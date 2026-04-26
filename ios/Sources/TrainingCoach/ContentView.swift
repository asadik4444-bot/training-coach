import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            Text("Today")
                .tabItem {
                    Label("Today", systemImage: "sun.max")
                }

            Text("Trends")
                .tabItem {
                    Label("Trends", systemImage: "chart.line.uptrend.xyaxis")
                }

            Text("Heatmap")
                .tabItem {
                    Label("Heatmap", systemImage: "square.grid.3x3")
                }

            Text("Goals")
                .tabItem {
                    Label("Goals", systemImage: "target")
                }

            Text("Body")
                .tabItem {
                    Label("Body", systemImage: "figure")
                }

            Text("Workouts")
                .tabItem {
                    Label("Workouts", systemImage: "dumbbell")
                }

            Text("Settings")
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    ContentView()
}
