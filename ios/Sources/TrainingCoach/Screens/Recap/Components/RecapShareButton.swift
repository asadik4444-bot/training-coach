import CoreTransferable
import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct RecapShareButton: View {
    let data: RecapData

    @State private var payload: RecapSharePayload?
    @State private var previewImage: UIImage?

    var body: some View {
        Group {
            if let payload, let previewImage {
                ShareLink(
                    item: payload,
                    preview: SharePreview(data.periodLabel, image: Image(uiImage: previewImage))
                ) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.text)
                }
                .simultaneousGesture(TapGesture().onEnded { _ in impact() })
                .accessibilityLabel("Share recap")
            } else {
                ProgressView()
                    .tint(Color.text)
                    .accessibilityLabel("Preparing recap image")
            }
        }
        .task(id: data) {
            await renderImage()
        }
    }

    @MainActor
    private func renderImage() {
        payload = nil
        previewImage = nil

        let renderer = ImageRenderer(content: RecapCard(data: data))
        renderer.proposedSize = ProposedViewSize(
            width: RecapCard.exportSize.width,
            height: RecapCard.exportSize.height
        )
        renderer.scale = 1

        guard let image = renderer.uiImage,
              let pngData = image.pngData()
        else {
            return
        }

        previewImage = image
        payload = RecapSharePayload(pngData: pngData)
    }

    private func impact() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

private struct RecapSharePayload: Transferable, Sendable {
    let pngData: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .png) { payload in
            payload.pngData
        }
    }
}
