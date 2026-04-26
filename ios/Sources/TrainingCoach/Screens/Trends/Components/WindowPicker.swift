import SwiftUI
import UIKit

struct WindowPicker: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var selection: TrendWindow

    init(selection: Binding<TrendWindow>) {
        self._selection = selection
    }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(TrendWindow.allCases) { window in
                Button {
                    select(window)
                } label: {
                    Text(window.label)
                        .font(.firaCode(13, weight: .medium).monospacedDigit())
                        .foregroundStyle(selection == window ? Color.text : Color.textMuted)
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background {
                            if selection == window {
                                Capsule(style: .continuous)
                                    .fill(
                                        LinearGradient(
                                            colors: [
                                                Color.primaryLight,
                                                Color.primary
                                            ],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .shadow(color: Color.primary.opacity(0.36), radius: 10, y: 4)
                            }
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(window.label) trend window")
                .accessibilityAddTraits(selection == window ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(4)
        .background(
            Capsule(style: .continuous)
                .fill(Color.bgCard)
        )
        .overlay {
            Capsule(style: .continuous)
                .stroke(Color.border.opacity(0.8), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.34), radius: 12, y: 4)
        .animation(reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.82), value: selection)
        .accessibilityElement(children: .contain)
    }

    private func select(_ window: TrendWindow) {
        guard selection != window else {
            return
        }

        UISelectionFeedbackGenerator().selectionChanged()
        selection = window
    }
}
