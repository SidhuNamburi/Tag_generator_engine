import { ViewStyle } from 'react-native';

export const COLORS = {
  background:          '#FFFFFF',
  backgroundSecondary: '#F8F9FB',
  backgroundTertiary:  '#F1F4F8',
  card:                '#FFFFFF',
  cardBorder:          '#EAECF0',

  orange:      '#F97316',
  orangeLight: '#FED7AA',
  orangePale:  '#FFF7ED',
  orangeDark:  '#EA6C0A',

  blue:        '#3B82F6',
  bluePale:    '#EFF6FF',
  green:       '#22C55E',
  greenPale:   '#F0FDF4',
  red:         '#EF4444',
  redPale:     '#FEF2F2',
  purple:      '#A78BFA',
  purplePale:  '#F5F3FF',
  yellow:      '#FBBF24',
  yellowPale:  '#FFFBEB',

  textPrimary:   '#111827',
  textSecondary: '#6B7280',
  textTertiary:  '#9CA3AF',
  textInverse:   '#FFFFFF',

  navy:  '#0B1829',
  navy2: '#112240',

  border:      '#E5E7EB',
  borderLight: '#F3F4F6',
  overlay:     'rgba(0,0,0,0.45)',
} as const;

export const FONTS = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
};

export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 999,
};

export const SHADOW: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },
};
