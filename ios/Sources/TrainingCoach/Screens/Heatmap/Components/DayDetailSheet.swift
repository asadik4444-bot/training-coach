import Foundation
import SwiftUI

struct DayDetailSheet: View {
    @Environment(\.dismiss) private var dismiss

    let entry: ExportEntry

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                hero

                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 12) {
                        breakdownCard("HRV", value: hrvText, detail: "RMSSD", color: recoveryColor)
                        breakdownCard("RHR", value: rhrText, detail: "Resting", color: Color.primaryLight)
                    }

                    HStack(spacing: 12) {
                        breakdownCard("Sleep", value: sleepEfficiencyText, detail: "Efficiency", color: Color.accent)
                        breakdownCard("Workout", value: workoutText, detail: "Latest", color: Color.textMuted)
                    }

                    if let decision = entry.decision {
                        decisionSection(decision)
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)
            .padding(.bottom, 96)
        }
        .safeAreaInset(edge: .bottom) {
            Button {
                dismiss()
            } label: {
                Text("Close")
                    .font(.firaSans(16, weight: .semibold))
                    .foregroundStyle(Color.bg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.text, in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
            .background(Color.bgSurface)
        }
        .background(Color.bg.ignoresSafeArea())
        .presentationDetents([.medium, .large])
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(longDate)
                .font(.firaSans(28, weight: .bold))
                .foregroundStyle(Color.text)
                .fixedSize(horizontal: false, vertical: true)

            HStack(alignment: .center, spacing: 16) {
                Text(recoveryBandEmoji)
                    .font(.system(size: 42))
                    .frame(width: 58, height: 58)
                    .background(recoveryColor.opacity(0.16), in: Circle())
                    .shadow(color: recoveryColor.opacity(0.45), radius: 18)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 4) {
                    Text("RECOVERY")
                        .font(.firaSans(11, weight: .semibold))
                        .foregroundStyle(Color.textDim)
                        .tracking(1.2)

                    Text(recoveryScoreText)
                        .font(.heroNumber)
                        .foregroundStyle(recoveryColor)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.62)
                        .shadow(color: recoveryColor.opacity(0.68), radius: 18)
                }
            }
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [
                    recoveryColor.opacity(0.2),
                    Color.bgCard,
                    Color.bg
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(recoveryColor.opacity(0.4), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
        .accessibilityElement(children: .combine)
    }

    private func breakdownCard(_ title: String, value: String, detail: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.firaSans(11, weight: .semibold))
                .foregroundStyle(Color.textDim)
                .textCase(.uppercase)
                .tracking(0.8)

            Text(value)
                .font(.firaCode(16, weight: .medium).monospacedDigit())
                .foregroundStyle(color)
                .lineLimit(3)
                .minimumScaleFactor(0.72)

            Text(detail)
                .font(.firaSans(12, weight: .medium))
                .foregroundStyle(Color.textDim)
        }
        .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
        .padding(14)
        .background(
            LinearGradient(
                colors: [
                    Color.bgCard,
                    Color.bg
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.border.opacity(0.7), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
        .accessibilityElement(children: .combine)
    }

    private func decisionSection(_ decision: Decision) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text("Decision")
                    .font(.firaSans(13, weight: .semibold))
                    .foregroundStyle(Color.textDim)

                Text(decision.band.uppercased())
                    .font(.firaCode(11, weight: .medium))
                    .foregroundStyle(Color.text)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(decisionColor(decision).opacity(0.18), in: Capsule())
            }

            Text(decision.reason)
                .font(.bodyApp)
                .foregroundStyle(Color.text)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 12) {
                decisionPill(decision.hardStop ? "Hard stop" : "Flexible")
                decisionPill("Intensity \(formatMultiplier(decision.intensityMultiplier))")
            }
        }
        .padding(16)
        .background(
            LinearGradient(
                colors: [
                    Color.bgCard,
                    Color.bg
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.border.opacity(0.7), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }

    private func decisionPill(_ text: String) -> some View {
        Text(text)
            .font(.firaSans(12, weight: .medium))
            .foregroundStyle(Color.textMuted)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.bgSurface, in: Capsule())
    }

    private func decisionColor(_ decision: Decision) -> Color {
        switch decision.band.lowercased() {
        case "green":
            return .recoveryGreen
        case "yellow":
            return .recoveryYellow
        case "red":
            return .recoveryRed
        default:
            return .textDim
        }
    }

    private var recovery: Recovery? {
        entry.snapshot.recovery
    }

    private var sleep: Sleep? {
        entry.snapshot.sleep
    }

    private var workout: Workout? {
        entry.snapshot.lastWorkout
    }

    private var recoveryScoreText: String {
        guard let score = recovery?.score else {
            return "--%"
        }

        return "\(score)%"
    }

    private var recoveryBandEmoji: String {
        guard let score = recovery?.score else {
            return "○"
        }

        return RecoveryBand.from(score: score).emoji
    }

    private var recoveryColor: Color {
        guard let score = recovery?.score else {
            return Color.textDim
        }

        return RecoveryBand.from(score: score).color
    }

    private var hrvText: String {
        guard let hrv = recovery?.hrvRmssdMs else {
            return "No data"
        }

        return "\(format(hrv, digits: 1)) ms"
    }

    private var rhrText: String {
        guard let rhr = recovery?.rhrBpm else {
            return "No data"
        }

        return "\(rhr) bpm"
    }

    private var sleepEfficiencyText: String {
        guard let efficiency = sleep?.efficiencyPct else {
            return "No data"
        }

        return "\(format(efficiency, digits: 0))%"
    }

    private var workoutText: String {
        guard let workout else {
            return "No workout"
        }

        var parts = [workout.sport.capitalized]

        if let strain = workout.strain {
            parts.append("strain \(format(strain, digits: 1))")
        }

        if let avgHr = workout.avgHr {
            parts.append("avg \(avgHr) bpm")
        }

        if let maxHr = workout.maxHr {
            parts.append("max \(maxHr) bpm")
        }

        return parts.joined(separator: ", ")
    }

    private var longDate: String {
        guard let date = Self.date(from: entry.date, calendar: .current) else {
            return entry.date
        }

        return date.formatted(.dateTime.weekday(.wide).month(.wide).day().year())
    }

    private func format(_ value: Double, digits: Int) -> String {
        String(format: "%.\(digits)f", value)
    }

    private func formatMultiplier(_ value: Double) -> String {
        if value == 0 {
            return "0"
        }

        return "\(format(value, digits: 2))x"
    }

    private static func date(from string: String, calendar: Calendar) -> Date? {
        let parts = string.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else {
            return nil
        }

        var components = DateComponents()
        components.calendar = calendar
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]

        return calendar.date(from: components)
    }
}
