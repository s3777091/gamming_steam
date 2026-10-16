// Token không đổi theo theme: bóng đổ, font và khung thiết kế.

export const glassShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.42,
  shadowRadius: 16,
  elevation: 8,
} as const;

export const glassShadowSubtle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 4,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Kích thước thiết kế gốc: iPhone 14 Pro Max nằm ngang. Mọi số dp trong UI tính ở khung này. */
export const DESIGN = { width: 932, height: 430 } as const;
