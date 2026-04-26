import Foundation
import SwiftUI

struct DecisionCard: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var accentPulse = false

    let decision: Decision?

    private var borderColor: Color {
        if decision?.isRed == true || decision?.hardStop == true {
            return Color.recoveryRed.opacity(0.6)
        }

        return Color.border.opacity(0.35)
    }

    var body: some View {
        ZStack(alignment: .leading) {
            if showsHardStopAccent {
                Rectangle()
                    .fill(Color.recoveryRed)
                    .frame(width: 4)
                    .frame(maxHeight: .infinity)
                    .brightness(reduceMotion ? 0 : (accentPulse ? 0.04 : 0))
                    .accessibilityHidden(true)
            }

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

                decisionHero

                Text(reasonText)
                    .font(.firaSans(14))
                    .italic()
                    .foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.leading, showsHardStopAccent ? 10 : 0)
            .padding(18)
        }
        .frame(maxWidth: .infinity, minHeight: 168, alignment: .leading)
        .todayCardStyle()
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(borderColor, lineWidth: decision?.isRed == true || decision?.hardStop == true ? 1 : 0)
        }
        .task(id: showsHardStopAccent) {
            guard showsHardStopAccent, !reduceMotion else {
                accentPulse = false
                return
            }

            withAnimation(.easeInOut(duration: 1.15).repeatForever(autoreverses: true)) {
                accentPulse = true
            }
        }
        .onChange(of: reduceMotion) { _, isReduced in
            guard isReduced else {
                return
            }

            accentPulse = false
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Today's decision")
        .accessibilityValue(accessibilityValue)
    }

    private var decisionHero: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            if decision?.hardStop == true {
                Image(systemName: "hand.raised.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.recoveryRed)
                    .accessibilityHidden(true)
            }

            Text(heroText)
                .font(.firaSans(36, weight: .semibold))
                .foregroundStyle(decisionColor)
                .lineLimit(1)
                .minimumScaleFactor(0.62)
        }
    }

    private var heroText: String {
        guard let decision else {
            return "NO DECISION"
        }

        return decision.title
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

    private var showsHardStopAccent: Bool {
        decision?.isRed == true && decision?.hardStop == true
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
