import SwiftUI

struct TrendsView: View {
    @State private var vm = TrendsViewModel()

    var body: some View {
        ZStack {
            Color.bg
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 18) {
                    WindowPicker(selection: $vm.window)

                    content
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 18)
            }
            .refreshable {
                await vm.load()
            }
        }
        .task {
            await vm.load()
        }
        .onChange(of: vm.window) {
            Task {
                await vm.load()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch vm.state {
        case .empty:
            StateBanner(
                title: "No trend data yet",
                message: "Refresh after your dashboard has recovery entries.",
                actionTitle: "Retry",
                action: reload
            )
            emptyCards
        case .loading:
            loadingCards
        case .error(let error):
            StateBanner(
                title: "Could not load trends",
                message: error.message,
                actionTitle: error.statusCode == 401 ? "Reconnect" : "Retry",
                action: reload
            )
            emptyCards
        case .success(let data):
            cards(data: data)
        }
    }

    private var loadingCards: some View {
        Group {
            ChartCard(
                metricLabel: TrendMetric.hrv.label,
                unit: TrendMetric.hrv.unit,
                color: RecoveryBand.yellow.color,
                data: [],
                windowLabel: vm.window.label,
                isLoading: true
            )

            ChartCard(
                metricLabel: TrendMetric.rhr.label,
                unit: TrendMetric.rhr.unit,
                color: Color.primaryLight,
                data: [],
                windowLabel: vm.window.label,
                isLoading: true
            )

            ChartCard(
                metricLabel: TrendMetric.sleep.label,
                unit: TrendMetric.sleep.unit,
                color: Color.accent,
                data: [],
                windowLabel: vm.window.label,
                isLoading: true
            )

            ChartCard(
                metricLabel: TrendMetric.strain.label,
                unit: TrendMetric.strain.unit,
                color: Color.text,
                data: [],
                windowLabel: vm.window.label,
                isLoading: true
            )
        }
    }

    private var emptyCards: some View {
        Group {
            ChartCard(
                metricLabel: TrendMetric.hrv.label,
                unit: TrendMetric.hrv.unit,
                color: RecoveryBand.yellow.color,
                data: [],
                windowLabel: vm.window.label
            )

            ChartCard(
                metricLabel: TrendMetric.rhr.label,
                unit: TrendMetric.rhr.unit,
                color: Color.primaryLight,
                data: [],
                windowLabel: vm.window.label
            )

            ChartCard(
                metricLabel: TrendMetric.sleep.label,
                unit: TrendMetric.sleep.unit,
                color: Color.accent,
                data: [],
                windowLabel: vm.window.label
            )

            ChartCard(
                metricLabel: TrendMetric.strain.label,
                unit: TrendMetric.strain.unit,
                color: Color.text,
                data: [],
                windowLabel: vm.window.label
            )
        }
    }

    private func cards(data: TrendsData) -> some View {
        Group {
            ChartCard(
                metricLabel: TrendMetric.hrv.label,
                unit: TrendMetric.hrv.unit,
                color: hrvColor(points: data.hrv.points),
                data: data.hrv.points,
                windowLabel: vm.window.label
            )

            ChartCard(
                metricLabel: TrendMetric.rhr.label,
                unit: TrendMetric.rhr.unit,
                color: Color.primaryLight,
                data: data.rhr.points,
                windowLabel: vm.window.label
            )

            ChartCard(
                metricLabel: TrendMetric.sleep.label,
                unit: TrendMetric.sleep.unit,
                color: Color.accent,
                data: data.sleep.points,
                windowLabel: vm.window.label
            )

            ChartCard(
                metricLabel: TrendMetric.strain.label,
                unit: TrendMetric.strain.unit,
                color: Color.text,
                data: data.strain.points,
                windowLabel: vm.window.label
            )
        }
    }

    private func hrvColor(points: [TrendPoint]) -> Color {
        guard let latestValue = points.max(by: { $0.date < $1.date })?.value else {
            return RecoveryBand.yellow.color
        }

        return RecoveryBand.from(score: Int(latestValue.rounded())).color
    }

    private func reload() {
        Task {
            await vm.load()
        }
    }
}

private struct StateBanner: View {
    let title: String
    let message: String
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.firaSans(15, weight: .semibold))
                    .foregroundStyle(Color.text)

                Text(message)
                    .font(.firaSans(13))
                    .foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 10)

            Button(action: action) {
                Text(actionTitle)
                    .font(.firaSans(13, weight: .semibold))
                    .foregroundStyle(Color.text)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(Color.primary, in: Capsule(style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(
            LinearGradient(
                colors: [
                    Color.bgCard,
                    Color.primary.opacity(0.12)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.border.opacity(0.72), lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }
}
