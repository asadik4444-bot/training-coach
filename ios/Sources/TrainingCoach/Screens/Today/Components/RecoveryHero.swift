import SwiftUI

struct RecoveryHero: View {
    let score: Int?

    private var band: RecoveryBand? {
        score.map(RecoveryBand.from(score:))
    }

    var body: some View {
        VStack(spacing: 0) {
            if let score, let band {
                RecoveryRing(score: score, band: band, size: 232)
            } else {
                RecoveryRing(score: 0, band: .red, size: 232, animateOnAppear: false, isLoading: true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 268)
        .padding(.vertical, 24)
        .todayCardStyle()
    }
}
