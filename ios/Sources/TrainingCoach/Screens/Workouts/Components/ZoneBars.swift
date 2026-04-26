import SwiftUI

struct ZoneBars: View {
    let zoneMinutes: ZoneMinutes

    private var zones: [ZoneBar] {
        [
            ZoneBar(label: "Z1", minutes: zoneMinutes.z1, color: Color(hex: 0x60A5FA)),
            ZoneBar(label: "Z2", minutes: zoneMinutes.z2, color: Color(hex: 0x22D3EE)),
            ZoneBar(label: "Z3", minutes: zoneMinutes.z3, color: Color(hex: 0x22C55E)),
            ZoneBar(label: "Z4", minutes: zoneMinutes.z4, color: Color(hex: 0xFACC15)),
            ZoneBar(label: "Z5", minutes: zoneMinutes.z5, color: Color(hex: 0xEF4444))
        ]
    }

    private var maxMinutes: Int {
        max(zones.map(\.minutes).max() ?? 0, 1)
    }

    var body: some View {
        VStack(spacing: 10) {
            ForEach(zones) { zone in
                ZoneBarRow(zone: zone, maxMinutes: maxMinutes)
            }
        }
        .accessibilityElement(children: .contain)
    }
}

private struct ZoneBar: Identifiable {
    let label: String
    let minutes: Int
    let color: Color

    var id: String {
        label
    }
}

private struct ZoneBarRow: View {
    let zone: ZoneBar
    let maxMinutes: Int

    @ScaledMetric(relativeTo: .caption) private var barHeight: CGFloat = 12

    var body: some View {
        HStack(spacing: 10) {
            Text(zone.label)
                .font(.firaCode(12, weight: .medium))
                .foregroundStyle(Color.textMuted)
                .frame(width: 28, alignment: .leading)

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.bgSurface)

                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [zone.color.opacity(0.55), zone.color],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: barWidth(in: proxy.size.width))
                }
            }
            .frame(height: barHeight)

            Text("\(zone.minutes)m")
                .font(.firaCode(13, weight: .medium).monospacedDigit())
                .foregroundStyle(Color.text)
                .frame(width: 48, alignment: .trailing)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(zone.label), \(zone.minutes) minutes")
    }

    private func barWidth(in availableWidth: CGFloat) -> CGFloat {
        guard zone.minutes > 0, maxMinutes > 0 else {
            return 0
        }

        return max(6, availableWidth * CGFloat(zone.minutes) / CGFloat(maxMinutes))
    }
}
