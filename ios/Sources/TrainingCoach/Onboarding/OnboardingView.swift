import SwiftUI
import UIKit

struct OnboardingView: View {
    @Environment(AuthState.self) private var auth
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var secret = ""
    @State private var state = LoadState.idle
    @State private var shakeOffset: CGFloat = 0
    @State private var contentVisible = false

    @ScaledMetric(relativeTo: .largeTitle) private var brandSize: CGFloat = 34
    @ScaledMetric(relativeTo: .body) private var subtitleSize: CGFloat = 16
    @ScaledMetric(relativeTo: .body) private var buttonSize: CGFloat = 17

    var body: some View {
        ZStack {
            OnboardingBackground()

            VStack(spacing: 0) {
                Spacer(minLength: 32)

                VStack(spacing: 30) {
                    OnboardingBrandHeader(
                        brandSize: brandSize,
                        subtitleSize: subtitleSize,
                        isVisible: contentVisible,
                        reduceMotion: reduceMotion
                    )

                    VStack(alignment: .leading, spacing: 18) {
                        DashboardSecretField(
                            secret: $secret,
                            showsError: state == .error,
                            onSubmit: connect
                        )

                        OnboardingConnectButton(
                            isValidating: state == .validating,
                            fontSize: buttonSize,
                            action: connect
                        )

                        OnboardingFooter()
                    }
                    .offset(x: shakeOffset)
                }
                .frame(maxWidth: 440)

                Spacer(minLength: 40)
            }
            .padding(.horizontal, 28)
        }
        .onAppear(perform: revealContent)
        .onChange(of: reduceMotion) {
            if reduceMotion {
                contentVisible = true
            }
        }
    }

    private func revealContent() {
        guard reduceMotion == false else {
            contentVisible = true
            return
        }

        withAnimation(.spring(response: 0.8, dampingFraction: 0.86)) {
            contentVisible = true
        }
    }

    private func connect() {
        let trimmedSecret = secret.trimmingCharacters(in: .whitespacesAndNewlines)

        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        guard trimmedSecret.isEmpty == false else {
            showError()
            return
        }

        state = .validating
        shakeOffset = 0

        let client = APIClient(secretProvider: { trimmedSecret })

        Task { @MainActor in
            do {
                try await auth.setSecret(trimmedSecret, validatingWith: client)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                showError()
            }
        }
    }

    private func showError() {
        state = .error

        guard reduceMotion == false else {
            shakeOffset = 0
            return
        }

        Task { @MainActor in
            for offset in [-8, 8, -8, 8, -8, 8, 0] {
                withAnimation(.linear(duration: 0.06)) {
                    shakeOffset = CGFloat(offset)
                }

                try? await Task.sleep(nanoseconds: 60_000_000)
            }
        }
    }

    private enum LoadState {
        case idle
        case validating
        case error
    }
}
