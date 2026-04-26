import Foundation
import UserNotifications

actor NotificationManager {
    static let shared = NotificationManager()

    private static let dailyNudgeIdentifier = "tc.daily.morning"

    private let center: UNUserNotificationCenter
    private let calendar: Calendar

    init(
        center: UNUserNotificationCenter = .current(),
        calendar: Calendar = .current
    ) {
        self.center = center
        self.calendar = calendar
    }

    func requestAuthorization() async throws -> Bool {
        try await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    func scheduleDailyNudge() async throws {
        var dateComponents = DateComponents()
        dateComponents.calendar = calendar
        dateComponents.hour = 8
        dateComponents.minute = 5

        let trigger = UNCalendarNotificationTrigger(
            dateMatching: dateComponents,
            repeats: true
        )
        let request = UNNotificationRequest(
            identifier: Self.dailyNudgeIdentifier,
            content: NotificationContent.dailyMorning(),
            trigger: trigger
        )

        try await center.add(request)
    }

    func cancelDailyNudge() {
        center.removePendingNotificationRequests(
            withIdentifiers: [Self.dailyNudgeIdentifier]
        )
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    func scheduleOneOff(
        at date: Date,
        title: String,
        body: String,
        identifier: String
    ) async throws {
        var dateComponents = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: date
        )
        dateComponents.calendar = calendar

        let content = NotificationContent.postWorkout()
        content.title = title
        content.body = body

        let trigger = UNCalendarNotificationTrigger(
            dateMatching: dateComponents,
            repeats: false
        )
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }
}
