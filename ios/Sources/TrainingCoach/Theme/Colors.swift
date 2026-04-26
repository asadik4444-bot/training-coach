import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: 1.0
        )
    }

    static let bg = Color(hex: 0x0A0A0F)
    static let bgSurface = Color(hex: 0x11121A)
    static let bgCard = Color(hex: 0x161824)

    static let border = Color(hex: 0x1F2937)
    static let borderMuted = Color(hex: 0x0F1018)

    static let text = Color(hex: 0xF8FAFC)
    static let textMuted = Color(hex: 0x94A3B8)
    static let textDim = Color(hex: 0x64748B)

    static let primary = Color(hex: 0x1E40AF)
    static let primaryLight = Color(hex: 0x3B82F6)
    static let accent = Color(hex: 0xD97706)

    static let recoveryGreen = Color(hex: 0x22C55E)
    static let recoveryYellow = Color(hex: 0xEAB308)
    static let recoveryRed = Color(hex: 0xEF4444)
}
