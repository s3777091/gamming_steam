import Foundation

func expect(_ hid: Int, _ key: Int, _ vk: Int) {
  guard let actual = KeyboardMap.codes(hid), actual.key == key, actual.vk == vk else {
    fatalError("Incorrect HID mapping for \(hid)")
  }
}

expect(4, 29, 0x41) // A, not the character produced by the active keyboard layout.
expect(29, 54, 0x5A)
expect(30, 8, 0x31)
expect(38, 16, 0x39)
expect(39, 7, 0x30)
expect(40, 66, 0x0D)
expect(41, 111, 0x1B)
expect(58, 131, 0x70)
expect(69, 142, 0x7B)
expect(79, 22, 0x27)
expect(82, 19, 0x26)
expect(89, 145, 0x61)
expect(98, 144, 0x60)
expect(224, 113, 0xA2)
expect(228, 114, 0xA3) // Right Control retains Host-key identity.
expect(229, 60, 0xA1)
expect(231, 118, 0x5C)
assert(KeyboardMap.codes(0) == nil)
assert(KeyboardMap.codes(65535) == nil)
assert(KeyboardMap.modifiers([]) == 0)
assert(KeyboardMap.modifiers([224, 228]) == 2)
assert(KeyboardMap.modifiers([225, 228, 230, 231]) == 15)
assert(KeyboardMap.modifiers([4, 5]) == 0)
print("iOS keyboard mapping tests passed")
