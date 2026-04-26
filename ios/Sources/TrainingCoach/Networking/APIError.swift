import Foundation

public enum APIError: Error, Sendable, Equatable, LocalizedError {
    case unauthorized
    case network(URLError)
    case decode(String)
    case upstream(status: Int)
    case notConfigured

    public var errorDescription: String? {
        switch self {
        case .unauthorized:
            "Unauthorized — re-paste your dashboard secret."
        case .network(let error):
            "Network error: \(error.localizedDescription)"
        case .decode(let detail):
            "Decoding failed: \(detail.prefix(140))"
        case .upstream(let status):
            "Server returned HTTP \(status)."
        case .notConfigured:
            "No dashboard secret found in Keychain."
        }
    }
}
