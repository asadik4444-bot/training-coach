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
                            .foregroundStyle(strainColor)
                            .lineLimit(1)
                            .minimumScaleFactor(0.68)
                            .shadow(color: strainColor.opacity(strainGlowOpacity), radius: strainGlowRadius)

                        Text("/21")
                            .font(.firaCode(13, weight: .medium).monospacedDigit())
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

            WorkoutZoneCapsule(zoneMinutes: workout?.zoneMinutes)
        }
        .frame(maxWidth: .infinity, minHeight: 178, alignment: .leading)
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

    private var strainFraction: Double {
        guard let strain = workout?.strain else {
            return 0
        }

        return min(max(strain / 21, 0), 1)
    }

    private var strainColor: Color {
        switch strainFraction {
        case 0.72...:
            return Color.recoveryRed
        case 0.42..<0.72:
            return Color.recoveryYellow
        default:
            return Color.primaryLight
        }
    }

    private var strainGlowOpacity: Double {
        guard workout?.strain != nil else {
            return 0
        }

        return 0.22 + (strainFraction * 0.42)
    }

    private var strainGlowRadius: CGFloat {
        guard workout?.strain != nil else {
            return 0
        }

        return CGFloat(6 + (strainFraction * 10))
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
        return "\(workout.sport.capitalized), strain \(strainValue), \(avg), \(max), \(zoneSummary), \(relativeDate)"
    }

    private var zoneSummary: String {
        guard let workout else {
            return "zone time unavailable"
        }

        let zones = workout.zoneMinutes
        return "zone time Z1 \(zones.z1) minutes, Z2 \(zones.z2) minutes, Z3 \(zones.z3) minutes, Z4 \(zones.z4) minutes, Z5 \(zones.z5) minutes"
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

private struct WorkoutZoneCapsule: View {
    let zoneMinutes: ZoneMinutes?

    private var zones: [WorkoutZoneSegment] {
        [
            WorkoutZoneSegment(label: "Z1", minutes: zoneMinutes?.z1 ?? 0, color: Color(hex: 0x60A5FA)),
            WorkoutZoneSegment(label: "Z2", minutes: zoneMinutes?.z2 ?? 0, color: Color(hex: 0x22D3EE)),
            WorkoutZoneSegment(label: "Z3", minutes: zoneMinutes?.z3 ?? 0, color: Color.recoveryGreen),
            WorkoutZoneSegment(label: "Z4", minutes: zoneMinutes?.z4 ?? 0, color: Color.recoveryYellow),
            WorkoutZoneSegment(label: "Z5", minutes: zoneMinutes?.z5 ?? 0, color: Color.recoveryRed)
        ]
    }

    private var totalMinutes: Int {
        zones.reduce(0) { $0 + $1.minutes }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("ZONE TIME")
                    .font(.firaSans(11, weight: .medium))
                    .foregroundStyle(Color.textMuted)

                Spacer()

                Text(totalText)
                    .font(.firaCode(12, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.textDim)
            }

            GeometryReader { proxy in
                HStack(spacing: 4) {
                    ForEach(zones) { zone in
                        Capsule()
                            .fill(zoneFill(for: zone))
                            .frame(width: width(for: zone, in: proxy.size.width))
                    }
                }
            }
            .frame(height: 10)
        }
        .accessibilityHidden(true)
    }

    private var totalText: String {
        guard totalMinutes > 0 else {
            return "--"
        }

        return "\(totalMinutes)m"
    }

    private func zoneFill(for zone: WorkoutZoneSegment) -> some ShapeStyle {
        LinearGradient(
            colors: [
                zone.color.opacity(zone.minutes > 0 ? 0.52 : 0.14),
                zone.color.opacity(zone.minutes > 0 ? 0.95 : 0.2)
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    private func width(for zone: WorkoutZoneSegment, in availableWidth: CGFloat) -> CGFloat {
        let spacing: CGFloat = CGFloat(max(zones.count - 1, 0)) * 4
        let barWidth = max(0, availableWidth - spacing)

        guard totalMinutes > 0 else {
            return barWidth / CGFloat(max(zones.count, 1))
        }

        let proportionalWidth = barWidth * CGFloat(zone.minutes) / CGFloat(totalMinutes)
        return zone.minutes > 0 ? max(8, proportionalWidth) : 0
    }
}

private struct WorkoutZoneSegment: Identifiable {
    let label: String
    let minutes: Int
    let color: Color

    var id: String {
        label
    }
}
