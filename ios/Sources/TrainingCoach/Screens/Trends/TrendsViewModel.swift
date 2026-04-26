import Foundation
import Observation

@MainActor
@Observable
final class TrendsViewModel {
    var window: TrendWindow = .thirtyDays
    var state: LoadState<TrendsData> = .loading

    private let client: APIClient = APIClient(secretProvider: { @Sendable in
        await MainActor.run {
            KeychainStore.currentSecret()
        }
    })

    func load() async {
        let requestedWindow = window
        let apiClient = client
        state = .loading

        do {
            async let hrv = apiClient.getTrend(metric: .hrv, days: requestedWindow.days)
            async let rhr = apiClient.getTrend(metric: .rhr, days: requestedWindow.days)
            async let sleep = apiClient.getTrend(metric: .sleep, days: requestedWindow.days)
            async let strain = apiClient.getTrend(metric: .strain, days: requestedWindow.days)

            let trends = try await TrendsData(hrv: hrv, rhr: rhr, sleep: sleep, strain: strain)

            guard requestedWindow == window else {
                return
            }

            state = trends.isEmpty ? .empty : .success(trends)
        } catch {
            guard requestedWindow == window else {
                return
            }

            state = .error(appError(from: error))
        }
    }

    private func appError(from error: Error) -> AppError {
        guard let apiError = error as? APIError else {
            return AppError(message: "Unable to load trends.", statusCode: nil)
        }

        switch apiError {
        case .unauthorized:
            return AppError(message: "Session expired. Reconnect your dashboard secret.", statusCode: 401)
        case .network:
            return AppError(message: "Network connection failed. Try again.", statusCode: nil)
        case .decode:
            return AppError(message: "Trend data could not be read.", statusCode: nil)
        case .upstream(let status):
            return AppError(message: "Server returned status \(status).", statusCode: status)
        case .notConfigured:
            return AppError(message: "Dashboard secret is missing.", statusCode: 401)
        }
    }
}

private extension TrendsData {
    var isEmpty: Bool {
        hrv.points.isEmpty && rhr.points.isEmpty && sleep.points.isEmpty && strain.points.isEmpty
    }
}
