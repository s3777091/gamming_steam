import * as Linking from 'expo-linking';

/** Mở một liên kết ngoài (trang Steam, hồ sơ…) bằng ứng dụng mặc định; lỗi thì im lặng. */
export async function openExternal(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // Không có trình duyệt xử lý được: bỏ qua, người dùng vẫn ở trong app.
  }
}
