import SwiftUI

struct OnboardingFooter: View {
    @ScaledMetric(relativeTo: .caption2) private var footerSize: CGFloat = 10

    var body: some View {
        (
            Text("Powered by Whoop API · ")
                .font(.firaSans(footerSize, weight: .medium))
            +
            Text("v9.0")
                .font(.firaCode(footerSize, weight: .medium))
        )
        .foregroundStyle(Color.textDim)
        .frame(maxWidth: .infinity, minHeight: 24)
        .multilineTextAlignment(.center)
        .accessibilityLabel("Powered by Whoop API version 9.0")
    }
}
