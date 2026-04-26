import SwiftUI
import UIKit

struct WindowPicker: View {
    @Binding private var selection: TrendWindow

    init(selection: Binding<TrendWindow>) {
        self._selection = selection
    }

    var body: some View {
        Picker("Trend window", selection: $selection) {
            ForEach(TrendWindow.allCases) { window in
                Text(window.label)
                    .font(.firaSans(14, weight: .medium))
                    .tag(window)
            }
        }
        .pickerStyle(.segmented)
        .tint(Color.primary)
        .padding(4)
        .background(
            Capsule(style: .continuous)
                .fill(Color.bgSurface.opacity(0.94))
        )
        .overlay {
            Capsule(style: .continuous)
                .stroke(Color.border.opacity(0.8), lineWidth: 1)
        }
        .onChange(of: selection) {
            UISelectionFeedbackGenerator().selectionChanged()
        }
    }
}
