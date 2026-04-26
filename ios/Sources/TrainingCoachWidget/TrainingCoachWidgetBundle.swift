import SwiftUI
import WidgetKit

struct PlaceholderEntry: TimelineEntry {
    let date: Date
}

struct PlaceholderTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlaceholderEntry {
        PlaceholderEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (PlaceholderEntry) -> Void) {
        completion(PlaceholderEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PlaceholderEntry>) -> Void) {
        let entry = PlaceholderEntry(date: Date())
        completion(Timeline(entries: [entry], policy: .never))
    }
}

struct PlaceholderWidgetView: View {
    let title: String

    var body: some View {
        Text(title)
            .containerBackground(.black, for: .widget)
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TodayWidget", provider: PlaceholderTimelineProvider()) { _ in
            PlaceholderWidgetView(title: "Today")
        }
        .configurationDisplayName("Today")
        .description("Today placeholder.")
    }
}

struct RecoveryWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "RecoveryWidget", provider: PlaceholderTimelineProvider()) { _ in
            PlaceholderWidgetView(title: "Recovery")
        }
        .configurationDisplayName("Recovery")
        .description("Recovery placeholder.")
    }
}

struct HeatmapWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HeatmapWidget", provider: PlaceholderTimelineProvider()) { _ in
            PlaceholderWidgetView(title: "Heatmap")
        }
        .configurationDisplayName("Heatmap")
        .description("Heatmap placeholder.")
    }
}

@main
struct TrainingCoachWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        RecoveryWidget()
        HeatmapWidget()
        // LiveActivity will be added in commit 10.
    }
}
