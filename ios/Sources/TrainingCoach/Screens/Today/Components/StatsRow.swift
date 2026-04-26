import SwiftUI

struct StatsRow: View {
    let day: Day
    let hrvSparkline: TrendResponse

    var body: some View {
        HStack(spacing: 10) {
            StatTile(
                label: "HRV",
                value: hrvValue,
                unit: "ms",
                trend: hrvTrend,
                tint: Color.primaryLight,
                accessibilityValue: hrvAccessibilityValue
            )

            StatTile(
                label: "RHR",
                value: rhrValue,
                unit: "bpm",
                trend: nil,
                tint: Color.recoveryRed,
                accessibilityValue: rhrAccessibilityValue
            )

            StatTile(
                label: "Sleep",
                value: sleepValue,
                unit: "%",
                trend: nil,
                tint: Color.recoveryYellow,
                accessibilityValue: sleepAccessibilityValue
            )
        }
    }

    private var hrvValue: String {
        guard let hrv = day.biometrics?.recovery?.hrvRmssdMs else {
            return "--"
        }

        return "\(Int(hrv.rounded()))"
    }

    private var rhrValue: String {
        guard let rhr = day.biometrics?.recovery?.rhrBpm else {
            return "--"
        }

        return "\(rhr)"
    }

    private var sleepValue: String {
        guard let sleep = day.biometrics?.sleep?.performancePct else {
            return "--"
        }

        return "\(Int(sleep.rounded()))"
    }

    private var hrvTrend: StatTrend? {
        guard let first = hrvSparkline.points.first?.value,
              let last = hrvSparkline.points.last?.value,
              hrvSparkline.points.count > 1
        else {
            return nil
        }

        if last >= first {
            return .up
        }

        return .down
    }

    private var hrvAccessibilityValue: String {
        guard hrvValue != "--" else {
            return "No HRV data"
        }

        let trend = hrvTrend?.accessibilityLabel ?? "trend unavailable"
        return "\(hrvValue) milliseconds, \(trend)"
    }

    private var rhrAccessibilityValue: String {
        guard rhrValue != "--" else {
            return "No resting heart rate data"
        }

        return "\(rhrValue) beats per minute"
    }

    private var sleepAccessibilityValue: String {
        guard sleepValue != "--" else {
            return "No sleep data"
        }

        return "\(sleepValue) percent"
    }
}

private struct StatTile: View {
    let label: String
    let value: String
    let unit: String
    let trend: StatTrend?
    let tint: Color
    let accessibilityValue: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label.uppercased())
                .font(.firaSans(11, weight: .medium))
                .foregroundStyle(Color.textMuted)

            HStack(alignment: .firstTextBaseline, spacing: 3) {
                if let trend {
                    Image(systemName: trend.symbolName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(trend.color)
                        .accessibilityHidden(true)
                }

                Text(value)
                    .font(.firaCode(28, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.58)

                Text(unit)
                    .font(.firaSans(10, weight: .medium))
                    .foregroundStyle(Color.textDim)
                    .baselineOffset(3)
                    .lineLimit(1)
            }

            Capsule()
                .fill(tint.opacity(0.75))
                .frame(width: 30, height: 3)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
        .padding(14)
        .todayCardStyle()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(accessibilityValue)
    }
}

private enum StatTrend {
    case up
    case down

    var symbolName: String {
        switch self {
        case .up:
            "arrow.up.right"
        case .down:
            "arrow.down.right"
        }
    }

    var color: Color {
        switch self {
        case .up:
            Color.recoveryGreen
        case .down:
            Color.recoveryRed
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .up:
            "trending up"
        case .down:
            "trending down"
        }
    }
}
