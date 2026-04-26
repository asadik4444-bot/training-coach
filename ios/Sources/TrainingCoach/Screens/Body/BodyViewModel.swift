import Foundation
import HealthKit
import Observation

@MainActor
@Observable
final class BodyViewModel {
    private let client: APIClient = APIClient(secretProvider: { @Sendable in
        await MainActor.run {
            KeychainStore.currentSecret()
        }
    })
    private let healthKit = HealthKitClient.shared

    var state: LoadState<BodyData> = .loading
    var hkAuthStatus: HKAuthorizationStatus = .notDetermined
    var isHealthKitAvailable = HKHealthStore.isHealthDataAvailable()

    func requestHealthKit() async throws {
        try await healthKit.requestAccess()
        hkAuthStatus = await healthKit.authorizationStatus()
    }

    func load() async {
        state = .loading
        isHealthKitAvailable = healthKit.isAvailable

        async let authorizationStatus = healthKitStatus(available: isHealthKitAvailable)
        async let weightSamples = bodyMassSamples(available: isHealthKitAvailable)
        async let bodyFatSample = bodyFatSample(available: isHealthKitAvailable)
        async let rhrTrend = client.getTrend(metric: .rhr, days: 30)
        async let sleepTrend = client.getTrend(metric: .sleep, days: 30)

        do {
            let (status, weights, bodyFat, rhr, sleep) = try await (
                authorizationStatus,
                weightSamples,
                bodyFatSample,
                rhrTrend,
                sleepTrend
            )

            hkAuthStatus = resolvedHealthKitStatus(status, weights: weights, bodyFat: bodyFat)

            let weight = metric(from: weights, unit: "kg") { sample in
                sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
            }
            let bodyFatPct = bodyFat.map {
                $0.quantity.doubleValue(for: .percent()) * 100
            }
            let data = BodyData(
                weight: weight,
                bodyFatPct: bodyFatPct,
                rhrTrend: rhr,
                sleepTrend: sleep
            )

            state = data.hasAnyData ? .success(data) : .empty
        } catch {
            state = .error(appError(from: error))
        }
    }

    func rhrMetric(from trend: TrendResponse) -> BodyMetric? {
        metric(from: trend, unit: "bpm")
    }

    func sleepMetric(from trend: TrendResponse) -> BodyMetric? {
        metric(from: trend, unit: "%")
    }

    private func healthKitStatus(available: Bool) async -> HKAuthorizationStatus {
        guard available else {
            return .sharingDenied
        }

        return await healthKit.authorizationStatus()
    }

    private func bodyMassSamples(available: Bool) async -> [HKQuantitySample] {
        guard available else {
            return []
        }

        do {
            return try await healthKit.bodyMassKg()
        } catch {
            return []
        }
    }

    private func bodyFatSample(available: Bool) async -> HKQuantitySample? {
        guard available else {
            return nil
        }

        do {
            return try await healthKit.bodyFatPercentage()
        } catch {
            return nil
        }
    }

    private func resolvedHealthKitStatus(
        _ status: HKAuthorizationStatus,
        weights: [HKQuantitySample],
        bodyFat: HKQuantitySample?
    ) -> HKAuthorizationStatus {
        guard status != .sharingAuthorized,
              weights.isEmpty == false || bodyFat != nil
        else {
            return status
        }

        return .sharingAuthorized
    }

    private func metric(
        from samples: [HKQuantitySample],
        unit: String,
        value: (HKQuantitySample) -> Double
    ) -> BodyMetric? {
        let series = samples
            .sorted { $0.startDate < $1.startDate }
            .map { sample in
                (date: sample.startDate, value: value(sample))
            }
            .filter { $0.value.isFinite }

        guard let latest = series.last else {
            return nil
        }

        return BodyMetric(
            latest: latest.value,
            series: series,
            unit: unit,
            weekDelta: weekDelta(for: series)
        )
    }

    private func metric(from trend: TrendResponse, unit: String) -> BodyMetric? {
        let series = trend.points.compactMap { point -> (date: Date, value: Double)? in
            guard let date = Self.date(from: point.date), point.value.isFinite else {
                return nil
            }

            return (date: date, value: point.value)
        }
        .sorted { $0.date < $1.date }

        guard let latest = series.last else {
            return nil
        }

        return BodyMetric(
            latest: latest.value,
            series: series,
            unit: unit,
            weekDelta: weekDelta(for: series)
        )
    }

    private func weekDelta(for series: [(date: Date, value: Double)]) -> Double? {
        guard let latest = series.last,
              let weekAgo = Calendar.current.date(byAdding: .day, value: -7, to: latest.date),
              let baseline = series.reversed().first(where: { $0.date <= weekAgo })
        else {
            return nil
        }

        return latest.value - baseline.value
    }

    private func appError(from error: Error) -> AppError {
        if let apiError = error as? APIError {
            switch apiError {
            case .unauthorized:
                return AppError(message: "Dashboard authorization failed.", statusCode: 401)
            case .network:
                return AppError(message: "Network request failed. Pull to refresh or try again.", statusCode: nil)
            case .decode(let detail):
                return AppError(message: "Could not decode body trend data: \(detail)", statusCode: nil)
            case .upstream(let status):
                return AppError(message: "Server returned status \(status).", statusCode: status)
            case .notConfigured:
                return AppError(message: "Dashboard secret is missing.", statusCode: 401)
            }
        }

        return AppError(message: error.localizedDescription, statusCode: nil)
    }

    private static func date(from string: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"

        if let date = formatter.date(from: string) {
            return date
        }

        return ISO8601DateFormatter().date(from: string)
    }
}

private extension BodyData {
    var hasAnyData: Bool {
        weight != nil ||
        bodyFatPct != nil ||
        rhrTrend.points.isEmpty == false ||
        sleepTrend.points.isEmpty == false
    }
}
