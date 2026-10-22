// Đăng nhập bằng đúng tài khoản Supabase của web và jetson-phone. Bố cục ngang:
// giới thiệu bên trái, thẻ đăng nhập bên phải.

import * as Haptics from 'expo-haptics';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { supabaseConfigured } from '@/lib/config';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { createClient } from '@/lib/supabase';
import { fonts, glassShadow, glassShadowSubtle, makeStyles, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { LiquidAmbientAurora } from '@/ui/LiquidGlass';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const LOGO = require('../../../assets/icon.png');

export default function LoginScreen() {
  const { glass, colors } = useTheme();
  const styles = useStyles();
  const { s, insets, width } = useUi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const compact = width < 700;

  const signIn = async () => {
    if (busy) return;
    const supabase = createClient();
    if (!supabase) { setError('Chưa thể kết nối dịch vụ đăng nhập.'); return; }
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu để tiếp tục.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    playUiSound('confirm');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const field = [styles.input, { height: s(46), borderRadius: s(14), paddingHorizontal: s(16), fontSize: s(13.6) }];

  return (
    <LinearGradient colors={['#10101a', '#090810', '#08070d']} locations={[0, 0.5, 1]} style={styles.root}>
      <LiquidAmbientAurora />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(48),
            paddingHorizontal: s(40) + insets.left, paddingVertical: s(24),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!compact ? (
            <View style={{ flex: 1, maxWidth: s(420) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(14) }}>
                <View style={{ width: s(52), height: s(52), borderRadius: s(26), borderWidth: 1, borderColor: glass.borderSpecular, overflow: 'hidden', ...glassShadowSubtle }}>
                  <Img source={LOGO} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
                </View>
                <View>
                  <T size={15} weight="bold" color={colors.accentSoft} tracking={0.14}>JETSONA</T>
                  <T size={11} color={colors.text3}>Game Console</T>
                </View>
              </View>
              <T size={30} weight="bold" tracking={-0.03} leading={1.12} style={{ marginTop: s(24) }}>Chơi game trên PC,{'\n'}ngay trong tay bạn.</T>
              <T size={13} color={colors.text3} leading={1.6} style={{ marginTop: s(12) }}>
                Kết nối máy tính ở nhà, dùng tay cầm Bluetooth hoặc cảm ứng, vào thẳng game.
              </T>
            </View>
          ) : null}

          <View style={[styles.card, { width: Math.min(s(380), width - s(48)), borderRadius: s(28), padding: s(26) }]}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 2 }}
            />
            {!supabaseConfigured ? (
              <View>
                <T size={18} weight="bold">Chưa thể kết nối</T>
                <T size={12} color={colors.text3} leading={1.6} style={{ marginTop: s(8) }}>Ứng dụng đang thiếu cấu hình đăng nhập Supabase.</T>
              </View>
            ) : (
              <>
                <T size={22} weight="bold" tracking={-0.02}>Đăng nhập</T>
                <T size={12} color={colors.text3} style={{ marginTop: s(4) }}>Tiếp tục vào console cá nhân của bạn.</T>
                <View style={{ marginTop: s(20), gap: s(12) }}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.38)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    selectionColor={colors.accent}
                    style={field}
                  />
                  <View style={styles.passwordField}>
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Mật khẩu"
                      placeholderTextColor="rgba(255,255,255,0.38)"
                      secureTextEntry={!passwordVisible}
                      autoCapitalize="none"
                      autoComplete="current-password"
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={() => void signIn()}
                      selectionColor={colors.accent}
                      style={[field, { paddingRight: s(48) }]}
                    />
                    <Press
                      accessibilityRole="button"
                      accessibilityLabel={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      accessibilityHint="Thay đổi cách hiển thị nội dung ô mật khẩu"
                      onPress={() => setPasswordVisible((visible) => !visible)}
                      pressScale={0.9}
                      focusRadius={s(10)}
                      style={[styles.passwordToggle, { width: s(46), height: s(46), borderRadius: s(12) }]}
                    >
                      {passwordVisible ? (
                        <EyeOff size={s(18)} color={colors.text3} strokeWidth={1.8} />
                      ) : (
                        <Eye size={s(18)} color={colors.text3} strokeWidth={1.8} />
                      )}
                    </Press>
                  </View>
                </View>
                {error ? <T size={11.2} color="#fecaca" leading={1.5} style={{ marginTop: s(10) }}>{error}</T> : null}
                <Press onPress={() => void signIn()} disabled={busy} style={[styles.submit, { marginTop: s(18), height: s(46), borderRadius: s(23), overflow: 'visible' }]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.05)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[StyleSheet.absoluteFill, { height: '55%', borderTopLeftRadius: s(23), borderTopRightRadius: s(23) }]}
                    pointerEvents="none"
                  />
                  {busy ? <ActivityIndicator color="#0a111c" /> : <T size={13.4} weight="bold" color="#0a111c">Đăng nhập</T>}
                </Press>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const useStyles = makeStyles(({ colors, glass }) => ({
  root: { flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: glass.borderSpecular,
    backgroundColor: glass.modal,
    overflow: 'hidden',
    ...glassShadow,
  },
  input: {
    fontFamily: fonts.medium,
    color: colors.white,
    borderWidth: 1,
    borderColor: glass.borderSpecular,
    backgroundColor: glass.surfaceUltraThin,
  },
  passwordField: { position: 'relative' },
  passwordToggle: { position: 'absolute', right: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    ...glassShadowSubtle,
  },
}));
