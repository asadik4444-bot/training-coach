import SwiftUI
import UIKit

struct HeatmapView: View {
    @State private var viewModel = HeatmapViewModel()
    @State private var selectedEntry: SelectedHeatmapEntry?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("HEATMAP")
                        .font(.firaSans(28, weight: .bold))
                        .foregroundStyle(Color.text)
                        .tracking(1.5)
                        .accessibilityAddTraits(.isHeader)

                    Text("RECOVERY (90 DAYS)")
                        .font(.firaSans(12, weight: .semibold))
                        .foregroundStyle(Color.textDim)
                        .textCase(.uppercase)
                        .tracking(0.6)
                }

                content
            }
            .padding(.horizontal, 20)
            .padding(.top, 28)
            .padding(.bottom, 40)
        }
        .background(Color.bg.ignoresSafeArea())
        .refreshable {
            impact()
            await viewModel.load()
            impact()
        }
        .task {
            await viewModel.load()
        }
        .sheet(item: $selectedEntry) { selection in
            DayDetailSheet(entry: selection.entry)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .empty:
            HeatmapEmptyState(retry: reload)

        case .loading:
            HeatmapGridSection {
                HeatmapGridSkeleton()
            }
            HeatmapLegend()

        case .error(let error):
            HeatmapErrorState(error: error, retry: reload)

        case .success(let data):
            HeatmapGridSection {
                HeatmapGrid(cells: data.cells) { cell in
                    guard let entry = cell.entry else {
                        return
                    }

                    selectedEntry = SelectedHeatmapEntry(entry: entry)
                }
            }
            HeatmapLegend()
        }
    }

    private func reload() {
        impact()
        Task {
            await viewModel.load()
            impact()
        }
    }

    private func impact() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

private struct SelectedHeatmapEntry: Identifiable {
    let entry: ExportEntry

    var id: String {
        entry.date
    }
}

private struct HeatmapGridSection<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            WeekdayLabelColumn()
                .padding(.top, HeatmapGridMetrics.monthLabelHeight + HeatmapGridMetrics.monthLabelSpacing)

            ScrollView(.horizontal, showsIndicators: false) {
                content
            }
            .scrollClipDisabled()
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
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.border.opacity(0.75), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }
}

private struct WeekdayLabelColumn: View {
    private let labels = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        VStack(spacing: HeatmapGridMetrics.spacing) {
            ForEach(labels.indices, id: \.self) { index in
                Text(labels[index])
                    .font(.firaCode(10, weight: .medium))
                    .foregroundStyle(Color.textDim)
                    .frame(width: 14, height: HeatmapGridMetrics.tapTargetSide)
            }
        }
        .accessibilityHidden(true)
    }
}

private struct HeatmapLegend: View {
    private let sampleColors: [Color] = [
        Color.bgCard.opacity(0.5),
        Color.recoveryGreen.opacity(0.22),
        Color.recoveryGreen.opacity(0.42),
        Color.recoveryGreen.opacity(0.65),
        Color.recoveryGreen.opacity(0.9)
    ]

    var body: some View {
        HStack(spacing: 7) {
            Text("Less")
                .font(.firaCode(10, weight: .medium))
                .foregroundStyle(Color.textDim)

            Text("···")
                .font(.firaCode(10, weight: .medium))
                .foregroundStyle(Color.textDim)

            HStack(spacing: 4) {
                ForEach(sampleColors.indices, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(sampleColors[index])
                        .overlay {
                            if index == 0 {
                                RoundedRectangle(cornerRadius: 3, style: .continuous)
                                    .stroke(Color.border, lineWidth: 0.5)
                            }
                        }
                        .frame(width: 12, height: 12)
                }
            }
            .accessibilityHidden(true)

            Text("More")
                .font(.firaCode(10, weight: .medium))
                .foregroundStyle(Color.textDim)
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Less to more recovery")
    }
}

private struct HeatmapEmptyState: View {
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("No recovery data yet")
                .font(.firaSans(18, weight: .semibold))
                .foregroundStyle(Color.text)

            Text("Refresh after your first export is available.")
                .font(.bodyApp)
                .foregroundStyle(Color.textMuted)

            Button("Retry", action: retry)
                .font(.firaSans(14, weight: .semibold))
                .foregroundStyle(Color.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.bgCard, in: Capsule())
                .overlay {
                    Capsule()
                        .stroke(Color.border, lineWidth: 0.5)
                }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(
            LinearGradient(
                colors: [
                    Color.bgCard,
                    Color.bg
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.border.opacity(0.75), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }
}

private struct HeatmapErrorState: View {
    let error: AppError
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Could not load heatmap")
                .font(.firaSans(18, weight: .semibold))
                .foregroundStyle(Color.text)

            Text(message)
                .font(.bodyApp)
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)

            Button("Retry", action: retry)
                .font(.firaSans(14, weight: .semibold))
                .foregroundStyle(Color.text)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.bgCard, in: Capsule())
                .overlay {
                    Capsule()
                        .stroke(Color.border, lineWidth: 0.5)
                }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(
            LinearGradient(
                colors: [
                    Color.bgCard,
                    Color.bg
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.border.opacity(0.75), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
    }

    private var message: String {
        if error.isUnauthorized {
            return "Authentication failed. Open Settings to authenticate again."
        }
        return error.message
    }
}
