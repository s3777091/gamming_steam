// Lớp trang trí của theme: không khí (ánh sáng, sương) + hạt trôi. Đặt trong NỀN của
// các màn lớn — sau nội dung, trên ảnh nền — để không bao giờ đè lên control.
// Tắt khi người dùng tắt trong Cài đặt, đứng yên khi app chạy nền, bỏ hạt khi máy bật
// giảm chuyển động. Màn stream không gắn lớp này.

import { StyleSheet, View } from 'react-native';

import { useMotion } from '@/ui/motion';

import { useDecorEnabled, useTheme } from '../ThemeProvider';
import { ThemeAmbience } from './ambience';
import { ThemeParticles } from './particles';

export function ThemeDecor() {
  const theme = useTheme();
  const enabled = useDecorEnabled();
  const { active, reduceMotion } = useMotion();
  const { particles, ambience } = theme.decor;
  if (!enabled || (!particles && !ambience)) return null;

  const running = active && !reduceMotion;
  return (
    <View key={theme.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ambience ? <ThemeAmbience kind={ambience} running={running} /> : null}
      {particles && !reduceMotion ? <ThemeParticles kind={particles} running={running} /> : null}
    </View>
  );
}
