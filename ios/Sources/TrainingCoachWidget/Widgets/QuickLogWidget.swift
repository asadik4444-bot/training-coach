import AppIntents
import SwiftUI
import WidgetKit

struct QuickLogWidget: Widget {
    private let kind = "QuickLogWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SharedDataProvider()) { entry in
            QuickLogWidgetView(entry: entry)
        }
        .configurationDisplayName("Quick Log")
        .description("Log weight or mark today's training done.")
        .supportedFamilies([.systemMedium])
    }
}

private struct QuickLogWidgetView: View {
    let entry: TrainingEntry

    private var bandColor: Color {
        entry.recoveryBand?.color ?? .textMuted
    }

    var body: some View {
        HStack(spacing: 16) {
            recoverySummary
                .frame(maxWidth: .infinity, alignment: .leading)

            actionButtons
                .frame(width: 126)
        }
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color.bgCard, Color.bg], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        .overlay {
            ContainerRelativeShape()
                .stroke(Color.border, lineWidth: 0.5)
        }
    }

    private var recoverySummary: some View {
        ZStack(alignment: .leading) {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [bandColor.opacity(0.44), .clear],
                        center: .center,
                        startRadius: 4,
                        endRadius: 76
                    )
                )
                .frame(width: 112, height: 112)
                .blur(radius: 9)

            VStack(alignment: .leading, spacing: 7) {
                Text("Recovery")
                    .font(.captionApp)
                    .foregroundStyle(Color.textMuted)

                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(entry.bandEmoji)
                        .font(.system(size: 34))
                        .shadow(color: bandColor.opacity(0.5), radius: 10)
                        .accessibilityHidden(true)

                    Text(entry.recoveryPercentText)
                        .font(.firaCode(40, weight: .semibold).monospacedDigit())
                        .foregroundStyle(Color.text)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(entry.recoveryAccessibilityLabel)
    }

    private var actionButtons: some View {
        VStack(spacing: 10) {
            Button(intent: MarkDoneIntent()) {
                actionLabel("Done", systemImage: "checkmark.circle.fill")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Mark today's training as done")

            Button(intent: LogWeightIntent()) {
                actionLabel("Weigh", systemImage: "scalemass")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Log weight from widget")
        }
    }

    private func actionLabel(_ title: LocalizedStringKey, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.firaSans(13, weight: .semibold))
            .foregroundStyle(Color.text)
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(Color.primary, in: Capsule())
            .contentShape(Capsule())
    }
}
