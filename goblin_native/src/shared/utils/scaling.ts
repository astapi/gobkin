import { scale, verticalScale, moderateScale } from 'react-native-size-matters'

// Shorthand aliases
export const s = scale
export const vs = verticalScale
export const ms = moderateScale

// Font size (with reduced scaling factor)
export const fs = (size: number) => moderateScale(size, 0.3)

// Spacing definitions
export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(24),
  xxl: scale(32),
}

// Font size definitions
export const fontSize = {
  xs: fs(12),
  sm: fs(14),
  md: fs(16),
  lg: fs(18),
  xl: fs(20),
  xxl: fs(24),
  title: fs(28),
}

// Icon size definitions
export const iconSize = {
  sm: moderateScale(16),
  md: moderateScale(24),
  lg: moderateScale(32),
  xl: moderateScale(48),
}

// Re-export for convenience
export { scale, verticalScale, moderateScale }
