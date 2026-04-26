import Foundation
import SwiftUI

enum HeatmapGridMetrics {
    static let visibleCellSide: CGFloat = 22
    static let tapTargetSide: CGFloat = 44
    static let spacing: CGFloat = 5
    static let rowCount = 7
    static let monthLabelHeight: CGFloat = 18
    static let monthLabelSpacing: CGFloat = 8

    static var bodyHeight: CGFloat {
        CGFloat(rowCount) * tapTargetSide + CGFloat(rowCount - 1) * spacing
    }

    static var fullHeight: CGFloat {
        monthLabelHeight + monthLabelSpacing + bodyHeight
    }
}

struct HeatmapGrid: View {
    let cells: [HeatmapCell]
    let onSelect: (HeatmapCell) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: HeatmapGridMetrics.monthLabelSpacing) {
            MonthMarkerRow(cells: cells, columnWidth: HeatmapGridMetrics.tapTargetSide)
                .frame(width: gridWidth, height: HeatmapGridMetrics.monthLabelHeight, alignment: .leading)

            LazyHGrid(rows: rows, spacing: spacing) {
                ForEach(cells) { cell in
                    HeatmapCellView(
                        cell: cell,
                        size: HeatmapGridMetrics.visibleCellSide,
                        isToday: cell.date == todayString,
                        isPastEmpty: cell.entry == nil && cell.date < todayString,
                        onTap: onSelect
                    )
                }
            }
            .frame(width: gridWidth, height: HeatmapGridMetrics.bodyHeight, alignment: .leading)
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: cells)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Recovery heatmap")
        }
        .frame(width: gridWidth, height: HeatmapGridMetrics.fullHeight, alignment: .leading)
    }

    private var spacing: CGFloat {
        HeatmapGridMetrics.spacing
    }

    private var todayString: String {
        Self.dateString(from: Date(), calendar: .current)
    }

    private var rows: [GridItem] {
        Array(
            repeating: GridItem(.fixed(HeatmapGridMetrics.tapTargetSide), spacing: spacing),
            count: HeatmapGridMetrics.rowCount
        )
    }

    private var columnCount: Int {
        max(Int(ceil(Double(cells.count) / Double(HeatmapGridMetrics.rowCount))), 1)
    }

    private var gridWidth: CGFloat {
        CGFloat(columnCount) * HeatmapGridMetrics.tapTargetSide + CGFloat(max(columnCount - 1, 0)) * spacing
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

    var body: some View {
        VStack(alignment: .leading, spacing: HeatmapGridMetrics.monthLabelSpacing) {
            HStack(spacing: 22) {
                ForEach(0..<4, id: \.self) { _ in
                    Capsule()
                        .fill(Color.textDim.opacity(0.16))
                        .frame(width: 32, height: 8)
                }
            }
            .frame(width: gridWidth, height: HeatmapGridMetrics.monthLabelHeight, alignment: .leading)

            LazyHGrid(rows: rows, spacing: spacing) {
                ForEach(0..<placeholderCount, id: \.self) { _ in
                    skeletonCell(side: HeatmapGridMetrics.visibleCellSide)
                }
            }
            .frame(width: gridWidth, height: HeatmapGridMetrics.bodyHeight, alignment: .leading)
        }
        .frame(width: gridWidth, height: HeatmapGridMetrics.fullHeight, alignment: .leading)
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

    private var spacing: CGFloat {
        HeatmapGridMetrics.spacing
    }

    private var rows: [GridItem] {
        Array(
            repeating: GridItem(.fixed(HeatmapGridMetrics.tapTargetSide), spacing: spacing),
            count: HeatmapGridMetrics.rowCount
        )
    }

    private var placeholderCount: Int {
        91
    }

    private var columnCount: Int {
        max(Int(ceil(Double(placeholderCount) / Double(HeatmapGridMetrics.rowCount))), 1)
    }

    private var gridWidth: CGFloat {
        CGFloat(columnCount) * HeatmapGridMetrics.tapTargetSide + CGFloat(max(columnCount - 1, 0)) * spacing
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
            .frame(width: HeatmapGridMetrics.tapTargetSide, height: HeatmapGridMetrics.tapTargetSide)
    }
}

private struct MonthMarkerRow: View {
    let cells: [HeatmapCell]
    let columnWidth: CGFloat

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(markers) { marker in
                Text(marker.label)
                    .font(.firaCode(10, weight: .medium))
                    .foregroundStyle(Color.textDim)
                    .frame(width: 42, alignment: .leading)
                    .offset(x: CGFloat(marker.column) * (columnWidth + HeatmapGridMetrics.spacing))
            }
        }
        .accessibilityHidden(true)
    }

    private var markers: [MonthMarker] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current

        return cells.enumerated().compactMap { index, cell in
            guard let date = Self.date(from: cell.date, calendar: calendar) else {
                return nil
            }

            let day = calendar.component(.day, from: date)
            guard day == 1 || index == 0 else {
                return nil
            }

            return MonthMarker(
                id: cell.date,
                label: date.formatted(.dateTime.month(.abbreviated)),
                column: index / HeatmapGridMetrics.rowCount
            )
        }
    }

    private static func date(from string: String, calendar: Calendar) -> Date? {
        let parts = string.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else {
            return nil
        }

        var components = DateComponents()
        components.calendar = calendar
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]

        return calendar.date(from: components)
    }
}

private struct MonthMarker: Identifiable {
    let id: String
    let label: String
    let column: Int
}
