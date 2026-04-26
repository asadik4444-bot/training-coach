import Foundation

actor APIClient {
    private let secretProvider: @Sendable () async -> String?
    private let baseURL: URL
    private let session: URLSession
    private var hasAuth = false

    init(
        secretProvider: @Sendable @escaping () async -> String?,
        baseURL: URL = URL(string: "https://training-coach-phi.vercel.app")!
    ) {
        self.secretProvider = secretProvider
        self.baseURL = baseURL

        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpShouldSetCookies = true
        self.session = URLSession(configuration: configuration)
    }

    func getDay(date: String) async throws -> Day {
        try await authenticateIfNeeded()

        let data = try await data(for: url(pathComponents: ["api", "day", date]))
        return try decode(Day.self, from: data)
    }

    func getTrend(metric: TrendMetric, days: Int) async throws -> TrendResponse {
        try await authenticateIfNeeded()

        let data = try await data(
            for: url(
                pathComponents: ["api", "trend", metric.rawValue],
                queryItems: [URLQueryItem(name: "days", value: String(days))]
            )
        )
        return try decode(TrendResponse.self, from: data)
    }

    func getExport() async throws -> Data {
        try await authenticateIfNeeded()

        return try await data(for: url(pathComponents: ["api", "export"]))
    }

    func ensureAuth() async throws {
        guard !hasAuth else {
            return
        }

        guard let secret = await secretProvider() else {
            throw APIError.notConfigured
        }

        do {
            let (_, response) = try await session.data(
                for: request(
                    url: url(
                        pathComponents: ["api", "auth", "dashboard"],
                        queryItems: [URLQueryItem(name: "key", value: secret)]
                    )
                )
            )
            let statusCode = try httpStatusCode(from: response)

            if (200..<300).contains(statusCode) || statusCode == 302 {
                hasAuth = true
                return
            }

            hasAuth = false
            throw APIError.unauthorized
        } catch let error as APIError {
            throw error
        } catch let error as URLError {
            throw APIError.network(error)
        } catch {
            throw APIError.network(URLError(.unknown))
        }
    }

    private func authenticateIfNeeded() async throws {
        if !hasAuth {
            try await ensureAuth()
        }
    }

    private func data(for url: URL) async throws -> Data {
        do {
            let (data, response) = try await session.data(for: request(url: url))
            let statusCode = try httpStatusCode(from: response)

            if statusCode == 401 {
                hasAuth = false
                throw APIError.unauthorized
            }

            guard (200..<300).contains(statusCode) else {
                throw APIError.upstream(status: statusCode)
            }

            return data
        } catch let error as APIError {
            throw error
        } catch let error as URLError {
            throw APIError.network(error)
        } catch {
            throw APIError.network(URLError(.unknown))
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder.trainingCoach.decode(type, from: data)
        } catch let error as DecodingError {
            throw APIError.decode(String(describing: error))
        }
    }

    private func request(url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        return request
    }

    private func url(pathComponents: [String], queryItems: [URLQueryItem] = []) -> URL {
        let endpoint = pathComponents.reduce(baseURL) { url, component in
            url.appendingPathComponent(component)
        }

        guard !queryItems.isEmpty, var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            return endpoint
        }

        components.queryItems = queryItems
        return components.url ?? endpoint
    }

    private func httpStatusCode(from response: URLResponse) throws -> Int {
        guard let response = response as? HTTPURLResponse else {
            throw APIError.network(URLError(.badServerResponse))
        }

        return response.statusCode
    }
}
