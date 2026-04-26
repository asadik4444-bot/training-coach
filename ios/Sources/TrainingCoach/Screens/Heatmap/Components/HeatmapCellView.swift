import SwiftUI
import UIKit

struct HeatmapCellView: View {
    let cell: HeatmapCell
    let size: CGFloat
    let isToday: Bool
    let onTap: (HeatmapCell) -> Void

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onTap(cell)
        } label: {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(fill)
                .overlay {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .stroke(borderColor, lineWidth: borderWidth)
                }
                .overlay {
                    if isToday {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .stroke(Color.text, lineWidth: 1.5)
                    }
                }
                .frame(width: size, height: size)
                .frame(width: max(size, 22), height: max(size, 22))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
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
