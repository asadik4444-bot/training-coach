import SwiftUI

struct OnboardingBrandHeader: View {
    let brandSize: CGFloat
    let subtitleSize: CGFloat
    let isVisible: Bool
    let reduceMotion: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.primary.opacity(0.12),
                            Color.primaryLight.opacity(0.055),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 4,
                        endRadius: 150
                    )
                )
                .frame(width: 260, height: 260)
                .blur(radius: 60)
                .offset(y: -26)
                .accessibilityHidden(true)

            VStack(spacing: 10) {
                Text("TRAINING COACH")
                    .font(.firaSans(brandSize, weight: .bold))
                    .kerning(1.5)
                    .foregroundStyle(Color.text)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .shadow(color: Color.primaryLight.opacity(0.20), radius: 18, y: 8)

                Text("HRV-aware coaching. Native iOS.")
                    .font(.firaSans(subtitleSize))
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .opacity(isVisible || reduceMotion ? 1 : 0)
        .offset(y: isVisible || reduceMotion ? 0 : 16)
        .accessibilityElement(children: .combine)
    }
}
