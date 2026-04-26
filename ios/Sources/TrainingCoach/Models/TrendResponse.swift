import Foundation

/// Sample: ios/specs/api-samples/trend-hrv-30.json
struct TrendResponse: Decodable, Equatable, Hashable, Sendable {
    let metric: String
    let days: Int
    let points: [TrendPoint]

    private enum CodingKeys: String, CodingKey {
        case metric
        case days
        case points
    }
}

/// Sample: ios/specs/api-samples/trend-hrv-30.json
struct TrendPoint: Decodable, Equatable, Hashable, Sendable {
    let date: String
    let value: Double

    private enum CodingKeys: String, CodingKey {
        case date
        case value
    }
}
