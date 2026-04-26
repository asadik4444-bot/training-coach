## What this is

Training Coach iOS is a single-user native iOS app for Asadbek that talks to the existing Vercel backend at `https://training-coach-phi.vercel.app`; distribution stays at $0/yr by using Apple Free Provisioning for device installs plus AltStore Classic for weekly auto-resigning.

## Why native?

- Haptics: native taps, nudges, and workout-window feedback feel immediate.
- HealthKit: read weight, body fat percent, resting HR, workouts, and sleep directly from iPhone/Apple Watch data.
- Widgets: recovery and plan status can live on the Home Screen and Lock Screen.
- Live Activity: today's workout window can surface in the Dynamic Island and on the Lock Screen.
- Native Charts: Swift Charts gives interactive trends without SVG or web gesture workarounds.

## Build prerequisites

- Xcode 15+
- iOS 17+ device
- Free Apple ID
- AltStore Classic

## First-build steps

1. `brew install xcodegen` (already installed for this project)
2. `cd ios && xcodegen generate`
3. `open TrainingCoach.xcodeproj`
4. In Signing and Capabilities, choose your personal Apple ID team and enable automatic signing.
5. Plug iPhone via USB, select it as the run destination, then press Cmd+R.
6. Trust the developer certificate on iPhone: Settings, General, VPN and Device Management, Apple Development your-email, Trust.

## AltStore Classic setup

Switzerland is non-EU, so use AltStore Classic, NOT PAL.

- Mac: download AltServer from https://altstore.io
- iPhone: install AltStore via AltServer pairing
- Keep iPhone and Mac on the same WiFi for weekly auto-resign
- Keep the Mac awake during the resign window

## Fonts

Put these font files in `Resources/Fonts/`:

- `FiraSans-Regular.ttf`
- `FiraSans-Medium.ttf`
- `FiraSans-SemiBold.ttf`
- `FiraSans-Bold.ttf`
- `FiraCode-Regular.ttf`
- `FiraCode-Medium.ttf`

Download sources:

- Fira Sans: https://fonts.google.com/specimen/Fira+Sans
- Fira Code: https://fonts.google.com/specimen/Fira+Code

## Common gotchas

- Free provisioning certificates expire after 7 days without AltStore re-signing.
- Free provisioning can require occasional manual Xcode repair if the team, bundle ID, or device trust state changes.
- HealthKit read-only access is OK for personal use, but the app still needs explicit user permission on-device.

## Pointers

- Native iOS spec: `/Users/asadbekabdurashidov/training-coach/docs/superpowers/specs/2026-04-26-v9-native-ios.md`
- API samples: `/Users/asadbekabdurashidov/training-coach/ios/specs/api-samples`
- App source: `/Users/asadbekabdurashidov/training-coach/ios/Sources/TrainingCoach`
- Widget and Live Activity source: `/Users/asadbekabdurashidov/training-coach/ios/Sources/TrainingCoachWidget`
