import CoreImage
import ReplayKit

// Streams the screen to the Orbit app over the Unix socket that @livekit/react-native-webrtc listens on
// (ScreenCaptureController.m: <app group container>/rtc_SSFD). Each frame is a serialized CFHTTPMessage with
// Buffer-Width/Height/Orientation headers and a JPEG body, which ScreenCapturer.m decodes.
class SampleHandler: RPBroadcastSampleHandler {
  private var fd: Int32 = -1
  private var lastFrame = Date.distantPast
  private let ciContext = CIContext(options: nil)

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    guard
      let group = Bundle.main.object(forInfoDictionaryKey: "RTCAppGroupIdentifier") as? String,
      let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else { return stop("Screen sharing isn't set up for this build.") }

    // The app starts listening right after showing the picker; give it a moment if we beat it.
    for _ in 0..<10 {
      if connectSocket(path: dir.appendingPathComponent("rtc_SSFD").path) { return }
      Thread.sleep(forTimeInterval: 0.3)
    }
    stop("Start screen sharing from a call in Orbit.")
  }

  override func broadcastFinished() {
    closeSocket()
  }

  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with type: RPSampleBufferType) {
    guard type == .video, fd >= 0, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    // ponytail: fixed ~15 fps, half resolution, 0.6 JPEG (keeps the extension under its ~50 MB memory cap); tune if text looks soft.
    let now = Date()
    guard now.timeIntervalSince(lastFrame) >= 1.0 / 15 else { return }
    lastFrame = now

    let image = CIImage(cvPixelBuffer: pixelBuffer).transformed(by: CGAffineTransform(scaleX: 0.5, y: 0.5))
    guard
      let jpeg = ciContext.jpegRepresentation(
        of: image,
        colorSpace: CGColorSpaceCreateDeviceRGB(),
        options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.6])
    else { return }
    let orientation =
      (CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber)?
      .uint32Value ?? CGImagePropertyOrientation.up.rawValue

    let message = CFHTTPMessageCreateResponse(nil, 200, nil, kCFHTTPVersion1_1).takeRetainedValue()
    let headers = [
      "Content-Length": String(jpeg.count),
      "Buffer-Width": String(Int(image.extent.width)),
      "Buffer-Height": String(Int(image.extent.height)),
      "Buffer-Orientation": String(orientation),
    ]
    for (key, value) in headers {
      CFHTTPMessageSetHeaderFieldValue(message, key as CFString, value as CFString)
    }
    CFHTTPMessageSetBody(message, jpeg as CFData)
    guard let data = CFHTTPMessageCopySerializedMessage(message)?.takeRetainedValue() as Data? else { return }
    if !write(data) { stop("Screen sharing stopped.") }
  }

  private func connectSocket(path: String) -> Bool {
    var addr = sockaddr_un()
    let pathBytes = path.utf8CString
    guard pathBytes.count <= MemoryLayout.size(ofValue: addr.sun_path) else { return false }
    addr.sun_family = sa_family_t(AF_UNIX)
    withUnsafeMutableBytes(of: &addr.sun_path) { dst in pathBytes.withUnsafeBytes { dst.copyMemory(from: $0) } }

    fd = socket(AF_UNIX, SOCK_STREAM, 0)
    guard fd >= 0 else { return false }
    // The app closes the socket when sharing stops in-app; get EPIPE instead of being killed by SIGPIPE.
    var on: Int32 = 1
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
    let result = withUnsafePointer(to: &addr) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) }
    }
    if result != 0 { closeSocket() }
    return result == 0
  }

  private func write(_ data: Data) -> Bool {
    data.withUnsafeBytes { raw in
      guard let base = raw.baseAddress else { return false }
      var offset = 0
      while offset < data.count {
        let n = Darwin.write(fd, base + offset, data.count - offset)
        if n <= 0 { return false }
        offset += n
      }
      return true
    }
  }

  private func closeSocket() {
    if fd >= 0 { close(fd) }
    fd = -1
  }

  private func stop(_ reason: String) {
    closeSocket()
    finishBroadcastWithError(NSError(domain: "OrbitScreenShare", code: 0, userInfo: [NSLocalizedFailureReasonErrorKey: reason]))
  }
}
