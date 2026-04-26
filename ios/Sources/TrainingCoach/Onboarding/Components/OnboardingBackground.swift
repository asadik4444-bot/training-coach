import SwiftUI

struct OnboardingBackground: View {
    var body: some View {
        ZStack {
            Color.bg

            RadialGradient(
                colors: [
                    Color.primaryLight.opacity(0.10),
                    Color.primary.opacity(0.045),
                    Color.clear
                ],
                center: .top,
                startRadius: 20,
                endRadius: 520
            )
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}
