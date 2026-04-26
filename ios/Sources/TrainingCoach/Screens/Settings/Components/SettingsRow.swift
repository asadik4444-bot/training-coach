import SwiftUI
import UIKit

struct SettingsRow<Accessory: View>: View {
    private let systemImage: String
    private let title: String
    private let subtitle: String?
    private let showsChevron: Bool
    private let isDestructive: Bool
    private let action: (() -> Void)?
    private let accessory: Accessory

    init(
        systemImage: String,
        title: String,
        subtitle: String? = nil,
        showsChevron: Bool = false,
        isDestructive: Bool = false,
        action: (() -> Void)? = nil,
        @ViewBuilder accessory: () -> Accessory
    ) {
        self.systemImage = systemImage
        self.title = title
        self.subtitle = subtitle
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
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(isDestructive ? Color.recoveryRed : Color.primaryLight)
                .frame(width: 34, height: 34)
                .background((isDestructive ? Color.recoveryRed : Color.primaryLight).opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
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
}

extension SettingsRow where Accessory == EmptyView {
    init(
        systemImage: String,
        title: String,
        subtitle: String? = nil,
        showsChevron: Bool = false,
        isDestructive: Bool = false,
        action: (() -> Void)? = nil
    ) {
        self.init(
            systemImage: systemImage,
            title: title,
            subtitle: subtitle,
            showsChevron: showsChevron,
            isDestructive: isDestructive,
            action: action
        ) {
            EmptyView()
        }
    }
}
