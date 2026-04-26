import SwiftUI

struct RecoveryHero: View {
    let score: Int?

    private var band: RecoveryBand? {
        score.map(RecoveryBand.from(score:))
    }

    var body: some View {
        VStack(spacing: 0) {
            if let score, let band {
                RecoveryRing(score: score, band: band)
            } else {
                RecoveryRing(score: 0, band: .red, animateOnAppear: false, isLoading: true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 268)
        .padding(.vertical, 24)
        .todayCardStyle()
    }
}
