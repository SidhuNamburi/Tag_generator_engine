import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fetchLogs } from '../api'; 
// 1. Import useDocuments so the Trash screen can access the brain!
import { useStats, useDocuments } from '../hooks/useDocuments';

// ─── Stats Screen ──────────────────────────────────────────────────────────────
export const StatsScreen: React.FC<any> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { stats } = useStats();

  const rows = [
    { label: 'Total Documents', value: stats?.total_docs,       icon: 'database',       color: '#FFFFFF' },
    { label: 'Safe Documents',  value: stats?.safe_docs,        icon: 'shield',         color: '#4ADE80' },
    { label: 'Total Links',     value: stats?.total_links,      icon: 'link',           color: '#F5D1B0' },
    { label: 'Total PDFs',      value: stats?.total_pdfs,       icon: 'file-text',      color: '#FF8484' },
    { label: 'Private',         value: stats?.private_count,    icon: 'lock',           color: '#FFFFFF' },
    { label: 'Public',          value: stats?.public_count,     icon: 'globe',          color: '#FFFFFF' },
    { label: 'Restricted',      value: stats?.restricted_count, icon: 'alert-triangle', color: '#F5D1B0' },
    { label: 'Trash',           value: stats?.trash_count,      icon: 'trash-2',        color: 'rgba(255,255,255,0.5)' },
  ];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity style={s.menuBtn} onPress={() => navigation.openDrawer()}>
          <Feather name="menu" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Platform Stats</Text>
      </View>
      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {rows.map((r, idx) => (
            <View key={idx} style={s.statCard}>
              <View style={[s.statIconWrap, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Feather name={r.icon as keyof typeof Feather.glyphMap} size={24} color={r.color} />
              </View>
              <Text style={s.statVal}>{r.value ?? '0'}</Text>
              <Text style={s.statLbl}>{r.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Logs Screen ──────────────────────────────────────────────────────────────
const STATUS_UI: Record<string, { color: string; icon: keyof typeof Feather.glyphMap }> = {
  success: { color: '#4ADE80', icon: 'check-circle' },
  warning: { color: '#F5D1B0', icon: 'alert-circle' },
  error:   { color: '#FF8484', icon: 'x-circle' },
  info:    { color: '#FFFFFF', icon: 'info' },
};

export const LogsScreen: React.FC<any> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  // 👇 MAGIC: Pull the live socket logs straight from the Brain!
  const { logs } = useDocuments(); 

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity style={s.menuBtn} onPress={() => navigation.openDrawer()}>
          <Feather name="menu" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>System Logs</Text>
      </View>
      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
        {logs.length === 0 ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
             <Feather name="radio" size={32} color="rgba(255,255,255,0.3)" style={{marginBottom: 10}}/>
             <Text style={{color: 'rgba(255,255,255,0.5)', fontWeight: '600'}}>Listening for AI updates...</Text>
          </View>
        ) : (
          logs.map((log: any) => {
            const ui = STATUS_UI[log.status] || STATUS_UI.info;
            return (
              <View key={log.id} style={s.logCard}>
                <View style={[s.logDot, { backgroundColor: ui.color }]} />
                <View style={s.logBody}>
                  <Text style={s.logMsg}>{log.message}</Text>
                  <Text style={s.logTime}>{log.timestamp}</Text>
                </View>
                <Feather name={ui.icon} size={20} color={ui.color} />
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

// ─── Trash Screen ─────────────────────────────────────────────────────────────
export const TrashScreen: React.FC<any> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  // 3. Pull live data and functions from the Brain!
  const { docs, restoreFromTrash, deletePermanently, emptyTrash } = useDocuments();
  const trashData = docs.Trash;

  // 4. Connect the action handlers
  // 👇 FIX: Added ": any" to item
  const handleRestore = (item: any) => {
    restoreFromTrash(item);
  };

  // 👇 FIX: Added ": string" to id
  const handleDelete = (id: string) => {
    Alert.alert("Permanent Delete", "This document will be permanently destroyed. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deletePermanently(id) }
    ]);
  };

  const handleEmptyTrash = () => {
    Alert.alert("Empty Trash", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Empty", style: "destructive", onPress: () => {
          emptyTrash(); // <-- Just one clean line! No more looping!
      }}
    ]);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with Empty Trash Button */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity style={s.menuBtn} onPress={() => navigation.openDrawer()}>
            <Feather name="menu" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Trash</Text>
        </View>
        
        {trashData.length > 0 && (
          <TouchableOpacity onPress={handleEmptyTrash}>
            <Text style={s.emptyTrashText}>Empty</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
        {trashData.length === 0 ? (
          <View style={s.emptyState}>
            <Feather name="trash" size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
            <Text style={s.emptyStateTitle}>Trash is Empty</Text>
            <Text style={s.emptyStateSub}>No documents have been deleted recently.</Text>
          </View>
        ) : (
          trashData.map((item: any) => ( // 👇 FIX: Added ": any" to item
            <View key={item._id} style={s.trashCard}>
              <View style={s.trashIconWrap}>
                <Feather name={item.type === 'pdf' ? 'file-text' : 'link'} size={20} color="#2D464C" />
              </View>
              <View style={s.trashBody}>
                {/* Fallback removed, mapping strictly to title */}
                <Text style={s.trashName} numberOfLines={1}>{item.title}</Text>
                {/* Fallback added for deletedAt */}
                <Text style={s.trashTime}>{item.deletedAt || 'Recently deleted'}</Text>
              </View>
              
              {/* Action Buttons */}
              <View style={s.trashActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => handleRestore(item)}>
                  <Feather name="refresh-ccw" size={18} color="#4ADE80" />
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { marginLeft: 8 }]} onPress={() => handleDelete(item._id)}>
                  <Feather name="x" size={20} color="#FF8484" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

// ─── Shared Styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D464C' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 25 },
  menuBtn: { padding: 8, marginLeft: -8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 24, paddingBottom: 40 },

  // Stats Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  statCard: { width: '47%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center', marginBottom: 2 },
  statIconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statVal: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  statLbl: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Logs List
  logCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 14 },
  logDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  logBody: { flex: 1 },
  logMsg: { fontSize: 14, color: '#FFFFFF', fontWeight: '700', letterSpacing: -0.2 },
  logTime: { fontSize: 11, color: '#F5D1B0', fontWeight: '600', marginTop: 4, letterSpacing: 0.5 },

  // Trash Screen Styles
  emptyTrashText: { color: '#FF8484', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  trashCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  trashIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  trashBody: { flex: 1, paddingRight: 10 },
  trashName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  trashTime: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  trashActions: { flexDirection: 'row' },
  actionBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyStateTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  emptyStateSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }
});