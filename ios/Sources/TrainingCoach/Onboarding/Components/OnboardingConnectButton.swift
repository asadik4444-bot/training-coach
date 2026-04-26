import SwiftUI

struct OnboardingConnectButton: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let isValidating: Bool
    let fontSize: CGFloat
    let action: () -> Void

    @State private var glowPulse = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isValidating {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(Color.text)
                        .accessibilityHidden(true)
                } else {
                    Text("Connect")
                        .font(.firaSans(fontSize, weight: .semibold))

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .bold))
                        .accessibilityHidden(true)
                }
            }
            .foregroundStyle(Color.text)
            .frame(maxWidth: .infinity, minHeight: 58)
            .contentShape(Capsule())
        }
        .buttonStyle(
            OnboardingConnectButtonStyle(
                isValidating: isValidating,
                reduceMotion: reduceMotion,
                glowPulse: glowPulse
            )
        )
        .opacity(isValidating ? 0.82 : 1)
        .disabled(isValidating)
        .accessibilityLabel(isValidating ? "Connecting" : "Connect")
        .accessibilityHint(isValidating ? "Validating the dashboard secret." : "Validates the dashboard secret and signs in.")
        .onAppear(perform: startGlow)
        .onChange(of: reduceMotion) {
            startGlow()
        }
    }

    private func startGlow() {
        guard reduceMotion == false else {
            glowPulse = false
            return
        }

        withAnimation(.easeInOut(duration: 1.7).repeatForever(autoreverses: true)) {
            glowPulse = true
        }
    }
}
