import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  Check,
  Cpu,
  Layers,
  Plus,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Wifi,
  X,
  Zap,
} from 'lucide-react-native';

import { useMultipathAi, type AvailableWifi } from '@/lib/multipath-ai';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import {
  ActionRow,
  appleColors,
  InfoRow,
  PillButton,
  rowStyle,
  SettingsGroup,
  ToggleRow,
} from './controls';

export function MultipathSection() {
  const { s } = useUi();
  const {
    capabilities,
    status,
    availableWifi,
    scanning,
    aiEnabled,
    autoCellular,
    decision,
    metrics,
    scanWifi,
    connectSecondary,
    disconnectSecondary,
    toggleCellular,
    toggleAi,
  } = useMultipathAi();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedWifi, setSelectedWifi] = useState<AvailableWifi | null>(null);
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleOpenScan = () => {
    setModalVisible(true);
    void scanWifi();
  };

  const handleConnect = async () => {
    if (!selectedWifi) return;
    setConnecting(true);
    try {
      await connectSecondary(selectedWifi.ssid, password || undefined);
      setModalVisible(false);
      setSelectedWifi(null);
      setPassword('');
    } finally {
      setConnecting(false);
    }
  };

  const primary = status.primary;
  const isHbs = status.mode === 'hbs_dual_wifi';
  const isCellularActive = status.mode === 'wifi_cellular';
  const isDualActive = status.isMultipathActive;

  return (
    <>
      <SettingsGroup
        title="Đa đường truyền AI (Multipath Scheduling)"
        footer="Mô hình Tiny DRL điều phối từng packet microsecond qua 2 đường truyền (HBS Dual 5GHz hoặc Wi-Fi + 5G) để chống giật lag tuyệt đối."
      >
        <ToggleRow
          label="Mô hình AI Scheduler"
          detail="Tự động phân luồng, dự đoán RTT và co giãn buffer"
          checked={aiEnabled}
          onChange={(val) => void toggleAi(val)}
        />

        {/* Trạng thái chế độ hiện tại */}
        <View style={[rowStyle(s, { minHeight: s(62) }), { backgroundColor: 'rgba(255, 255, 255, 0.02)' }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
              {isHbs ? (
                <View style={[styles.badge, { backgroundColor: 'rgba(64, 200, 224, 0.16)', borderColor: 'rgba(64, 200, 224, 0.4)' }]}>
                  <Zap size={s(11)} color={appleColors.teal} />
                  <T size={10} weight="semibold" color={appleColors.teal}>
                    HBS Dual 5GHz Active
                  </T>
                </View>
              ) : isCellularActive ? (
                <View style={[styles.badge, { backgroundColor: 'rgba(52, 199, 89, 0.16)', borderColor: 'rgba(52, 199, 89, 0.4)' }]}>
                  <RadioTower size={s(11)} color={appleColors.green} />
                  <T size={10} weight="semibold" color={appleColors.green}>
                    Wi-Fi + 5G Active
                  </T>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.18)' }]}>
                  <Wifi size={s(11)} color={appleColors.textSecondary} />
                  <T size={10} weight="semibold" color={appleColors.textSecondary}>
                    Single-Path (AI ABR)
                  </T>
                </View>
              )}
            </View>

            <T size={10.4} color={appleColors.textTertiary} style={{ marginTop: s(4) }}>
              {isHbs
                ? 'Galaxy Tab S9 thu phát 2 sóng 5GHz song song qua Qualcomm FastConnect 7800.'
                : isCellularActive
                ? '4G/5G chạy ngầm song song, tự động gánh packet khi Wi-Fi có dấu hiệu nghẽn.'
                : 'Đang chạy 1 đường truyền: AI Pensieve tự động điều tiết bitrate và buffer.'}
            </T>
          </View>
        </View>

        {/* Đường truyền chính */}
        <InfoRow
          label="Đường chính"
          value={
            <View style={{ alignItems: 'flex-end', gap: s(1) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <T size={10} weight="semibold" color={appleColors.blue}>
                  {`[${primary.band ?? '5GHz'}]`}
                </T>
                <T size={12.4} weight="medium" color={appleColors.text}>
                  {primary.ssid ?? 'Wi-Fi Hiện Tại'}
                </T>
              </View>
              <T size={10} color={appleColors.textTertiary}>
                {`Ping: ~${metrics.link1Rtt.toFixed(0)}ms · Mất gói: ${metrics.link1Loss}%`}
              </T>
            </View>
          }
        />

        {/* Đường truyền phụ */}
        {capabilities.hasCellular ? (
          <ToggleRow
            label="Dự phòng 4G / 5G Cellular"
            detail="Tự động giữ kết nối 5G ngầm; chỉ dùng data khi Wi-Fi giật để tiết kiệm gói cước"
            checked={autoCellular}
            onChange={(val) => void toggleCellular(val)}
          />
        ) : (
          <>
            {status.secondary.status === 'connected' ? (
              <>
                <InfoRow
                  label="Đường phụ (Wi-Fi 2)"
                  value={
                    <View style={{ alignItems: 'flex-end', gap: s(1) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                        <T size={10} weight="semibold" color={appleColors.teal}>
                          [5GHz HBS]
                        </T>
                        <T size={12.4} weight="medium" color={appleColors.text}>
                          {status.secondary.ssid ?? 'Secondary Wi-Fi'}
                        </T>
                      </View>
                      <T size={10} color={appleColors.textTertiary}>
                        {`Ping: ~${metrics.link2Rtt.toFixed(0)}ms · Mất gói: ${metrics.link2Loss}%`}
                      </T>
                    </View>
                  }
                />
                <ActionRow
                  icon={X}
                  tone="danger"
                  label="Ngắt kết nối Wi-Fi phụ"
                  detail="Chuyển về dùng 1 đường Wi-Fi duy nhất"
                  onPress={() => void disconnectSecondary()}
                />
              </>
            ) : (
              <ActionRow
                icon={Plus}
                iconBg={appleColors.teal}
                tone="accent"
                label="Chọn Wi-Fi phụ (HBS Dual Wi-Fi)"
                detail="Tab S9 hỗ trợ kết nối thêm 1 sóng 5GHz thứ hai cùng lúc"
                onPress={handleOpenScan}
              />
            )}
          </>
        )}
      </SettingsGroup>

      {/* Bảng điều khiển phân phối luồng AI thời gian thực */}
      {aiEnabled && (
        <View style={{ marginTop: s(12), paddingHorizontal: s(2) }}>
          <View style={styles.monitorCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                <Cpu size={s(15)} color={appleColors.blue} />
                <T size={12.2} weight="semibold" color={appleColors.text}>
                  Bộ điều phối AI thời gian thực (Tiny DRL)
                </T>
              </View>
              <T size={10.2} color={appleColors.textTertiary}>
                Chu kỳ: 1.0s / lần
              </T>
            </View>

            {/* Thanh hiển thị tỉ lệ phân phối đường truyền */}
            <View style={{ marginTop: s(10) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                <T size={10.6} weight="medium" color={appleColors.blue}>
                  {`Đường chính: ${decision.primaryRatio}%`}
                </T>
                <T size={10.6} weight="medium" color={isDualActive ? appleColors.teal : appleColors.textTertiary}>
                  {`Đường phụ: ${decision.secondaryRatio}%`}
                </T>
              </View>

              <View style={styles.ratioBarContainer}>
                <View
                  style={[
                    styles.ratioBarPrimary,
                    { width: `${decision.primaryRatio}%` },
                  ]}
                />
                <View
                  style={[
                    styles.ratioBarSecondary,
                    {
                      width: `${decision.secondaryRatio}%`,
                      backgroundColor: isDualActive ? appleColors.teal : 'rgba(255,255,255,0.1)',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Các thông số suy luận của AI */}
            <View style={{ flexDirection: 'row', gap: s(8), marginTop: s(12) }}>
              <View style={styles.subStatBox}>
                <T size={9} color={appleColors.textTertiary}>
                  BITRATE MỤC TIÊU
                </T>
                <T size={13.5} weight="semibold" color={appleColors.text} style={{ marginTop: s(2) }}>
                  {`${decision.recommendedBitrateMbps} Mbps`}
                </T>
              </View>

              <View style={styles.subStatBox}>
                <T size={9} color={appleColors.textTertiary}>
                  BUFFER DỰ PHÒNG
                </T>
                <T size={13.5} weight="semibold" color={appleColors.text} style={{ marginTop: s(2) }}>
                  {`${decision.targetBufferSec.toFixed(1)}s`}
                </T>
              </View>

              <View style={styles.subStatBox}>
                <T size={9} color={appleColors.textTertiary}>
                  GỬI LẶP KHẨN CẤP
                </T>
                <T
                  size={13.5}
                  weight="semibold"
                  color={decision.redundancyActive ? appleColors.orange : appleColors.green}
                  style={{ marginTop: s(2) }}
                >
                  {decision.redundancyActive ? 'Kích hoạt' : 'Tối ưu'}
                </T>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Modal chọn Wi-Fi phụ cho Galaxy Tab S9 */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <T size={15} weight="semibold" color={appleColors.text}>
                  Chọn Wi-Fi phụ (HBS Dual-Band)
                </T>
                <T size={11} color={appleColors.textSecondary} style={{ marginTop: s(2) }}>
                  Ưu tiên sóng 5GHz để đạt băng thông tối đa trên Tab S9
                </T>
              </View>
              <Press onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={s(18)} color={appleColors.textSecondary} />
              </Press>
            </View>

            {/* Danh sách quét Wi-Fi */}
            <View style={{ marginVertical: s(10), maxHeight: s(220) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(8) }}>
                <T size={11} weight="semibold" color={appleColors.textSecondary}>
                  CÁC MẠNG XUNG QUANH
                </T>
                <Press
                  onPress={() => void scanWifi()}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}
                >
                  <RefreshCw size={s(12)} color={appleColors.blue} />
                  <T size={11} color={appleColors.blue}>
                    {scanning ? 'Đang quét…' : 'Quét lại'}
                  </T>
                </Press>
              </View>

              {scanning ? (
                <View style={{ paddingVertical: s(30), alignItems: 'center', gap: s(8) }}>
                  <ActivityIndicator color={appleColors.blue} />
                  <T size={11.5} color={appleColors.textSecondary}>
                    Đang tìm kiếm các điểm phát sóng…
                  </T>
                </View>
              ) : availableWifi.length === 0 ? (
                <View style={{ paddingVertical: s(20), alignItems: 'center' }}>
                  <T size={12} color={appleColors.textTertiary}>
                    Không tìm thấy mạng Wi-Fi nào. Hãy nhấn Quét lại.
                  </T>
                </View>
              ) : (
                availableWifi.map((item) => {
                  const isSelected = selectedWifi?.ssid === item.ssid;
                  const is5G = item.band.includes('5GHz') || item.isHbsCandidate;

                  return (
                    <Press
                      key={`${item.ssid}-${item.frequency}`}
                      onPress={() => setSelectedWifi(item)}
                      style={[
                        styles.wifiRow,
                        isSelected && { borderColor: appleColors.blue, backgroundColor: 'rgba(31, 111, 235, 0.12)' },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                          <T size={13} weight="medium" color={appleColors.text}>
                            {item.ssid}
                          </T>
                          <View
                            style={[
                              styles.bandPill,
                              {
                                backgroundColor: is5G
                                  ? 'rgba(64, 200, 224, 0.18)'
                                  : 'rgba(255, 255, 255, 0.08)',
                              },
                            ]}
                          >
                            <T
                              size={9.5}
                              weight="semibold"
                              color={is5G ? appleColors.teal : appleColors.textSecondary}
                            >
                              {item.band}
                            </T>
                          </View>
                          {is5G && (
                            <T size={9.5} color={appleColors.teal}>
                              ★ HBS Khuyên Dùng
                            </T>
                          )}
                        </View>
                        <T size={10} color={appleColors.textTertiary} style={{ marginTop: s(2) }}>
                          {`Tín hiệu: ${item.level} dBm · Tần số: ${item.frequency} MHz`}
                        </T>
                      </View>

                      {isSelected && (
                        <Check size={s(16)} color={appleColors.blue} strokeWidth={2.4} />
                      )}
                    </Press>
                  );
                })
              )}
            </View>

            {/* Ô nhập mật khẩu nếu đã chọn */}
            {selectedWifi && (
              <View style={{ marginTop: s(8) }}>
                <T size={11} weight="medium" color={appleColors.textSecondary} style={{ marginBottom: s(4) }}>
                  {`Mật khẩu cho "${selectedWifi.ssid}":`}
                </T>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Để trống nếu mạng mở..."
                  placeholderTextColor={appleColors.textTertiary}
                  secureTextEntry
                  style={styles.input}
                />
              </View>
            )}

            {/* Nút hành động */}
            <View style={{ flexDirection: 'row', gap: s(8), marginTop: s(16) }}>
              <View style={{ flex: 1 }}>
                <Press
                  onPress={() => setModalVisible(false)}
                  style={[styles.btn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
                >
                  <T size={12.5} weight="medium" color={appleColors.textSecondary}>
                    Hủy
                  </T>
                </Press>
              </View>
              <View style={{ flex: 1.5 }}>
                <Press
                  disabled={!selectedWifi || connecting}
                  onPress={() => void handleConnect()}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: selectedWifi ? appleColors.blue : 'rgba(255, 255, 255, 0.05)',
                      opacity: connecting ? 0.7 : 1,
                    },
                  ]}
                >
                  {connecting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <T size={12.5} weight="semibold" color={selectedWifi ? '#fff' : appleColors.textTertiary}>
                      Kết nối song song
                    </T>
                  )}
                </Press>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monitorCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 14,
  },
  ratioBarContainer: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  ratioBarPrimary: {
    height: '100%',
    backgroundColor: appleColors.blue,
  },
  ratioBarSecondary: {
    height: '100%',
  },
  subStatBox: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  closeBtn: {
    padding: 4,
  },
  wifiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 6,
  },
  bandPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  input: {
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 13,
  },
  btn: {
    height: 42,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
