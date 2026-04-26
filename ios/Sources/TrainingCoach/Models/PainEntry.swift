import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct PainEntry: Decodable, Equatable, Hashable, Sendable {
    let area: String
    let severity: Int
    let note: String?
    let ts: Date

    private enum CodingKeys: String, CodingKey {
        case area
        case severity
        case note
        case ts
    }
}
