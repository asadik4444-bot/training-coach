import Foundation

struct WorkoutItem: Identifiable, Hashable, Sendable {
    let id: String
    let date: String
    let workout: Workout
    let recoveryScore: Int?

    init(date: String, workout: Workout, recoveryScore: Int?) {
        self.id = "\(date)-\(workout.sport)"
        self.date = date
        self.workout = workout
        self.recoveryScore = recoveryScore
    }
}
