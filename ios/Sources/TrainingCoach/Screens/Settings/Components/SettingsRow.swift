import SwiftUI
import UIKit

struct SettingsRow<Accessory: View>: View {
    private let systemImage: String
    private let title: String
    private let subtitle: String?
    private let iconColor: Color
    private let showsChevron: Bool
    private let isDestructive: Bool
    private let action: (() -> Void)?
    private let accessory: Accessory

    init(
        systemImage: String,
        title: String,
        subtitle: String? = nil,
        iconColor: Color = Color.primaryLight,
        showsChevron: Bool = false,
        isDestructive: Bool = false,
        action: (() -> Void)? = nil,
        @ViewBuilder accessory: () -> Accessory
    ) {
        self.systemImage = systemImage
        self.title = title
        self.subtitle = subtitle
        self.iconColor = iconColor
        self.showsChevron = showsChevron
        self.isDestructive = isDestructive
        self.action = action
        self.accessory = accessory()
    }

    var body: some View {
        Group {
            if action == nil {
                rowContent
            } else {
                Button(action: performAction) {
                    rowContent
                }
                .buttonStyle(.plain)
            }
        }
        .contentShape(Rectangle())
    }

    private var rowContent: some View {
        HStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(rowIconColor)
                .frame(width: 36, height: 36)
                .background(rowIconColor.opacity(0.15))
                .clipShape(Circle())
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.firaSans(16, weight: .medium))
                    .foregroundStyle(isDestructive ? Color.recoveryRed : Color.text)

                if let subtitle {
                    Text(subtitle)
                        .font(.firaSans(13))
                        .foregroundStyle(Color.textDim)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 12)

            accessory

            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textDim)
                    .frame(width: 16, alignment: .trailing)
                    .accessibilityHidden(true)
            }
        }
        .frame(minHeight: 58)
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
    }

    private func performAction() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        action?()
    }

    private var rowIconColor: Color {
        isDestructive ? Color.recoveryRed : iconColor
    }
}

extension SettingsRow where Accessory == EmptyView {
    init(
        systemImage: String,
        title: String,
        subtitle: String? = nil,
        iconColor: Color = Color.primaryLight,
        showsChevron: Bool = false,
        isDestructive: Bool = false,
        action: (() -> Void)? = nil
    ) {
        self.init(
            systemImage: systemImage,
            title: title,
            subtitle: subtitle,
            iconColor: iconColor,
            showsChevron: showsChevron,
            isDestructive: isDestructive,
            action: action
        ) {
            EmptyView()
        }
    }
}
