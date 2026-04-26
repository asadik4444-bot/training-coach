import SwiftUI
import WidgetKit

struct LockScreenRecoveryWidget: Widget {
    private let kind = "LockScreenRecoveryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SharedDataProvider()) { entry in
            LockScreenRecoveryWidgetView(entry: entry)
        }
        .configurationDisplayName("Recovery")
        .description("Glanceable recovery for the Lock Screen.")
        .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

private struct LockScreenRecoveryWidgetView: View {
    @Environment(\.widgetFamily) private var family

    let entry: TrainingEntry

    var body: some View {
        content
            .containerBackground(for: .widget) {
                LinearGradient(colors: [Color.bgCard, Color.bg], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
            .overlay {
                ContainerRelativeShape()
                    .stroke(Color.border, lineWidth: 0.5)
            }
            .widgetAccentable()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(entry.recoveryAccessibilityLabel)
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryCircular:
            circularContent
        case .accessoryInline:
            inlineContent
        default:
            rectangularContent
        }
    }

    private var rectangularContent: some View {
        HStack(spacing: 8) {
            accentedBandMark(size: 18)

            VStack(alignment: .leading, spacing: 1) {
                Text("Recovery")
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)

                Text(entry.recoveryPercentText)
                    .font(.firaCode(22, weight: .semibold).monospacedDigit())
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 6)
    }

    private var circularContent: some View {
        VStack(spacing: 2) {
            accentedBandMark(size: 14)

            Text(entry.recoveryPercentText)
                .font(.firaCode(15, weight: .semibold).monospacedDigit())
                .foregroundStyle(Color.text)
                .lineLimit(1)
                .minimumScaleFactor(0.64)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var inlineContent: some View {
        Text("\(entry.bandEmoji) \(entry.recoveryPercentText)")
            .font(.firaCode(13, weight: .medium).monospacedDigit())
            .foregroundStyle(Color.text)
            .lineLimit(1)
    }

    @ViewBuilder
    private func accentedBandMark(size: CGFloat) -> some View {
        Text(entry.bandEmoji)
            .font(.system(size: size))
            .accessibilityHidden(true)
    }
}
