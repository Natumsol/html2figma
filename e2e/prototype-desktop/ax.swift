// THROWAWAY: direct macOS Accessibility reads avoid per-property AppleEvents.
// No permission prompts, private APIs or JS injection. Paste keys target Figma's PID.
import AppKit
import ApplicationServices
import Foundation

let args = CommandLine.arguments
guard args.count >= 3, let pid = Int32(args[1]) else { fatalError("pid dump|press [path role label]") }
guard AXIsProcessTrusted() else { print("Accessibility is not authorized for this process"); exit(2) }
let app = AXUIElementCreateApplication(pid)
func value(_ node: AXUIElement, _ key: String) -> CFTypeRef? {
  var result: CFTypeRef?
  guard AXUIElementCopyAttributeValue(node, key as CFString, &result) == .success else { return nil }
  return result
}
func str(_ node: AXUIElement, _ key: String) -> String { value(node, key) as? String ?? "" }
let windows = value(app, "AXWindows") as? [AXUIElement] ?? []
guard let window = windows.first else { print("No accessible Figma window"); exit(2) }
guard str(window, "AXTitle") == "html2figma E2E 画布验收" else { print("Unexpected window: " + str(window, "AXTitle")); exit(2) }
func children(_ node: AXUIElement) -> [AXUIElement] { value(node, "AXChildren") as? [AXUIElement] ?? [] }
if args[2] == "dump" {
  var output: [[String: Any]] = []
  func walk(_ node: AXUIElement, _ path: String, _ depth: Int) {
    if depth > 45 || output.count > 3000 { return }
    let role = str(node, "AXRole")
    var entry: [String: Any] = ["path":path, "role":role]
    for key in ["AXTitle", "AXDescription", "AXHelp", "AXIdentifier", "AXValue", "AXURL"] {
      if let raw = value(node, key), let text = raw as? String, !text.isEmpty { entry[key] = String(text.prefix(1000)) }
    }
    if role != "AXGroup" && role != "AXImage" || entry.count > 2 { output.append(entry) }
    for (index, child) in children(node).enumerated() { walk(child, path + "." + String(index), depth + 1) }
  }
  walk(window, "0", 0)
  print(String(data:try JSONSerialization.data(withJSONObject: output, options:[.prettyPrinted,.sortedKeys]),encoding:.utf8)!)
} else if ["press", "set", "paste"].contains(args[2]), args.count >= 6 {
  var node = window
  for part in args[3].split(separator:".").dropFirst() {
    guard let index = Int(part), children(node).indices.contains(index) else { print("Stale AX path"); exit(2) }
    node = children(node)[index]
  }
  guard str(node,"AXRole") == args[4], [str(node,"AXTitle"),str(node,"AXDescription")].contains(args[5]) else {
    print("AX role/label changed; refusing action"); exit(2)
  }
  NSRunningApplication(processIdentifier:pid)?.activate(options:[])
  if args[2] == "press" {
    let result = AXUIElementPerformAction(node, kAXPressAction as CFString)
    print("AXPress result: \(result.rawValue)")
    exit(result == .success ? 0 : 2)
  }
  guard args.count == 7, ["AXTextField", "AXTextArea", "AXComboBox"].contains(args[4]) else { exit(2) }
  if args[2] == "set" {
    let result = AXUIElementSetAttributeValue(node, kAXValueAttribute as CFString, args[6] as CFString)
    print("Set visible field result: \(result.rawValue)"); exit(result == .success ? 0 : 2)
  }
  let text = try String(contentsOfFile:args[6],encoding:.utf8)
  guard AXUIElementSetAttributeValue(node,kAXFocusedAttribute as CFString,kCFBooleanTrue) == .success else { print("Could not focus text input"); exit(2) }
  let clipboard = NSPasteboard.general
  let saved = clipboard.pasteboardItems?.map { item in item.types.compactMap { type in item.data(forType:type).map { (type,$0) } } } ?? []
  clipboard.clearContents(); clipboard.setString(text,forType:.string)
  func key(_ code:CGKeyCode) {
    for down in [true,false] {
      let event = CGEvent(keyboardEventSource:nil,virtualKey:code,keyDown:down)!
      event.flags = .maskCommand; event.postToPid(pid)
    }
  }
  key(0); key(9) // Real Command-A / Command-V keyboard events, addressed to Figma.
  let deadline = Date().addingTimeInterval(5)
  while str(node,"AXValue") != text && Date() < deadline { Thread.sleep(forTimeInterval:0.05) }
  let matched = str(node,"AXValue") == text
  clipboard.clearContents()
  let items = saved.map { values -> NSPasteboardItem in
    let item = NSPasteboardItem(); for (type,data) in values { item.setData(data,forType:type) }; return item
  }
  clipboard.writeObjects(items)
  print("Actual clipboard paste verified: \(matched)")
  exit(matched ? 0 : 2)
} else { print("Unsupported action"); exit(2) }
