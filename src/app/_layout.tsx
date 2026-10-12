import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts,
} from '@expo-google-fonts/inter';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setImmersive } from 'jetsona-input';

import { AuthProvider, useAuth } from '@/features/auth';
import { deactivateFocus } from '@/features/gamepad/focus';
import GamepadNavigator from '@/features/gamepad/GamepadNavigator';
import { useHardwareBack } from '@/features/gamepad/hooks';
import LoginScreen from '@/features/login/LoginScreen';
import { colors } from '@/theme';
import { UiProvider } from '@/ui/scale';
import { T } from '@/ui/Text';

void SplashScreen.preventAutoHideAsync();

function Gate() {
  const auth = useAuth();
  const pathname = usePathname();
  useHardwareBack();

  useEffect(() => {
    if (auth.status !== 'loading') void SplashScreen.hideAsync();
  }, [auth.status]);

  if (auth.status === 'loading') return <View style={styles.fill} />;
  if (auth.status === 'config-error') {
    return (
      <View style={[styles.fill, styles.center]}>
        <T size={16} weight="bold" color={colors.accentSoft} tracking={0.12}>Jetsona</T>
        <T size={24} weight="bold" style={{ marginTop: 16 }}>Chưa thể kết nối</T>
        <T size={14} color={colors.text3} leading={1.5} style={{ marginTop: 10, maxWidth: 360, textAlign: 'center' }}>
          Ứng dụng đang thiếu cấu hình đăng nhập. Hãy kiểm tra cấu hình Supabase rồi mở lại app.
        </T>
      </View>
    );
  }
  if (auth.status === 'signed-out') return <LoginScreen />;

  return (
    // Chạm màn hình thì ẩn viền tiêu điểm của tay cầm; D-pad bấm lại sẽ hiện lên.
    <View style={styles.fill} onTouchStart={deactivateFocus}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }} />
      {/* Điều hướng tay cầm chỉ có ngoài màn stream; trong stream tay cầm thuộc về PC. */}
      <GamepadNavigator enabled={pathname !== '/stream'} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    // Máy luôn nằm ngang, ẩn thanh hệ thống: giống một console, không phải một app.
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    setImmersive(true);
  }, []);

  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <UiProvider>
        <AuthProvider>
          <StatusBar hidden />
          <Gate />
        </AuthProvider>
      </UiProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
});
