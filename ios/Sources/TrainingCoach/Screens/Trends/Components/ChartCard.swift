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
    @State private var skeletonPhase: CGFloat = 0

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

                if points.count < 2 {
                    sparseContent(points: points)
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
        .shadow(color: .black.opacity(0.4), radius: 12, y: 4)
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
                        Color.bg
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

            VStack(alignment: .leading, spacing: 14) {
                ZStack {
                    VStack(spacing: 0) {
                        ForEach(0..<4, id: \.self) { index in
                            Rectangle()
                                .fill(Color.border.opacity(0.22))
                                .frame(height: 1)

                            if index < 3 {
                                Spacer()
                            }
                        }
                    }

                    SkeletonSineWave(phase: skeletonPhase)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    color.opacity(skeletonPulse ? 0.72 : 0.38),
                                    Color.text.opacity(skeletonPulse ? 0.18 : 0.1),
                                    color.opacity(skeletonPulse ? 0.52 : 0.28)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
                        )
                        .shadow(color: color.opacity(0.24), radius: 10)
                }
                .frame(height: 138)

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

    private func sparseContent(points: [ChartPoint]) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(color.opacity(0.75))
                .accessibilityHidden(true)

            Text("Sparse data — sync more workouts")
                .font(.firaSans(15, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 190)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(metricLabel) \(windowLabel) chart, \(points.count) data points")
    }

    private func header(points: [ChartPoint]) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(metricLabel.uppercased())
                        .font(.firaSans(11, weight: .semibold))
                        .foregroundStyle(Color.textDim)
                        .tracking(1.2)

                    Text(windowLabel.uppercased())
                        .font(.firaCode(10, weight: .medium).monospacedDigit())
                        .foregroundStyle(Color.textDim)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(Color.bgSurface, in: Capsule(style: .continuous))
                }

                Text(latestValueText(points: points))
                    .font(.firaCode(30, weight: .medium).monospacedDigit())
                    .foregroundStyle(points.isEmpty ? Color.textDim : color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .shadow(color: color.opacity(0.55), radius: 14)
            }

            Spacer(minLength: 12)

            trendBadge(points: points)
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
                    callout(point: selectedPoint, in: points)
                        .id(selectedPoint.id)
                        .transition(reduceMotion ? .opacity : .scale(scale: 0.88).combined(with: .opacity))
                        .animation(
                            reduceMotion ? .easeInOut(duration: 0.12) : .spring(response: 0.28, dampingFraction: 0.78),
                            value: selectedPoint.id
                        )
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
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { axisValue in
                AxisGridLine()
                    .foregroundStyle(Color.border.opacity(0.3))
                AxisValueLabel {
                    if let value = axisValue.as(Double.self) {
                        Text(axisLabel(value))
                            .font(.firaCode(10, weight: .medium).monospacedDigit())
                            .foregroundStyle(Color.textDim)
                            .frame(width: 44, alignment: .trailing)
                    }
                }
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

    private func trendBadge(points: [ChartPoint]) -> some View {
        let summary = trendSummary(points: points)

        return HStack(spacing: 6) {
            Image(systemName: summary?.symbolName ?? "minus")
                .font(.system(size: 11, weight: .semibold))
                .accessibilityHidden(true)

            Text(summary?.text ?? "No prior")
                .font(.firaCode(11, weight: .medium).monospacedDigit())
        }
        .foregroundStyle(summary?.color ?? Color.textDim)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background((summary?.color ?? Color.textDim).opacity(0.14), in: Capsule(style: .continuous))
        .overlay {
            Capsule(style: .continuous)
                .stroke((summary?.color ?? Color.border).opacity(0.42), lineWidth: 1)
        }
        .accessibilityLabel(summary?.accessibilityLabel ?? "No previous period")
    }

    private func callout(point: ChartPoint, in points: [ChartPoint]) -> some View {
        VStack(spacing: 5) {
            Text(point.date.formatted(.dateTime.month(.abbreviated).day()))
                .font(.firaSans(11, weight: .medium))
                .foregroundStyle(Color.textMuted)

            Text(formattedValue(point.value))
                .font(.firaCode(13, weight: .medium).monospacedDigit())
                .foregroundStyle(Color.text)

            if let summary = trendSummary(for: point, in: points) {
                HStack(spacing: 4) {
                    Image(systemName: summary.symbolName)
                        .font(.system(size: 9, weight: .bold))
                        .accessibilityHidden(true)

                    Text("vs prev \(summary.text)")
                        .font(.firaCode(10, weight: .medium).monospacedDigit())
                }
                .foregroundStyle(summary.color)
            }
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

    private func trendSummary(points: [ChartPoint]) -> TrendSummary? {
        guard points.count >= 2,
              let latest = points.last
        else {
            return nil
        }

        return trendSummary(for: latest, in: points)
    }

    private func trendSummary(for point: ChartPoint, in points: [ChartPoint]) -> TrendSummary? {
        guard let index = points.firstIndex(of: point), index > 0 else {
            return nil
        }

        let delta = point.value - points[index - 1].value
        return TrendSummary(
            text: formattedDelta(delta),
            symbolName: symbolName(for: delta),
            color: trendColor(for: delta),
            accessibilityLabel: "Delta versus previous period \(formattedDelta(delta))"
        )
    }

    private func formattedDelta(_ delta: Double) -> String {
        let sign = delta > 0 ? "+" : delta < 0 ? "-" : ""
        return "\(sign)\(formattedValue(abs(delta)))"
    }

    private func symbolName(for delta: Double) -> String {
        if delta > 0 {
            return "arrow.up.right"
        }

        if delta < 0 {
            return "arrow.down.right"
        }

        return "arrow.right"
    }

    private func trendColor(for delta: Double) -> Color {
        if delta > 0 {
            return color
        }

        if delta < 0 {
            return Color.recoveryRed
        }

        return Color.textDim
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

    private func axisLabel(_ value: Double) -> String {
        if abs(value) >= 100 || unit != "" {
            return value.formatted(.number.precision(.fractionLength(0)))
        }

        return value.formatted(.number.precision(.fractionLength(1)))
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
            skeletonPhase = 0
            return
        }

        withAnimation(.easeInOut(duration: 0.95).repeatForever(autoreverses: true)) {
            skeletonPulse = true
        }

        withAnimation(.linear(duration: 1.8).repeatForever(autoreverses: false)) {
            skeletonPhase = .pi * 2
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

    private struct TrendSummary {
        let text: String
        let symbolName: String
        let color: Color
        let accessibilityLabel: String
    }
}

private struct SkeletonSineWave: Shape {
    var phase: CGFloat

    var animatableData: CGFloat {
        get { phase }
        set { phase = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midY = rect.midY
        let amplitude = max(rect.height * 0.16, 12)
        let frequency: CGFloat = 2.6
        let step = max(rect.width / 44, 3)

        var x = rect.minX
        var isFirstPoint = true

        while x <= rect.maxX {
            let progress = (x - rect.minX) / max(rect.width, 1)
            let wave = CGFloat(sin(Double(progress * .pi * frequency + phase)))
            let y = midY + wave * amplitude
            let point = CGPoint(x: x, y: y)

            if isFirstPoint {
                path.move(to: point)
                isFirstPoint = false
            } else {
                path.addLine(to: point)
            }

            x += step
        }

        return path
    }
}
