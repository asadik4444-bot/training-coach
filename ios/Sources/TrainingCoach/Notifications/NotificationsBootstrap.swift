import Foundation
import UserNotifications

struct NotificationsBootstrap {
    private let notificationManager: NotificationManager
    private let hasFinishedOnboarding: () -> Bool

    init(
        notificationManager: NotificationManager = .shared,
        hasFinishedOnboarding: @escaping () -> Bool = {
            KeychainStore.currentSecret() != nil
        }
    ) {
        self.notificationManager = notificationManager
        self.hasFinishedOnboarding = hasFinishedOnboarding
    }

    func bootstrap() async {
        guard hasFinishedOnboarding() else {
            return
        }

        do {
            switch await notificationManager.authorizationStatus() {
            case .notDetermined:
                let granted = try await notificationManager.requestAuthorization()

                if granted {
                    try await notificationManager.scheduleDailyNudge()
                }
            case .authorized, .provisional, .ephemeral:
                try await notificationManager.scheduleDailyNudge()
            case .denied:
                return
            @unknown default:
                return
            }
        } catch {
            return
        }
    }
}
