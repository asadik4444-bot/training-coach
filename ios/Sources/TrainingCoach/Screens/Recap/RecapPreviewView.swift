import SwiftUI

struct RecapPreviewView: View {
    @Environment(\.dismiss) private var dismiss

    let period: RecapPeriod
    let viewModel: RecapViewModel

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bg.ignoresSafeArea()
                content
            }
            .navigationTitle(period.periodLabel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundStyle(Color.text)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    if let data = loadedData {
                        RecapShareButton(data: data)
                    }
                }
            }
        }
        .task(id: period) {
            switch period {
            case .week:
                await viewModel.loadWeek()
            case .month:
                await viewModel.loadMonth()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch currentState {
        case .empty:
            RecapPreviewPlaceholder(
                title: "No recap data",
                message: "Refresh after recovery data has synced.",
                retry: reload
            )

        case .loading:
            VStack(spacing: 14) {
                ProgressView()
                    .tint(Color.text)

                Text("Building \(period.periodLabel.lowercased())")
                    .font(.firaSans(14, weight: .medium))
                    .foregroundStyle(Color.textMuted)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .error(let error):
            RecapPreviewPlaceholder(
                title: "Could not build recap",
                message: error.message,
                retry: reload
            )

        case .success(let data):
            ScaledRecapCardPreview(data: data)
        }
    }

    private var currentState: LoadState<RecapData> {
        switch period {
        case .week:
            viewModel.weekState
        case .month:
            viewModel.monthState
        }
    }

    private var loadedData: RecapData? {
        guard case .success(let data) = currentState else {
            return nil
        }

        return data
    }

    private func reload() {
        Task {
            switch period {
            case .week:
                await viewModel.loadWeek()
            case .month:
                await viewModel.loadMonth()
            }
        }
    }
}

private struct ScaledRecapCardPreview: View {
    let data: RecapData

    var body: some View {
        GeometryReader { proxy in
            let cardWidth = min(max(proxy.size.width - 32, 260), 430)
            let scale = cardWidth / RecapCard.exportSize.width
            let cardHeight = RecapCard.exportSize.height * scale

            ScrollView {
                HStack {
                    Spacer(minLength: 0)

                    RecapCard(data: data)
                        .frame(width: RecapCard.exportSize.width, height: RecapCard.exportSize.height)
                        .scaleEffect(scale, anchor: .top)
                        .frame(width: cardWidth, height: cardHeight)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .shadow(color: .black.opacity(0.46), radius: 22, y: 12)

                    Spacer(minLength: 0)
                }
                .padding(.vertical, 20)
            }
        }
    }
}

private struct RecapPreviewPlaceholder: View {
    let title: String
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
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
            .accessibilityHint("Attempts to generate the recap again.")
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
