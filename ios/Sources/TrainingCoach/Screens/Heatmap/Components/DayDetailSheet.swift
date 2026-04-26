import Foundation
import SwiftUI

struct DayDetailSheet: View {
    @Environment(\.dismiss) private var dismiss

    let entry: ExportEntry

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header

                VStack(alignment: .leading, spacing: 12) {
                    detailRow("HRV", value: hrvText)
                    detailRow("RHR", value: rhrText)
                    detailRow("Sleep efficiency", value: sleepEfficiencyText)
                    detailRow("Last workout", value: workoutText)

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

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(longDate)
                .font(.firaSans(13, weight: .semibold))
                .foregroundStyle(Color.textDim)
                .textCase(.uppercase)

            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(recoveryScoreText)
                    .font(.heroNumber)
                    .foregroundStyle(Color.text)
                    .monospacedDigit()

                Text(recoveryBandEmoji)
                    .font(.system(size: 34))
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func detailRow(_ title: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.firaSans(13, weight: .medium))
                .foregroundStyle(Color.textDim)

            Spacer(minLength: 16)

            Text(value)
                .font(.firaSans(15, weight: .medium))
                .foregroundStyle(Color.text)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .background(Color.bgCard, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.border, lineWidth: 0.5)
        }
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
        .background(Color.bgCard, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.border, lineWidth: 0.5)
        }
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
            return "--"
        }

        return "\(score)"
    }

    private var recoveryBandEmoji: String {
        guard let score = recovery?.score else {
            return "○"
        }

        return RecoveryBand.from(score: score).emoji
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
