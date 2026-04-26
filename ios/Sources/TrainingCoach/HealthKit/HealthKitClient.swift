import Foundation
import HealthKit

actor HealthKitClient {
    static let shared = HealthKitClient()

    private let store = HKHealthStore()

    nonisolated var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    func requestAccess() async throws {
        guard isAvailable else {
            throw HealthKitClientError.unavailable
        }

        try await store.requestAuthorization(
            toShare: Set<HKSampleType>(),
            read: Set(Self.readTypes)
        )
    }

    func authorizationStatus() -> HKAuthorizationStatus {
        guard isAvailable else {
            return .sharingDenied
        }

        return store.authorizationStatus(for: Self.bodyMassType)
    }

    func bodyMassKg() async throws -> [HKQuantitySample] {
        try await quantitySamples(for: Self.bodyMassType, sorted: .forward)
    }

    func bodyFatPercentage() async throws -> HKQuantitySample? {
        let samples = try await quantitySamples(for: Self.bodyFatType, sorted: .reverse, limit: 1)
        return samples.first
    }

    func restingHeartRate() async throws -> [HKQuantitySample] {
        try await quantitySamples(for: Self.restingHeartRateType, sorted: .forward)
    }

    func sleepAnalysis() async throws -> [HKCategorySample] {
        guard isAvailable else {
            throw HealthKitClientError.unavailable
        }

        let predicate = HKQuery.predicateForSamples(
            withStart: Self.lookbackStartDate(),
            end: Date(),
            options: [.strictStartDate]
        )
        let samplePredicate = HKSamplePredicate.categorySample(type: Self.sleepAnalysisType, predicate: predicate)
        let descriptor = HKSampleQueryDescriptor(
            predicates: [samplePredicate],
            sortDescriptors: [SortDescriptor(\.startDate, order: .forward)],
            limit: HKObjectQueryNoLimit
        )

        return try await descriptor.result(for: store)
    }

    private func quantitySamples(
        for type: HKQuantityType,
        sorted sortOrder: SortOrder,
        limit: Int = HKObjectQueryNoLimit
    ) async throws -> [HKQuantitySample] {
        guard isAvailable else {
            throw HealthKitClientError.unavailable
        }

        let predicate = HKQuery.predicateForSamples(
            withStart: Self.lookbackStartDate(),
            end: Date(),
            options: [.strictStartDate]
        )
        let samplePredicate = HKSamplePredicate.quantitySample(type: type, predicate: predicate)
        let descriptor = HKSampleQueryDescriptor(
            predicates: [samplePredicate],
            sortDescriptors: [SortDescriptor(\.startDate, order: sortOrder)],
            limit: limit
        )

        return try await descriptor.result(for: store)
    }

    private static let bodyMassType = HKObjectType.quantityType(forIdentifier: .bodyMass)!
    private static let bodyFatType = HKObjectType.quantityType(forIdentifier: .bodyFatPercentage)!
    private static let restingHeartRateType = HKObjectType.quantityType(forIdentifier: .restingHeartRate)!
    private static let sleepAnalysisType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!

    private static let readTypes: [HKObjectType] = [
        bodyMassType,
        bodyFatType,
        restingHeartRateType,
        sleepAnalysisType
    ]

    private static func lookbackStartDate() -> Date {
        Calendar.current.date(byAdding: .day, value: -90, to: Date()) ?? Date()
    }
}

private enum HealthKitClientError: Error, Sendable {
    case unavailable
}
