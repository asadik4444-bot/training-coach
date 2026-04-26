import Foundation

extension JSONDecoder {
    /// Shared API decoder for TrainingCoach models.
    ///
    /// `keyDecodingStrategy = .convertFromSnakeCase` is not used; each model keeps
    /// explicit `CodingKeys` so the API contract stays visible at the type boundary.
    static let trainingCoach: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}
