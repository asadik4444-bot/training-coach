import ActivityKit
import Foundation

struct TrainingActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable, Sendable {
        let recoveryScore: Int
        let band: String
        let todayPlan: String
        let windowEnd: Date
    }

    let userId: String
}
