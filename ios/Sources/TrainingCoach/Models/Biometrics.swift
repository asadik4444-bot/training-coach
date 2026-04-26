import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct Biometrics: Decodable, Equatable, Hashable, Sendable {
    let date: String
    let recovery: Recovery?
    let sleep: Sleep?
    let cycle: Cycle?
    let lastWorkout: Workout?

    private enum CodingKeys: String, CodingKey {
        case date
        case recovery
        case sleep
        case cycle
        case lastWorkout = "last_workout"
    }
}
