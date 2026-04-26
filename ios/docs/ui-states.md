# UI States

Every screen with data fetching MUST implement all four states:

- Empty: no data yet, friendly placeholder plus retry button.
- Loading: skeleton or progress indicator, never blocking the rest of the UI.
- Error: network, decode, or 401 failure; show an error message plus retry, and on 401 prompt re-auth.
- Success: data loaded, render the content.

Codex MUST scaffold all four cases when generating any data-fetching screen because retrofitting error states later never happens.

## Canonical pattern

```swift
struct AppError: Error, Sendable, Equatable {
    let message: String
    let statusCode: Int?
}

enum LoadState<T: Sendable>: Sendable {
    case empty
    case loading
    case error(AppError)
    case success(T)
}
```

## SwiftUI skeleton

```swift
struct DataScreen: View {
    @State private var state: LoadState<DashboardSummary> = .empty

    var body: some View {
        Group {
            switch state {
            case .empty:
                EmptyPlaceholderView(
                    title: "No data yet",
                    message: "Refresh when you are ready.",
                    retry: reload
                )

            case .loading:
                LoadingSkeletonView()

            case .error(let error):
                ErrorStateView(
                    message: error.message,
                    retry: reload,
                    reauth: error.statusCode == 401 ? promptReauth : nil
                )

            case .success(let summary):
                DashboardContentView(summary: summary)
            }
        }
        .task {
            await load()
        }
    }

    private func reload() {
        Task {
            await load()
        }
    }

    private func load() async {
        // Fetch, decode, and assign .empty, .loading, .error, or .success.
    }

    private func promptReauth() {
        // Route to secret entry or show the auth sheet.
    }
}
```
