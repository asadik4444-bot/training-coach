import Foundation

public enum APIError: Error, Sendable, Equatable {
    case unauthorized
    case network(URLError)
    case decode(String)
    case upstream(status: Int)
    case notConfigured
}
