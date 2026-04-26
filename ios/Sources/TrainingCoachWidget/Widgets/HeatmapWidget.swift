import SwiftUI
import WidgetKit

struct HeatmapWidget: Widget {
    private let kind = "HeatmapWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SharedDataProvider()) { entry in
            HeatmapWidgetView(entry: entry)
        }
        .configurationDisplayName("Recovery Heatmap")
        .description("Four weeks of recovery scores.")
        .supportedFamilies([.systemLarge])
    }
}

private struct HeatmapWidgetView: View {
    let entry: TrainingEntry

    private var bandColor: Color {
        entry.recoveryBand?.color ?? .textMuted
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center, spacing: 12) {
                Text(entry.bandEmoji)
                    .font(.system(size: 38))
                    .shadow(color: bandColor.opacity(0.5), radius: 10)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Recovery")
                        .font(.captionApp)
                        .foregroundStyle(Color.textMuted)

                    Text(entry.recoveryPercentText)
                        .font(.firaCode(36, weight: .semibold).monospacedDigit())
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                }

                Spacer()

                Text("4 weeks")
                    .font(.firaCode(12, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.textDim)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.bgSurface.opacity(0.8), in: Capsule())
            }

            RecoveryHeatmapGrid(scores: entry.normalizedLast28Scores)
        }
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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

private struct RecoveryHeatmapGrid: View {
    let scores: [Int?]

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(Array(scores.enumerated()), id: \.offset) { offset, score in
                RecoveryHeatmapCell(score: score, isToday: offset == scores.count - 1)
            }
        }
    }
}

private struct RecoveryHeatmapCell: View {
    let score: Int?
    let isToday: Bool

    private var fill: Color {
        guard let score else {
            return Color.bgSurface.opacity(0.78)
        }

        let band = RecoveryBand.from(score: score)
        let intensity = 0.32 + (Double(score) / 100.0 * 0.46)
        return band.color.opacity(intensity)
    }

    var body: some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(fill)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .stroke(isToday ? Color.white : Color.border.opacity(0.45), lineWidth: isToday ? 2 : 0.5)
            }
            .shadow(color: score.map { RecoveryBand.from(score: $0).color.opacity(0.28) } ?? .clear, radius: isToday ? 4 : 0)
            .accessibilityHidden(true)
    }
}
