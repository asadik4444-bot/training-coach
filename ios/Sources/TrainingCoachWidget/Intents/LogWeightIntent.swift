import AppIntents
import Foundation

struct LogWeightIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Weight"
    static var description = IntentDescription("Opens Training Coach to log weight.")
    static var openAppWhenRun: Bool = true

    private static let appGroupSuiteName = "group.com.asadbek.trainingcoach"
    private static let requestedFlowKey = "tc.widget.requestedFlow"
    private static let requestedAtKey = "tc.widget.requestedFlowAt"

    func perform() async throws -> some IntentResult {
        // Production should enable the App Group entitlement so launch routing can consume this handoff.
        let defaults = UserDefaults(suiteName: Self.appGroupSuiteName) ?? .standard
        defaults.set("logWeight", forKey: Self.requestedFlowKey)
        defaults.set(Date().timeIntervalSince1970, forKey: Self.requestedAtKey)

        return .result()
    }
}
