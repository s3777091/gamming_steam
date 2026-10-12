import { View } from 'react-native';

const RING = 3;

/**
 * Viền tiêu điểm của tay cầm: trắng, bo theo phần tử, phát sáng nhẹ. Đặt làm
 * con CUỐI của phần tử được chọn; nó tràn ra ngoài RING px nên không đổi bố cục.
 */
export function FocusRing({ radius }: { radius: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -RING - 1, left: -RING - 1, right: -RING - 1, bottom: -RING - 1,
        borderRadius: radius + RING + 1,
        borderWidth: RING,
        borderColor: '#ffffff',
        backgroundColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#ffffff',
        shadowOpacity: 0.55,
        shadowRadius: 10,
        elevation: 8,
      }}
    />
  );
}
