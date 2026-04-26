import Charts
import SwiftUI

struct MetricCard: View {
    let label: String
    let value: Double?
    let unit: String
    let weekDelta: Double?
    let sparklinePoints: [(date: Date, value: Double)]
    let color: Color
    let trendPreference: MetricTrendPreference
    let placeholder: String
    let valueFormat: FloatingPointFormatStyle<Double>
    let accessibilityLabelText: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var valueSize: CGFloat = 34
    @ScaledMetric(relativeTo: .body) private var unitSize: CGFloat = 14
    @ScaledMetric(relativeTo: .body) private var cardPadding: CGFloat = 18
    @ScaledMetric(relativeTo: .caption) private var chartHeight: CGFloat = 58

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.firaSans(13, weight: .semibold))
                    .foregroundStyle(Color.textMuted)
                    .textCase(.uppercase)

                Spacer(minLength: 12)

                DeltaBadge(delta: weekDelta, unit: unit, preference: trendPreference)
            }

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                if let value {
                    Text(value.formatted(valueFormat))
                        .font(.firaCode(valueSize, weight: .medium).monospacedDigit())
                        .foregroundStyle(valueColor)
                        .lineLimit(1)
                        .minimumScaleFactor(0.62)
                        .shadow(
                            color: glowColor,
                            radius: reduceMotion ? 0 : 14,
                            y: reduceMotion ? 0 : 4
                        )

                    Text(unit)
                        .font(.firaSans(unitSize, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                } else {
                    Text(placeholder)
                        .font(.body)
                        .foregroundStyle(Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Sparkline(points: sparklinePoints, color: valueColor)
                .frame(height: chartHeight)
        }
        .padding(cardPadding)
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.border.opacity(0.8), lineWidth: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabelText)
        .accessibilityValue(accessibilityValue)
        .accessibilityHint(accessibilityHint)
    }

    private var cardBackground: some ShapeStyle {
        LinearGradient(
            colors: [
                Color.bgCard.opacity(0.98),
                color.opacity(0.18),
                Color.bgSurface.opacity(0.92)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var valueColor: Color {
        guard let isGood = trendQuality else {
            return color
        }

        return isGood ? Color.recoveryGreen : Color.recoveryRed
    }

    private var glowColor: Color {
        switch trendQuality {
        case true:
            return Color.recoveryGreen.opacity(0.45)
        case false:
            return Color.recoveryRed.opacity(0.22)
        case nil:
            return color.opacity(0.18)
        }
    }

    private var trendQuality: Bool? {
        guard let weekDelta,
              abs(weekDelta) >= 0.01
        else {
            return nil
        }

        return trendPreference.isGood(delta: weekDelta)
    }

    private var accessibilityValue: String {
        guard let value else {
            return placeholder
        }

        return "\(value.formatted(valueFormat)) \(unit)"
    }

    private var accessibilityHint: String {
        guard let weekDelta else {
            return "No week over week change available."
        }

        let direction = weekDelta >= 0 ? "up" : "down"
        let magnitude = abs(weekDelta).formatted(.number.precision(.fractionLength(1)))
        return "Week over week \(direction) \(magnitude) \(unit)."
    }
}

enum MetricTrendPreference: Sendable {
    case higherIsBetter
    case lowerIsBetter
    case neutral

    func isGood(delta: Double) -> Bool? {
        switch self {
        case .higherIsBetter:
            return delta > 0
        case .lowerIsBetter:
            return delta < 0
        case .neutral:
            return nil
        }
    }
}

private struct DeltaBadge: View {
    let delta: Double?
    let unit: String
    let preference: MetricTrendPreference

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: deltaIcon)
                .font(.caption.weight(.bold))
                .accessibilityHidden(true)

            Text(deltaText)
                .font(.firaCode(12, weight: .medium).monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .foregroundStyle(deltaColor)
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(deltaColor.opacity(0.12))
        .clipShape(Capsule())
    }

    private var deltaIcon: String {
        guard let delta, abs(delta) >= 0.01 else {
            return "minus"
        }

        return delta > 0 ? "arrow.up" : "arrow.down"
    }

    private var deltaText: String {
        guard let delta else {
            return "No WoW"
        }

        let arrow = delta >= 0 ? "↑" : "↓"
        let amount = abs(delta).formatted(.number.precision(.fractionLength(1)))
        return "\(arrow) \(amount) \(unit)"
    }

    private var deltaColor: Color {
        guard let delta,
              abs(delta) >= 0.01,
              let isGood = preference.isGood(delta: delta)
        else {
            return Color.textMuted
        }

        return isGood ? Color.recoveryGreen : Color.recoveryRed
    }
}

private struct Sparkline: View {
    let points: [(date: Date, value: Double)]
    let color: Color

    var body: some View {
        if points.count > 1 {
            Chart {
                ForEach(Array(points.suffix(84).enumerated()), id: \.offset) { _, point in
                    LineMark(
                        x: .value("Date", point.date),
                        y: .value("Value", point.value)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(color)

                    AreaMark(
                        x: .value("Date", point.date),
                        y: .value("Value", point.value)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [color.opacity(0.22), color.opacity(0.02)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                }
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .chartPlotStyle { plotArea in
                plotArea
                    .background(Color.white.opacity(0.02))
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            }
            .accessibilityHidden(true)
        } else {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.white.opacity(0.04))
                .overlay {
                    Text("No trend yet")
                        .font(.caption)
                        .foregroundStyle(Color.textDim)
                }
                .accessibilityHidden(true)
        }
    }
}
