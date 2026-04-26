import Foundation
import HealthKit
import Observation
import UIKit

@MainActor
@Observable
final class SettingsViewModel {
    var hkStatus: String = "Unknown"
    var lastUpdate: Date?

    @ObservationIgnored private let auth: AuthState
    @ObservationIgnored private let healthStore = HKHealthStore()

    init(auth: AuthState) {
        self.auth = auth
    }

    var lastUpdateText: String {
        lastUpdateText(relativeTo: Date())
    }

    func lastUpdateText(relativeTo date: Date) -> String {
        guard let lastUpdate else {
            return "Never"
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: lastUpdate, relativeTo: date)
    }

    func signOut() {
        auth.clear()
    }

    func forceRefresh() {
        lastUpdate = Date()
        NotificationCenter.default.post(name: Notification.Name("ForceRefresh"), object: nil)
    }

    func refreshHealthKitStatus() {
        guard HKHealthStore.isHealthDataAvailable() else {
            hkStatus = "Unavailable"
            return
        }

        let readTypes = healthReadTypes
        guard readTypes.isEmpty == false else {
            hkStatus = "Unavailable"
            return
        }

        healthStore.getRequestStatusForAuthorization(toShare: Set<HKSampleType>(), read: readTypes) { [weak self] status, error in
            Task { @MainActor in
                guard let self else {
                    return
                }

                if error != nil {
                    self.hkStatus = "Denied"
                    return
                }

                switch status {
                case .unnecessary:
                    self.hkStatus = "Granted"
                case .shouldRequest:
                    self.hkStatus = "Not Determined"
                case .unknown:
                    self.hkStatus = "Denied"
                @unknown default:
                    self.hkStatus = "Unknown"
                }
            }
        }
    }

    func openTelegram() {
        UIApplication.shared.open(URL(string: "https://t.me/whoop_trainer_bot")!)
    }

    func openHealthApp() {
        UIApplication.shared.open(URL(string: "x-apple-health://")!)
    }

    func openVercelDashboard() {
        UIApplication.shared.open(URL(string: "https://vercel.com/dashboard")!)
    }

    func openGitHub() {
        UIApplication.shared.open(URL(string: "https://github.com/asadik4444-bot/training-coach")!)
    }

    private var healthReadTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()

        if let restingHeartRate = HKObjectType.quantityType(forIdentifier: .restingHeartRate) {
            types.insert(restingHeartRate)
        }

        if let bodyMass = HKObjectType.quantityType(forIdentifier: .bodyMass) {
            types.insert(bodyMass)
        }

        if let sleepAnalysis = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(sleepAnalysis)
        }

        return types
    }
}
