import SwiftUI

struct WorkoutDetailView: View {
    let item: WorkoutItem

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                heroHeader

                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Zone breakdown")
                            .font(.firaSans(18, weight: .semibold))
                            .foregroundStyle(Color.text)

                        Spacer()

                        Text("\(totalZoneMinutes) min total")
                            .font(.firaCode(13, weight: .medium).monospacedDigit())
                            .foregroundStyle(Color.textMuted)
                    }

                    ZoneBars(zoneMinutes: item.workout.zoneMinutes)
                }
                .padding(16)
                .background(Color.bgCard.opacity(0.74))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.border.opacity(0.72), lineWidth: 1)
                }

                heartRateCard

                if let recoveryScore = item.recoveryScore {
                    recoveryContext(score: recoveryScore)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 24)
            .padding(.bottom, 32)
        }
        .background(Color.bg.ignoresSafeArea())
        .navigationTitle(sportLabel)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var heroHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(sportLabel.uppercased())
                .font(.firaSans(24, weight: .bold))
                .foregroundStyle(Color.text)
                .tracking(1.2)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(strainText)
                    .font(.firaCode(40, weight: .medium).monospacedDigit())
                    .foregroundStyle(strainColor)
                    .shadow(color: strainColor.opacity(0.7), radius: 18)

                Text("strain")
                    .font(.firaSans(16, weight: .medium))
                    .foregroundStyle(Color.textMuted)
            }

            Text(item.workout.start.formatted(.dateTime.weekday(.wide).month(.abbreviated).day().hour().minute()))
                .font(.firaSans(14))
                .foregroundStyle(Color.textDim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var heartRateCard: some View {
        HStack(spacing: 0) {
            heartRateStat(title: "Avg HR", value: item.workout.avgHr)

            Rectangle()
                .fill(Color.border)
                .frame(width: 1)
                .padding(.vertical, 8)

            heartRateStat(title: "Max HR", value: item.workout.maxHr)
        }
        .padding(.vertical, 16)
        .background(Color.bgCard.opacity(0.74))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.border.opacity(0.72), lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }

    private func heartRateStat(title: String, value: Int?) -> some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.firaSans(12, weight: .semibold))
                .foregroundStyle(Color.textDim)

            Text(value.map { String($0) } ?? "--")
                .font(.firaCode(28, weight: .medium).monospacedDigit())
                .foregroundStyle(Color.text)

            Text("bpm")
                .font(.firaSans(12))
                .foregroundStyle(Color.textMuted)
        }
        .frame(maxWidth: .infinity)
    }

    private func recoveryContext(score: Int) -> some View {
        let band = RecoveryBand.from(score: score)

        return HStack(spacing: 10) {
            Circle()
                .fill(band.color)
                .frame(width: 10, height: 10)
                .shadow(color: band.color.opacity(0.5), radius: 8)
                .accessibilityHidden(true)

            Text("Recovery was \(score)% — \(band.label) band")
                .font(.firaSans(14, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.bgSurface.opacity(0.9))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .accessibilityElement(children: .combine)
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

    private var totalZoneMinutes: Int {
        item.workout.zoneMinutes.z1
            + item.workout.zoneMinutes.z2
            + item.workout.zoneMinutes.z3
            + item.workout.zoneMinutes.z4
            + item.workout.zoneMinutes.z5
    }
}

private extension RecoveryBand {
    var label: String {
        switch self {
        case .green:
            return "green"
        case .yellow:
            return "yellow"
        case .red:
            return "red"
        }
    }
}
