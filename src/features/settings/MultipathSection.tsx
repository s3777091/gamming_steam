import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FocusLayer, FocusScroll } from '@/features/gamepad/focus';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  Unlock,
  Wifi,
  X,
} from 'lucide-react-native';

import { useMultipathAi, type AvailableWifi } from '@/lib/multipath-ai';
import { alpha, makeStyles } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { useMotion } from '@/ui/motion';
import { useSettingsRestore } from './SettingsRestore';
import { SettingsDisclosure } from './SettingsDisclosure';
import { useSettingsColors } from './SettingsSurface';

import { ActionRow, InfoRow, SettingsGroup, ToggleRow } from './controls';

function isWifiSecured(capabilities?: string): boolean {
  if (!capabilities) return false;
  const c = capabilities.toUpperCase();
  return (
    c.includes('WPA') ||
    c.includes('PSK') ||
    c.includes('WEP') ||
    c.includes('SAE') ||
    c.includes('EAP') ||
    c.includes('802.1X')
  );
}

function isLikelyCaptivePortal(capabilities?: string, ssid?: string): boolean {
  const open = !isWifiSecured(capabilities);
  if (!open) return false;
  const s = (ssid ?? '').toLowerCase();
  return (
    s.includes('guest') ||
    s.includes('free') ||
    s.includes('public') ||
    s.includes('hotel') ||
    s.includes('coffee') ||
    s.includes('cafe') ||
    s.includes('portal') ||
    s.includes('web')
  );
}

export function MultipathSection({ connectionHeader }: { connectionHeader?: ReactNode }) {
  const appleColors = useSettingsColors();
  const styles = useStyles();
  const { s } = useUi();
  const { reduceMotion, active } = useMotion();
  const {
    capabilities,
    status,
    availableWifi,
    scanning,
    aiEnabled,
    autoCellular,
    metrics,
    metricsLive,
    decision,
    scanError,
    captivePortalSsid,
    scanWifi,
    connectSecondary,
    disconnectSecondary,
    toggleCellular,
    toggleAi,
    openCaptivePortal,
  } = useMultipathAi();

  useSettingsRestore(async () => {
    await Promise.all([
      !aiEnabled ? toggleAi(true) : Promise.resolve(),
      !autoCellular ? toggleCellular(true) : Promise.resolve(),
    ]);
  }, { label: 'Khôi phục cài đặt mạng', disabled: aiEnabled && autoCellular });

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedWifi, setSelectedWifi] = useState<AvailableWifi | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [manualSsid, setManualSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Hiệu ứng quay 360 độ mượt mà cho icon "Quét lại"
  const [spinAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (scanning && !reduceMotion && active) {
      const animation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [active, reduceMotion, scanning, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleOpenScan = () => {
    setSelectedWifi(null);
    setIsManual(false);
    setManualSsid('');
    setPassword('');
    setShowPassword(false);
    setModalVisible(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void scanWifi();
  };

  const primary = status.primary;
  const primarySsidTrimmed = (primary.ssid ?? '').trim().toLowerCase();

  // Lọc bỏ mạng chính đang kết nối: Mạng phụ dự phòng BẮT BUỘC phải là mạng khác
  const eligibleWifiList = availableWifi.filter((item) => {
    const s = (item.ssid ?? '').trim().toLowerCase();
    return s.length > 0 && s !== primarySsidTrimmed;
  });

  const isManualConflict = isManual && manualSsid.trim().toLowerCase() === primarySsidTrimmed;

  // Kiểm tra Wi-Fi đang chọn có bảo mật không
  const isSelectedSecured = isManual ? true : selectedWifi ? isWifiSecured(selectedWifi.capabilities) : true;
  const isSelectedCaptive = selectedWifi ? isLikelyCaptivePortal(selectedWifi.capabilities, selectedWifi.ssid) : false;

  const handleConnect = async () => {
    const targetSsid = isManual ? manualSsid.trim() : selectedWifi?.ssid;
    if (!targetSsid || isManualConflict) return;

    setConnecting(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await connectSecondary(targetSsid, isSelectedSecured && password ? password : undefined);
      setModalVisible(false);
      setSelectedWifi(null);
      setIsManual(false);
      setManualSsid('');
      setPassword('');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
      <SettingsGroup title="Kết nối hiện tại">
        {connectionHeader}
        <InfoRow
          label="Đường truyền chính"
          detail={primary.ssid}
          value={
            <View style={{ alignItems: 'flex-end', gap: s(2) }}>
              <T size={12.4} color={appleColors.text}>
                {primary.band ? `Wi-Fi ${primary.band.replace('GHz', ' GHz')}` : primary.ssid ? 'Wi-Fi' : 'Chưa xác định'}
              </T>
              {primary.rssi != null ? (
                <T size={10.6} color={appleColors.textTertiary} tabular>{primary.rssi} dBm</T>
              ) : null}
            </View>
          }
        />
        {status.secondary.type === 'wifi' && status.secondary.status === 'connected' ? (
          <View>
            <ActionRow icon={Wifi} iconBg={appleColors.accent} label="Đường truyền phụ"
              detail={status.secondary.ssid ?? 'Wi-Fi phụ'}
              trailing={<T size={11} color={appleColors.textSecondary}>Đã kết nối</T>}
              onPress={() => setShowDisconnectConfirm((current) => !current)} />
            <SettingsDisclosure open={showDisconnectConfirm}>
              <ActionRow icon={X} tone="danger" label="Ngắt kết nối Wi-Fi phụ"
                onPress={() => { void disconnectSecondary(); setShowDisconnectConfirm(false); }} />
            </SettingsDisclosure>
            {(captivePortalSsid || isLikelyCaptivePortal(undefined, status.secondary.ssid)) ? (
              <ActionRow icon={Globe} tone="accent" label="Mở trang xác nhận"
                detail="Mạng có thể yêu cầu đăng nhập web" onPress={openCaptivePortal} />
            ) : null}
          </View>
        ) : capabilities.hasCellular ? (
          <InfoRow label="Đường truyền phụ" value={status.secondary.status === 'connected'
            ? '4G / 5G' : status.secondary.status === 'connecting' ? 'Đang kết nối…' : 'Chưa kết nối'} />
        ) : capabilities.isDualWifiSupported ? (
          <ActionRow icon={Plus} tone="accent" label="Đường truyền phụ"
            detail={status.secondary.status === 'connecting' ? 'Đang kết nối Wi-Fi phụ…' : 'Thêm Wi-Fi dự phòng'}
            busy={status.secondary.status === 'connecting'} onPress={handleOpenScan}
            trailing={<T size={11} color={appleColors.accent}>Chọn Wi-Fi</T>} />
        ) : (
          <InfoRow label="Đường truyền phụ" value="Không khả dụng" />
        )}
      </SettingsGroup>

      <SettingsGroup title="Tối ưu kết nối">
        <ToggleRow label="Phân tích chất lượng mạng"
          detail="Phân tích độ trễ và mất gói khi chơi" checked={aiEnabled}
          onChange={(value) => void toggleAi(value)} />
        <InfoRow label={metricsLive ? 'Phiên stream hiện tại' : 'Phiên stream gần nhất'}
          value={metrics ? (
            <View style={{ alignItems: 'flex-end', gap: s(2) }}>
              <T size={12} color={appleColors.textSecondary} tabular>
                RTT: {metrics.rttMs == null ? 'Chưa có dữ liệu' : `${metrics.rttMs.toFixed(0)} ms`}
              </T>
              <T size={10.6} color={appleColors.textTertiary} tabular>
                Mất gói: {metrics.lossPercent == null ? 'Chưa có dữ liệu' : `${metrics.lossPercent.toFixed(1)}%`}
              </T>
            </View>
          ) : 'Chưa có dữ liệu'} />
        <InfoRow label="Khuyến nghị" value={!aiEnabled ? 'Đã tắt phân tích'
          : decision === 'poor' ? 'Nên giảm bitrate'
          : decision === 'fair' ? 'Theo dõi đường truyền khi chơi'
          : decision === 'good' ? 'Chất lượng đường truyền tốt' : 'Chưa có dữ liệu'} />
        {capabilities.hasCellular ? (
          <ToggleRow label="Dự phòng 4G / 5G"
            detail="Giữ kết nối di động sẵn sàng làm dự phòng"
            checked={autoCellular} onChange={(value) => void toggleCellular(value)} />
        ) : null}
      </SettingsGroup>
      {/* Modal chọn Wi-Fi phụ - Thiết kế Apple Glass tối giản */}
      <Modal
        visible={modalVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setModalVisible(false)}
      >
        <FocusLayer>
          <View style={styles.modalBackdrop} focusable={false}>
            {/* Lớp nền trong suốt bắt chạm ngoài để đóng, không nhận focus */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setModalVisible(false)}
              focusable={false}
              accessible={false}
              importantForAccessibility="no"
              accessibilityLabel="Đóng chọn Wi-Fi"
            />

            <View style={styles.modalCard} focusable={false}>
              {/* Header: Đã có dấu X tắt tab */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
                  <View style={styles.headerIconBadge}>
                    <Wifi size={s(16)} color={appleColors.blue} />
                  </View>
                  <View>
                    <T size={14.6} weight="semibold" color={appleColors.text}>
                      Chọn Wi-Fi phụ
                    </T>
                    <T size={10.2} color={appleColors.textTertiary}>
                      Đường truyền dự phòng song song
                    </T>
                  </View>
                </View>
                <Press
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalVisible(false);
                  }}
                  focusVariant="card"
                  focusRadius={s(14)}
                  pressScale={0.92}
                  accessibilityLabel="Đóng chọn Wi-Fi"
                  style={styles.closeBtn}
                >
                  <X size={s(14)} color={appleColors.textSecondary} />
                </Press>
              </View>

              {/* Subheader với nút "Quét lại" hiện đại có spinning animation */}
              <View style={styles.listSubHeader}>
                <T size={10} weight="semibold" color={appleColors.textSecondary} tracking={0.06}>
                  MẠNG KHẢ DỤNG ({eligibleWifiList.length})
                </T>
                <Press
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    void scanWifi();
                  }}
                  disabled={scanning}
                  focusVariant="card"
                  focusRadius={s(12)}
                  pressScale={0.94}
                  accessibilityLabel="Quét lại mạng Wi-Fi"
                  style={[styles.scanPillBtn, scanning && { opacity: 0.7 }]}
                >
                  <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                    <RefreshCw size={s(11)} color={appleColors.blue} />
                  </Animated.View>
                  <T size={11} weight="medium" color={appleColors.blue}>
                    {scanning ? 'Đang dò sóng…' : 'Quét lại'}
                  </T>
                </Press>
              </View>

              {/* Danh sách mạng Wi-Fi: Dùng FocusScroll tự cuộn theo D-pad, item đầu autoFocus */}
              <View style={styles.glassListContainer}>
                <FocusScroll
                  style={{ maxHeight: s(185) }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {eligibleWifiList.length === 0 ? (
                    <View style={{ paddingVertical: s(20), alignItems: 'center' }}>
                      <T size={11.4} color={appleColors.textTertiary}>
                        {scanning ? 'Đang tìm kiếm mạng Wi-Fi…' : scanError ?? 'Chưa tìm thấy mạng Wi-Fi nào khác xung quanh'}
                      </T>
                    </View>
                  ) : (
                    eligibleWifiList.map((item, idx) => {
                      const isSelected = !isManual && selectedWifi?.ssid === item.ssid;
                      const is5G = item.band.includes('5GHz') || item.isHbsCandidate;
                      const isSecured = isWifiSecured(item.capabilities);

                      return (
                        <View key={`${item.ssid}-${item.frequency}-${idx}`}>
                          {idx > 0 ? <View style={styles.rowSeparator} /> : null}
                          <Press
                            autoFocus={idx === 0}
                            focusVariant="row"
                            onPress={() => {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setIsManual(false);
                              setSelectedWifi(item);
                              setPassword('');
                            }}
                            style={[
                              styles.wifiRow,
                              isSelected && styles.wifiRowSelected,
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flex: 1 }}>
                              <Wifi
                                size={s(14)}
                                color={isSelected ? appleColors.accent : appleColors.textSecondary}
                              />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                                  <T size={12.4} weight="medium" color={appleColors.text} numberOfLines={1}>
                                    {item.ssid}
                                  </T>
                                  <View
                                    style={[
                                      styles.bandBadge,
                                      is5G && { backgroundColor: appleColors.pressedBg },
                                    ]}
                                  >
                                    <T
                                      size={8.8}
                                      weight="semibold"
                                      color={appleColors.textTertiary}
                                    >
                                      {is5G ? '5 GHz' : '2.4 GHz'}
                                    </T>
                                  </View>
                                </View>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                              {isSecured ? (
                                <Lock size={s(11)} color={appleColors.textTertiary} />
                              ) : (
                                <View style={styles.openBadge}>
                                  <Unlock size={s(10)} color="#30d158" />
                                  <T size={9} weight="semibold" color="#30d158">
                                    Mở
                                  </T>
                                </View>
                              )}
                              {isSelected ? (
                                <Check size={s(14)} color={appleColors.accent} strokeWidth={2.4} />
                              ) : null}
                            </View>
                          </Press>
                        </View>
                      );
                    })
                  )}

                  {/* Tuỳ chọn thêm mạng khác thủ công */}
                  <View style={styles.rowSeparator} />
                  <Press
                    autoFocus={eligibleWifiList.length === 0}
                    focusVariant="row"
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsManual(true);
                      setSelectedWifi(null);
                    }}
                    style={[
                      styles.wifiRow,
                      isManual && styles.wifiRowSelected,
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flex: 1 }}>
                      <Plus size={s(14)} color={isManual ? appleColors.blue : appleColors.textSecondary} />
                      <T size={12.4} weight="medium" color={isManual ? appleColors.blue : appleColors.textSecondary}>
                        Khác… (Nhập tên mạng)
                      </T>
                    </View>
                    {isManual ? (
                      <Check size={s(14)} color={appleColors.accent} strokeWidth={2.4} />
                    ) : null}
                  </Press>
                </FocusScroll>
              </View>

                {/* Nhập tên mạng thủ công nếu chọn "Khác..." */}
                {isManual ? (
                  <View style={{ marginTop: s(10) }}>
                    <T size={10.8} weight="medium" color={appleColors.textSecondary} style={{ marginBottom: s(4) }}>
                      Tên mạng (SSID):
                    </T>
                    <TextInput
                      value={manualSsid}
                      onChangeText={setManualSsid}
                      placeholder="Ví dụ: Backup_Hotspot_5G"
                      placeholderTextColor={appleColors.textTertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[
                        styles.glassInput,
                        isManualConflict && { borderColor: '#ff453a' },
                      ]}
                    />
                    {isManualConflict ? (
                      <View style={styles.warningBox}>
                        <AlertTriangle size={s(12)} color="#ff453a" />
                        <T size={10} color="#ff453a" style={{ flex: 1 }}>
                          Trùng với mạng chính đang dùng! Đường dự phòng bắt buộc phải là mạng khác.
                        </T>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Trường hợp 1: Mạng KHÔNG có mật khẩu (Mạng mở) -> Kết nối ngay, không hiện ô nhập mật khẩu thừa thãi */}
                {!isManual && selectedWifi && !isSelectedSecured ? (
                  <View style={styles.openNetworkCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flex: 1 }}>
                      <Unlock size={s(15)} color="#30d158" />
                      <View style={{ flex: 1 }}>
                        <T size={12} weight="semibold" color="#30d158">
                          Mạng mở (Không có mật khẩu)
                        </T>
                        <T size={9.8} color={appleColors.textTertiary}>
                          {isSelectedCaptive
                            ? 'Có thể yêu cầu xác nhận qua trang Web (Captive Portal)'
                            : 'Không yêu cầu mật khẩu để kết nối'}
                        </T>
                      </View>
                    </View>

                    <Press
                      disabled={connecting}
                      focusVariant="row"
                      focusRadius={s(8)}
                      pressScale={0.96}
                      onPress={() => void handleConnect()}
                      style={[styles.instantConnectBtn, connecting && { opacity: 0.6 }]}
                    >
                      {connecting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                          <T size={11.8} weight="semibold" color="#fff">
                            Kết nối ngay
                          </T>
                          <ArrowRight size={s(12)} color="#fff" />
                        </View>
                      )}
                    </Press>
                  </View>
                ) : null}

                {/* Trường hợp 2: Mạng có mật khẩu -> Ô nhập mật khẩu tích hợp nút ENTER/Kết nối ngay cạnh icon con mắt */}
                {(isManual || (selectedWifi && isSelectedSecured)) ? (
                  <View style={{ marginTop: s(10) }}>
                    <T size={10.8} weight="medium" color={appleColors.textSecondary} style={{ marginBottom: s(4) }}>
                      {isManual ? 'Mật khẩu Wi-Fi:' : `Mật khẩu cho "${selectedWifi?.ssid}":`}
                    </T>

                    <View style={styles.passwordInputContainer}>
                      <Lock size={s(13)} color={appleColors.textTertiary} style={{ marginRight: s(6) }} />
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Nhập mật khẩu Wi-Fi…"
                        placeholderTextColor={appleColors.textTertiary}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="go"
                        onSubmitEditing={() => void handleConnect()}
                        style={styles.passwordInput}
                      />

                      {/* Icon con mắt bật/tắt mật khẩu */}
                      <Press
                        onPress={() => setShowPassword((prev) => !prev)}
                        focusVariant="row"
                        focusRadius={s(14)}
                        pressScale={0.92}
                        style={styles.eyeBtn}
                      >
                        {showPassword ? (
                          <EyeOff size={s(14)} color={appleColors.textTertiary} />
                        ) : (
                          <Eye size={s(14)} color={appleColors.textTertiary} />
                        )}
                      </Press>

                      {/* Nút ENTER / Kết nối nằm NGAY CẠNH con mắt theo đúng tư duy công thái học */}
                      <Press
                        disabled={
                          connecting ||
                          (isManual && (!manualSsid.trim() || isManualConflict)) ||
                          (!isManual && !selectedWifi)
                        }
                        focusVariant="row"
                        focusRadius={s(8)}
                        pressScale={0.96}
                        onPress={() => void handleConnect()}
                        style={[
                          styles.inlineSubmitBtn,
                          (connecting || (isManual && (!manualSsid.trim() || isManualConflict))) && {
                            opacity: 0.5,
                          },
                        ]}
                      >
                        {connecting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                            <T size={11.8} weight="semibold" color="#fff">
                              Kết nối
                            </T>
                            <ArrowRight size={s(12)} color="#fff" />
                          </View>
                        )}
                      </Press>
                    </View>
                  </View>
                ) : null}

                {/* Hỗ trợ mở cổng xác thực Web Captive Portal nếu cần */}
                {isSelectedCaptive ? (
                  <Press
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      openCaptivePortal();
                    }}
                    focusVariant="row"
                    focusRadius={8} style={[styles.captivePortalLink, { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }]}
                  >
                    <Globe size={s(11)} color={appleColors.blue} />
                    <T size={10.2} color={appleColors.blue}>
                      Mạng này cần đăng nhập Web? Nhấn để mở trang xác thực
                    </T>
                  </Press>
                ) : null}
              </View>
            </View>
          </FocusLayer>
        </Modal>
      </>
    );
  }

const useStyles = makeStyles(({ colors, settings }) => {
  const appleColors = { ...settings, blue: settings.orange };
  return {
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    backgroundColor: colors.panelSolid,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: alpha(appleColors.blue, 0.10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  scanPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    backgroundColor: alpha(appleColors.blue, 0.10),
    borderWidth: 1,
    borderColor: alpha(appleColors.blue, 0.18),
  },
  glassListContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  wifiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  wifiRowSelected: {
    backgroundColor: alpha(appleColors.blue, 0.09),
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginLeft: 34,
  },
  bandBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  glassInput: {
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 12.2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.28)',
  },
  openNetworkCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  instantConnectBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#30d158',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordInputContainer: {
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 4,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    color: '#fff',
    fontSize: 12.4,
    padding: 0,
  },
  eyeBtn: {
    padding: 6,
    marginRight: 4,
  },
  inlineSubmitBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: appleColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captivePortalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  };
});
