# Màn hình ảo cho streaming — app mobile

App mobile dùng vòng đời PC/Sunshine trong commit `ba94668` của repo cha. Giữ luồng đăng nhập → claim → chuẩn bị host → stream → release/khôi phục; mobile không tự đổi topology hoặc cài driver.

## Hành vi

- Đọc `displayMode`, `displayState`, `watchdogReady`, `restoreVerified`, danh sách mode/Hz và các target thực sự active từ `/api/pc/display`.
- Với profile VDD, chỉ chọn độ phân giải đúng tỷ lệ thiết bị nhận và Hz được công bố cho chính độ phân giải đó. 2560×1440/120 không bị giới hạn bởi panel vật lý 1920×1080/100. Màn 16:10 cần mode riêng, ví dụ 2560×1600/120.
- Auto dùng kích thước pixel của thiết bị (có áp giới hạn khu vực), không làm tròn tablet 2732×2048 thành mode 3200 pixel. Auto FPS vẫn có thể giảm theo đường truyền và các Hz VDD hỗ trợ. Độ phân giải/FPS chọn thủ công không bị thay bằng mode gần nhất.
- Không kéo giãn video của profile VDD để che viền. Driver thiếu mode đúng kích thước/tỷ lệ/Hz sẽ báo lỗi; cần thêm mode vào cấu hình driver rồi chạy lại setup PC để quét capabilities.
- Trước claim, kiểm tra readiness. Sau claim, đọc lại readiness. Trước khi mở game qua cổng `live`, kiểm tra một target VDD active, đúng kích thước và Hz thực tế. Frame nhận được sai kích thước sẽ dừng và release phiên.
- Không đọc được agent sẽ dừng kết nối, tránh đoán nhầm cấu hình màn hình vật lý khi VDD đang lỗi.
- Thao tác tại PC do watchdog PC xử lý: chặn generation → dừng remote → khôi phục màn hình vật lý. Mobile xử lý tín hiệu kết thúc và trả lease, không tự reconnect.
- Thoát khi claim còn đang chạy vẫn trả đúng lease đến muộn; lần kết nối tiếp theo đợi cleanup xong trước khi được claim.

## Kích hoạt host

Theo `../deploy/pc/VIRTUAL-DISPLAY-SETUP.md`: cài VDD được ký với một target, cấu hình các mode cần dùng, triển khai agent/helper/session service mới, cấp `DISPLAY_AGENT_UPSTREAM` và `DISPLAY_AGENT_TOKEN` cho instance PC, rồi chạy `configure-virtual-display.ps1` bằng Administrator khi không còn phiên stream. Không đặt các biến này cho instance VM.

Chỉ chọn 2K/120 trên mobile chưa tạo ra VDD. PC phải được setup và công bố mode tương ứng trước; thử thực tế cả input từ xa và chuột/bàn phím tại PC, kết thúc/lỗi/resume và khôi phục resolution/Hz/HDR.

Ngày 20/10/2026, PC-DAT và instance session PC đã được kích hoạt. Đã áp VDD 2560×1440/120 Hz với một target active và khôi phục màn hình vật lý 1920×1080/100 Hz. Phiên trình duyệt PC để Auto đã chạy qua VDD ở 1080p/60 theo yêu cầu client. Chi tiết và phần nghiệm thu còn lại: `../deploy/pc/VIRTUAL-DISPLAY-VALIDATION-2026-10-20.md`. Bản driver đang dùng có 90 tổ hợp độ phân giải/Hz, nằm trong giới hạn 96; không thêm mode vượt giới hạn này.

## Kiểm tra

- `npm test`: chính sách mode/Hz, parser, readiness, kiểm tra mode thực và race thoát/claim lại; giữ các kiểm tra host vật lý/VM cũ.
- `npm run lint` và `npx tsc --noEmit`.
- Repo cha: `node --test test/virtual-display.test.mjs test/virtual-display-windows.test.mjs test/monitor-privacy.test.mjs test/stream-host-setup.test.mjs`.

Kiểm tra tự động không thay topology hoặc cài driver. Cần nghiệm thu trên PC/GPU và thiết bị nhận thực tế để xác nhận capture 2K/120, FPS game/encoder/thiết bị nhận và chỉ một target active trong toàn bộ quá trình chuyển màn hình.
