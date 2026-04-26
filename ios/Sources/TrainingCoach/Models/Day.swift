import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct Day: Decodable, Equatable, Hashable, Sendable {
    let date: String
    let biometrics: Biometrics?
    let done: DoneEntry?
    let pain: [PainEntry]
    let protein: Bool?
    let bedtime: String?
    let log: [DailyLogEntry]

    private enum CodingKeys: String, CodingKey {
        case date
        case biometrics
        case done
        case pain
        case protein
        case bedtime
        case log
    }
}
