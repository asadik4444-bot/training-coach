import SwiftUI
import UIKit

struct OnboardingView: View {
    @Environment(AuthState.self) private var auth
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var secret = ""
    @State private var state = LoadState.idle
    @State private var shakeOffset: CGFloat = 0

    @ScaledMetric(relativeTo: .largeTitle) private var brandSize: CGFloat = 34
    @ScaledMetric(relativeTo: .body) private var subtitleSize: CGFloat = 16
    @ScaledMetric(relativeTo: .body) private var fieldSize: CGFloat = 16
    @ScaledMetric(relativeTo: .body) private var buttonSize: CGFloat = 17

    var body: some View {
        ZStack {
            Color.bg
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: 88)

                VStack(spacing: 12) {
                    Text("TRAINING COACH")
                        .font(.firaSans(brandSize, weight: .bold))
                        .kerning(1.5)
                        .foregroundStyle(Color.text)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)

                    Text("HRV-aware coaching. Native iOS.")
                        .font(.firaSans(subtitleSize))
                        .foregroundStyle(Color.textMuted)
                        .multilineTextAlignment(.center)
                }
                .accessibilityElement(children: .combine)

                Spacer(minLength: 96)

                VStack(alignment: .leading, spacing: 14) {
                    SecureField("Dashboard secret", text: $secret)
                        .font(.firaCode(fieldSize))
                        .foregroundStyle(Color.text)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(.password)
                        .submitLabel(.go)
                        .onSubmit(connect)
                        .padding(20)
                        .background(Color.bgCard.opacity(0.6))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Color.border, lineWidth: 1)
                        }
                        .accessibilityLabel("Dashboard secret")
                        .accessibilityHint("Paste your dashboard secret.")

                    Text("Paste your dashboard secret. Find it in your bookmarks or Vercel env.")
                        .font(.caption)
                        .foregroundStyle(Color.textDim)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("Invalid secret. Try again.")
                        .font(.firaSans(13, weight: .medium))
                        .foregroundStyle(Color.recoveryRed)
                        .opacity(state == .error ? 1 : 0)
                        .accessibilityHidden(state != .error)

                    Button(action: connect) {
                        Group {
                            if state == .validating {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(.white)
                            } else {
                                Text("Connect")
                                    .font(.firaSans(buttonSize, weight: .semibold))
                                    .foregroundStyle(Color.text)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                    }
                    .background(Color.primary)
                    .clipShape(.capsule)
                    .shadow(color: Color.primary.opacity(0.3), radius: 12, y: 4)
                    .opacity(state == .validating ? 0.7 : 1)
                    .disabled(state == .validating)
                    .accessibilityLabel(state == .validating ? "Connecting" : "Connect")
                }
                .offset(x: shakeOffset)

                Spacer(minLength: 88)
            }
            .padding(.horizontal, 28)
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
