import Foundation
import SwiftUI

struct HeatmapGrid: View {
    let cells: [HeatmapCell]
    let onSelect: (HeatmapCell) -> Void

    private let spacing: CGFloat = 5

    var body: some View {
        GeometryReader { proxy in
            let side = cellSide(for: proxy.size.width)
            let touchSide = max(side, 22)
            let rows = Array(
                repeating: GridItem(.fixed(touchSide), spacing: spacing),
                count: 7
            )

            LazyHGrid(rows: rows, spacing: spacing) {
                ForEach(cells) { cell in
                    HeatmapCellView(
                        cell: cell,
                        size: side,
                        isToday: cell.date == todayString,
                        onTap: onSelect
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: cells)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Recovery heatmap")
        }
        .frame(height: gridHeight)
    }

    private var gridHeight: CGFloat {
        7 * 22 + 6 * spacing
    }

    private var todayString: String {
        Self.dateString(from: Date(), calendar: .current)
    }

    private func cellSide(for width: CGFloat) -> CGFloat {
        let availableWidth = max(width - spacing * 12, 0)
        return min(max(floor(availableWidth / 13), 16), 22)
    }

    private static func dateString(from date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let year = components.year ?? 0
        let month = components.month ?? 1
        let day = components.day ?? 1

        return String(format: "%04d-%02d-%02d", year, month, day)
    }
}

struct HeatmapGridSkeleton: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shimmerOffset: CGFloat = -1

    private let spacing: CGFloat = 5

    var body: some View {
        GeometryReader { proxy in
            let side = cellSide(for: proxy.size.width)
            let touchSide = max(side, 22)
            let rows = Array(
                repeating: GridItem(.fixed(touchSide), spacing: spacing),
                count: 7
            )

            LazyHGrid(rows: rows, spacing: spacing) {
                ForEach(0..<90, id: \.self) { _ in
                    skeletonCell(side: side)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: gridHeight)
        .task(id: reduceMotion) {
            guard !reduceMotion else {
                shimmerOffset = -1
                return
            }

            shimmerOffset = -1
            withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                shimmerOffset = 1
            }
        }
        .accessibilityHidden(true)
    }

    private var gridHeight: CGFloat {
        7 * 22 + 6 * spacing
    }

    private func skeletonCell(side: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(Color.bgCard.opacity(0.5))
            .overlay {
                if !reduceMotion {
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0),
                            Color.white.opacity(0.35),
                            Color.white.opacity(0)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .offset(x: shimmerOffset * 40)
                    .mask {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                    }
                }
            }
            .opacity(0.3)
            .frame(width: side, height: side)
            .frame(width: max(side, 22), height: max(side, 22))
    }

    private func cellSide(for width: CGFloat) -> CGFloat {
        let availableWidth = max(width - spacing * 12, 0)
        return min(max(floor(availableWidth / 13), 16), 22)
    }
}
