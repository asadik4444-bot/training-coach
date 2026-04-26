import Foundation
import SwiftUI

struct DecisionCard: View {
    let decision: Decision?

    private var borderColor: Color {
        if decision?.isRed == true || decision?.hardStop == true {
            return Color.recoveryRed.opacity(0.6)
        }

        return Color.border.opacity(0.35)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("TODAY'S DECISION")
                    .font(.firaSans(11, weight: .medium))
                    .foregroundStyle(Color.textMuted)

                Spacer()

                Text(multiplierText)
                    .font(.firaCode(14, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.textDim)
            }

            Text(heroText)
                .font(.firaSans(36, weight: .semibold))
                .foregroundStyle(decisionColor)
                .lineLimit(1)
                .minimumScaleFactor(0.62)

            Text(reasonText)
                .font(.firaSans(14))
                .italic()
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .todayCardStyle()
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(borderColor, lineWidth: decision?.isRed == true || decision?.hardStop == true ? 1 : 0)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Today's decision")
        .accessibilityValue(accessibilityValue)
    }

    private var heroText: String {
        guard let decision else {
            return "NO DECISION"
        }

        let stopPrefix = decision.hardStop ? "🛑 " : ""
        return "\(stopPrefix)\(decision.title)"
    }

    private var reasonText: String {
        decision?.reason ?? "Decision will appear after today's data sync."
    }

    private var decisionColor: Color {
        decision?.color ?? Color.textDim
    }

    private var multiplierText: String {
        guard let decision else {
            return "--"
        }

        return String(format: "%.0f%%", decision.intensityMultiplier * 100)
    }

    private var accessibilityValue: String {
        guard let decision else {
            return "No decision available"
        }

        let hardStop = decision.hardStop ? "Hard stop. " : ""
        return "\(hardStop)\(decision.title), \(reasonText), intensity \(multiplierText)"
    }
}

private extension Decision {
    var normalizedBand: String {
        band.lowercased()
    }

    var isRed: Bool {
        normalizedBand == "red"
    }

    var title: String {
        switch normalizedBand {
        case "red":
            "REST DAY"
        case "yellow":
            "EASY"
        case "green":
            "GO"
        default:
            "CHECK IN"
        }
    }

    var color: Color {
        switch normalizedBand {
        case "red":
            Color.recoveryRed
        case "yellow":
            Color.recoveryYellow
        case "green":
            Color.recoveryGreen
        default:
            Color.textDim
        }
    }
}
