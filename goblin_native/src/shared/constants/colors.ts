/**
 * シックなモノトーンカラーパレット
 * 白黒灰色系のカラーコードを定義
 */

// Tailwind CSSクラス名として使用
export const colors = {
  // 背景色
  bg: {
    primary: 'bg-gray-900',      // メイン背景（ダーク）
    secondary: 'bg-gray-800',    // セカンダリ背景
    tertiary: 'bg-gray-700',     // 第三背景
    surface: 'bg-gray-100',      // サーフェス（ライト）
    surfaceAlt: 'bg-gray-200',   // サーフェス代替
    white: 'bg-white',           // 白背景
    overlay: 'bg-black/50',      // オーバーレイ
  },

  // テキスト色
  text: {
    primary: 'text-gray-900',    // メインテキスト
    secondary: 'text-gray-700',  // セカンダリテキスト
    tertiary: 'text-gray-500',   // 第三テキスト
    muted: 'text-gray-400',      // 淡いテキスト
    inverse: 'text-white',       // 反転テキスト
    dark: 'text-gray-800',       // ダークテキスト
  },

  // ボーダー色
  border: {
    primary: 'border-gray-300',   // メインボーダー
    secondary: 'border-gray-400', // セカンダリボーダー
    dark: 'border-gray-600',      // ダークボーダー
    light: 'border-gray-200',     // ライトボーダー
  },

  // ボタン・インタラクティブ要素
  button: {
    primary: 'bg-gray-800 hover:bg-gray-900 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    outline: 'bg-white border-2 border-gray-400 hover:border-gray-600 text-gray-700',
    disabled: 'bg-gray-300 text-gray-500 cursor-not-allowed',
    danger: 'bg-gray-700 hover:bg-gray-800 text-white',
  },

  // 状態色（すべてグレースケール）
  status: {
    success: 'text-gray-700',     // 成功（濃いグレー）
    warning: 'text-gray-600',     // 警告
    error: 'text-gray-800',       // エラー（最も濃い）
    info: 'text-gray-500',        // 情報
  },

  // プログレスバー
  progress: {
    bg: 'bg-gray-300',
    fill: 'bg-gray-700',
    fillLow: 'bg-gray-500',
    fillMid: 'bg-gray-600',
  },

  // 選択状態
  selected: {
    bg: 'bg-gray-200',
    border: 'border-gray-600',
    text: 'text-gray-900',
  },

  // ホバー
  hover: {
    bg: 'hover:bg-gray-100',
    border: 'hover:border-gray-500',
    text: 'hover:text-gray-900',
  },

  // アクセント（強調用、グレースケールの中で目立つ色）
  accent: {
    bg: 'bg-gray-700',
    text: 'text-gray-100',
    border: 'border-gray-700',
  },

  // バッジ・タグ
  badge: {
    default: 'bg-gray-200 text-gray-700',
    active: 'bg-gray-700 text-white',
    inactive: 'bg-gray-100 text-gray-500',
  },
} as const;

// 生のカラーコード（必要に応じて使用）
export const rawColors = {
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
} as const;

// React Native用カラー定義
export const rnColors = {
  // Gray scale
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Primary (Blue)
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',

  // Secondary (Green)
  secondary: '#10B981',
  secondaryLight: '#34D399',
  secondaryDark: '#059669',

  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Background colors
  background: '#F9FAFB',
  cardBackground: '#FFFFFF',
  darkBackground: '#1F2937',

  // Text colors
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Border colors
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Special colors
  goblin: '#10B981',
  gold: '#F59E0B',
  experience: '#8B5CF6',
} as const;
