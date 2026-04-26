import SwiftUI

/// Recovery score color bands.
///
/// Any animation using band colors must check `@Environment(\.accessibilityReduceMotion)`
/// and skip transitions when it is `true`.
enum RecoveryBand: Hashable {
    case green
    case yellow
    case red

    var color: Color {
        switch self {
        case .green:
            return .recoveryGreen
        case .yellow:
            return .recoveryYellow
        case .red:
            return .recoveryRed
        }
    }

    var emoji: String {
        switch self {
        case .green:
            return "🟢"
        case .yellow:
            return "🟡"
        case .red:
            return "🔴"
        }
    }

    var threshold: ClosedRange<Int> {
        switch self {
        case .green:
            return 67...100
        case .yellow:
            return 34...66
        case .red:
            return 0...33
        }
    }

    static func from(score: Int) -> RecoveryBand {
        let boundedScore = min(max(score, 0), 100)

        switch boundedScore {
        case green.threshold:
            return .green
        case yellow.threshold:
            return .yellow
        default:
            return .red
        }
    }
}
