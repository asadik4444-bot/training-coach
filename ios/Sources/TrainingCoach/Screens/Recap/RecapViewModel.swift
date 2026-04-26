import Foundation
import Observation

enum RecapPeriod: String, Identifiable, Sendable, Hashable {
    case week
    case month

    var id: String { rawValue }

    var days: Int {
        switch self {
        case .week:
            7
        case .month:
            30
        }
    }

    var periodLabel: String {
        switch self {
        case .week:
            "WEEK RECAP"
        case .month:
            "MONTH RECAP"
        }
    }

    var detailLabel: String {
        switch self {
        case .week:
            "LAST 7 DAYS"
        case .month:
            "LAST 30 DAYS"
        }
    }

    var symbolName: String {
        switch self {
        case .week:
            "calendar.badge.clock"
        case .month:
            "calendar"
        }
    }
}

@MainActor
@Observable
final class RecapViewModel {
    private let client: APIClient

    var weekState: LoadState<RecapData> = .loading
    var monthState: LoadState<RecapData> = .loading

    init(
        client: APIClient = APIClient(
            secretProvider: { @Sendable in await MainActor.run { KeychainStore.currentSecret() } }
        )
    ) {
        self.client = client
    }

    func loadWeek() async {
        weekState = .loading
        await load(period: .week)
    }

    func loadMonth() async {
        monthState = .loading
        await load(period: .month)
    }

    private func load(period: RecapPeriod) async {
        do {
            let exportData = try await client.getExport()
            let response = try JSONDecoder.trainingCoach.decode(ExportResponse.self, from: exportData)
            let data = buildRecapData(from: response, period: period)

            if data.recoveryPoints.isEmpty {
                setState(.empty, for: period)
            } else {
                setState(.success(data), for: period)
            }
        } catch {
            setState(.error(appError(from: error)), for: period)
        }
    }

    private func setState(_ state: LoadState<RecapData>, for period: RecapPeriod) {
        switch period {
        case .week:
            weekState = state
        case .month:
            monthState = state
        }
    }

    private func buildRecapData(from response: ExportResponse, period: RecapPeriod) -> RecapData {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let startDate = calendar.date(byAdding: .day, value: -(period.days - 1), to: today) ?? today
        let dateStrings = (0..<period.days).compactMap { offset -> String? in
            guard let date = calendar.date(byAdding: .day, value: offset, to: startDate) else {
                return nil
            }

            return Self.apiDateString(from: date, calendar: calendar)
        }

        let entriesByDate = Dictionary(response.entries.map { ($0.date, $0) }, uniquingKeysWith: { _, newest in newest })
        let entries = dateStrings.compactMap { entriesByDate[$0] }
        let recoveryScores = entries.compactMap { $0.snapshot.recovery?.score }
        let hrvValues = entries.compactMap { $0.snapshot.recovery?.hrvRmssdMs }
        let rhrValues = entries.compactMap { $0.snapshot.recovery?.rhrBpm }
        let sleepValues = entries.compactMap { $0.snapshot.sleep?.efficiencyPct }
        let recoveryPoints = dateStrings.compactMap { dateString -> (date: String, value: Int)? in
            guard let score = entriesByDate[dateString]?.snapshot.recovery?.score else {
                return nil
            }

            return (date: dateString, value: score)
        }
        let avgRecovery = Int((Self.average(recoveryScores) ?? 0).rounded())

        return RecapData(
            periodLabel: period.periodLabel,
            dateRange: Self.dateRangeString(from: startDate, to: today),
            avgRecovery: avgRecovery,
            avgHRV: Self.average(hrvValues) ?? 0,
            avgRHR: Int((Self.average(rhrValues.map(Double.init)) ?? 0).rounded()),
            avgSleepPct: Self.average(sleepValues) ?? 0,
            totalStrain: entries.reduce(0) { partialResult, entry in
                partialResult + (entry.snapshot.lastWorkout?.strain ?? 0)
            },
            recoveryPoints: recoveryPoints,
            band: RecoveryBand.from(score: avgRecovery)
        )
    }

    private func appError(from error: Error) -> AppError {
        if let apiError = error as? APIError {
            switch apiError {
            case .unauthorized:
                return .unauthorized
            case .network(let urlError):
                return .network(urlError.localizedDescription)
            case .decode(let reason):
                return .network("Could not decode export data. \(reason)")
            case .upstream(let status):
                return .network("Server returned status \(status).")
            case .notConfigured:
                return .unauthorized
            }
        }

        if error is DecodingError {
            return .network("Could not decode export data.")
        }

        return .network(error.localizedDescription)
    }

    private static func average<T: BinaryInteger>(_ values: [T]) -> Double? {
        guard !values.isEmpty else {
            return nil
        }

        let total = values.reduce(0.0) { $0 + Double($1) }
        return total / Double(values.count)
    }

    private static func average(_ values: [Double]) -> Double? {
        guard !values.isEmpty else {
            return nil
        }

        let total = values.reduce(0, +)
        return total / Double(values.count)
    }

    private static func apiDateString(from date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let year = components.year ?? 0
        let month = components.month ?? 1
        let day = components.day ?? 1

        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    private static func dateRangeString(from startDate: Date, to endDate: Date) -> String {
        let calendar = Calendar.current
        let monthDayFormatter = DateFormatter()
        monthDayFormatter.locale = Locale(identifier: "en_US_POSIX")
        monthDayFormatter.dateFormat = "MMM d"

        let fullFormatter = DateFormatter()
        fullFormatter.locale = Locale(identifier: "en_US_POSIX")
        fullFormatter.dateFormat = "MMM d, yyyy"

        if calendar.component(.year, from: startDate) == calendar.component(.year, from: endDate) {
            return "\(monthDayFormatter.string(from: startDate)) - \(fullFormatter.string(from: endDate))"
        }

        return "\(fullFormatter.string(from: startDate)) - \(fullFormatter.string(from: endDate))"
    }
}
