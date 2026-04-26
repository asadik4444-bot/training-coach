import Foundation

struct TrendsData: Sendable {
    let hrv: TrendResponse
    let rhr: TrendResponse
    let sleep: TrendResponse
    let strain: TrendResponse
}
