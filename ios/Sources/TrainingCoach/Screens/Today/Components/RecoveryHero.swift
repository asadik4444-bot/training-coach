import SwiftUI

struct RecoveryHero: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    let score: Int?

    private var band: RecoveryBand? {
        score.map(RecoveryBand.from(score:))
    }

    private var color: Color {
        band?.color ?? Color.textDim
    }

    var body: some View {
        VStack(spacing: 10) {
            Text(scoreText)
                .font(.firaCode(80, weight: .semibold).monospacedDigit())
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.62)
                .shadow(color: color.opacity(0.45), radius: reduceMotion ? 16 : (pulse ? 22 : 16), y: 0)
                .scaleEffect(reduceMotion ? 1 : (pulse ? 1.018 : 1))

            Text("\(band?.emoji ?? "○") \(bandLabel)")
                .font(.firaSans(14, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .tracking(1.2)
        }
        .frame(maxWidth: .infinity, minHeight: 188)
        .padding(.vertical, 24)
        .todayCardStyle()
        .task {
            guard !reduceMotion else {
                return
            }

            withAnimation(.easeInOut(duration: 1.55).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Recovery")
        .accessibilityValue(accessibilityValue)
    }

    private var scoreText: String {
        guard let score else {
            return "--%"
        }

        return "\(score)%"
    }

    private var bandLabel: String {
        switch band {
        case .green:
            "GREEN"
        case .yellow:
            "YELLOW"
        case .red:
            "RED"
        case .none:
            "UNKNOWN"
        }
    }

    private var accessibilityValue: String {
        guard let score else {
            return "No recovery score"
        }

        return "\(score) percent, \(bandLabel.lowercased())"
    }
}
