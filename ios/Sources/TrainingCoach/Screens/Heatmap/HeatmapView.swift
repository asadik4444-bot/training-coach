import SwiftUI

struct HeatmapView: View {
    @State private var viewModel = HeatmapViewModel()
    @State private var selectedEntry: SelectedHeatmapEntry?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("RECOVERY (90 DAYS)")
                    .font(.firaSans(12, weight: .semibold))
                    .foregroundStyle(Color.textDim)
                    .textCase(.uppercase)
                    .tracking(0.6)

                content
            }
            .padding(.horizontal, 20)
            .padding(.top, 28)
            .padding(.bottom, 40)
        }
        .background(Color.bg.ignoresSafeArea())
        .refreshable {
            await viewModel.load()
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
            HeatmapEmptyState {
                Task {
                    await viewModel.load()
                }
            }

        case .loading:
            HeatmapGridSection {
                HeatmapGridSkeleton()
            }
            HeatmapLegend()

        case .error(let error):
            HeatmapErrorState(error: error) {
                Task {
                    await viewModel.load()
                }
            }

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
                .padding(.top, 0)

            content
        }
    }
}

private struct WeekdayLabelColumn: View {
    private let labels = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        VStack(spacing: 5) {
            ForEach(labels.indices, id: \.self) { index in
                Text(labels[index])
                    .font(.firaSans(10, weight: .medium))
                    .foregroundStyle(Color.textDim)
                    .frame(width: 12, height: 22)
            }
        }
        .accessibilityHidden(true)
    }
}

private struct HeatmapLegend: View {
    private let sampleColors: [Color] = [
        Color.bgCard.opacity(0.5),
        Color.recoveryGreen.opacity(0.25),
        Color.recoveryGreen.opacity(0.55),
        Color.recoveryGreen.opacity(0.85)
    ]

    var body: some View {
        HStack(spacing: 8) {
            Text("Less")
                .font(.firaSans(10, weight: .medium))
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
                .font(.firaSans(10, weight: .medium))
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
        .background(Color.bgSurface, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.border, lineWidth: 0.5)
        }
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
        .background(Color.bgSurface, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.border, lineWidth: 0.5)
        }
    }

    private var message: String {
        if error.isUnauthorized {
            return "Authentication failed. Open Settings to authenticate again."
        }
        return error.message
    }
}
