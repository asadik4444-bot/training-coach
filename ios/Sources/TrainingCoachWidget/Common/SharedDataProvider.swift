import Foundation
import WidgetKit

struct SharedDataProvider: TimelineProvider {
    private static let cacheKey = "tc.widget.cache"
    private static let refreshInterval: TimeInterval = 30 * 60

    private let client: APIClient
    private let defaults: UserDefaults
    private let calendar: Calendar

    init(
        client: APIClient = APIClient(secretProvider: {
            KeychainStore.currentSecret()
        }),
        defaults: UserDefaults? = UserDefaults(suiteName: "group.com.asadbek.trainingcoach"),
        calendar: Calendar = .current
    ) {
        self.client = client
        self.defaults = defaults ?? .standard
        self.calendar = calendar
    }

    func placeholder(in context: Context) -> TrainingEntry {
        TrainingEntry.placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (TrainingEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }

        completion(cachedEntry(date: Date()) ?? .unavailable())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TrainingEntry>) -> Void) {
        Task {
            let entry = await refreshedEntry()
            let nextRefresh = Date().addingTimeInterval(Self.refreshInterval)
            completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
        }
    }

    private func refreshedEntry() async -> TrainingEntry {
        let now = Date()
        let today = apiDateString(for: now)
        let cached = cachedEntry(date: now)

        let day = try? await client.getDay(date: today)
        let exportData = try? await client.getExport()
        var exportScores = [String: Int]()

        if let exportData {
            exportScores = (try? recoveryScores(from: exportData)) ?? [:]
        }

        guard day != nil || !exportScores.isEmpty else {
            return cached ?? .unavailable(date: now)
        }

        let score = day?.biometrics?.recovery?.score ?? exportScores[today] ?? cached?.recoveryScore
        let plan = day.map(todayPlan(from:)) ?? cached?.todayPlan ?? "Today's plan"
        var last28Scores = exportScores.isEmpty
            ? cached?.normalizedLast28Scores ?? TrainingEntry.emptyLast28Scores
            : last28Scores(from: exportScores, endingAt: now)

        if let score, last28Scores.indices.contains(27) {
            last28Scores[27] = boundedScore(score)
        }

        let entry = TrainingEntry(
            date: now,
            recoveryScore: score.map(boundedScore(_:)),
            band: score.map { RecoveryBand.from(score: boundedScore($0)) },
            last28Scores: last28Scores,
            todayPlan: plan
        )

        cache(entry)
        return entry
    }

    private func cachedEntry(date: Date) -> TrainingEntry? {
        guard let data = defaults.data(forKey: Self.cacheKey),
              let cache = try? JSONDecoder().decode(WidgetCache.self, from: data)
        else {
            return nil
        }

        let score = cache.recoveryScore.map(boundedScore(_:))
        return TrainingEntry(
            date: date,
            recoveryScore: score,
            band: score.map(RecoveryBand.from(score:)),
            last28Scores: cache.last28Scores,
            todayPlan: cache.todayPlan
        )
    }

    private func cache(_ entry: TrainingEntry) {
        let cache = WidgetCache(
            recoveryScore: entry.recoveryScore.map(boundedScore(_:)),
            last28Scores: entry.normalizedLast28Scores,
            todayPlan: entry.todayPlan,
            updatedAt: entry.date
        )

        guard let data = try? JSONEncoder().encode(cache) else {
            return
        }

        defaults.set(data, forKey: Self.cacheKey)
    }

    private func recoveryScores(from data: Data) throws -> [String: Int] {
        let export = try JSONDecoder.trainingCoach.decode(ExportResponse.self, from: data)
        return export.entries.reduce(into: [String: Int]()) { result, entry in
            guard let score = entry.snapshot.recovery?.score else {
                return
            }

            result[entry.date] = boundedScore(score)
        }
    }

    private func last28Scores(from scoresByDate: [String: Int], endingAt date: Date) -> [Int?] {
        let end = calendar.startOfDay(for: date)
        let start = calendar.date(byAdding: .day, value: -27, to: end) ?? end

        return (0..<28).map { offset in
            guard let date = calendar.date(byAdding: .day, value: offset, to: start) else {
                return nil
            }

            return scoresByDate[apiDateString(for: date)]
        }
    }

    private func todayPlan(from day: Day) -> String {
        if let rpe = day.done?.rpe {
            return "Logged RPE \(rpe)"
        }

        if let sport = day.biometrics?.lastWorkout?.sport, !sport.isEmpty {
            return sport.capitalized
        }

        return "Today's plan"
    }

    private func apiDateString(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func boundedScore(_ score: Int) -> Int {
        min(max(score, 0), 100)
    }
}

private struct WidgetCache: Codable {
    let recoveryScore: Int?
    let last28Scores: [Int?]
    let todayPlan: String?
    let updatedAt: Date
}
