import HealthKit
import SwiftUI

struct BodyView: View {
    @State private var viewModel = BodyViewModel()
    @State private var showingHealthKitPermission = false

    var body: some View {
        ZStack {
            Color.bg
                .ignoresSafeArea()

            content
        }
        .task {
            await viewModel.load()
        }
        .sheet(isPresented: $showingHealthKitPermission) {
            HealthKitPermissionView(
                status: viewModel.hkAuthStatus,
                requestAccess: requestHealthKitAccess
            )
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .empty:
            BodyStateScrollView {
                EmptyBodyStateView(retry: reload)
            }
        case .loading:
            BodyStateScrollView {
                BodyLoadingView()
            }
        case .error(let error):
            BodyStateScrollView {
                BodyErrorView(error: error, retry: reload)
            }
        case .success(let data):
            BodyMetricsScrollView(
                data: data,
                viewModel: viewModel,
                showHealthKitCTA: showHealthKitCTA,
                healthKitAvailable: viewModel.isHealthKitAvailable,
                grantAccess: showHealthKitPermission
            )
        }
    }

    private var showHealthKitCTA: Bool {
        viewModel.isHealthKitAvailable &&
        (viewModel.hkAuthStatus == .notDetermined || viewModel.hkAuthStatus == .sharingDenied)
    }

    private func reload() {
        Task {
            await viewModel.load()
        }
    }

    private func showHealthKitPermission() {
        showingHealthKitPermission = true
    }

    private func requestHealthKitAccess() async throws {
        try await viewModel.requestHealthKit()
        await viewModel.load()
    }
}

private struct BodyMetricsScrollView: View {
    let data: BodyData
    let viewModel: BodyViewModel
    let showHealthKitCTA: Bool
    let healthKitAvailable: Bool
    let grantAccess: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                BodyHeaderView()

                if showHealthKitCTA {
                    HealthKitCTAView(grantAccess: grantAccess)
                }

                WeightCard(metric: data.weight, healthKitAvailable: healthKitAvailable)

                BodyFatCard(value: data.bodyFatPct, healthKitAvailable: healthKitAvailable)

                RHRCard(metric: viewModel.rhrMetric(from: data.rhrTrend))

                SleepEfficiencyCard(metric: viewModel.sleepMetric(from: data.sleepTrend))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .refreshable {
            await viewModel.load()
        }
    }
}

private struct BodyStateScrollView<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                BodyHeaderView()
                content
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct BodyHeaderView: View {
    var body: some View {
        Text("BODY")
            .font(.firaSans(32, weight: .bold))
            .foregroundStyle(Color.text)
            .tracking(1.5)
            .accessibilityAddTraits(.isHeader)
    }
}

private struct HealthKitCTAView: View {
    let grantAccess: () -> Void

    var body: some View {
        Button(action: grantAccess) {
            HStack(spacing: 12) {
                Image(systemName: "heart.text.square.fill")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.recoveryGreen)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    Text("Grant HealthKit access")
                        .font(.firaSans(16, weight: .semibold))
                        .foregroundStyle(Color.text)

                    Text("Enable local weight and body fat reads.")
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                }

                Spacer(minLength: 12)

                Image(systemName: "chevron.up.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.textDim)
                    .accessibilityHidden(true)
            }
            .padding(16)
            .background(Color.bgCard.opacity(0.82))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the HealthKit permission sheet.")
    }
}

private struct WeightCard: View {
    let metric: BodyMetric?
    let healthKitAvailable: Bool

    var body: some View {
        MetricCard(
            label: "Weight",
            value: metric?.latest,
            unit: metric?.unit ?? "kg",
            weekDelta: metric?.weekDelta,
            sparklinePoints: metric?.series ?? [],
            color: Color.primaryLight,
            trendPreference: .neutral,
            placeholder: placeholder,
            valueFormat: .number.precision(.fractionLength(1)),
            accessibilityLabelText: "Weight"
        )
    }

    private var placeholder: String {
        healthKitAvailable ? "No HealthKit weight samples yet" : "HealthKit unavailable on this device"
    }
}

private struct BodyFatCard: View {
    let value: Double?
    let healthKitAvailable: Bool

    var body: some View {
        MetricCard(
            label: "Body fat",
            value: value,
            unit: "%",
            weekDelta: nil,
            sparklinePoints: [],
            color: Color.accent,
            trendPreference: .lowerIsBetter,
            placeholder: placeholder,
            valueFormat: .number.precision(.fractionLength(1)),
            accessibilityLabelText: "Body fat percentage"
        )
    }

    private var placeholder: String {
        healthKitAvailable ? "No HealthKit body fat sample yet" : "HealthKit unavailable on this device"
    }
}

private struct RHRCard: View {
    let metric: BodyMetric?

    var body: some View {
        MetricCard(
            label: "Resting heart rate",
            value: metric?.latest,
            unit: "bpm",
            weekDelta: metric?.weekDelta,
            sparklinePoints: metric?.series ?? [],
            color: Color.recoveryGreen,
            trendPreference: .lowerIsBetter,
            placeholder: "No resting heart rate trend yet",
            valueFormat: .number.precision(.fractionLength(0)),
            accessibilityLabelText: "Resting heart rate"
        )
    }
}

private struct SleepEfficiencyCard: View {
    let metric: BodyMetric?

    var body: some View {
        MetricCard(
            label: "Sleep efficiency",
            value: metric?.latest,
            unit: "%",
            weekDelta: metric?.weekDelta,
            sparklinePoints: metric?.series ?? [],
            color: Color.recoveryYellow,
            trendPreference: .higherIsBetter,
            placeholder: "No sleep efficiency trend yet",
            valueFormat: .number.precision(.fractionLength(0)),
            accessibilityLabelText: "Sleep efficiency"
        )
    }
}

private struct BodyLoadingView: View {
    var body: some View {
        VStack(spacing: 14) {
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.bgCard.opacity(0.86))
                    .frame(height: 154)
                    .overlay(alignment: .leading) {
                        VStack(alignment: .leading, spacing: 14) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.textDim.opacity(0.25))
                                .frame(width: 96, height: 12)

                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.textDim.opacity(0.18))
                                .frame(width: 160, height: 38)

                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.textDim.opacity(0.12))
                                .frame(height: 54)
                        }
                        .padding(18)
                    }
                    .accessibilityLabel("Loading body metric")
            }
        }
    }
}

private struct EmptyBodyStateView: View {
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("No body data yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.text)

            Text("Refresh after HealthKit or trend data is available.")
                .font(.body)
                .foregroundStyle(Color.textMuted)

            Button("Retry", action: retry)
                .font(.firaSans(16, weight: .semibold))
                .foregroundStyle(Color.text)
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .background(Color.primary)
                .clipShape(Capsule())
        }
        .padding(20)
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct BodyErrorView: View {
    let error: AppError
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Could not load body data")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.text)

            Text(error.message)
                .font(.body)
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)

            Button(error.statusCode == 401 ? "Retry after sign in" : "Retry", action: retry)
                .font(.firaSans(16, weight: .semibold))
                .foregroundStyle(Color.text)
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .background(Color.primary)
                .clipShape(Capsule())
        }
        .padding(20)
        .background(Color.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

#Preview {
    BodyView()
}
