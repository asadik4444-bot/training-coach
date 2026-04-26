import SwiftUI

struct OnboardingConnectButtonStyle: ButtonStyle {
    let isValidating: Bool
    let reduceMotion: Bool
    let glowPulse: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                LinearGradient(
                    colors: [
                        Color.primaryLight.opacity(0.96),
                        Color.primary
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(Capsule())
            .overlay {
                Capsule()
                    .stroke(ringColor, lineWidth: isValidating ? 1.5 : 0.7)
                    .shadow(color: ringShadowColor, radius: isValidating ? ringRadius : 0)
            }
            .shadow(color: shadowColor, radius: shadowRadius, y: 5)
            .scaleEffect(configuration.isPressed && reduceMotion == false && isValidating == false ? 0.97 : 1)
            .animation(pressAnimation, value: configuration.isPressed)
    }

    private var pressAnimation: Animation {
        reduceMotion ? .linear(duration: 0.01) : .spring(response: 0.22, dampingFraction: 0.72)
    }

    private var shadowColor: Color {
        if isValidating {
            return Color.primaryLight.opacity(glowPulse ? 0.34 : 0.18)
        }

        return (glowPulse ? Color.primaryLight : Color.primary).opacity(0.24)
    }

    private var shadowRadius: CGFloat {
        glowPulse ? 18 : 12
    }

    private var ringColor: Color {
        if isValidating {
            return Color.primaryLight.opacity(glowPulse ? 0.95 : 0.42)
        }

        return Color.text.opacity(0.12)
    }

    private var ringShadowColor: Color {
        Color.primaryLight.opacity(glowPulse ? 0.45 : 0.12)
    }

    private var ringRadius: CGFloat {
        glowPulse ? 16 : 6
    }
}
