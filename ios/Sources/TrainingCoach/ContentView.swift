import SwiftUI

struct ContentView: View {
    @Environment(AuthState.self) private var auth

    var body: some View {
        TabView {
            TodayView()
                .tabItem {
                    Label("Today", systemImage: "sun.max")
                }

            TrendsView()
                .tabItem {
                    Label("Trends", systemImage: "chart.line.uptrend.xyaxis")
                }

            HeatmapView()
                .tabItem {
                    Label("Heatmap", systemImage: "square.grid.3x3")
                }

            GoalsView()
                .tabItem {
                    Label("Goals", systemImage: "target")
                }

            BodyView()
                .tabItem {
                    Label("Body", systemImage: "figure")
                }

            WorkoutsView()
                .tabItem {
                    Label("Workouts", systemImage: "dumbbell")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    ContentView()
        .environment(AuthState())
}
