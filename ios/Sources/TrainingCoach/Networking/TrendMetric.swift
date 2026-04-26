import Foundation

public enum TrendMetric: String, Sendable, CaseIterable, Hashable {
    case hrv
    case rhr
    case sleep
    case strain

    public var label: String {
        switch self {
        case .hrv:
            "HRV"
        case .rhr:
            "RHR"
        case .sleep:
            "Sleep"
        case .strain:
            "Strain"
        }
    }

    public var unit: String {
        switch self {
        case .hrv:
            "ms"
        case .rhr:
            "bpm"
        case .sleep:
            "%"
        case .strain:
            ""
        }
    }
}
