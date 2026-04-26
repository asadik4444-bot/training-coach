# Premium Features

v9.0 has three "10K-app" features: Interactive Widget, Shareable Recap Cards, and Animated Recovery Ring.

## Interactive Widget

iOS 17+ home-screen widget actions let Asadbek tap "Log Weight" or "Mark Done" directly on the widget without launching the app.

Implementation note: use `AppIntent` actions wired into the WidgetKit configuration display.

Why it screams premium: the app feels present where the user already is, and the shortest workout/admin actions become one-tap interactions instead of full app sessions.

Files to create:

- Commit 13: `Sources/TrainingCoachWidget/InteractiveWidget.swift`
- Commit 13: `Sources/TrainingCoachWidget/LogWeightIntent.swift`
- Commit 13: `Sources/TrainingCoachWidget/MarkDoneIntent.swift`
- Commit 13: `Sources/TrainingCoachWidget/WidgetConfigurationDisplay.swift`

## Shareable Recap Cards

Spotify-Wrapped-style image cards should exist in week and month variants, optimized for sharing from inside the app.

Implementation note: render the SwiftUI recap layout with `ImageRenderer`, then expose it through `ShareLink`; use OLED dark styling with charts baked into the exported image.

Why it screams premium: it turns private training data into a polished artifact, with the charts and story already composed instead of relying on screenshots.

Files to create:

- Commit 14: `Sources/TrainingCoach/Features/Recap/WeeklyRecapCard.swift`
- Commit 14: `Sources/TrainingCoach/Features/Recap/MonthlyRecapCard.swift`
- Commit 14: `Sources/TrainingCoach/Features/Recap/RecapImageRenderer.swift`
- Commit 14: `Sources/TrainingCoach/Features/Recap/RecapShareSheet.swift`

## Animated Recovery Ring

The recovery score should render as an Apple-Watch-grade ring with spring physics and a tier color glow.

Implementation note: draw the ring using SwiftUI `Canvas` plus `Path`, and honor `@Environment(\.accessibilityReduceMotion)` by skipping the animation.

Why it screams premium: recovery is the app's main emotional signal, so the motion and color treatment should make it feel deliberate, responsive, and native.

Files to create:

- Commit 15: `Sources/TrainingCoach/Components/RecoveryRing.swift`
- Commit 15: `Sources/TrainingCoach/Components/RecoveryRingCanvas.swift`
- Commit 15: `Sources/TrainingCoach/Components/RecoveryRingPreview.swift`
