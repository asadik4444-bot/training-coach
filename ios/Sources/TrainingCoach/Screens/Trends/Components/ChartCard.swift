import Charts
import Foundation
import SwiftUI

struct ChartCard: View {
    let metricLabel: String
    let unit: String
    let color: Color
    let data: [TrendPoint]
    let windowLabel: String
    let isLoading: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedPoint: ChartPoint?
    @State private var skeletonPulse = false

    init(
        metricLabel: String,
        unit: String,
        color: Color,
        data: [TrendPoint],
        windowLabel: String,
        isLoading: Bool = false
    ) {
        self.metricLabel = metricLabel
        self.unit = unit
        self.color = color
        self.data = data
        self.windowLabel = windowLabel
        self.isLoading = isLoading
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if isLoading {
                skeletonContent
            } else {
                let points = chartPoints
                header(points: points)

                if points.isEmpty {
                    emptyContent
                } else {
                    chart(points: points)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackground)
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.border.opacity(0.75), lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: color.opacity(0.16), radius: 22, y: 12)
        .onAppear(perform: startSkeletonAnimation)
        .onChange(of: data) {
            selectedPoint = nil
        }
    }

    private var chartPoints: [ChartPoint] {
        data.enumerated()
            .compactMap { index, point in
                guard let date = Self.date(from: point.date) else {
                    return nil
                }

                return ChartPoint(
                    id: "\(point.date)-\(index)",
                    date: date,
                    value: point.value
                )
            }
            .sorted { $0.date < $1.date }
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        Color.bgCard,
                        color.opacity(0.13),
                        Color.bgSurface
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
    }

    private var skeletonContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 10) {
                    skeletonBar(width: 72, height: 13)
                    skeletonBar(width: 124, height: 30)
                }

                Spacer()
                skeletonBar(width: 42, height: 24)
            }

            VStack(alignment: .leading, spacing: 12) {
                skeletonBar(width: .infinity, height: 138)
                HStack {
                    skeletonBar(width: 44, height: 10)
                    Spacer()
                    skeletonBar(width: 44, height: 10)
                    Spacer()
                    skeletonBar(width: 44, height: 10)
                }
            }
            .frame(height: 190)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(metricLabel) \(windowLabel) chart loading")
    }

    private var emptyContent: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(color.opacity(0.75))
                .accessibilityHidden(true)

            Text("No data yet")
                .font(.firaSans(15, weight: .medium))
                .foregroundStyle(Color.textMuted)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 190)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(metricLabel) \(windowLabel) chart, latest no data")
    }

    private func header(points: [ChartPoint]) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Text(metricLabel)
                    .font(.firaSans(13, weight: .semibold))
                    .foregroundStyle(Color.textMuted)

                Text(latestValueText(points: points))
                    .font(.firaCode(28, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .shadow(color: color.opacity(0.55), radius: 14)
            }

            Spacer(minLength: 12)

            Text(windowLabel)
                .font(.firaCode(12, weight: .medium).monospacedDigit())
                .foregroundStyle(color)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(color.opacity(0.14), in: Capsule(style: .continuous))
        }
        .accessibilityElement(children: .combine)
    }

    private func chart(points: [ChartPoint]) -> some View {
        let yDomain = yDomain(points: points)

        return Chart {
            ForEach(points) { point in
                AreaMark(
                    x: .value("Date", point.date),
                    yStart: .value("Baseline", yDomain.lowerBound),
                    yEnd: .value(metricLabel, point.value)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            color.opacity(0.34),
                            color.opacity(0.04)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                LineMark(
                    x: .value("Date", point.date),
                    y: .value(metricLabel, point.value)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(color)
                .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
            }

            if let selectedPoint {
                RuleMark(x: .value("Selected Date", selectedPoint.date))
                    .foregroundStyle(Color.text.opacity(0.28))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 5]))

                PointMark(
                    x: .value("Selected Date", selectedPoint.date),
                    y: .value(metricLabel, selectedPoint.value)
                )
                .foregroundStyle(color)
                .symbolSize(78)
                .annotation(position: .top, alignment: .center) {
                    callout(point: selectedPoint)
                }
            }
        }
        .chartXScale(domain: xDomain(points: points))
        .chartYScale(domain: yDomain)
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) {
                AxisGridLine()
                    .foregroundStyle(Color.border.opacity(0.35))
                AxisTick()
                    .foregroundStyle(Color.border.opacity(0.55))
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) {
                AxisGridLine()
                    .foregroundStyle(Color.border.opacity(0.35))
                AxisTick()
                    .foregroundStyle(Color.border.opacity(0.55))
                AxisValueLabel()
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geometry in
                Rectangle()
                    .fill(Color.clear)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                selectNearestPoint(
                                    at: value.location,
                                    proxy: proxy,
                                    geometry: geometry,
                                    points: points
                                )
                            }
                    )
            }
        }
        .frame(height: 190)
        .accessibilityLabel("\(metricLabel) \(windowLabel) chart, latest \(accessibilityLatestValue(points: points))")
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.35), value: points)
        .transaction { transaction in
            if reduceMotion {
                transaction.animation = nil
            }
        }
    }

    private func callout(point: ChartPoint) -> some View {
        VStack(spacing: 3) {
            Text(point.date.formatted(.dateTime.month(.abbreviated).day()))
                .font(.firaSans(11, weight: .medium))
                .foregroundStyle(Color.textMuted)

            Text(formattedValue(point.value))
                .font(.firaCode(13, weight: .medium).monospacedDigit())
                .foregroundStyle(Color.text)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Color.bgSurface.opacity(0.96), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(color.opacity(0.55), lineWidth: 1)
        }
        .shadow(color: color.opacity(0.24), radius: 12, y: 6)
    }

    private func skeletonBar(width: CGFloat, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: min(height / 2, 8), style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        Color.text.opacity(0.08),
                        Color.text.opacity(skeletonPulse ? 0.18 : 0.11),
                        color.opacity(skeletonPulse ? 0.16 : 0.08)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(maxWidth: width == .infinity ? .infinity : width)
            .frame(height: height)
    }

    private func latestValueText(points: [ChartPoint]) -> String {
        guard let latest = points.last else {
            return "--"
        }

        return formattedValue(latest.value)
    }

    private func accessibilityLatestValue(points: [ChartPoint]) -> String {
        guard let latest = points.last else {
            return "no data"
        }

        return formattedValue(latest.value)
    }

    private func formattedValue(_ value: Double) -> String {
        let precision: FloatingPointFormatStyle<Double>.Configuration.Precision = unit.isEmpty
            ? .fractionLength(1)
            : .fractionLength(0)
        let number = value.formatted(.number.precision(precision))

        if unit == "%" {
            return "\(number)%"
        }

        if unit.isEmpty {
            return number
        }

        return "\(number) \(unit)"
    }

    private func xDomain(points: [ChartPoint]) -> ClosedRange<Date> {
        guard let firstDate = points.first?.date, let lastDate = points.last?.date else {
            let now = Date()
            return now...now.addingTimeInterval(86_400)
        }

        guard firstDate != lastDate else {
            return firstDate.addingTimeInterval(-43_200)...lastDate.addingTimeInterval(43_200)
        }

        return firstDate...lastDate
    }

    private func yDomain(points: [ChartPoint]) -> ClosedRange<Double> {
        let values = points.map(\.value)

        guard let minValue = values.min(), let maxValue = values.max() else {
            return 0...1
        }

        guard minValue != maxValue else {
            let padding = max(abs(maxValue) * 0.12, 1)
            return max(0, minValue - padding)...(maxValue + padding)
        }

        let padding = (maxValue - minValue) * 0.18
        return max(0, minValue - padding)...(maxValue + padding)
    }

    private func selectNearestPoint(
        at location: CGPoint,
        proxy: ChartProxy,
        geometry: GeometryProxy,
        points: [ChartPoint]
    ) {
        guard let plotFrame = proxy.plotFrame else {
            return
        }

        let frame = geometry[plotFrame]
        let xPosition = location.x - frame.origin.x

        guard xPosition >= 0, xPosition <= frame.width,
              let selectedDate = proxy.value(atX: xPosition, as: Date.self),
              let nearestPoint = nearestPoint(to: selectedDate, in: points)
        else {
            return
        }

        selectedPoint = nearestPoint
    }

    private func nearestPoint(to date: Date, in points: [ChartPoint]) -> ChartPoint? {
        points.min { lhs, rhs in
            abs(lhs.date.timeIntervalSince(date)) < abs(rhs.date.timeIntervalSince(date))
        }
    }

    private func startSkeletonAnimation() {
        guard isLoading, reduceMotion == false else {
            skeletonPulse = false
            return
        }

        withAnimation(.easeInOut(duration: 0.95).repeatForever(autoreverses: true)) {
            skeletonPulse = true
        }
    }

    private static func date(from string: String) -> Date? {
        let parts = string.split(separator: "-")

        guard parts.count == 3,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              let day = Int(parts[2])
        else {
            return nil
        }

        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = TimeZone(secondsFromGMT: 0)
        components.year = year
        components.month = month
        components.day = day

        return components.date
    }

    private struct ChartPoint: Identifiable, Equatable {
        let id: String
        let date: Date
        let value: Double
    }
}
