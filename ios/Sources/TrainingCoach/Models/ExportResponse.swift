import Foundation

struct ExportResponse: Decodable, Equatable, Sendable {
    let ok: Bool
    let months: [String]
    let count: Int
    let entries: [ExportEntry]
}

struct ExportEntry: Decodable, Equatable, Sendable {
    let date: String
    let snapshot: Biometrics
    let decision: Decision?

    private enum CodingKeys: String, CodingKey {
        case date
        case snapshot
        case decision
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        date = try container.decode(String.self, forKey: .date)
        decision = try container.decodeIfPresent(Decision.self, forKey: .decision)

        let snapshotPayload = try container.decode(ExportSnapshotPayload.self, forKey: .snapshot)
        snapshot = Biometrics(
            date: snapshotPayload.date ?? date,
            recovery: snapshotPayload.recovery,
            sleep: snapshotPayload.sleep,
            cycle: snapshotPayload.cycle,
            lastWorkout: snapshotPayload.lastWorkout
        )
    }
}

struct Decision: Decodable, Equatable, Hashable, Sendable {
    let band: String
    let reason: String
    let hardStop: Bool
    let intensityMultiplier: Double

    private enum CodingKeys: String, CodingKey {
        case band
        case reason
        case hardStop = "hard_stop"
        case intensityMultiplier = "intensity_multiplier"
    }
}

private struct ExportSnapshotPayload: Decodable {
    let date: String?
    let recovery: Recovery?
    let sleep: Sleep?
    let cycle: Cycle?
    let lastWorkout: Workout?

    private enum CodingKeys: String, CodingKey {
        case date
        case recovery
        case sleep
        case cycle
        case lastWorkout = "last_workout"
    }
}
