import Foundation

struct BodyData: Sendable {
    let weight: BodyMetric?
    let bodyFatPct: Double?
    let rhrTrend: TrendResponse
    let sleepTrend: TrendResponse
}

struct BodyMetric: Sendable {
    let latest: Double
    let series: [(date: Date, value: Double)]
    let unit: String
    let weekDelta: Double?
}
