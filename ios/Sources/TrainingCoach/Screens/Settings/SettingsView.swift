import Foundation
import SwiftUI

struct SettingsView: View {
    @Environment(AuthState.self) private var auth

    @State private var viewModel: SettingsViewModel?
    @State private var isShowingRotateSecret = false
    @State private var isShowingSignOutConfirmation = false

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
        .alert("Sign out?", isPresented: $isShowingSignOutConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Sign out", role: .destructive) {
                viewModel?.signOut()
            }
        } message: {
            Text("You will need your dashboard secret to reconnect.")
        }
    }

    private func content(for viewModel: SettingsViewModel) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("SETTINGS")
                    .font(.firaSans(28, weight: .bold))
                    .foregroundStyle(Color.text)
                    .tracking(1.5)
                    .padding(.top, 26)

                settingsSection("ACCOUNT") {
                    SettingsRow(
                        systemImage: "checkmark.seal.fill",
                        title: "Connected",
                        iconColor: Color.primaryLight
                    ) {
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
                        iconColor: Color.primaryLight,
                        showsChevron: true,
                        action: {
                            isShowingRotateSecret = true
                        }
                    )

                    divider

                    SettingsRow(
                        systemImage: "rectangle.portrait.and.arrow.right",
                        title: "Sign out",
                        iconColor: Color.recoveryRed,
                        isDestructive: true,
                        action: {
                            isShowingSignOutConfirmation = true
                        }
                    )
                }

                settingsSection("DATA") {
                    SettingsRow(
                        systemImage: "arrow.clockwise",
                        title: "Force refresh",
                        subtitle: "Broadcasts a refresh to active screens",
                        iconColor: Color.recoveryYellow,
                        action: viewModel.forceRefresh
                    )

                    divider

                    SettingsRow(
                        systemImage: "clock.fill",
                        title: "Last update",
                        iconColor: Color.recoveryYellow
                    ) {
                        TimelineView(.periodic(from: Date.now, by: 30)) { timeline in
                            Text(viewModel.lastUpdateText(relativeTo: timeline.date))
                                .font(.firaCode(13, weight: .medium))
                                .foregroundStyle(Color.textMuted)
                                .monospacedDigit()
                        }
                    }
                }

                settingsSection("HEALTHKIT") {
                    SettingsRow(
                        systemImage: "heart.text.square.fill",
                        title: "Status",
                        iconColor: Color.recoveryGreen
                    ) {
                        Text(viewModel.hkStatus)
                            .font(.firaSans(13, weight: .medium))
                            .foregroundStyle(healthKitColor(for: viewModel.hkStatus))
                    }

                    divider

                    SettingsRow(
                        systemImage: "heart.fill",
                        title: "Open Health App",
                        iconColor: Color.recoveryGreen,
                        showsChevron: true,
                        action: viewModel.openHealthApp
                    )
                }

                settingsSection("INTEGRATIONS") {
                    SettingsRow(
                        systemImage: "paperplane.fill",
                        title: "Telegram bot",
                        subtitle: "@whoop_trainer_bot",
                        iconColor: Color.accent,
                        showsChevron: true,
                        action: viewModel.openTelegram
                    )

                    divider

                    SettingsRow(
                        systemImage: "server.rack",
                        title: "Vercel dashboard",
                        iconColor: Color.accent,
                        showsChevron: true,
                        action: viewModel.openVercelDashboard
                    )
                }

                settingsSection("ABOUT") {
                    AboutAppHeader(version: appVersion, build: buildNumber)

                    divider

                    SettingsRow(
                        systemImage: "chevron.left.forwardslash.chevron.right",
                        title: "GitHub",
                        subtitle: "github.com/asadik4444-bot/training-coach",
                        iconColor: Color.primaryLight,
                        showsChevron: true,
                        action: viewModel.openGitHub
                    )

                    divider

                    MadeWithLoveRow()
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
            Text(title.uppercased())
                .font(.firaSans(11, weight: .semibold))
                .foregroundStyle(Color.textMuted)
                .kerning(1.2)
                .padding(.horizontal, 4)

            VStack(spacing: 0, content: content)
                .background(cardGradient)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.border.opacity(0.72), lineWidth: 1)
                }
                .shadow(color: Color.black.opacity(0.22), radius: 16, y: 8)
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

    private var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
    }

    private var cardGradient: LinearGradient {
        LinearGradient(
            colors: [
                Color.bgCard.opacity(0.98),
                Color.primaryLight.opacity(0.08),
                Color.bgSurface.opacity(0.9)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
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

private struct AboutAppHeader: View {
    let version: String
    let build: String

    var body: some View {
        HStack(spacing: 14) {
            Capsule()
                .fill(Color.primary)
                .frame(width: 48, height: 40)
                .overlay {
                    Text("TC")
                        .font(.firaSans(16, weight: .bold))
                        .foregroundStyle(Color.text)
                        .kerning(0.8)
                }
                .shadow(color: Color.primaryLight.opacity(0.28), radius: 12, y: 5)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text("TrainingCoach")
                    .font(.firaSans(17, weight: .semibold))
                    .foregroundStyle(Color.text)

                Text("Version \(version) (\(build))")
                    .font(.firaCode(12, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.textMuted)
            }

            Spacer(minLength: 12)
        }
        .frame(minHeight: 70)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}

private struct MadeWithLoveRow: View {
    var body: some View {
        SettingsRow(
            systemImage: "heart.fill",
            title: "Made with love",
            subtitle: "Built for consistent training.",
            iconColor: Color.recoveryRed
        )
    }
}
