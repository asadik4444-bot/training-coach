import SwiftUI

struct WorkoutsView: View {
    @State private var viewModel = WorkoutsViewModel()

    var body: some View {
        NavigationStack {
            List {
                headerRow

                switch viewModel.state {
                case .empty:
                    emptyRow

                case .loading:
                    loadingRows

                case .error(let error):
                    errorRow(error)

                case .success(let items):
                    workoutSections(items)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.bg)
            .environment(\.defaultMinListRowHeight, 1)
            .refreshable {
                await viewModel.load()
            }
            .task {
                await viewModel.load()
            }
            .navigationDestination(for: WorkoutItem.self) { item in
                WorkoutDetailView(item: item)
            }
        }
        .tint(Color.primaryLight)
    }

    private var headerRow: some View {
        Text("WORKOUTS")
            .font(.firaSans(28, weight: .bold))
            .foregroundStyle(Color.text)
            .tracking(1.5)
            .padding(.top, 10)
            .padding(.bottom, 6)
            .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.bg)
            .accessibilityAddTraits(.isHeader)
    }

    private var loadingRows: some View {
        Section {
            ForEach(0..<6, id: \.self) { _ in
                WorkoutSkeletonRow()
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.bg)
            }
        }
    }

    private var emptyRow: some View {
        WorkoutsStateRow(
            systemImage: "dumbbell.fill",
            title: "No workouts yet.",
            message: "Sync from Whoop to see history.",
            actionTitle: "Refresh",
            retry: reload
        )
        .listRowInsets(EdgeInsets(top: 80, leading: 24, bottom: 24, trailing: 24))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.bg)
    }

    private func errorRow(_ error: AppError) -> some View {
        WorkoutsStateRow(
            systemImage: "exclamationmark.triangle.fill",
            title: "Could not load workouts",
            message: error.statusCode == 401
                ? "\(error.message) Open onboarding to reconnect, then retry."
                : error.message,
            actionTitle: "Retry",
            retry: reload
        )
        .listRowInsets(EdgeInsets(top: 80, leading: 24, bottom: 24, trailing: 24))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.bg)
    }

    private func workoutSections(_ items: [WorkoutItem]) -> some View {
        ForEach(sections(from: items)) { section in
            Section {
                ForEach(section.items) { item in
                    NavigationLink(value: item) {
                        WorkoutRow(item: item)
                    }
                    .buttonStyle(.plain)
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.bg)
                }
            } header: {
                Text(section.title)
                    .font(.firaSans(12, weight: .semibold))
                    .foregroundStyle(Color.textMuted)
                    .textCase(nil)
                    .padding(.top, 8)
                    .accessibilityAddTraits(.isHeader)
            }
        }
    }

    private func reload() {
        Task {
            await viewModel.load()
        }
    }

    private func sections(from items: [WorkoutItem]) -> [WorkoutWeekSection] {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = .current
        let now = Date()
        let grouped = Dictionary(grouping: items) { item in
            calendar.dateInterval(of: .weekOfYear, for: item.workout.start)?.start ?? item.workout.start
        }

        return grouped.map { weekStart, sectionItems in
            WorkoutWeekSection(
                id: weekStart,
                title: title(for: weekStart, calendar: calendar, now: now),
                items: sectionItems.sorted { lhs, rhs in
                    lhs.workout.start > rhs.workout.start
                }
            )
        }
        .sorted { lhs, rhs in
            lhs.id > rhs.id
        }
    }

    private func title(for weekStart: Date, calendar: Calendar, now: Date) -> String {
        guard let thisWeek = calendar.dateInterval(of: .weekOfYear, for: now) else {
            return weekRangeTitle(startingAt: weekStart, calendar: calendar)
        }

        if calendar.isDate(weekStart, inSameDayAs: thisWeek.start) {
            return "This week"
        }

        if let lastWeekStart = calendar.date(byAdding: .weekOfYear, value: -1, to: thisWeek.start),
           calendar.isDate(weekStart, inSameDayAs: lastWeekStart) {
            return "Last week"
        }

        return weekRangeTitle(startingAt: weekStart, calendar: calendar)
    }

    private func weekRangeTitle(startingAt start: Date, calendar: Calendar) -> String {
        let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start

        return "\(formatWeekDate(start)) – \(formatWeekDate(end))"
    }

    private func formatWeekDate(_ date: Date) -> String {
        date.formatted(.dateTime.month(.abbreviated).day())
    }
}

private struct WorkoutWeekSection: Identifiable {
    let id: Date
    let title: String
    let items: [WorkoutItem]
}

private struct WorkoutSkeletonRow: View {
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.bgCard)
                .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(Color.bgCard)
                    .frame(width: 104, height: 14)

                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(Color.bgCard)
                    .frame(width: 132, height: 16)

                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(Color.bgCard)
                    .frame(width: 92, height: 10)
            }

            Spacer()

            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(Color.bgCard)
                .frame(width: 56, height: 12)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: 60)
        .background(Color.bgCard.opacity(0.45))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .redacted(reason: .placeholder)
        .accessibilityHidden(true)
    }
}

private struct WorkoutsStateRow: View {
    let systemImage: String
    let title: String
    let message: String
    let actionTitle: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .medium))
                .foregroundStyle(Color.textDim.opacity(0.28))
                .accessibilityHidden(true)

            VStack(spacing: 6) {
                Text(title)
                    .font(.firaSans(18, weight: .semibold))
                    .foregroundStyle(Color.text)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(.firaSans(14))
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button(actionTitle, action: retry)
                .font(.firaSans(15, weight: .semibold))
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
        .accessibilityElement(children: .contain)
    }
}
