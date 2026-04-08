import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Alert
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDocuments } from '../hooks/useDocuments';

// 👇 THE ONLY NEW IMPORT: Pulling in your new modal
import { ManualUploadModal } from '../components/ManualUploadModal'; 

const MAIN_MENU = [
  { key: 'Dashboard', label: 'Home',  icon: 'home' },
  { key: 'Stats',     label: 'Stats', icon: 'bar-chart-2' },
  { key: 'Logs',      label: 'Logs',  icon: 'file-text' },
  // 👇 THE NEW BUTTON: Added right above Trash
  { key: 'Upload',    label: 'Add Document', icon: 'upload-cloud' }, 
  { key: 'Trash',     label: 'Trash', icon: 'trash-2' }, 
];

const DrawerContent: React.FC<DrawerContentComponentProps> = ({ navigation, state }) => {
  const activeRoute = state.routeNames[state.index];
  
  // 👇 THE NEW STATE: Controls whether the popup is open or closed
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  const go = (screen: string) => {
    navigation.closeDrawer();
    navigation.navigate(screen as never);
  };

  // ─── LOGOUT HANDLER ───
  const { switchUser } = useDocuments();
  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to securely log out of your workspace?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('userId');
              await switchUser(null);
              navigation.closeDrawer();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error("Error clearing AsyncStorage:", error);
            }
          } 
        }
      ]
    );
  };

  // ─── MENU ITEM COMPONENT ───
  const Item = ({ itemKey, label, icon }: { itemKey: string; label: string; icon: any }) => {
    const active = activeRoute === itemKey;
    
    // Check if this is our special upload button
    const isUpload = itemKey === 'Upload';

    return (
      <TouchableOpacity
        style={[
          s.item, 
          active && s.itemActive,
          // Give the Upload button a special green tint and push Trash down a bit
          isUpload && { backgroundColor: 'rgba(74, 222, 128, 0.1)', marginBottom: 16 }
        ]}
        // 👇 THE MAGIC CLICK HANDLER
        onPress={() => {
          if (isUpload) {
            // If they clicked Add Document, close the sidebar and open the popup!
            navigation.closeDrawer();
            setUploadModalVisible(true);
          } else {
            // Otherwise, navigate normally
            go(itemKey);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[s.iconWrap, active && s.iconWrapActive, isUpload && { backgroundColor: 'transparent' }]}>
          <Feather 
            name={icon} 
            size={20} 
            color={active ? '#F5D1B0' : (isUpload ? '#4ADE80' : 'rgba(255,255,255,0.5)')} 
          />
        </View>
        <Text style={[s.itemLabel, active && s.itemLabelActive, isUpload && { color: '#4ADE80', fontWeight: '800' }]}>
          {label}
        </Text>
        {active && !isUpload && <View style={s.activeBar} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>

      {/* ── App brand header ── */}
      <View style={s.header}>
        <View style={s.tagShapeContainer}>
          <View style={s.tagTip} />
          <View style={s.tagHole} />
          <View style={s.tagBody} />
        </View>
        <Text style={s.brandName}>
          TagAnd<Text style={{ color: '#F5D1B0' }}>Trail</Text>
        </Text>
        <Text style={s.brandSub}>AI Document Intelligence</Text>
        <View style={s.accentBar} />
      </View>

      <View style={s.divider} />

      {/* ── Menu ── */}
      <ScrollView style={s.menu} showsVerticalScrollIndicator={false}>
        {MAIN_MENU.map(m => (
          <Item key={m.key} itemKey={m.key} label={m.label} icon={m.icon} />
        ))}
      </ScrollView>

      {/* ── Log Out Button ── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <TouchableOpacity style={s.item} onPress={handleLogout} activeOpacity={0.7}>
          <View style={s.iconWrap}>
            <Feather name="log-out" size={20} color="#FF8484" />
          </View>
          <Text style={[s.itemLabel, { color: '#FF8484', fontWeight: '800' }]}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── App version footer ── */}
      <View style={s.footer}>
        <View style={s.divider} />
        <Text style={s.footerText}>TagAndTrail v1.0.0 · SDK 54</Text>
      </View>

      {/* 👇 THE POPUP MODAL HIDDEN AT THE BOTTOM */}
      <ManualUploadModal 
        visible={uploadModalVisible} 
        onClose={() => setUploadModalVisible(false)} 
      />

    </View>
  );
};

export default DrawerContent;

// ... (KEEP ALL YOUR EXACT SAME STYLES DOWN HERE, I DID NOT TOUCH THEM) ...
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2D464C', // Forest Green background
    paddingTop: Platform.OS === 'android' ? 40 : 54,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 25,
  },
  tagShapeContainer: { 
    width: 60, 
    height: 34, 
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
    marginTop: 10,
  },
  tagBody: {
    position: 'absolute',
    right: 0,
    width: 42,
    height: 34,
    backgroundColor: '#F5D1B0', // Light Peach
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  tagTip: {
    position: 'absolute',
    left: 17 - 12, // Centered math
    top: 17 - 12,
    width: 24, 
    height: 24, 
    backgroundColor: '#F5D1B0',
    transform: [{ rotate: '45deg' }], 
    borderRadius: 3, 
  },
  tagHole: {
    position: 'absolute',
    left: 8, 
    top: 17 - 4, 
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2D464C', // Matches header background
    zIndex: 10, 
  },
  brandName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  brandSub:  { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '600' },
  accentBar: { width: 32, height: 4, backgroundColor: '#F5D1B0', borderRadius: 2, marginTop: 12 },
  divider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  menu:       { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  item:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, marginBottom: 6, position: 'relative' },
  itemActive:     { backgroundColor: 'rgba(245, 209, 176, 0.1)' }, // Soft peach highlight
  iconWrap:       { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  iconWrapActive: { backgroundColor: 'transparent' },
  itemLabel:      { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.7)', flex: 1 },
  itemLabelActive:{ color: '#F5D1B0', fontWeight: '800' },
  activeBar:      { width: 4, height: 24, backgroundColor: '#F5D1B0', borderRadius: 2, position: 'absolute', right: 0 },
  footer:      { paddingBottom: 24 },
  footerText:  { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', paddingVertical: 16, fontWeight: '600', letterSpacing: 0.5 },
});