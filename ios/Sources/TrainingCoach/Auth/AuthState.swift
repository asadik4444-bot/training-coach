import Foundation
import Observation

@MainActor
@Observable
final class AuthState {
    private(set) var isAuthenticated: Bool

    init() {
        isAuthenticated = KeychainStore.currentSecret() != nil
    }

    func setSecret(_ secret: String, validatingWith client: APIClient) async throws {
        try KeychainStore.setSecret(secret)

        do {
            try await client.ensureAuth()
            isAuthenticated = true
        } catch {
            try? KeychainStore.clear()
            isAuthenticated = false
            throw error
        }
    }

    func clear() {
        try? KeychainStore.clear()
        isAuthenticated = false
    }

    func currentSecret() -> String? {
        KeychainStore.currentSecret()
    }
}
