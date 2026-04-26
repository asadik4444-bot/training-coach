import SwiftUI
import WidgetKit

@main
struct TrainingCoachWidgetBundle: WidgetBundle {
    var body: some Widget {
        RecoveryWidget()
        TodayWidget()
        HeatmapWidget()
        LockScreenRecoveryWidget()
        TrainingLiveActivity()
    }
}
