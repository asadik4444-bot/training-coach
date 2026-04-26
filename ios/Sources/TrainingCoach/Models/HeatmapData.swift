import Foundation

struct HeatmapData: Sendable, Equatable {
    let cells: [HeatmapCell]
}

struct HeatmapCell: Identifiable, Sendable, Hashable {
    let id: String
    let date: String
    let score: Int?
    let entry: ExportEntry?

    var band: RecoveryBand? {
        guard let score else {
            return nil
        }

        return RecoveryBand.from(score: score)
    }

    static func == (lhs: HeatmapCell, rhs: HeatmapCell) -> Bool {
        lhs.id == rhs.id
            && lhs.date == rhs.date
            && lhs.score == rhs.score
            && lhs.entry?.date == rhs.entry?.date
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(date)
        hasher.combine(score)
        hasher.combine(entry?.date)
    }
}
