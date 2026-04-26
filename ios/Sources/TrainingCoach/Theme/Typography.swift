import SwiftUI

// Required font files in Resources/Fonts/:
// FiraSans-Regular.ttf
// FiraSans-Medium.ttf
// FiraSans-SemiBold.ttf
// FiraSans-Bold.ttf
// FiraCode-Regular.ttf
// FiraCode-Medium.ttf
// These must also be registered in Info.plist UIAppFonts (handled in project.yml).
extension Font {
    static func firaSans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(firaSansName(for: weight), size: size).weight(weight)
    }

    static func firaCode(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom(firaCodeName(for: weight), size: size).weight(weight)
    }

    static let heroNumber: Font = .firaCode(64, weight: .semibold).monospacedDigit()
    static let metricLarge: Font = .firaCode(28, weight: .medium)
    static let metricMedium: Font = .firaSans(18, weight: .medium)
    static let bodyApp: Font = .custom("FiraSans-Regular", size: 16, relativeTo: .body)
        .weight(.regular)
    static let captionApp: Font = .custom("FiraSans-Medium", size: 12, relativeTo: .caption2)
        .weight(.medium)

    private static func firaSansName(for weight: Font.Weight) -> String {
        if weight == .bold {
            return "FiraSans-Bold"
        }

        if weight == .semibold {
            return "FiraSans-SemiBold"
        }

        if weight == .medium {
            return "FiraSans-Medium"
        }

        return "FiraSans-Regular"
    }

    private static func firaCodeName(for weight: Font.Weight) -> String {
        if weight == .medium || weight == .semibold {
            return "FiraCode-Medium"
        }

        return "FiraCode-Regular"
    }
}
