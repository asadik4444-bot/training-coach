import ActivityKit
import Foundation

actor LiveActivityManager {
    static let shared = LiveActivityManager()

    private var currentActivity: Activity<TrainingActivityAttributes>?
    private let authorizationInfo = ActivityAuthorizationInfo()

    var current: Activity<TrainingActivityAttributes>? {
        get {
            activeActivity
        }
    }

    func start(
        score: Int,
        band: String,
        plan: String,
        windowEnd: Date
    ) async throws -> Activity<TrainingActivityAttributes>? {
        guard authorizationInfo.areActivitiesEnabled else {
            currentActivity = nil
            return nil
        }

        let contentState = TrainingActivityAttributes.ContentState(
            recoveryScore: boundedScore(score),
            band: band,
            todayPlan: plan,
            windowEnd: windowEnd
        )
        let content = ActivityContent(
            state: contentState,
            staleDate: windowEnd,
            relevanceScore: 1
        )

        if let activity = activeActivity {
            await activity.update(content)
            currentActivity = activity
            return activity
        }

        let activity = try Activity.request(
            attributes: TrainingActivityAttributes(userId: "local"),
            content: content,
            pushType: nil
        )
        currentActivity = activity
        return activity
    }

    func update(score: Int, band: String) async {
        guard authorizationInfo.areActivitiesEnabled, let activity = activeActivity else {
            return
        }

        let existingState = activity.content.state
        let contentState = TrainingActivityAttributes.ContentState(
            recoveryScore: boundedScore(score),
            band: band,
            todayPlan: existingState.todayPlan,
            windowEnd: existingState.windowEnd
        )
        let content = ActivityContent(
            state: contentState,
            staleDate: existingState.windowEnd,
            relevanceScore: 1
        )

        await activity.update(content)
        currentActivity = activity
    }

    func end() async {
        guard let activity = activeActivity else {
            currentActivity = nil
            return
        }

        await activity.end(nil, dismissalPolicy: .immediate)
        currentActivity = nil
    }

    private var activeActivity: Activity<TrainingActivityAttributes>? {
        if let currentActivity, currentActivity.isRunning {
            return currentActivity
        }

        return Activity<TrainingActivityAttributes>.activities.first { activity in
            activity.isRunning
        }
    }

    private func boundedScore(_ score: Int) -> Int {
        min(max(score, 0), 100)
    }
}

private extension Activity where Attributes == TrainingActivityAttributes {
    var isRunning: Bool {
        activityState == .active || activityState == .stale
    }
}
