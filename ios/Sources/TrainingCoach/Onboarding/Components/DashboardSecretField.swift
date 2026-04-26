import SwiftUI

struct DashboardSecretField: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @Binding var secret: String

    let showsError: Bool
    let onSubmit: () -> Void

    @FocusState private var isFocused: Bool

    @ScaledMetric(relativeTo: .caption) private var labelSize: CGFloat = 11
    @ScaledMetric(relativeTo: .body) private var fieldSize: CGFloat = 16
    @ScaledMetric(relativeTo: .footnote) private var hintSize: CGFloat = 13
    @ScaledMetric(relativeTo: .body) private var iconSize: CGFloat = 16

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("DASHBOARD SECRET")
                .font(.firaSans(labelSize, weight: .semibold))
                .kerning(1.2)
                .foregroundStyle(Color.textDim)
                .accessibilityHidden(true)

            HStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .font(.system(size: iconSize, weight: .semibold))
                    .foregroundStyle(isFocused ? Color.primaryLight : Color.textDim)
                    .frame(width: 20)
                    .accessibilityHidden(true)

                SecureField("Paste secret", text: $secret)
                    .font(.firaCode(fieldSize))
                    .foregroundStyle(Color.text)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.password)
                    .submitLabel(.go)
                    .focused($isFocused)
                    .onSubmit(onSubmit)
                    .accessibilityLabel("Dashboard secret")
                    .accessibilityHint("Paste your dashboard secret.")
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: 58, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.bgCard.opacity(isFocused ? 0.78 : 0.62))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        isFocused ? Color.primaryLight.opacity(0.9) : Color.border,
                        lineWidth: isFocused ? 1.25 : 1
                    )
            }
            .shadow(
                color: Color.primary.opacity(isFocused ? 0.18 : 0),
                radius: isFocused ? 14 : 0,
                y: isFocused ? 5 : 0
            )
            .animation(reduceMotion ? .linear(duration: 0.01) : .easeInOut(duration: 0.18), value: isFocused)

            ValidationHint(showsError: showsError, hintSize: hintSize)
        }
    }
}

private struct ValidationHint: View {
    let showsError: Bool
    let hintSize: CGFloat

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: showsError ? "exclamationmark.circle.fill" : "info.circle")
                .font(.system(size: hintSize, weight: .medium))
                .accessibilityHidden(true)

            Text(showsError ? "Invalid secret. Try again." : "Paste your dashboard secret. Find it in your bookmarks or Vercel env.")
                .font(.firaSans(hintSize, weight: showsError ? .medium : .regular))
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(showsError ? Color.recoveryRed : Color.textDim)
        .frame(minHeight: 34, alignment: .topLeading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(showsError ? "Invalid secret. Try again." : "Paste your dashboard secret. Find it in your bookmarks or Vercel environment.")
    }
}
