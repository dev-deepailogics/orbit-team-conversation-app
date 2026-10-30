import UIKit
import FirebaseCore
import livekit_react_native

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // LiveKit (calls) must be set up before React Native starts.
    LivekitReactNative.setup()
    FirebaseApp.configure()
    return true
  }
}
