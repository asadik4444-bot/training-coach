import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct Cycle: Decodable, Equatable, Hashable, Sendable {
    let strain: Double?
    let kilojoules: Double?
    let avgHr: Int?
    let maxHr: Int?

    private enum CodingKeys: String, CodingKey {
        case strain
        case kilojoules
        case avgHr = "avg_hr"
        case maxHr = "max_hr"
    }
}
