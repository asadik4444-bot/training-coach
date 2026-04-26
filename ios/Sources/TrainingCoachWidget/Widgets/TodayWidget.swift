import SwiftUI
import WidgetKit

struct TodayWidget: Widget {
    private let kind = "TodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SharedDataProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Recovery and today's plan.")
        .supportedFamilies([.systemMedium])
    }
}

private struct TodayWidgetView: View {
    let entry: TrainingEntry

    private var bandColor: Color {
        entry.recoveryBand?.color ?? .textMuted
    }

    var body: some View {
        HStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [bandColor.opacity(0.42), .clear],
                            center: .center,
                            startRadius: 4,
                            endRadius: 72
                        )
                    )
                    .blur(radius: 8)

                Text(entry.bandEmoji)
                    .font(.system(size: 54))
                    .shadow(color: bandColor.opacity(0.5), radius: 12)
                    .accessibilityHidden(true)
            }
            .frame(width: 88, height: 88)

            VStack(alignment: .leading, spacing: 8) {
                Text("Recovery")
                    .font(.captionApp)
                    .foregroundStyle(Color.textMuted)

                Text(entry.recoveryPercentText)
                    .font(.firaCode(44, weight: .semibold).monospacedDigit())
                    .foregroundStyle(Color.text)
                    .minimumScaleFactor(0.72)
                    .lineLimit(1)

                Text(entry.todayPlan ?? "Today's plan")
                    .font(.firaSans(16, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
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
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(entry.recoveryAccessibilityLabel)
    }
}
