import Foundation

/// Sample: ios/specs/api-samples/day-2026-04-26.json
struct Recovery: Decodable, Equatable, Hashable, Sendable {
    let status: String
    let score: Int?
    let hrvRmssdMs: Double?
    let rhrBpm: Int?

    var band: RecoveryBand? {
        guard let score else { return nil }
        return RecoveryBand.from(score: score)
    }

    private enum CodingKeys: String, CodingKey {
        case status
        case score
        case hrvRmssdMs = "hrv_rmssd_ms"
        case rhrBpm = "rhr_bpm"
    }
}
