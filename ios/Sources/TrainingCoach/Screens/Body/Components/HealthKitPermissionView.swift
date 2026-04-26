import HealthKit
import SwiftUI
import UIKit

struct HealthKitPermissionView: View {
    let status: HKAuthorizationStatus
    let requestAccess: () async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var iconSize: CGFloat = 70

    @State private var isRequesting = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            ZStack {
                Circle()
                    .fill(Color.recoveryGreen.opacity(0.14))
                    .frame(width: iconSize + 42, height: iconSize + 42)
                    .shadow(
                        color: Color.recoveryGreen.opacity(reduceMotion ? 0.16 : 0.32),
                        radius: reduceMotion ? 10 : 26,
                        y: reduceMotion ? 2 : 8
                    )

                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: iconSize, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(Color.recoveryGreen)
                    .accessibilityHidden(true)
            }

            VStack(spacing: 10) {
                Text("HealthKit Access")
                    .font(.firaSans(28, weight: .bold))
                    .foregroundStyle(Color.text)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(.body)
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if status == .sharingDenied {
                Text("iOS may not show the permission prompt twice. Open Settings and allow TrainingCoach to read Health data.")
                    .font(.callout)
                    .foregroundStyle(Color.textDim)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(Color.recoveryRed)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button(action: grantAccess) {
                Label(isRequesting ? "Requesting" : buttonTitle, systemImage: "heart.text.square.fill")
                    .font(.firaSans(17, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 54)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.text)
            .background(Color.primary)
            .clipShape(Capsule())
            .shadow(color: Color.primaryLight.opacity(reduceMotion ? 0.16 : 0.34), radius: reduceMotion ? 8 : 18, y: 6)
            .disabled(isRequesting)
            .opacity(isRequesting ? 0.65 : 1)
            .accessibilityHint(status == .sharingDenied ? "Opens Settings." : "Shows the HealthKit permission sheet.")
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [
                    Color.bg,
                    Color.bgCard.opacity(0.96),
                    Color.bgSurface.opacity(0.9)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        )
    }

    private var buttonTitle: String {
        status == .sharingAuthorized ? "Done" : "Grant Health Access"
    }

    private var message: String {
        switch status {
        case .notDetermined:
            "Allow read-only access to weight, body fat, resting heart rate, and sleep analysis."
        case .sharingDenied:
            "HealthKit access is currently denied, so body composition cards cannot read local health samples."
        case .sharingAuthorized:
            "HealthKit access is enabled."
        @unknown default:
            "HealthKit access status is unknown."
        }
    }

    private func grantAccess() {
        if status == .sharingAuthorized {
            dismiss()
            return
        }

        if status == .sharingDenied,
           let settingsURL = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsURL)
            return
        }

        isRequesting = true
        errorMessage = nil

        Task { @MainActor in
            do {
                try await requestAccess()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }

            isRequesting = false
        }
    }
}
