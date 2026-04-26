import Foundation

struct AppError: Error, Sendable, Equatable, Hashable {
    let message: String
    let statusCode: Int?

    init(message: String, statusCode: Int? = nil) {
        self.message = message
        self.statusCode = statusCode
    }

    static let unauthorized = AppError(message: "Authentication expired. Re-enter your dashboard secret.", statusCode: 401)

    static func network(_ message: String) -> AppError {
        AppError(message: message, statusCode: nil)
    }

    var isUnauthorized: Bool { statusCode == 401 }
}

enum LoadState<T: Sendable>: Sendable {
    case empty
    case loading
    case error(AppError)
    case success(T)
}

extension LoadState: Equatable where T: Equatable {
    static func == (lhs: LoadState<T>, rhs: LoadState<T>) -> Bool {
        switch (lhs, rhs) {
        case (.empty, .empty), (.loading, .loading):
            true
        case (.error(let lhsError), .error(let rhsError)):
            lhsError == rhsError
        case (.success(let lhsValue), .success(let rhsValue)):
            lhsValue == rhsValue
        default:
            false
        }
    }
}
