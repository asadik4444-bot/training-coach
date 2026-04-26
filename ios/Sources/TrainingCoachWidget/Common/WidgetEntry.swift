import Foundation
import WidgetKit

struct TrainingEntry: TimelineEntry, Hashable, Sendable {
    let date: Date
    let recoveryScore: Int?
    let band: RecoveryBand?
    let last28Scores: [Int?]
    let todayPlan: String?
}

extension TrainingEntry {
    static let emptyLast28Scores = [Int?](repeating: nil, count: 28)

    static var placeholder: TrainingEntry {
        TrainingEntry(
            date: Date(),
            recoveryScore: 78,
            band: .green,
            last28Scores: [
                62, 65, 71, 74, 68, 58, 52,
                55, 61, 69, 73, 76, 64, 48,
                44, 51, 59, 66, 72, 79, 81,
                77, 70, 63, 58, 67, 74, 78
            ],
            todayPlan: "Today's plan"
        )
    }

    static func unavailable(date: Date = Date()) -> TrainingEntry {
        TrainingEntry(
            date: date,
            recoveryScore: nil,
            band: nil,
            last28Scores: emptyLast28Scores,
            todayPlan: "Today's plan"
        )
    }

    var normalizedLast28Scores: [Int?] {
        if last28Scores.count == 28 {
            return last28Scores
        }

        if last28Scores.count > 28 {
            return Array(last28Scores.suffix(28))
        }

        return [Int?](repeating: nil, count: 28 - last28Scores.count) + last28Scores
    }

    var recoveryBand: RecoveryBand? {
        band ?? recoveryScore.map(RecoveryBand.from(score:))
    }

    var recoveryPercentText: String {
        guard let recoveryScore else { return "--%" }
        return "\(recoveryScore)%"
    }

    var bandEmoji: String {
        recoveryBand?.emoji ?? "⚪️"
    }

    var bandName: String {
        recoveryBand?.widgetAccessibilityName ?? "unknown"
    }

    var recoveryAccessibilityLabel: String {
        guard let recoveryScore else {
            return "Recovery: unavailable, band unknown"
        }

        return "Recovery: \(recoveryScore)%, band \(bandName)"
    }
}

private extension RecoveryBand {
    var widgetAccessibilityName: String {
        switch self {
        case .green:
            return "green"
        case .yellow:
            return "yellow"
        case .red:
            return "red"
        }
    }
}
