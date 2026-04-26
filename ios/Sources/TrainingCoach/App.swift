import SwiftUI

@main
struct TrainingCoachApp: App {
    @State private var auth = AuthState()

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isAuthenticated {
                    ContentView()
                } else {
                    OnboardingView()
                }
            }
            .environment(auth)
            .preferredColorScheme(.dark)
        }
    }
}
