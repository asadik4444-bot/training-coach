import Foundation
import SwiftUI

struct RecapCard: View {
    static let exportSize = CGSize(width: 1080, height: 1920)

    let data: RecapData

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let sidePadding = size.width * 0.074

            ZStack {
                cardGlow(size: size)

                VStack(alignment: .leading, spacing: 0) {
                    header

                    Spacer(minLength: size.height * 0.07)

                    hero

                    Spacer(minLength: size.height * 0.055)

                    metricGrid

                    Spacer(minLength: size.height * 0.055)

                    trendSection
                        .frame(height: size.height * 0.21)

                    Spacer(minLength: size.height * 0.04)

                    footer
                }
                .padding(.horizontal, sidePadding)
                .padding(.top, size.height * 0.06)
                .padding(.bottom, size.height * 0.052)
            }
        }
        .frame(width: Self.exportSize.width, height: Self.exportSize.height)
        .background(
            LinearGradient(
                colors: [Color.bg, Color.bgCard, Color.bg],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipped()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(data.periodLabel), average recovery \(data.avgRecovery) percent")
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("TRAINING COACH")
                .font(.firaCode(31, weight: .medium))
                .foregroundStyle(Color.text)
                .tracking(3.8)

            Spacer()

            Text(data.periodLabel)
                .font(.firaSans(25, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .tracking(2.4)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("AVG RECOVERY")
                .font(.firaSans(28, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .tracking(3.4)

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("\(data.avgRecovery)")
                    .font(.firaCode(228, weight: .semibold).monospacedDigit())
                    .foregroundStyle(data.band.color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.58)
                    .shadow(color: data.band.color.opacity(0.72), radius: 34, y: 0)
                    .shadow(color: data.band.color.opacity(0.34), radius: 92, y: 0)

                Text("%")
                    .font(.firaCode(92, weight: .medium).monospacedDigit())
                    .foregroundStyle(data.band.color.opacity(0.9))
                    .baselineOffset(22)
            }

            Text(bandLabel)
                .font(.firaCode(34, weight: .medium))
                .foregroundStyle(data.band.color)
                .tracking(2.8)
        }
    }

    private var metricGrid: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 22),
                GridItem(.flexible(), spacing: 22)
            ],
            spacing: 22
        ) {
            RecapMetricTile(label: "AVG HRV", value: "\(Int(data.avgHRV.rounded()))", unit: "MS", tint: Color.primaryLight)
            RecapMetricTile(label: "AVG RHR", value: "\(data.avgRHR)", unit: "BPM", tint: Color.recoveryRed)
            RecapMetricTile(label: "AVG SLEEP EFF", value: "\(Int(data.avgSleepPct.rounded()))", unit: "%", tint: Color.recoveryYellow)
            RecapMetricTile(label: "TOTAL STRAIN", value: String(format: "%.1f", data.totalStrain), unit: "LOAD", tint: data.band.color)
        }
    }

    private var trendSection: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Text("RECOVERY TREND")
                    .font(.firaSans(24, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .tracking(2.8)

                Spacer()

                Text("\(data.recoveryPoints.count) POINTS")
                    .font(.firaCode(22, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.textDim)
            }

            RecoverySparkline(points: data.recoveryPoints, tint: data.band.color)
        }
        .padding(30)
        .background(Color.bgSurface.opacity(0.74), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .stroke(Color.border.opacity(0.72), lineWidth: 1)
        )
    }

    private var footer: some View {
        HStack(alignment: .bottom) {
            Text(data.dateRange.uppercased())
                .font(.firaSans(24, weight: .medium))
                .foregroundStyle(Color.text)
                .tracking(2.4)
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            Spacer(minLength: 20)

            Text("Generated \(Self.generatedDate)")
                .font(.firaSans(20, weight: .medium))
                .foregroundStyle(Color.textDim.opacity(0.72))
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
    }

    private var bandLabel: String {
        switch data.band {
        case .green:
            "GREEN BAND"
        case .yellow:
            "YELLOW BAND"
        case .red:
            "RED BAND"
        }
    }

    private func cardGlow(size: CGSize) -> some View {
        ZStack {
            RadialGradient(
                colors: [data.band.color.opacity(0.28), Color.clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: size.width * 0.76
            )
            .frame(width: size.width, height: size.width)
            .position(x: size.width * 0.72, y: size.height * 0.12)

            RadialGradient(
                colors: [Color.primaryLight.opacity(0.18), Color.clear],
                center: .bottomLeading,
                startRadius: 0,
                endRadius: size.width * 0.72
            )
            .frame(width: size.width, height: size.width)
            .position(x: size.width * 0.18, y: size.height * 0.86)
        }
        .allowsHitTesting(false)
    }

    private static var generatedDate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: Date())
    }
}

private struct RecapMetricTile: View {
    let label: String
    let value: String
    let unit: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(label)
                .font(.firaCode(24, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .tracking(2.2)
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(value)
                    .font(.firaCode(58, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)

                Text(unit)
                    .font(.firaSans(20, weight: .medium))
                    .foregroundStyle(Color.textDim)
                    .baselineOffset(8)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            Capsule()
                .fill(tint)
                .frame(width: 72, height: 6)
        }
        .frame(maxWidth: .infinity, minHeight: 178, alignment: .leading)
        .padding(26)
        .background(Color.bgSurface.opacity(0.72), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.borderMuted.opacity(0.9), lineWidth: 1)
        )
    }
}

private struct RecoverySparkline: View {
    let points: [(date: String, value: Int)]
    let tint: Color

    var body: some View {
        GeometryReader { proxy in
            let chartPoints = pointsForChart(in: proxy.size)

            ZStack {
                ForEach(0..<4, id: \.self) { index in
                    Path { path in
                        let y = proxy.size.height * CGFloat(index) / 3
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: proxy.size.width, y: y))
                    }
                    .stroke(Color.textDim.opacity(0.14), style: StrokeStyle(lineWidth: 1, dash: [10, 16]))
                }

                Path { path in
                    guard let first = chartPoints.first else {
                        return
                    }

                    path.move(to: first)
                    for point in chartPoints.dropFirst() {
                        path.addLine(to: point)
                    }
                }
                .stroke(
                    LinearGradient(
                        colors: [tint.opacity(0.72), tint, Color.text],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 8, lineCap: .round, lineJoin: .round)
                )
                .shadow(color: tint.opacity(0.52), radius: 18, y: 0)

                ForEach(Array(chartPoints.enumerated()), id: \.offset) { _, point in
                    Circle()
                        .fill(Color.bg)
                        .frame(width: 22, height: 22)
                        .overlay(Circle().stroke(tint, lineWidth: 6))
                        .position(point)
                }
            }
        }
    }

    private func pointsForChart(in size: CGSize) -> [CGPoint] {
        guard !points.isEmpty else {
            return []
        }

        let width = max(size.width, 1)
        let height = max(size.height, 1)
        let xStep = points.count > 1 ? width / CGFloat(points.count - 1) : 0

        return points.enumerated().map { index, point in
            let value = min(max(point.value, 0), 100)
            let x = points.count > 1 ? CGFloat(index) * xStep : width / 2
            let y = height - (CGFloat(value) / 100 * height)
            return CGPoint(x: x, y: y)
        }
    }
}
