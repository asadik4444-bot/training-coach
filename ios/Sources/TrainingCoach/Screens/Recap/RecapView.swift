import SwiftUI

struct RecapView: View {
    @State private var viewModel = RecapViewModel()
    @State private var selectedPeriod: RecapPeriod?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bg.ignoresSafeArea()

                VStack(spacing: 14) {
                    RecapPeriodButton(period: .week) {
                        selectedPeriod = .week
                    }

                    RecapPeriodButton(period: .month) {
                        selectedPeriod = .month
                    }

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 18)
            }
            .navigationTitle("Recap")
            .navigationBarTitleDisplayMode(.inline)
        }
        .fullScreenCover(item: $selectedPeriod) { period in
            RecapPreviewView(period: period, viewModel: viewModel)
        }
    }
}

private struct RecapPeriodButton: View {
    let period: RecapPeriod
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: period.symbolName)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.primaryLight)
                    .frame(width: 44, height: 44)
                    .background(Color.primaryLight.opacity(0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 5) {
                    Text(period.periodLabel)
                        .font(.firaCode(18, weight: .medium))
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)

                    Text(period.detailLabel)
                        .font(.firaSans(11, weight: .medium))
                        .foregroundStyle(Color.textMuted)
                        .tracking(1.2)
                }

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.textDim)
                    .accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity, minHeight: 82, alignment: .leading)
            .padding(16)
            .todayCardStyle()
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the \(period.detailLabel.lowercased()) recap preview.")
    }
}
