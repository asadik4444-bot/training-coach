import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct DoneEntry: Decodable, Equatable, Hashable, Sendable {
    let rpe: Int?
    let date: String
    let createdAt: Date

    private enum CodingKeys: String, CodingKey {
        case rpe
        case date
        case createdAt = "created_at"
    }
}
