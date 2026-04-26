import Foundation

struct TodayData: Sendable, Equatable {
    let day: Day
    let decision: Decision?
    let hrvSparkline: TrendResponse
}
