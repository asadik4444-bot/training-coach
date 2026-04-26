import SwiftUI
import UIKit

struct TodayView: View {
    @State private var vm = TodayViewModel()
    @State private var didAppear = false

    var body: some View {
        NavigationStack {
            ScrollView {
                content
                    .padding(.horizontal, 16)
                    .padding(.vertical, 18)
            }
            .refreshable {
                impact()
                await vm.load()
            }
            .background(Color.bg.ignoresSafeArea())
            .navigationTitle("Today")
        }
        .background(Color.bg.ignoresSafeArea())
        .task {
            guard !didAppear else {
                return
            }

            didAppear = true
            impact()
            await vm.load()
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.78), value: vm.state)
    }

    @ViewBuilder
    private var content: some View {
        switch vm.state {
        case .empty:
            TodayPlaceholderView(
                title: "No data yet",
                message: "Refresh when you are ready.",
                retry: reload
            )

        case .loading:
            TodaySkeletonView()

        case .error(let error):
            TodayPlaceholderView(
                title: "Could not load today",
                message: error.displayMessage,
                retry: reload
            )

        case .success(let data):
            TodaySuccessView(data: data)
        }
    }

    private func reload() {
        impact()
        Task {
            await vm.load()
        }
    }

    private func impact() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

private struct TodaySuccessView: View {
    @State private var isRecapPresented = false

    let data: TodayData

    var body: some View {
        VStack(spacing: 14) {
            RecoveryHero(score: data.day.biometrics?.recovery?.score)
            StatsRow(day: data.day, hrvSparkline: data.hrvSparkline)
            LastWorkoutCard(workout: data.day.biometrics?.lastWorkout)
            DecisionCard(decision: data.decision)
            PainProteinBedtimeRow(day: data.day)
            shareRecapButton
        }
        .sheet(isPresented: $isRecapPresented) {
            RecapView()
        }
    }

    private var shareRecapButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            isRecapPresented = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.primaryLight)
                    .frame(width: 34, height: 34)
                    .background(Color.primaryLight.opacity(0.14), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .accessibilityHidden(true)

                Text("Share Recap")
                    .font(.firaSans(15, weight: .medium))
                    .foregroundStyle(Color.text)

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textDim)
                    .accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
            .padding(14)
            .todayCardStyle()
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the shareable recap card generator.")
    }
}

private struct TodayPlaceholderView: View {
    let title: String
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Spacer(minLength: 90)

            VStack(spacing: 8) {
                Text(title)
                    .font(.firaSans(22, weight: .semibold))
                    .foregroundStyle(Color.text)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(.firaSans(14))
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
            }

            Button(action: retry) {
                Text("Retry")
                    .font(.firaSans(15, weight: .medium))
                    .foregroundStyle(Color.text)
                    .frame(minWidth: 112, minHeight: 44)
                    .padding(.horizontal, 12)
                    .background(Color.primary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .accessibilityHint("Attempts to load today's training data again.")

            Spacer(minLength: 90)
        }
        .frame(maxWidth: .infinity)
        .todayCardStyle()
    }
}

private struct TodaySkeletonView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        VStack(spacing: 14) {
            SkeletonCard(height: 190)
            HStack(spacing: 10) {
                SkeletonCard(height: 104)
                SkeletonCard(height: 104)
                SkeletonCard(height: 104)
            }
            SkeletonCard(height: 142)
            SkeletonCard(height: 160)
            HStack(spacing: 10) {
                SkeletonCard(height: 86)
                SkeletonCard(height: 86)
                SkeletonCard(height: 86)
            }
        }
        .opacity(reduceMotion ? 0.62 : (pulse ? 0.38 : 0.82))
        .task {
            guard !reduceMotion else {
                return
            }

            withAnimation(.easeInOut(duration: 0.95).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
        .accessibilityLabel("Loading today's training data")
    }
}

private struct SkeletonCard: View {
    let height: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [Color.bgCard, Color.bg],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 12) {
                    Capsule()
                        .fill(Color.textDim.opacity(0.22))
                        .frame(width: 72, height: 10)

                    Capsule()
                        .fill(Color.textMuted.opacity(0.18))
                        .frame(width: 128, height: 18)
                }
                .padding(18)
            }
            .frame(maxWidth: .infinity, minHeight: height)
            .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }
}

private struct PainProteinBedtimeRow: View {
    let day: Day

    var body: some View {
        HStack(spacing: 10) {
            SummaryTile(
                label: "Pain",
                value: painValue,
                detail: painDetail,
                color: painColor,
                accessibilityValue: painAccessibilityValue
            )

            SummaryTile(
                label: "Protein",
                value: proteinValue,
                detail: proteinDetail,
                color: proteinColor,
                accessibilityValue: proteinAccessibilityValue
            )

            SummaryTile(
                label: "Bedtime",
                value: day.bedtime ?? "--:--",
                detail: day.bedtime == nil ? "not set" : "target",
                color: Color.primaryLight,
                accessibilityValue: day.bedtime ?? "Not set"
            )
        }
    }

    private var strongestPain: PainEntry? {
        day.pain.max { lhs, rhs in
            lhs.severity < rhs.severity
        }
    }

    private var painValue: String {
        guard let strongestPain else {
            return "None"
        }

        return "\(strongestPain.severity)/10"
    }

    private var painDetail: String {
        strongestPain?.area.capitalized ?? "clear"
    }

    private var painColor: Color {
        guard let severity = strongestPain?.severity else {
            return Color.recoveryGreen
        }

        if severity >= 7 {
            return Color.recoveryRed
        }

        if severity >= 4 {
            return Color.recoveryYellow
        }

        return Color.recoveryGreen
    }

    private var painAccessibilityValue: String {
        guard let strongestPain else {
            return "No pain logged"
        }

        return "\(strongestPain.area), severity \(strongestPain.severity) out of 10"
    }

    private var proteinValue: String {
        switch day.protein {
        case .some(true):
            "Done"
        case .some(false):
            "Open"
        case .none:
            "--"
        }
    }

    private var proteinDetail: String {
        switch day.protein {
        case .some(true):
            "logged"
        case .some(false):
            "pending"
        case .none:
            "not set"
        }
    }

    private var proteinColor: Color {
        day.protein == true ? Color.recoveryGreen : Color.recoveryYellow
    }

    private var proteinAccessibilityValue: String {
        switch day.protein {
        case .some(true):
            "Completed"
        case .some(false):
            "Pending"
        case .none:
            "Not set"
        }
    }
}

private struct SummaryTile: View {
    let label: String
    let value: String
    let detail: String
    let color: Color
    let accessibilityValue: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased())
                .font(.firaSans(11, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Text(value)
                .font(.firaCode(16, weight: .medium).monospacedDigit())
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text(detail)
                .font(.firaSans(12, weight: .medium))
                .foregroundStyle(Color.textDim)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, minHeight: 86, alignment: .leading)
        .padding(14)
        .todayCardStyle()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(accessibilityValue)
    }
}

extension View {
    func todayCardStyle(cornerRadius: CGFloat = 16) -> some View {
        background(
            LinearGradient(
                colors: [Color.bgCard, Color.bg],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }
}

private extension AppError {
    var displayMessage: String { message }
}
