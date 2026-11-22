//
//  ViewController.swift
//  EMU LabMarker
//
//  Created by Asil on 22.11.2026.
//

import SafariServices
import UIKit
import WebKit

private let extensionBundleIdentifier = "com.asilturkmen.emulabmarker.Extension"
private let portalURL = URL(string: "https://student.emu.edu.tr/")!
private let developerURL = URL(string: "https://asilturkmen.com")!
private let privacyURL = URL(string: "https://github.com/Asilturkmen/Emu-Labmarker/blob/main/PRIVACY.md")!

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.isOpaque = false
        self.webView.backgroundColor = UIColor(red: 0xF7 / 255, green: 0xF9 / 255, blue: 0xFC / 255, alpha: 1)

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)

        // The user turns the extension on in Settings and comes back: show the new state.
        NotificationCenter.default.addObserver(self, selector: #selector(refreshState), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshState()
    }

    @objc private func refreshState() {
        if #available(iOS 26.2, *) {
            SFSafariExtensionManager.getStateOfExtension(withIdentifier: extensionBundleIdentifier) { state, _ in
                let enabled = state.map { $0.isEnabled ? "true" : "false" } ?? "null"
                DispatchQueue.main.async {
                    self.webView.evaluateJavaScript("show(\(enabled), true)")
                }
            }
        } else {
            webView.evaluateJavaScript("show(null, false)")
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let action = message.body as? String else { return }

        switch action {
        case "open-settings":
            if #available(iOS 26.2, *) {
                SFSafariSettings.openExtensionsSettings(forIdentifiers: [extensionBundleIdentifier]) { _ in }
            }
        case "open-portal":
            UIApplication.shared.open(portalURL)
        case "open-site":
            UIApplication.shared.open(developerURL)
        case "open-privacy":
            UIApplication.shared.open(privacyURL)
        default:
            break
        }
    }

}
