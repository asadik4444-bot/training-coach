import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct Workout: Decodable, Equatable, Hashable, Sendable {
    let sport: String
    let strain: Double?
    let avgHr: Int?
    let maxHr: Int?
    let zoneMinutes: ZoneMinutes
    let start: Date

    private enum CodingKeys: String, CodingKey {
        case sport
        case strain
        case avgHr = "avg_hr"
        case maxHr = "max_hr"
        case zoneMinutes = "zone_minutes"
        case start
    }
}
