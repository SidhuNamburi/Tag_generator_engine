import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, ViewStyle, Platform,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SHADOW } from '../constants/theme';
import { SafetyStatus } from '../types';

// ─── SafeBadge ────────────────────────────────────────────────────────────────
export const SafeBadge: React.FC<{ status?: SafetyStatus | string }> = ({ status }) => {
  const isSafe = status === 'SAFE' || status === 'safe';
  return (
    <View style={[s.badge, isSafe ? s.badgeSafe : s.badgeWarn]}>
      <Text style={[s.badgeText, isSafe ? s.badgeTextSafe : s.badgeTextWarn]}>
        {isSafe ? 'SAFE' : 'FLAGGED'}
      </Text>
    </View>
  );
};

// ─── TagPill ──────────────────────────────────────────────────────────────────
type TagVariant = 'orange' | 'blue' | 'green' | 'gray';

export const TagPill: React.FC<{ label: string; variant?: TagVariant }> = ({ label, variant = 'orange' }) => {
  const map: Record<TagVariant, { bg: string; text: string }> = {
    orange: { bg: '#FFF7ED', text: '#EA580C' },
    blue:   { bg: '#EFF6FF', text: '#2563EB' },
    green:  { bg: '#F0FDF4', text: '#16A34A' },
    gray:   { bg: '#F3F4F6', text: '#4B5563' },
  };
  const v = map[variant];
  return (
    <View style={[s.tagPill, { backgroundColor: v.bg }]}>
      <Text style={[s.tagText, { color: v.text }]}>{label}</Text>
    </View>
  );
};

// ─── SectionHeader ────────────────────────────────────────────────────────────
export const SectionHeader: React.FC<{
  title: string; count?: number; dotColor?: string;
  action?: string; onAction?: () => void;
}> = ({ title, count, dotColor, action, onAction }) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionLeft}>
      {dotColor && <View style={[s.sectionDot, { backgroundColor: dotColor }]} />}
      <Text style={s.sectionTitle}>{title}</Text>
      {count !== undefined && <Text style={s.sectionCount}>{count}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.6}>
        <Text style={s.sectionAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── SearchBar ────────────────────────────────────────────────────────────────
export const SearchBar: React.FC<{
  value: string; onChangeText: (t: string) => void; placeholder?: string;
}> = ({ value, onChangeText, placeholder = 'Search documents…' }) => (
  <View style={s.searchWrap}>
    <View style={s.searchBox}>
      <Text style={s.searchIconText}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={s.searchInput}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  </View>
);

// ─── SegmentTabs ──────────────────────────────────────────────────────────────
export const SegmentTabs: React.FC<{
  tabs: string[]; active: string; onChange: (t: string) => void;
}> = ({ tabs, active, onChange }) => (
  <View style={s.segWrap}>
    {tabs.map(tab => (
      <TouchableOpacity
        key={tab}
        style={[s.segTab, active === tab && s.segTabActive]}
        onPress={() => onChange(tab)}
        activeOpacity={0.8}
      >
        <Text style={[s.segLabel, active === tab && s.segLabelActive]}>{tab}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ─── TopBar ───────────────────────────────────────────────────────────────────
export const TopBar: React.FC<{
  title: string;
  onMenuPress: () => void;
  onSearchPress?: () => void;
  style?: ViewStyle;
}> = ({ title, onMenuPress, onSearchPress, style }) => (
  <View style={[s.topBar, style]}>
    {/* Hamburger — Updated to dark, sleek lines */}
    <TouchableOpacity
      onPress={onMenuPress}
      style={s.hamBtn}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      activeOpacity={0.6}
    >
      <View style={s.hamLine} />
      <View style={[s.hamLine, { width: 14 }]} />
      <View style={[s.hamLine, { width: 18 }]} />
    </TouchableOpacity>

    <Text style={s.topTitle}>{title}</Text>

    {/* Search Icon — Soft gray background instead of translucent white */}
    <TouchableOpacity
      style={s.iconBtn}
      onPress={onSearchPress}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      activeOpacity={0.6}
    >
      <Text style={{ fontSize: 16 }}>🔍</Text>
    </TouchableOpacity>
  </View>
);

// ─── LoadingState ─────────────────────────────────────────────────────────────
export const LoadingState: React.FC = () => (
  <View style={s.centeredState}>
    <ActivityIndicator color="#F97316" size="large" />
  </View>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────
export const EmptyState: React.FC<{ message?: string }> = ({ message = 'No documents found' }) => (
  <View style={s.centeredState}>
    <Text style={s.emptyIcon}>📭</Text>
    <Text style={s.emptyText}>{message}</Text>
  </View>
);

// ─── PDFIcon ──────────────────────────────────────────────────────────────────
export const PDFIcon: React.FC = () => (
  <View style={s.pdfIcon}><Text style={s.pdfIconText}>PDF</Text></View>
);

// ─── LinkIcon ─────────────────────────────────────────────────────────────────
export const LinkIcon: React.FC = () => (
  <View style={s.linkIcon}><Text style={{ fontSize: 18 }}>🔗</Text></View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Badge
  badge:          { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeSafe:      { backgroundColor: '#D1FAE5' },
  badgeWarn:      { backgroundColor: '#FEF3C7' },
  badgeText:      { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  badgeTextSafe:  { color: '#065F46' },
  badgeTextWarn:  { color: '#92400E' },

  // Tag
  tagPill:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, marginRight: 6, marginTop: 6 },
  tagText:        { fontSize: 11, fontWeight: '600' },

  // Section header
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot:     { width: 8, height: 8, borderRadius: 4 },
  sectionTitle:   { fontSize: 20, fontWeight: '800', color: '#111827' },
  sectionCount:   { fontSize: 13, color: '#9CA3AF', marginLeft: 4, fontWeight: '500' },
  sectionAction:  { fontSize: 14, color: '#F97316', fontWeight: '600' },

  // Search - Taller, softer border, lighter background
  searchWrap:     { paddingHorizontal: 24, paddingVertical: 12 },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#F3F4F6', gap: 10 },
  searchIconText: { fontSize: 16 },
  searchInput:    { flex: 1, fontSize: 15, color: '#111827', padding: 0, fontWeight: '500' },

  // Segment tabs - Looks like an iOS system toggle now
  segWrap:        { flexDirection: 'row', marginHorizontal: 24, marginTop: 6, marginBottom: 12, backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4 },
  segTab:         { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segTabActive:   { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  segLabel:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  segLabelActive: { color: '#111827', fontWeight: '700' },

  // TopBar - Navy is gone. Pure white, matching horizontal padding of dashboard
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 48 : 54,
    paddingBottom: 16,
  },
  hamBtn:  { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start', gap: 5 },
  hamLine: { width: 22, height: 2.5, backgroundColor: '#111827', borderRadius: 2 }, // Dark lines now
  topTitle:{ fontSize: 18, fontWeight: '800', color: '#111827' }, // Dark text now
  iconBtn: { width: 44, height: 44, backgroundColor: '#F3F4F6', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  // States
  centeredState:  { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
  emptyIcon:      { fontSize: 48, marginBottom: 16 },
  emptyText:      { fontSize: 15, color: '#6B7280', fontWeight: '500' },

  // Icons
  pdfIcon:        { width: 44, height: 44, backgroundColor: '#FEE2E2', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pdfIconText:    { fontSize: 10, fontWeight: '800', color: '#DC2626' },
  linkIcon:       { width: 44, height: 44, backgroundColor: '#EFF6FF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});