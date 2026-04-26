import SwiftUI
import UIKit

struct HeatmapCellView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPressedPreview = false

    let cell: HeatmapCell
    let size: CGFloat
    let isToday: Bool
    let isPastEmpty: Bool
    let onTap: (HeatmapCell) -> Void

    var body: some View {
        Button(action: handleTap) {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(fill)
                .overlay {
                    if isPastEmpty {
                        DiagonalStripePattern()
                            .stroke(Color.textDim.opacity(0.3), lineWidth: 1)
                            .mask {
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                            }
                    }
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .stroke(borderColor, lineWidth: borderWidth)
                }
                .overlay {
                    if isToday {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .stroke(Color.text, lineWidth: 2)
                    }
                }
                .frame(width: size, height: size)
                .scaleEffect(isPressedPreview && !reduceMotion ? 1.15 : 1)
                .frame(width: HeatmapGridMetrics.tapTargetSide, height: HeatmapGridMetrics.tapTargetSide)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
    }

    private func handleTap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        guard !reduceMotion else {
            onTap(cell)
            return
        }

        withAnimation(.spring(response: 0.16, dampingFraction: 0.56)) {
            isPressedPreview = true
        } completion: {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.74)) {
                isPressedPreview = false
            } completion: {
                onTap(cell)
            }
        }
    }

    private var fill: Color {
        if let color = cell.band?.color {
            return color.opacity(0.85)
        }

        return Color.bgCard.opacity(0.5)
    }

    private var borderColor: Color {
        cell.score == nil ? Color.border : Color.clear
    }

    private var borderWidth: CGFloat {
        cell.score == nil ? 0.5 : 0
    }

    private var accessibilityLabel: String {
        if let score = cell.score {
            return "\(cell.date), recovery \(score)"
        }

        return "\(cell.date), no data"
    }
}

private struct DiagonalStripePattern: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let spacing: CGFloat = 6
        var offset = -rect.height

        while offset <= rect.width {
            path.move(to: CGPoint(x: offset, y: rect.maxY))
            path.addLine(to: CGPoint(x: offset + rect.height, y: rect.minY))
            offset += spacing
        }

        return path
    }
}
