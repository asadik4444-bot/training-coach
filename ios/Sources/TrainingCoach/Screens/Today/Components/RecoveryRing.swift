import SwiftUI
import UIKit

struct RecoveryRing: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var animatedFraction: CGFloat
    @State private var isPulsing = false
    @State private var isTapExpanded = false
    @State private var didAppear = false

    private let score: Int
    private let band: RecoveryBand
    private let size: CGFloat
    private let animateOnAppear: Bool
    private let isLoading: Bool

    init(
        score: Int,
        band: RecoveryBand,
        size: CGFloat = 220,
        animateOnAppear: Bool = true,
        isLoading: Bool = false
    ) {
        let boundedScore = min(max(score, 0), 100)
        self.score = boundedScore
        self.band = band
        self.size = size
        self.animateOnAppear = animateOnAppear
        self.isLoading = isLoading
        self._animatedFraction = State(initialValue: animateOnAppear && !isLoading ? 0 : CGFloat(boundedScore) / 100)
    }

    var body: some View {
        Button(action: handleTap) {
            ZStack {
                RecoveryRingCanvas(
                    fraction: displayedFraction,
                    color: ringColor,
                    size: size
                )

                VStack(spacing: 3) {
                    RecoveryScoreText(
                        fraction: displayedFraction,
                        color: ringColor,
                        isLoading: isLoading,
                        isExpanded: isTapExpanded
                    )

                    Text("RECOVERY")
                        .font(.custom("FiraSans-Medium", size: 11, relativeTo: .caption2).weight(.medium))
                        .foregroundStyle(Color.textMuted)
                        .kerning(2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
                .frame(width: size * 0.68)
            }
            .frame(width: size, height: size)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .scaleEffect(loadingPulseScale)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: isPulsing)
        .recoveryRingReduceMotion(reduceMotion)
        .onAppear(perform: startAnimationIfNeeded)
        .onChange(of: targetFraction) { _, newValue in
            animate(to: newValue)
        }
        .onChange(of: reduceMotion) { _, isReduced in
            guard isReduced else {
                startAnimationIfNeeded()
                return
            }

            isPulsing = false
            animatedFraction = targetFraction
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Recovery")
        .accessibilityValue(accessibilityValue)
        .accessibilityHint("Shows the current recovery score.")
    }

    private var targetFraction: CGFloat {
        isLoading ? 0 : CGFloat(score) / 100
    }

    private var displayedFraction: CGFloat {
        if reduceMotion || !animateOnAppear || isLoading {
            return targetFraction
        }

        return animatedFraction
    }

    private var ringColor: Color {
        isLoading ? Color.textDim : band.color
    }

    private var loadingPulseScale: CGFloat {
        guard isLoading, !reduceMotion else {
            return 1
        }

        return isPulsing ? 1.04 : 1
    }

    private var accessibilityValue: String {
        guard !isLoading else {
            return "No recovery score"
        }

        return "\(score) percent, \(bandLabel)"
    }

    private var bandLabel: String {
        switch band {
        case .green:
            return "green"
        case .yellow:
            return "yellow"
        case .red:
            return "red"
        }
    }

    private func startAnimationIfNeeded() {
        guard !didAppear else {
            return
        }

        didAppear = true

        guard !reduceMotion else {
            animatedFraction = targetFraction
            return
        }

        if isLoading {
            withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) {
                isPulsing = true
            }
            return
        }

        animate(to: targetFraction)
    }

    private func animate(to fraction: CGFloat) {
        guard !reduceMotion, animateOnAppear, !isLoading else {
            animatedFraction = fraction
            return
        }

        withAnimation(.spring(response: 0.85, dampingFraction: 0.78)) {
            animatedFraction = fraction
        }
    }

    private func handleTap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        guard !reduceMotion else {
            return
        }

        withAnimation(.spring(response: 0.2, dampingFraction: 0.72)) {
            isTapExpanded = true
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
            withAnimation(.spring(response: 0.24, dampingFraction: 0.8)) {
                isTapExpanded = false
            }
        }
    }
}

private struct RecoveryRingCanvas: View, Animatable {
    var fraction: CGFloat
    let color: Color
    let size: CGFloat

    var animatableData: CGFloat {
        get { fraction }
        set { fraction = newValue }
    }

    var body: some View {
        Canvas { context, canvasSize in
            let lineWidth: CGFloat = 18
            let diameter = min(canvasSize.width, canvasSize.height)
            let radius = (diameter - lineWidth) / 2
            let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
            let strokeStyle = StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)

            var trackPath = Path()
            trackPath.addEllipse(
                in: CGRect(
                    x: center.x - radius,
                    y: center.y - radius,
                    width: radius * 2,
                    height: radius * 2
                )
            )

            context.stroke(
                trackPath,
                with: .color(Color.bgCard.opacity(0.6)),
                style: strokeStyle
            )

            let boundedFraction = min(max(fraction, 0), 1)
            guard boundedFraction > 0 else {
                return
            }

            var fillPath = Path()
            fillPath.addArc(
                center: center,
                radius: radius,
                startAngle: .degrees(-90),
                endAngle: .degrees(-90 + (360 * Double(boundedFraction))),
                clockwise: false
            )

            let gradient = Gradient(stops: [
                .init(color: color.opacity(0.68), location: 0),
                .init(color: color.opacity(0.9), location: 0.42),
                .init(color: color, location: 1)
            ])

            context.drawLayer { layer in
                layer.addFilter(.shadow(color: color.opacity(0.6), radius: 18, x: 0, y: 0))
                layer.stroke(
                    fillPath,
                    with: .conicGradient(gradient, center: center, angle: .degrees(-90)),
                    style: strokeStyle
                )
            }
        }
        .frame(width: size, height: size)
    }
}

private struct RecoveryScoreText: View, Animatable {
    var fraction: CGFloat
    let color: Color
    let isLoading: Bool
    let isExpanded: Bool

    var animatableData: CGFloat {
        get { fraction }
        set { fraction = newValue }
    }

    var body: some View {
        Text(scoreText)
            .font(.firaCode(64, weight: .semibold).monospacedDigit())
            .foregroundStyle(color)
            .lineLimit(1)
            .minimumScaleFactor(0.58)
            .scaleEffect(isExpanded ? 1.08 : 1)
            .shadow(color: isLoading ? .clear : color.opacity(0.62), radius: isExpanded ? 14 : 10)
    }

    private var scoreText: String {
        guard !isLoading else {
            return "--%"
        }

        return "\(Int((fraction * 100).rounded()))%"
    }
}

private struct RecoveryRingMotionModifier: ViewModifier {
    let reduceMotion: Bool

    func body(content: Content) -> some View {
        content.transaction { transaction in
            guard reduceMotion else {
                return
            }

            transaction.animation = nil
            transaction.disablesAnimations = true
        }
    }
}

extension View {
    func recoveryRingReduceMotion(_ reduceMotion: Bool) -> some View {
        modifier(RecoveryRingMotionModifier(reduceMotion: reduceMotion))
    }
}
