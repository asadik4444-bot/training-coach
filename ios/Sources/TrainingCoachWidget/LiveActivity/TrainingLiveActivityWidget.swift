import ActivityKit
import SwiftUI
import WidgetKit

struct TrainingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TrainingActivityAttributes.self) { context in
            TrainingLockScreenLiveActivityView(state: context.state)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    TrainingExpandedBandView(state: context.state)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    TrainingExpandedRemainingView(state: context.state)
                }

                DynamicIslandExpandedRegion(.center) {
                    TrainingExpandedRecoveryView(state: context.state)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    TrainingExpandedPlanView(state: context.state)
                }
            } compactLeading: {
                TrainingCompactBandView(state: context.state)
            } compactTrailing: {
                TrainingCompactScoreView(state: context.state)
            } minimal: {
                TrainingMinimalBandView(state: context.state)
            }
            .keyColor(context.state.bandTint)
        }
        .configurationDisplayName("Training Coach")
        .description("Live recovery and plan guidance during the workout window.")
    }
}

private struct TrainingLockScreenLiveActivityView: View {
    let state: TrainingActivityAttributes.ContentState

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Recovery")
                        .font(.custom("FiraSans-Medium", size: 13))
                        .foregroundStyle(Color.textMuted)

                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(state.boundedRecoveryScore)")
                            .font(.custom("FiraCode-Medium", size: 52))
                            .monospacedDigit()
                            .foregroundStyle(Color.text)
                            .minimumScaleFactor(0.7)

                        Text("%")
                            .font(.custom("FiraCode-Regular", size: 20))
                            .foregroundStyle(state.bandTint)
                    }

                    Label {
                        Text(state.bandLabel)
                            .font(.custom("FiraSans-Medium", size: 14))
                    } icon: {
                        Text(state.bandEmoji)
                    }
                    .foregroundStyle(state.bandTint)
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 6) {
                    Text("Window")
                        .font(.custom("FiraSans-Medium", size: 13))
                        .foregroundStyle(Color.textMuted)

                    Text(timerInterval: state.remainingRange, countsDown: true)
                        .font(.custom("FiraCode-Medium", size: 18))
                        .monospacedDigit()
                        .foregroundStyle(Color.text)
                        .multilineTextAlignment(.trailing)
                        .accessibilityLabel("Workout window remaining")

                    Text(state.windowEnd, style: .time)
                        .font(.custom("FiraSans-Medium", size: 12))
                        .foregroundStyle(Color.textDim)
                        .accessibilityLabel("Workout window ends")
                }
            }

            ProgressView(value: Double(state.boundedRecoveryScore), total: 100)
                .tint(state.bandTint)
                .background(Color.border, in: .capsule)
                .accessibilityLabel("Recovery score")
                .accessibilityValue("\(state.boundedRecoveryScore) percent")

            VStack(alignment: .leading, spacing: 5) {
                Text("Today's Plan")
                    .font(.custom("FiraSans-Medium", size: 13))
                    .foregroundStyle(Color.textMuted)

                Text(state.todayPlan)
                    .font(.custom("FiraSans-SemiBold", size: 16))
                    .foregroundStyle(Color.text)
                    .lineLimit(3)
                    .minimumScaleFactor(0.82)
            }
        }
        .padding(18)
        .background(Color.bgCard, in: .rect(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(state.bandTint.opacity(0.35), lineWidth: 1)
        }
        .scaleEffect(reduceMotion ? 1 : 1.01)
        .animation(reduceMotion ? nil : .bouncy(duration: 0.35), value: state.boundedRecoveryScore)
        .containerBackground(for: .widget) {
            Color.bg
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Training Coach live activity")
        .accessibilityValue("Recovery \(state.boundedRecoveryScore) percent, \(state.bandLabel). Today's plan: \(state.todayPlan).")
    }
}

private struct TrainingExpandedBandView: View {
    let state: TrainingActivityAttributes.ContentState

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 6) {
            Text(state.bandEmoji)
                .font(.system(size: 18))
                .scaleEffect(reduceMotion ? 1 : 1.05)
                .animation(reduceMotion ? nil : .bouncy(duration: 0.3), value: state.band)

            Text(state.bandLabel)
                .font(.custom("FiraSans-Medium", size: 13))
                .foregroundStyle(state.bandTint)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Recovery band \(state.bandLabel)")
    }
}

private struct TrainingExpandedRemainingView: View {
    let state: TrainingActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("Ends")
                .font(.custom("FiraSans-Medium", size: 11))
                .foregroundStyle(Color.textMuted)

            Text(state.windowEnd, style: .time)
                .font(.custom("FiraCode-Medium", size: 13))
                .monospacedDigit()
                .foregroundStyle(Color.text)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Workout window ends")
    }
}

private struct TrainingExpandedRecoveryView: View {
    let state: TrainingActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 3) {
            Text("\(state.boundedRecoveryScore)%")
                .font(.custom("FiraCode-Medium", size: 26))
                .monospacedDigit()
                .foregroundStyle(Color.text)
                .minimumScaleFactor(0.75)

            ProgressView(value: Double(state.boundedRecoveryScore), total: 100)
                .tint(state.bandTint)
                .frame(width: 96)
                .background(Color.border, in: .capsule)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Recovery \(state.boundedRecoveryScore) percent")
        .accessibilityValue(state.bandLabel)
    }
}

private struct TrainingExpandedPlanView: View {
    let state: TrainingActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Today's Plan")
                .font(.custom("FiraSans-Medium", size: 12))
                .foregroundStyle(Color.textMuted)

            Text(state.todayPlan)
                .font(.custom("FiraSans-SemiBold", size: 15))
                .foregroundStyle(Color.text)
                .lineLimit(2)
                .minimumScaleFactor(0.82)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Today's plan")
        .accessibilityValue(state.todayPlan)
    }
}

private struct TrainingCompactBandView: View {
    let state: TrainingActivityAttributes.ContentState

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Text(state.bandEmoji)
            .font(.system(size: 18))
            .scaleEffect(reduceMotion ? 1 : 1.04)
            .animation(reduceMotion ? nil : .bouncy(duration: 0.3), value: state.band)
            .accessibilityLabel("Recovery band \(state.bandLabel)")
    }
}

private struct TrainingCompactScoreView: View {
    let state: TrainingActivityAttributes.ContentState

    var body: some View {
        Text("\(state.boundedRecoveryScore)%")
            .font(.custom("FiraCode-Medium", size: 16))
            .monospacedDigit()
            .foregroundStyle(Color.text)
            .minimumScaleFactor(0.7)
            .accessibilityLabel("Recovery \(state.boundedRecoveryScore) percent")
    }
}

private struct TrainingMinimalBandView: View {
    let state: TrainingActivityAttributes.ContentState

    var body: some View {
        Text(state.bandEmoji)
            .font(.system(size: 16))
            .accessibilityLabel("Recovery band \(state.bandLabel)")
    }
}

private extension TrainingActivityAttributes.ContentState {
    var boundedRecoveryScore: Int {
        min(max(recoveryScore, 0), 100)
    }

    var bandEmoji: String {
        switch normalizedBand {
        case "green":
            return "🟢"
        case "yellow":
            return "🟡"
        default:
            return "🔴"
        }
    }

    var bandLabel: String {
        switch normalizedBand {
        case "green":
            return "Green"
        case "yellow":
            return "Yellow"
        default:
            return "Red"
        }
    }

    var bandTint: Color {
        switch normalizedBand {
        case "green":
            return Color.recoveryGreen
        case "yellow":
            return Color.recoveryYellow
        default:
            return Color.recoveryRed
        }
    }

    var remainingRange: ClosedRange<Date> {
        let now = Date()
        return now...max(now, windowEnd)
    }

    private var normalizedBand: String {
        let value = band.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if value.contains("green") || value.contains("high") || value.contains("🟢") {
            return "green"
        }

        if value.contains("yellow") || value.contains("medium") || value.contains("moderate") || value.contains("🟡") {
            return "yellow"
        }

        return "red"
    }
}

private extension DynamicIsland {
    func keyColor(_ color: Color) -> DynamicIsland {
        keylineTint(color)
    }
}

