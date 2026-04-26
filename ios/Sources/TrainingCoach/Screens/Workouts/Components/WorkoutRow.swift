import SwiftUI
import UIKit

struct WorkoutRow: View {
    let item: WorkoutItem

    @ScaledMetric(relativeTo: .body) private var iconSize: CGFloat = 28
    @ScaledMetric(relativeTo: .body) private var strainSize: CGFloat = 18

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: sportSymbol)
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundStyle(strainColor)
                .frame(width: 36, height: 36)
                .background(strainColor.opacity(0.12))
                .clipShape(Circle())
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(sportLabel)
                    .font(.firaSans(15, weight: .medium))
                    .foregroundStyle(Color.text)
                    .lineLimit(1)

                Text("\(strainText) strain")
                    .font(.firaCode(strainSize, weight: .medium).monospacedDigit())
                    .foregroundStyle(strainColor)
                    .lineLimit(1)

                Text(heartRateText)
                    .font(.captionApp)
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(1)
            }

            Spacer(minLength: 12)

            Text(relativeDate)
                .font(.captionApp)
                .foregroundStyle(Color.textDim)
                .multilineTextAlignment(.trailing)
                .lineLimit(2)
                .frame(minWidth: 58, alignment: .trailing)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
        .background(Color.bgCard.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.border.opacity(0.7), lineWidth: 1)
        }
        .contentShape(Rectangle())
        .simultaneousGesture(
            TapGesture().onEnded {
                UISelectionFeedbackGenerator().selectionChanged()
            }
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Opens workout details")
    }

    private var sportSymbol: String {
        switch normalizedSport {
        case "run", "running":
            return "figure.run"
        case "bike", "biking", "cycle", "cycling":
            return "figure.outdoor.cycle"
        case "lift", "lifting", "strength", "weightlifting":
            return "dumbbell.fill"
        case "walk", "walking":
            return "figure.walk"
        case "hike", "hiking":
            return "figure.hiking"
        case "row", "rowing":
            return "figure.rower"
        case "swim", "swimming":
            return "figure.pool.swim"
        case "yoga", "pilates", "mobility":
            return "figure.mind.and.body"
        case "soccer":
            return "soccerball"
        case "basketball":
            return "basketball.fill"
        case "tennis":
            return "tennisball.fill"
        default:
            return "figure.strengthtraining.traditional"
        }
    }

    private var sportLabel: String {
        switch normalizedSport {
        case "run", "running":
            return "Running"
        case "bike", "biking", "cycle", "cycling":
            return "Cycling"
        case "lift", "lifting", "strength", "weightlifting":
            return "Lifting"
        default:
            return item.workout.sport
                .replacingOccurrences(of: "_", with: " ")
                .replacingOccurrences(of: "-", with: " ")
                .capitalized
        }
    }

    private var normalizedSport: String {
        item.workout.sport.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var strainColor: Color {
        guard let strain = item.workout.strain else {
            return Color.textMuted
        }

        if strain >= 18 {
            return Color.recoveryRed
        }

        if strain >= 14 {
            return Color.recoveryYellow
        }

        return Color.recoveryGreen
    }

    private var strainText: String {
        guard let strain = item.workout.strain else {
            return "--"
        }

        return strain.formatted(.number.precision(.fractionLength(1)))
    }

    private var heartRateText: String {
        "\(heartRateValue(item.workout.avgHr)) avg / \(heartRateValue(item.workout.maxHr)) max"
    }

    private var relativeDate: String {
        let calendar = Calendar.current
        let start = item.workout.start

        if calendar.isDateInToday(start) {
            return "today"
        }

        if calendar.isDateInYesterday(start) {
            return "yesterday"
        }

        let startDay = calendar.startOfDay(for: start)
        let today = calendar.startOfDay(for: Date())
        let daysAgo = calendar.dateComponents([.day], from: startDay, to: today).day ?? 0

        if daysAgo > 0 {
            return "\(daysAgo)d ago"
        }

        return start.formatted(.dateTime.month(.abbreviated).day())
    }

    private var accessibilityLabel: String {
        "\(sportLabel) workout, \(strainText) strain, \(heartRateDescription(item.workout.avgHr, label: "average heart rate")), \(heartRateDescription(item.workout.maxHr, label: "maximum heart rate")), \(relativeDate)"
    }

    private func heartRateValue(_ value: Int?) -> String {
        guard let value else {
            return "--"
        }

        return "\(value)"
    }

    private func heartRateDescription(_ value: Int?, label: String) -> String {
        guard let value else {
            return "unknown \(label)"
        }

        return "\(value) \(label)"
    }
}
