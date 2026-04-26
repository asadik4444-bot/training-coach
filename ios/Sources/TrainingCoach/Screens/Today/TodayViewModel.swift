import Foundation
import Observation

@MainActor
@Observable
final class TodayViewModel {
    private let client: APIClient = APIClient(
        secretProvider: { @Sendable in await MainActor.run { KeychainStore.currentSecret() } }
    )
    var state: LoadState<TodayData> = .loading

    func load() async {
        state = .loading
        let today = ISO8601DateFormatter().string(from: Date()).prefix(10)
        do {
            async let dayTask = client.getDay(date: String(today))
            async let exportTask = client.getExport()
            async let hrvTrendTask = client.getTrend(metric: .hrv, days: 7)
            let (day, exportData, hrvTrend) = try await (dayTask, exportTask, hrvTrendTask)

            let decoded = try JSONDecoder.trainingCoach.decode(ExportResponse.self, from: exportData)
            let todayEntry = decoded.entries.first(where: { $0.date == String(today) })

            state = .success(TodayData(day: day, decision: todayEntry?.decision, hrvSparkline: hrvTrend))
        } catch let api as APIError {
            let status: Int? = if case .upstream(let s) = api { s } else { nil }
            state = .error(AppError(message: api.localizedDescription, statusCode: status))
        } catch {
            state = .error(.network(error.localizedDescription))
        }
    }
}
