import Foundation

enum TrendWindow: Int, CaseIterable, Identifiable, Hashable {
    case sevenDays = 7
    case thirtyDays = 30
    case ninetyDays = 90
    case year = 365

    var id: Int {
        rawValue
    }

    var label: String {
        switch self {
        case .sevenDays:
            "7d"
        case .thirtyDays:
            "30d"
        case .ninetyDays:
            "90d"
        case .year:
            "1y"
        }
    }

    var days: Int {
        rawValue
    }
}
