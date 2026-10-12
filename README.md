# Jetsona Console (app_mobile)

Ứng dụng Expo (SDK 57, React Native 0.86) **chạy ngang** cho điện thoại và tablet
(thiết kế ở iPhone 14 Pro Max 932×430, tự phóng cho Galaxy Tab S9). Là bản native
của giao diện `MobileVersionSelector` bên web: tab **Games** / **Store**, tìm kiếm Steam,
chi tiết game, Cài đặt, hồ sơ Steam, và màn **stream** tới máy tính ở nhà.

Dùng **chung Supabase và dữ liệu** với web (`jetsona-ui-hybrid`) và `jetson-phone`:
cùng tài khoản, `controller_settings`, `user_phone_stream_settings`,
`stream_sessions`, `pc_game_catalog`, `device_status`…

## Chạy

```bash
cd app_mobile
npm install                 # .npmrc đã bật legacy-peer-deps
npx expo prebuild --platform android
npx expo run:android        # cần dev build vì có module native + WebRTC
```

Cấu hình trong `app.json > extra`: `backendBaseUrl`, `supabaseAnonKey` (cùng giá trị
với jetson-phone). Có thể ghi đè bằng `EXPO_PUBLIC_BACKEND_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`.

> **Windows và đường dẫn 260 ký tự.** Thư mục này nằm sâu nên bước biên dịch C++ của
> Android (CMake/Ninja) có thể lỗi `Filename longer than 260 characters`. Cách sửa gốc:
> bật Windows *LongPathsEnabled* (cần quyền admin), hoặc build từ ổ đĩa ảo ngắn
> (`subst M: <đường dẫn tới jetsona-ui-hybrid>` rồi build trong `M:\app_mobile\android`).

Xem giao diện không cần đăng nhập / máy tính: build với `EXPO_PUBLIC_UI_DEMO=1`
(dữ liệu mẫu, `src/lib/demo.ts`; bản phát hành không bật cờ này).

## Kiến trúc

| Thư mục | Vai trò |
| --- | --- |
| `src/app` | Expo Router: `/` (console) và `/stream` |
| `src/features/console` | Header, Games, Store, tìm kiếm, chi tiết game, bật máy |
| `src/features/library` | Kiểu dữ liệu + hook thư viện/Store/hồ sơ (cùng hình dạng với web) |
| `src/features/settings` | Cài đặt: chất lượng stream, hình ảnh, độ trễ, mạng, thiết bị, tay cầm… |
| `src/features/stream` | Phiên stream, loading vào game, nhập liệu vật lý, HUD, menu Guide |
| `src/features/gamepad` | Điều hướng giao diện bằng tay cầm kiểu PS5 (tiêu điểm nhảy từng nấc) |
| `modules/jetsona-input` | Module Android (Kotlin): tay cầm/bàn phím/chuột, rung, ảnh chụp… |
| `src/lib` | Logic dùng chung với web/jetson-phone (cài đặt stream, lease phiên, Moonlight…) |

### API Steam / máy tính — chỉ đổi một chỗ

Mọi dữ liệu máy tính (`/games`, `/store`, `/steam/profile`, `/games/launch`…) đi qua
`src/lib/pc-api.ts`. Mặc định là backend Jetsona `https://vn.protexa.cloud/api/pc/*`,
đứng trước proxy Steam `steam.protexa.cloud` (Việt Nam chặn Steam). Muốn trỏ sang API
khác: đặt `EXPO_PUBLIC_PC_API_URL` (hoặc `extra.pcApiBaseUrl`); nếu hình dạng route khác
thì sửa bảng `PC_ROUTES` trong cùng file.

### Bấm Play → vào thẳng màn loading của game (không polling)

1. Bấm Play: `POST /api/pc/games/launch` → PC bật **game-booster** ngay.
2. App nối vào máy tính (lease + WebRTC) trong lúc màn loading che.
3. Stream lên → app báo `start` → PC mở game.
4. Khi cửa sổ game đứng ở foreground (màn loading của game), PC báo `running` → màn
   loading của app tan ra.

Mọi pha 1→4 đến app bằng **sự kiện Realtime**: `game-booster.ps1` ghi vào bảng
`pc_game_sessions` (xem `supabase/migrations/202610120006_pc_game_sessions.sql`,
`deploy/pc/game-session-events.ps1`). Không có vòng lặp hỏi thăm; chỉ có một lần đọc ảnh
chụp khi mở kênh, và một dây an toàn đọc **một lần** nếu PC chưa đẩy sự kiện nào.

**Để chạy được cần:** áp migration lên Supabase, chạy lại `deploy/pc/setup-admin.ps1`
(chép `game-booster.ps1` + `game-session-events.ps1` sang `C:\jetsona`), và có
`C:\jetsona\game-art.env` (đã dùng cho game-art) chứa `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`.

### Tay cầm, bàn phím, chuột (Bluetooth / USB)

`modules/jetsona-input` bọc `Window.Callback` của Activity (không sửa MainActivity, nên
`expo prebuild --clean` không làm mất):

- **Ngoài stream** (`ui`): điều hướng kiểu PS5, không có con trỏ tự do — D-pad/cần trái
  chuyển tiêu điểm từng nấc sang nút gần nhất (viền trắng), **A** bấm, cần phải cuộn,
  **B** quay lại, **LB/RB** đổi tab Games/Store. Mọi `Press` tự đăng ký làm ô điều hướng;
  lớp phủ bọc trong `FocusLayer`, ScrollView dùng `FocusScroll` để tự cuộn tới ô đang chọn.
- **Trong stream** (`stream`): tay cầm, bàn phím và chuột vật lý gửi sang PC. Tay cầm đi
  qua kênh `controllers`/`controllerN` của moonlight-web (đúng định dạng client web),
  rung từ game được chuyển ngược về tay cầm. Chuột dùng pointer-capture (chuyển động
  tương đối). Phím Host (mặc định Ctrl phải) + phím = phím tắt của app.
- **Nút Home/Guide của tay cầm** (hoặc **giữ Start + Select** ~0,6 giây) mở menu: tab game đang chạy, chụp ảnh, sao chép
  clipboard hai chiều với PC, thiết bị, tải lại, thoát game. Một số tay cầm Bluetooth gửi
  Home thành phím HOME của Android: hệ thống thoát ra màn hình chính trước khi app thấy
  phím đó (không app nào chặn được), nên dùng tổ hợp Start + Select thay thế.
- **Ảnh Steam** (steamstatic.com...) bị chặn ở Việt Nam nên `Img` tải qua proxy ảnh
  (`lib/image-proxy.ts`, mặc định wsrv.nl; đổi bằng `EXPO_PUBLIC_IMAGE_PROXY_URL` hoặc
  `extra.imageProxyUrl`, để rỗng để tắt) và tự thử lại URL gốc nếu proxy lỗi.
- Danh sách thiết bị, Bluetooth, tai nghe cập nhật bằng **sự kiện** (InputDeviceListener,
  AudioDeviceCallback, broadcast Bluetooth).
- *Cài đặt › Tay cầm* có bộ kiểm tra tín hiệu trực tiếp (nút, cần, cò) để thử từng tay cầm
  (ví dụ Rapoo V610M) và nút **Thử rung**.

Ghép đôi Bluetooth vẫn làm trong cài đặt hệ thống (app có nút mở nhanh); tay cầm
ghép xong tự hiện trong app. PC cần driver tay cầm ảo (**ViGEmBus**) để Sunshine tạo
tay cầm.

## Kiểm tra

```bash
npx tsc --noEmit
```
