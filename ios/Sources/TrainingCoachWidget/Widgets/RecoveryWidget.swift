import SwiftUI
import WidgetKit

struct RecoveryWidget: Widget {
    private let kind = "RecoveryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SharedDataProvider()) { entry in
            RecoveryWidgetView(entry: entry)
        }
        .configurationDisplayName("Recovery")
        .description("Current recovery score.")
        .supportedFamilies([.systemSmall])
    }
}

private struct RecoveryWidgetView: View {
    let entry: TrainingEntry

    private var bandColor: Color {
        entry.recoveryBand?.color ?? .textMuted
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [bandColor.opacity(0.48), .clear],
                        center: .center,
                        startRadius: 6,
                        endRadius: 86
                    )
                )
                .blur(radius: 10)

            VStack(spacing: 8) {
                Text(entry.bandEmoji)
                    .font(.system(size: 60))
                    .shadow(color: bandColor.opacity(0.55), radius: 14)
                    .accessibilityHidden(true)

                Text(entry.recoveryPercentText)
                    .font(.firaCode(34, weight: .semibold).monospacedDigit())
                    .foregroundStyle(Color.text)
                    .minimumScaleFactor(0.72)
                    .lineLimit(1)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color.bgCard, Color.bg], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        .overlay {
            ContainerRelativeShape()
                .stroke(Color.border, lineWidth: 0.5)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(entry.recoveryAccessibilityLabel)
    }
}
