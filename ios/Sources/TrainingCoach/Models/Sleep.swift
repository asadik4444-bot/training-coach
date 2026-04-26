import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct Sleep: Decodable, Equatable, Hashable, Sendable {
    let efficiencyPct: Double?
    let consistencyPct: Double?
    let performancePct: Double?
    let totalInBedMin: Int?
    let totalAwakeMin: Int?
    let totalLightMin: Int?
    let totalSwsMin: Int?
    let totalRemMin: Int?
    let respiratoryRate: Double?

    private enum CodingKeys: String, CodingKey {
        case efficiencyPct = "efficiency_pct"
        case consistencyPct = "consistency_pct"
        case performancePct = "performance_pct"
        case totalInBedMin = "total_in_bed_min"
        case totalAwakeMin = "total_awake_min"
        case totalLightMin = "total_light_min"
        case totalSwsMin = "total_sws_min"
        case totalRemMin = "total_rem_min"
        case respiratoryRate = "respiratory_rate"
    }
}
