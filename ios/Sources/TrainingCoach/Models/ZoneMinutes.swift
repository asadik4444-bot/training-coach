import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct ZoneMinutes: Decodable, Equatable, Hashable, Sendable {
    let z0: Int
    let z1: Int
    let z2: Int
    let z3: Int
    let z4: Int
    let z5: Int

    private enum CodingKeys: String, CodingKey {
        case z0
        case z1
        case z2
        case z3
        case z4
        case z5
    }
}
