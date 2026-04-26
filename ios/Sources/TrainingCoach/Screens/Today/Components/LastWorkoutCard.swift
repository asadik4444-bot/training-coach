import Foundation
import SwiftUI

struct LastWorkoutCard: View {
    let workout: Workout?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("LAST WORKOUT")
                        .font(.firaSans(11, weight: .medium))
                        .foregroundStyle(Color.textMuted)

                    Text(workout?.sport.capitalized ?? "No workout")
                        .font(.firaSans(22, weight: .semibold))
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }

                Spacer()

                Text(relativeDate)
                    .font(.firaSans(12, weight: .medium))
                    .foregroundStyle(Color.textDim)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 30)
                    .background(Color.bgSurface, in: Capsule())
            }

            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("STRAIN")
                        .font(.firaSans(11, weight: .medium))
                        .foregroundStyle(Color.textMuted)

                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(strainValue)
                            .font(.firaCode(42, weight: .medium).monospacedDigit())
                            .foregroundStyle(Color.primaryLight)
                            .lineLimit(1)
                            .minimumScaleFactor(0.68)

                        Text("/21")
                            .font(.firaSans(13, weight: .medium))
                            .foregroundStyle(Color.textDim)
                            .baselineOffset(5)
                    }
                }

                Spacer(minLength: 16)

                VStack(alignment: .trailing, spacing: 8) {
                    HeartRateLine(label: "AVG", value: workout?.avgHr)
                    HeartRateLine(label: "MAX", value: workout?.maxHr)
                }
            }
        }
        .padding(18)
        .todayCardStyle()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Last workout")
        .accessibilityValue(accessibilityValue)
    }

    private var strainValue: String {
        guard let strain = workout?.strain else {
            return "--"
        }

        return String(format: "%.1f", strain)
    }

    private var relativeDate: String {
        guard let start = workout?.start else {
            return "--"
        }

        let calendar = Calendar.current
        let startDay = calendar.startOfDay(for: start)
        let today = calendar.startOfDay(for: Date())
        let days = calendar.dateComponents([.day], from: startDay, to: today).day ?? 0

        switch days {
        case 0:
            return "today"
        case 1:
            return "yesterday"
        case 2...:
            return "\(days)d ago"
        default:
            return start.formatted(.dateTime.month(.abbreviated).day())
        }
    }

    private var accessibilityValue: String {
        guard let workout else {
            return "No recent workout"
        }

        let avg = workout.avgHr.map { "\($0) average heart rate" } ?? "average heart rate unavailable"
        let max = workout.maxHr.map { "\($0) maximum heart rate" } ?? "maximum heart rate unavailable"
        return "\(workout.sport.capitalized), strain \(strainValue), \(avg), \(max), \(relativeDate)"
    }
}

private struct HeartRateLine: View {
    let label: String
    let value: Int?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            Text(label)
                .font(.firaSans(11, weight: .medium))
                .foregroundStyle(Color.textDim)

            Text(valueText)
                .font(.firaCode(19, weight: .medium).monospacedDigit())
                .foregroundStyle(Color.text)

            Text("bpm")
                .font(.firaSans(10, weight: .medium))
                .foregroundStyle(Color.textDim)
                .baselineOffset(2)
        }
    }

    private var valueText: String {
        guard let value else {
            return "--"
        }

        return "\(value)"
    }
}
