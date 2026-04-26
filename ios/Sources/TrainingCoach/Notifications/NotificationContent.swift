import UserNotifications

enum NotificationContent {
    static func dailyMorning() -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = "Training Coach"
        content.subtitle = "Open Training Coach to see today's plan."
        content.body = "Today's recovery is ready"
        content.threadIdentifier = "tc.daily"
        content.sound = .default
        content.interruptionLevel = .timeSensitive
        return content
    }

    static func postWorkout() -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = "Training Coach"
        content.subtitle = "Open Training Coach to review the next step."
        content.body = "Workout follow-up is ready"
        content.threadIdentifier = "tc.postworkout"
        content.sound = .default
        content.interruptionLevel = .timeSensitive
        return content
    }
}
