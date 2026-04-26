import Foundation
import SwiftUI
import UIKit

struct RotateSecretSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var secret = ""
    @State private var state = ValidationState.idle
    @State private var shakeOffset: CGFloat = 0

    @ScaledMetric(relativeTo: .body) private var fieldSize: CGFloat = 16
    @ScaledMetric(relativeTo: .body) private var buttonSize: CGFloat = 17

    var body: some View {
        ZStack {
            Color.bg
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("ROTATE SECRET")
                        .font(.firaSans(28, weight: .bold))
                        .foregroundStyle(Color.text)
                        .tracking(1.1)

                    Text("Paste the replacement dashboard secret. It will be validated before Keychain is updated.")
                        .font(.firaSans(15))
                        .foregroundStyle(Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }

                SecureField("New dashboard secret", text: $secret)
                    .font(.firaCode(fieldSize))
                    .foregroundStyle(Color.text)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.password)
                    .submitLabel(.go)
                    .onSubmit(rotateSecret)
                    .padding(18)
                    .background(Color.bgCard.opacity(0.74))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color.border, lineWidth: 1)
                    }
                    .accessibilityLabel("New dashboard secret")
                    .accessibilityHint("Paste the replacement dashboard secret.")

                Text("Invalid secret. Current Keychain value was not changed.")
                    .font(.firaSans(13, weight: .medium))
                    .foregroundStyle(Color.recoveryRed)
                    .opacity(state == .error ? 1 : 0)
                    .accessibilityHidden(state != .error)

                Button(action: rotateSecret) {
                    Group {
                        if state == .validating {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .tint(.white)
                        } else {
                            Text("Validate and Save")
                                .font(.firaSans(buttonSize, weight: .semibold))
                                .foregroundStyle(Color.text)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                }
                .background(Color.primary)
                .clipShape(.capsule)
                .shadow(color: Color.primary.opacity(0.3), radius: 12, y: 4)
                .opacity(state == .validating ? 0.7 : 1)
                .disabled(state == .validating)
                .accessibilityLabel(state == .validating ? "Validating secret" : "Validate and save secret")

                Button("Cancel", role: .cancel) {
                    dismiss()
                }
                    .font(.firaSans(16, weight: .medium))
                    .foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .padding(26)
            .offset(x: shakeOffset)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private func rotateSecret() {
        let trimmedSecret = secret.trimmingCharacters(in: .whitespacesAndNewlines)

        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        guard trimmedSecret.isEmpty == false else {
            showError()
            return
        }

        state = .validating
        shakeOffset = 0

        Task { @MainActor in
            do {
                try await validate(secret: trimmedSecret)
                try KeychainStore.setSecret(trimmedSecret)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
            } catch {
                showError()
            }
        }
    }

    private func validate(secret: String) async throws {
        var components = URLComponents(string: "https://training-coach-phi.vercel.app/api/auth/dashboard")
        components?.queryItems = [URLQueryItem(name: "key", value: secret)]

        guard let url = components?.url else {
            throw RotationError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never

        let session = URLSession(configuration: configuration)
        defer {
            session.finishTasksAndInvalidate()
        }

        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) || httpResponse.statusCode == 302
        else {
            throw RotationError.invalidSecret
        }
    }

    private func showError() {
        state = .error

        guard reduceMotion == false else {
            shakeOffset = 0
            return
        }

        Task { @MainActor in
            for offset in [-8, 8, -8, 8, -8, 8, 0] {
                withAnimation(.linear(duration: 0.06)) {
                    shakeOffset = CGFloat(offset)
                }

                try? await Task.sleep(nanoseconds: 60_000_000)
            }
        }
    }

    private enum ValidationState {
        case idle
        case validating
        case error
    }

    private enum RotationError: Error {
        case invalidURL
        case invalidSecret
    }
}

#Preview {
    RotateSecretSheet()
        .preferredColorScheme(.dark)
}
