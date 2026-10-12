package expo.modules.jetsonainput

import android.view.KeyEvent

/**
 * Bảng đổi keycode Android -> Windows virtual-key, đúng thứ Moonlight-web mong
 * đợi trên kênh `keyboard` (xem NativeMoonlightClient.sendKey).
 */
object KeyMap {
  private val map = HashMap<Int, Int>().apply {
    // Chữ cái: KEYCODE_A..Z = 29..54 -> VK 0x41..0x5A
    for (i in 0 until 26) put(KeyEvent.KEYCODE_A + i, 0x41 + i)
    // Số: KEYCODE_0..9 = 7..16 -> VK 0x30..0x39
    for (i in 0 until 10) put(KeyEvent.KEYCODE_0 + i, 0x30 + i)
    // Numpad
    for (i in 0 until 10) put(KeyEvent.KEYCODE_NUMPAD_0 + i, 0x60 + i)
    put(KeyEvent.KEYCODE_NUMPAD_MULTIPLY, 0x6A)
    put(KeyEvent.KEYCODE_NUMPAD_ADD, 0x6B)
    put(KeyEvent.KEYCODE_NUMPAD_SUBTRACT, 0x6D)
    put(KeyEvent.KEYCODE_NUMPAD_DOT, 0x6E)
    put(KeyEvent.KEYCODE_NUMPAD_DIVIDE, 0x6F)
    put(KeyEvent.KEYCODE_NUMPAD_ENTER, 0x0D)
    put(KeyEvent.KEYCODE_NUM_LOCK, 0x90)
    // F1..F12 = 131..142 -> VK 0x70..0x7B
    for (i in 0 until 12) put(KeyEvent.KEYCODE_F1 + i, 0x70 + i)

    put(KeyEvent.KEYCODE_DEL, 0x08) // Backspace
    put(KeyEvent.KEYCODE_TAB, 0x09)
    put(KeyEvent.KEYCODE_ENTER, 0x0D)
    put(KeyEvent.KEYCODE_ESCAPE, 0x1B)
    put(KeyEvent.KEYCODE_SPACE, 0x20)
    put(KeyEvent.KEYCODE_PAGE_UP, 0x21)
    put(KeyEvent.KEYCODE_PAGE_DOWN, 0x22)
    put(KeyEvent.KEYCODE_MOVE_END, 0x23)
    put(KeyEvent.KEYCODE_MOVE_HOME, 0x24)
    put(KeyEvent.KEYCODE_DPAD_LEFT, 0x25)
    put(KeyEvent.KEYCODE_DPAD_UP, 0x26)
    put(KeyEvent.KEYCODE_DPAD_RIGHT, 0x27)
    put(KeyEvent.KEYCODE_DPAD_DOWN, 0x28)
    put(KeyEvent.KEYCODE_SYSRQ, 0x2C) // PrintScreen
    put(KeyEvent.KEYCODE_INSERT, 0x2D)
    put(KeyEvent.KEYCODE_FORWARD_DEL, 0x2E)
    put(KeyEvent.KEYCODE_BREAK, 0x13)
    put(KeyEvent.KEYCODE_SCROLL_LOCK, 0x91)
    put(KeyEvent.KEYCODE_CAPS_LOCK, 0x14)

    put(KeyEvent.KEYCODE_SHIFT_LEFT, 0xA0)
    put(KeyEvent.KEYCODE_SHIFT_RIGHT, 0xA1)
    put(KeyEvent.KEYCODE_CTRL_LEFT, 0xA2)
    put(KeyEvent.KEYCODE_CTRL_RIGHT, 0xA3)
    put(KeyEvent.KEYCODE_ALT_LEFT, 0xA4)
    put(KeyEvent.KEYCODE_ALT_RIGHT, 0xA5)
    put(KeyEvent.KEYCODE_META_LEFT, 0x5B)
    put(KeyEvent.KEYCODE_META_RIGHT, 0x5C)
    put(KeyEvent.KEYCODE_MENU, 0x5D)

    // Dấu câu theo bố cục US (VK_OEM_*)
    put(KeyEvent.KEYCODE_SEMICOLON, 0xBA)
    put(KeyEvent.KEYCODE_EQUALS, 0xBB)
    put(KeyEvent.KEYCODE_COMMA, 0xBC)
    put(KeyEvent.KEYCODE_MINUS, 0xBD)
    put(KeyEvent.KEYCODE_PERIOD, 0xBE)
    put(KeyEvent.KEYCODE_SLASH, 0xBF)
    put(KeyEvent.KEYCODE_GRAVE, 0xC0)
    put(KeyEvent.KEYCODE_LEFT_BRACKET, 0xDB)
    put(KeyEvent.KEYCODE_BACKSLASH, 0xDC)
    put(KeyEvent.KEYCODE_RIGHT_BRACKET, 0xDD)
    put(KeyEvent.KEYCODE_APOSTROPHE, 0xDE)

    put(KeyEvent.KEYCODE_VOLUME_MUTE, 0xAD)
    put(KeyEvent.KEYCODE_VOLUME_DOWN, 0xAE)
    put(KeyEvent.KEYCODE_VOLUME_UP, 0xAF)
    put(KeyEvent.KEYCODE_MEDIA_NEXT, 0xB0)
    put(KeyEvent.KEYCODE_MEDIA_PREVIOUS, 0xB1)
    put(KeyEvent.KEYCODE_MEDIA_STOP, 0xB2)
    put(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, 0xB3)
  }

  /** VK tương ứng, hoặc 0 khi phím không có chỗ trên Windows. */
  fun virtualKey(keyCode: Int): Int = map[keyCode] ?: 0

  /** Cờ modifier của Moonlight: SHIFT=1, CTRL=2, ALT=4, META=8. */
  fun modifiers(metaState: Int): Int {
    var flags = 0
    if (metaState and KeyEvent.META_SHIFT_ON != 0) flags = flags or 0x01
    if (metaState and KeyEvent.META_CTRL_ON != 0) flags = flags or 0x02
    if (metaState and KeyEvent.META_ALT_ON != 0) flags = flags or 0x04
    if (metaState and KeyEvent.META_META_ON != 0) flags = flags or 0x08
    return flags
  }
}
