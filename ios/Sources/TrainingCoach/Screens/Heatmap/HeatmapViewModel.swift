import Foundation
import Observation

@MainActor
@Observable
final class HeatmapViewModel {
    private let client: APIClient = APIClient(secretProvider: { @Sendable in
        await MainActor.run {
            KeychainStore.currentSecret()
        }
    })

    var state: LoadState<HeatmapData> = .loading

    func load() async {
        state = .loading

        do {
            let exportData = try await client.getExport()
            let response = try JSONDecoder.trainingCoach.decode(ExportResponse.self, from: exportData)
            let heatmapData = buildHeatmapData(from: response)

            if heatmapData.cells.contains(where: { $0.entry != nil }) {
                state = .success(heatmapData)
            } else {
                state = .empty
            }
        } catch {
            state = .error(appError(from: error))
        }
    }

    private func buildHeatmapData(from response: ExportResponse) -> HeatmapData {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let startDate = calendar.date(byAdding: .day, value: -89, to: today) ?? today

        var entriesByDate: [String: ExportEntry] = [:]
        for entry in response.entries {
            entriesByDate[entry.date] = entry
        }

        let cells = (0..<90).compactMap { offset -> HeatmapCell? in
            guard let date = calendar.date(byAdding: .day, value: offset, to: startDate) else {
                return nil
            }

            let dateString = Self.dateString(from: date, calendar: calendar)
            let entry = entriesByDate[dateString]
            let score = entry?.snapshot.recovery?.score

            return HeatmapCell(
                id: dateString,
                date: dateString,
                score: score,
                entry: entry
            )
        }

        return HeatmapData(cells: cells)
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

    private static func dateString(from date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let year = components.year ?? 0
        let month = components.month ?? 1
        let day = components.day ?? 1

        return String(format: "%04d-%02d-%02d", year, month, day)
    }
}
