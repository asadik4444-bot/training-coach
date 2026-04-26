import SwiftUI
import UIKit

struct GoalsView: View {
    private let telegramURL = URL(string: "https://t.me/whoop_trainer_bot")!

    @ScaledMetric(relativeTo: .largeTitle) private var iconSize: CGFloat = 64
    @ScaledMetric(relativeTo: .body) private var bodySize: CGFloat = 16
    @ScaledMetric(relativeTo: .body) private var buttonSize: CGFloat = 16

    var body: some View {
        ZStack {
            Color.bg
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    Image(systemName: "target")
                        .font(.system(size: iconSize, weight: .bold))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(Color.primaryLight)
                        .padding(.top, 36)
                        .accessibilityHidden(true)

                    Text("GOALS")
                        .font(.firaSans(28, weight: .bold))
                        .foregroundStyle(Color.text)
                        .tracking(1.5)

                    VStack(alignment: .leading, spacing: 18) {
                        Text("Goals are managed in Telegram.")
                            .font(.firaSans(20, weight: .semibold))
                            .foregroundStyle(Color.text)
                            .fixedSize(horizontal: false, vertical: true)

                        Text("Goals tracked via Telegram bot @whoop_trainer_bot. Type /goals there to view.")
                            .font(.firaSans(bodySize))
                            .foregroundStyle(Color.textMuted)
                            .fixedSize(horizontal: false, vertical: true)

                        Button("Open @whoop_trainer_bot", systemImage: "paperplane.fill", action: openTelegram)
                            .font(.firaSans(buttonSize, weight: .semibold))
                            .foregroundStyle(Color.text)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(Color.primary)
                            .clipShape(Capsule())
                            .shadow(color: Color.primary.opacity(0.28), radius: 12, y: 4)
                    }
                    .padding(22)
                    .background(cardGradient)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(Color.border.opacity(0.72), lineWidth: 1)
                    }
                    .shadow(color: Color.black.opacity(0.22), radius: 16, y: 8)

                    Text("Coming in v9.1: native goals editing")
                        .font(.firaSans(14, weight: .medium))
                        .foregroundStyle(Color.textDim.opacity(0.72))
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
    }

    private func openTelegram() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        UIApplication.shared.open(telegramURL)
    }

    private var cardGradient: LinearGradient {
        LinearGradient(
            colors: [
                Color.bgCard.opacity(0.98),
                Color.primaryLight.opacity(0.1),
                Color.bgSurface.opacity(0.9)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

#Preview {
    GoalsView()
        .preferredColorScheme(.dark)
}
