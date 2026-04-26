import Foundation
import Observation

@MainActor
@Observable
final class WorkoutsViewModel {
    private let client: APIClient = APIClient(secretProvider: { @Sendable in
        await MainActor.run {
            KeychainStore.currentSecret()
        }
    })

    var state: LoadState<[WorkoutItem]> = .loading

    func load() async {
        state = .loading

        do {
            let data = try await client.getExport()
            let export = try JSONDecoder.trainingCoach.decode(ExportResponse.self, from: data)
            let items = export.entries
                .compactMap { entry -> WorkoutItem? in
                    guard let workout = entry.snapshot.lastWorkout else {
                        return nil
                    }

                    return WorkoutItem(
                        date: entry.date,
                        workout: workout,
                        recoveryScore: entry.snapshot.recovery?.score
                    )
                }
                .sorted { lhs, rhs in
                    lhs.workout.start > rhs.workout.start
                }

            state = items.isEmpty ? .empty : .success(items)
        } catch {
            state = .error(appError(from: error))
        }
    }

    private func appError(from error: Error) -> AppError {
        if let apiError = error as? APIError {
            switch apiError {
            case .unauthorized:
                return AppError(
                    message: "Session expired. Re-enter your dashboard secret.",
                    statusCode: 401
                )
            case .network:
                return AppError(
                    message: "Network unavailable. Check your connection and try again.",
                    statusCode: nil
                )
            case .decode:
                return AppError(
                    message: "Could not read workout history from the export.",
                    statusCode: nil
                )
            case .upstream(let status):
                return AppError(
                    message: "Server returned \(status). Try again shortly.",
                    statusCode: status
                )
            case .notConfigured:
                return AppError(
                    message: "Dashboard secret is missing. Reconnect before loading workouts.",
                    statusCode: 401
                )
            }
        }

        if error is DecodingError {
            return AppError(
                message: "Could not read workout history from the export.",
                statusCode: nil
            )
        }

        return AppError(
            message: "Could not load workouts. Try again.",
            statusCode: nil
        )
    }
}
