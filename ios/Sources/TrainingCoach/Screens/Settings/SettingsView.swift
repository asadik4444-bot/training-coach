import Foundation
import SwiftUI

struct SettingsView: View {
    @Environment(AuthState.self) private var auth

    @State private var viewModel: SettingsViewModel?
    @State private var isShowingRotateSecret = false

    @ScaledMetric(relativeTo: .largeTitle) private var titleSize: CGFloat = 28

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bg
                    .ignoresSafeArea()

                if let viewModel {
                    content(for: viewModel)
                } else {
                    ProgressView()
                        .tint(Color.primaryLight)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task(installViewModelIfNeeded)
        .sheet(isPresented: $isShowingRotateSecret) {
            RotateSecretSheet()
        }
    }

    private func content(for viewModel: SettingsViewModel) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("SETTINGS")
                    .font(.firaSans(titleSize, weight: .bold))
                    .foregroundStyle(Color.text)
                    .tracking(1.2)
                    .padding(.top, 26)

                settingsSection("ACCOUNT") {
                    SettingsRow(systemImage: "checkmark.seal.fill", title: "Connected") {
                        HStack(spacing: 7) {
                            Circle()
                                .fill(Color.recoveryGreen)
                                .frame(width: 9, height: 9)
                                .accessibilityHidden(true)

                            Text("Active")
                                .font(.firaSans(13, weight: .medium))
                                .foregroundStyle(Color.recoveryGreen)
                        }
                    }

                    divider

                    SettingsRow(
                        systemImage: "key.fill",
                        title: "Rotate secret",
                        subtitle: "Validate before saving",
                        showsChevron: true,
                        action: {
                            isShowingRotateSecret = true
                        }
                    )

                    divider

                    SettingsRow(
                        systemImage: "rectangle.portrait.and.arrow.right",
                        title: "Sign out",
                        isDestructive: true,
                        action: viewModel.signOut
                    )
                }

                settingsSection("DATA") {
                    SettingsRow(
                        systemImage: "arrow.clockwise",
                        title: "Force refresh",
                        subtitle: "Broadcasts a refresh to active screens",
                        action: viewModel.forceRefresh
                    )

                    divider

                    SettingsRow(systemImage: "clock.fill", title: "Last update") {
                        Text(viewModel.lastUpdateText)
                            .font(.firaCode(13, weight: .medium))
                            .foregroundStyle(Color.textMuted)
                            .monospacedDigit()
                    }
                }

                settingsSection("HEALTHKIT") {
                    SettingsRow(systemImage: "heart.text.square.fill", title: "Status") {
                        Text(viewModel.hkStatus)
                            .font(.firaSans(13, weight: .medium))
                            .foregroundStyle(healthKitColor(for: viewModel.hkStatus))
                    }

                    divider

                    SettingsRow(
                        systemImage: "heart.fill",
                        title: "Open Health App",
                        showsChevron: true,
                        action: viewModel.openHealthApp
                    )
                }

                settingsSection("INTEGRATIONS") {
                    SettingsRow(
                        systemImage: "paperplane.fill",
                        title: "Telegram bot",
                        subtitle: "@whoop_trainer_bot",
                        showsChevron: true,
                        action: viewModel.openTelegram
                    )

                    divider

                    SettingsRow(
                        systemImage: "server.rack",
                        title: "Vercel dashboard",
                        showsChevron: true,
                        action: viewModel.openVercelDashboard
                    )
                }

                settingsSection("ABOUT") {
                    SettingsRow(systemImage: "app.badge.fill", title: "Version") {
                        Text("1.0.0")
                            .font(.firaCode(13, weight: .medium))
                            .foregroundStyle(Color.textMuted)
                            .monospacedDigit()
                    }

                    divider

                    SettingsRow(systemImage: "number.square.fill", title: "Build") {
                        Text(buildNumber)
                            .font(.firaCode(13, weight: .medium))
                            .foregroundStyle(Color.textMuted)
                            .monospacedDigit()
                    }

                    divider

                    SettingsRow(
                        systemImage: "chevron.left.forwardslash.chevron.right",
                        title: "GitHub",
                        showsChevron: true,
                        action: viewModel.openGitHub
                    )

                    divider

                    SettingsRow(systemImage: "doc.text.fill", title: "License") {
                        Text("ISC")
                            .font(.firaSans(13, weight: .medium))
                            .foregroundStyle(Color.textMuted)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 36)
        }
    }

    private func settingsSection<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(title)
                .font(.firaSans(12, weight: .semibold))
                .foregroundStyle(Color.textDim)
                .tracking(1.1)
                .padding(.horizontal, 4)

            VStack(spacing: 0, content: content)
                .background(Color.bgCard)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.border, lineWidth: 1)
                }
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.borderMuted)
            .frame(height: 1)
            .padding(.leading, 62)
    }

    private var buildNumber: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "Debug"
    }

    private func installViewModelIfNeeded() async {
        guard viewModel == nil else {
            return
        }

        let model = SettingsViewModel(auth: auth)
        viewModel = model
        model.refreshHealthKitStatus()
    }

    private func healthKitColor(for status: String) -> Color {
        switch status {
        case "Granted":
            Color.recoveryGreen
        case "Denied", "Unavailable":
            Color.recoveryRed
        case "Not Determined":
            Color.recoveryYellow
        default:
            Color.textMuted
        }
    }
}
