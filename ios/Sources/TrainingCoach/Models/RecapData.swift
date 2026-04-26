import Foundation

struct RecapData: Sendable, Hashable {
    let periodLabel: String
    let dateRange: String
    let avgRecovery: Int
    let avgHRV: Double
    let avgRHR: Int
    let avgSleepPct: Double
    let totalStrain: Double
    let recoveryPoints: [(date: String, value: Int)]
    let band: RecoveryBand

    static func == (lhs: RecapData, rhs: RecapData) -> Bool {
        lhs.periodLabel == rhs.periodLabel &&
            lhs.dateRange == rhs.dateRange &&
            lhs.avgRecovery == rhs.avgRecovery &&
            lhs.avgHRV == rhs.avgHRV &&
            lhs.avgRHR == rhs.avgRHR &&
            lhs.avgSleepPct == rhs.avgSleepPct &&
            lhs.totalStrain == rhs.totalStrain &&
            lhs.band == rhs.band &&
            lhs.recoveryPoints.elementsEqual(rhs.recoveryPoints) { lhsPoint, rhsPoint in
                lhsPoint.date == rhsPoint.date && lhsPoint.value == rhsPoint.value
            }
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(periodLabel)
        hasher.combine(dateRange)
        hasher.combine(avgRecovery)
        hasher.combine(avgHRV)
        hasher.combine(avgRHR)
        hasher.combine(avgSleepPct)
        hasher.combine(totalStrain)
        hasher.combine(band)
        for point in recoveryPoints {
            hasher.combine(point.date)
            hasher.combine(point.value)
        }
    }
}
