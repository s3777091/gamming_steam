import Foundation

// USB HID usage -> existing Android-keycode/Windows-VK wire contract.
// Keep remapping and Host shortcuts identical across both platforms.
enum KeyboardMap {
  static func codes(_ hid: Int) -> (key: Int, vk: Int)? {
    if (4...29).contains(hid) { return (29 + hid - 4, 0x41 + hid - 4) }
    if (30...38).contains(hid) { return (8 + hid - 30, 0x31 + hid - 30) }
    if hid == 39 { return (7, 0x30) }
    if (58...69).contains(hid) { return (131 + hid - 58, 0x70 + hid - 58) }
    if (89...97).contains(hid) { return (145 + hid - 89, 0x61 + hid - 89) }
    let table: [Int: (Int, Int)] = [
      40: (66, 0x0D), 41: (111, 0x1B), 42: (67, 0x08), 43: (61, 0x09),
      44: (62, 0x20), 45: (69, 0xBD), 46: (70, 0xBB), 47: (71, 0xDB),
      48: (72, 0xDD), 49: (73, 0xDC), 50: (73, 0xDC), 51: (74, 0xBA),
      52: (75, 0xDE), 53: (68, 0xC0), 54: (55, 0xBC), 55: (56, 0xBE),
      56: (76, 0xBF), 57: (115, 0x14), 70: (120, 0x2C), 71: (116, 0x91),
      72: (121, 0x13), 73: (124, 0x2D), 74: (122, 0x24), 75: (92, 0x21),
      76: (112, 0x2E), 77: (123, 0x23), 78: (93, 0x22), 79: (22, 0x27),
      80: (21, 0x25), 81: (20, 0x28), 82: (19, 0x26), 83: (143, 0x90),
      84: (154, 0x6F), 85: (155, 0x6A), 86: (156, 0x6D), 87: (157, 0x6B),
      88: (160, 0x0D), 98: (144, 0x60), 99: (158, 0x6E), 101: (82, 0x5D),
      224: (113, 0xA2), 225: (59, 0xA0), 226: (57, 0xA4), 227: (117, 0x5B),
      228: (114, 0xA3), 229: (60, 0xA1), 230: (58, 0xA5), 231: (118, 0x5C)
    ]
    return table[hid]
  }

  static func modifiers(_ held: Set<Int>) -> Int {
    var result = 0
    if held.contains(225) || held.contains(229) { result |= 1 }
    if held.contains(224) || held.contains(228) { result |= 2 }
    if held.contains(226) || held.contains(230) { result |= 4 }
    if held.contains(227) || held.contains(231) { result |= 8 }
    return result
  }
}
