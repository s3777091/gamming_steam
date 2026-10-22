import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  UIManager,
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
import { alpha, makeStyles, useTheme } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { useSettingsRestore } from './SettingsRestore';

import { ActionRow, InfoRow, SettingsGroup, ToggleRow } from './controls';

// Kích hoạt LayoutAnimation trên Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

export function MultipathSection() {
  const { settings: appleColors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
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
    if (scanning) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [scanning, spinAnim]);

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
      <SettingsGroup title="Đa đường truyền AI">
        <ToggleRow
          label="Phân tích chất lượng mạng"
          detail="Đánh giá độ trễ và mất gói đo từ phiên chơi"
          checked={aiEnabled}
          onChange={(val) => void toggleAi(val)}
        />

        {/* Đường truyền chính */}
        <InfoRow
          label="Đường chính"
          value={
            <View style={{ alignItems: 'flex-end', gap: s(1) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <T size={10} weight="semibold" color={appleColors.blue}>
                  {`[${primary.band ?? 'Chưa rõ băng tần'}]`}
                </T>
                <T size={12.4} weight="medium" color={appleColors.text}>
                  {primary.ssid ?? 'Wi-Fi Hiện Tại'}
                </T>
              </View>
              <T size={10} color={appleColors.textTertiary}>
                {primary.rssi != null ? `Tín hiệu: ${primary.rssi} dBm` : 'Chưa có thông tin tín hiệu'}
              </T>
            </View>
          }
        />

        <InfoRow
          label={metricsLive ? 'Phiên stream hiện tại' : 'Phiên stream gần nhất'}
          value={metrics
            ? `RTT: ${metrics.rttMs == null ? '—' : `${metrics.rttMs.toFixed(0)} ms`} · Mất gói: ${metrics.lossPercent == null ? '—' : `${metrics.lossPercent.toFixed(1)}%`}`
            : 'Chưa có dữ liệu'}
        />
        {aiEnabled ? (
          <InfoRow label="Khuyến nghị" value={decision === 'poor' ? 'Nên giảm bitrate để ổn định đường truyền'
            : decision === 'fair' ? 'Theo dõi đường truyền khi chơi'
            : decision === 'good' ? 'Chất lượng đường truyền tốt' : 'Chờ số liệu từ phiên chơi'} />
        ) : null}

        {/* Đường truyền phụ */}
        {capabilities.hasCellular ? (
          <ToggleRow
            label="Dự phòng 4G / 5G Cellular"
            detail="Giữ kết nối di động sẵn sàng làm đường truyền dự phòng"
            checked={autoCellular}
            onChange={(val) => void toggleCellular(val)}
          />
        ) : capabilities.isDualWifiSupported ? (
          <>
            {status.secondary.status === 'connected' ? (
              /* Thẻ Wi-Fi phụ tinh gọn - Chạm vào để mở/thu gọn nút [X Ngắt kết nối] */
              <View style={styles.secondaryCardContainer}>
                <Press
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowDisconnectConfirm((prev) => !prev);
                  }}
                  style={[styles.secondaryInteractiveRow, { paddingHorizontal: 8, paddingVertical: 6, marginHorizontal: -8, marginVertical: -6, borderRadius: 10 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), flex: 1 }}>
                    <View style={styles.secondaryIconBadge}>
                      <Wifi size={s(15)} color={appleColors.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                        <T size={12.8} weight="semibold" color={appleColors.text} numberOfLines={1}>
                          {status.secondary.ssid ?? 'Secondary Wi-Fi'}
                        </T>
                        <View style={styles.hbsBadge}>
                          <T size={9} weight="bold" color={appleColors.teal}>
                            5GHz HBS
                          </T>
                        </View>
                      </View>
                      <T size={10} color={appleColors.textTertiary}>
                        Đã kết nối · chưa có số đo riêng của đường phụ
                      </T>
                    </View>
                  </View>

                  {/* Nút hành động hiện ra mượt mà khi chạm vào thẻ */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                    {showDisconnectConfirm ? (
                      <Press
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          void disconnectSecondary();
                          setShowDisconnectConfirm(false);
                        }}
                        style={styles.disconnectPill}
                      >
                        <X size={s(12)} color="#ff453a" strokeWidth={2.4} />
                        <T size={11} weight="semibold" color="#ff453a">
                          disconnect
                        </T>
                      </Press>
                    ) : (
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <T size={10.5} weight="medium" color={appleColors.teal}>
                          dual-connect
                        </T>
                      </View>
                    )}
                  </View>
                </Press>

                {/* Banner hỗ trợ đăng nhập Web Captive Portal nếu mạng yêu cầu */}
                {(captivePortalSsid || status.secondary.ssid?.toLowerCase().includes('coffee') || status.secondary.ssid?.toLowerCase().includes('free')) && (
                  <View style={styles.captivePortalBanner}>
                    <Globe size={s(13)} color={appleColors.blue} />
                    <T size={10.5} color={appleColors.blue} style={{ flex: 1 }}>
                      Mạng có thể yêu cầu đăng nhập Web
                    </T>
                    <Press
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        openCaptivePortal();
                      }}
                      style={styles.captivePortalAction}
                    >
                      <T size={10.5} weight="semibold" color="#fff">
                        Mở trang xác nhận
                      </T>
                    </Press>
                  </View>
                )}
              </View>
            ) : (
              <ActionRow
                icon={Plus}
                iconBg={appleColors.blue}
                tone="accent"
                label="Chọn Wi-Fi phụ"
                detail="Kết nối song song đường truyền thứ 2 làm dự phòng"
                onPress={handleOpenScan}
              />
            )}
          </>
        ) : (
          <InfoRow
            label="Đường truyền phụ"
            value={Platform.OS === 'ios'
              ? 'iOS tự chọn Wi-Fi hoặc di động; phiên stream dùng một đường truyền'
              : 'Thiết bị chưa hỗ trợ đường truyền phụ'}
          />
        )}
      </SettingsGroup>

      {/* Modal chọn Wi-Fi phụ - Thiết kế Apple Glass tối giản */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
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
              {/* Specular highlight rim */}
              <View style={styles.specularTop} pointerEvents="none" />

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
                                color={isSelected ? appleColors.blue : is5G ? appleColors.teal : appleColors.textSecondary}
                              />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                                  <T size={12.4} weight="medium" color={appleColors.text} numberOfLines={1}>
                                    {item.ssid}
                                  </T>
                                  <View
                                    style={[
                                      styles.bandBadge,
                                      is5G && { backgroundColor: 'rgba(64, 200, 224, 0.16)' },
                                    ]}
                                  >
                                    <T
                                      size={8.8}
                                      weight="semibold"
                                      color={is5G ? appleColors.teal : appleColors.textTertiary}
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

const useStyles = makeStyles(({ colors, settings: appleColors }) => ({
  secondaryCardContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryInteractiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(64, 200, 224, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hbsBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(64, 200, 224, 0.16)',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(64, 200, 224, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(64, 200, 224, 0.25)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: appleColors.teal,
  },
  disconnectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.35)',
  },
  captivePortalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: alpha(colors.primary, 0.12),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.22),
  },
  captivePortalAction: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: appleColors.blue,
  },
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
    borderRadius: 18,
    backgroundColor: 'rgba(18, 26, 40, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  specularTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
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
    backgroundColor: alpha(colors.primary, 0.16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    backgroundColor: alpha(colors.primary, 0.12),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.28),
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
    height: 42,
  },
  wifiRowSelected: {
    backgroundColor: alpha(colors.primary, 0.16),
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
}));
