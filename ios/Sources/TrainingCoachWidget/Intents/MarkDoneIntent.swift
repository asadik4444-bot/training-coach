import AppIntents
import Foundation
import os

struct MarkDoneIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark Today's Training Done"
    static var description = IntentDescription("Marks today's training as completed.")
    static var openAppWhenRun: Bool = false

    private static let appGroupSuiteName = "group.com.asadbek.trainingcoach"
    private static let pendingKey = "tc.widget.markDone.pending"
    private static let dateKey = "tc.widget.markDone.date"
    private static let updatedAtKey = "tc.widget.markDone.updatedAt"
    private static let logger = Logger(subsystem: "com.asadbek.trainingcoach.widget", category: "QuickLog")

    func perform() async throws -> some IntentResult {
        // Production should enable the App Group entitlement so the app can read this suite.
        let defaults = UserDefaults(suiteName: Self.appGroupSuiteName) ?? .standard
        let today = Self.todayString()

        defaults.set(true, forKey: Self.pendingKey)
        defaults.set(today, forKey: Self.dateKey)
        defaults.set(Date().timeIntervalSince1970, forKey: Self.updatedAtKey)

        Self.logger.info("QuickLog Mark Done stub saved for \(today, privacy: .public)")
        return .result()
    }

    private static func todayString() -> String {
        let components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        guard let year = components.year,
              let month = components.month,
              let day = components.day
        else {
            return "unknown"
        }

        return String(format: "%04d-%02d-%02d", year, month, day)
    }
}
