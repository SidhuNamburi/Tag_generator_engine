import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Linking, Share, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
// 1. Import the Brain!
import { useDocuments } from '../hooks/useDocuments';

const fmt = (d) => {
  try {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diff < 60)        return 'Just now';
    if (diff < 3600)      return `${Math.floor(diff/60)} min ago`;
    if (diff < 86400)     return `${Math.floor(diff/3600)} hr ago`;
    return `${Math.floor(diff/86400)} days ago`;
  } catch { return d || 'Unknown date'; }
};

// ─── Shared Action Modal ──────────────────────────────────────────────────────
const ActionModal = ({ visible, onClose, item, type, onDelete }) => {
  if (!item) return null;

  const docTitle = item.title || 'Document';
  const docUrl = item.contentUrl || 'https://google.com'; // Mapped to MongoDB

  // 👇 THE MAGIC HAPPENS HERE: Updated to use In-App Browser & Google Viewer
  const handleOpen = async () => {
    try {
      let finalUrl = docUrl;
      const isFile = docUrl.toLowerCase().match(/\.(pdf|docx|doc|pptx|ppt|xlsx|xls)$/);
      const isWebLink = docUrl.startsWith('http') && !isFile;

      if (isFile) {
        // Wrap files in Google Viewer to prevent downloading
        finalUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(docUrl)}&embedded=true`;
      } else if (isWebLink) {
        // Regular links open as normal
        finalUrl = docUrl;
      }

      await WebBrowser.openBrowserAsync(finalUrl, {
        toolbarColor: '#2D464C',
        enableBarCollapsing: true,
        showTitle: true,
      });
    } catch (e) { 
      Alert.alert("Error", "Could not open this link."); 
    }
    onClose();
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out this document: ${docTitle}\n${docUrl}`, title: docTitle });
    } catch (error) { console.log("Error sharing", error); }
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Document",
      `Are you sure you want to move "${docTitle}" to trash?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Trash", style: "destructive", onPress: () => {
            if (onDelete) onDelete(item);
            onClose();
        }}
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modalContent}>
          <View style={s.modalDrag} />
          <View style={s.modalHeader}>
            <View style={s.modalIconWrap}>
              <Feather name={type === 'pdf' ? 'file-text' : 'link'} size={24} color="#2D464C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle} numberOfLines={1}>{docTitle}</Text>
              <Text style={s.modalSub}>{type === 'pdf' ? 'PDF Document' : 'Web Link'}</Text>
            </View>
          </View>
          <View style={s.actionGrid}>
            <TouchableOpacity style={s.actionBtn} onPress={handleOpen}>
              <Feather name="external-link" size={22} color="#FFFFFF" />
              <Text style={s.actionTxt}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
              <Feather name="share-2" size={22} color="#FFFFFF" />
              <Text style={s.actionTxt}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: 'rgba(255, 132, 132, 0.1)' }]} onPress={handleDelete}>
              <Feather name="trash-2" size={22} color="#FF8484" />
              <Text style={[s.actionTxt, { color: '#FF8484' }]}>Trash</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ─── LinkItem ─────────────────────────────────────────────────────────────────
export const LinkItem = ({ item }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { deleteToTrash } = useDocuments();
  const tags = item.tags || [];
  
  // Dynamic Security Logic mapped to MongoDB
  const isFlagged = item.security_status === 'flagged';
  const pillColor = isFlagged ? '#FF8484' : '#4ADE80';
  
  return (
    <>
      <TouchableOpacity style={s.card} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
        <View style={s.row}>
          <View style={s.iconWrap}><Feather name="link" size={20} color="#2D464C" /></View>
          <View style={s.body}>
            <Text style={s.title} numberOfLines={1}>{item.title}</Text>
            <Text style={s.url}   numberOfLines={1}>{item.contentUrl}</Text>
          </View>
        </View>
        <View style={s.tagsRow}>
          {tags.slice(0, 3).map((t, i) => <View key={i} style={s.tagPill}><Text style={s.tagText}>{t}</Text></View>)}
          <View style={{ flex: 1 }} />
          <View style={[s.safePill, { borderColor: `rgba(${isFlagged ? '255, 132, 132' : '74, 222, 128'}, 0.5)` }]}>
            <Text style={[s.safeTxt, { color: pillColor }]}>{isFlagged ? 'FLAGGED' : 'SAFE'}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <ActionModal visible={modalVisible} onClose={() => setModalVisible(false)} item={item} type="link" onDelete={(doc) => deleteToTrash(doc)} />
    </>
  );
};

// ─── PDFItem ──────────────────────────────────────────────────────────────────
export const PDFItem = ({ item }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { deleteToTrash } = useDocuments();
  const tags = item.tags || [];
  
  // Dynamic Security & Encryption Logic
  const isFlagged = item.security_status === 'flagged';
  const isEncrypted = item.metadata?.model_prediction?.prediction === 'encrypted';
  const pillColor = isFlagged ? '#FF8484' : '#4ADE80';
  
  return (
    <>
      <TouchableOpacity style={s.card} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
        <View style={s.row}>
          <View style={[s.iconWrap, { backgroundColor: '#FF8484' }]}>
            {isEncrypted ? <Feather name="lock" size={20} color="#FFFFFF" /> : <Feather name="file-text" size={20} color="#FFFFFF" />}
          </View>
          <View style={s.body}>
            <Text style={s.title}    numberOfLines={1}>{item.title}</Text>
            <Text style={s.subtitle} numberOfLines={1}>{isEncrypted ? 'Password Protected PDF' : `${item.category} Document`}</Text>
          </View>
        </View>
        <View style={s.tagsRow}>
          {tags.slice(0, 3).map((t, i) => <View key={i} style={s.tagPill}><Text style={s.tagText}>{t}</Text></View>)}
          <View style={{ flex: 1 }} />
          <View style={[s.safePill, { borderColor: `rgba(${isFlagged ? '255, 132, 132' : '74, 222, 128'}, 0.5)` }]}>
            <Text style={[s.safeTxt, { color: pillColor }]}>{isFlagged ? 'RESTRICTED' : 'SAFE'}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <ActionModal visible={modalVisible} onClose={() => setModalVisible(false)} item={item} type="pdf" onDelete={(doc) => deleteToTrash(doc)} />
    </>
  );
};

// ─── RecentDocItem ────────────────────────────────────────────────────────────
export const RecentDocItem = ({ item }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { deleteToTrash } = useDocuments();

  const isFlagged = item.security_status === 'flagged';
  const pillColor = isFlagged ? '#FF8484' : '#4ADE80';

  return (
    <>
      <TouchableOpacity style={s.recentCard} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
        <View style={s.recentRow}>
          <View style={[s.iconWrap, item.type === 'pdf' ? { backgroundColor: '#FF8484' } : {}]}>
            <Feather name={item.type === 'pdf' ? 'file-text' : 'link'} size={18} color={item.type === 'pdf' ? '#FFFFFF' : '#2D464C'} />
          </View>
          <View style={s.body}>
            <Text style={s.title} numberOfLines={1}>{item.title}</Text>
            <Text style={s.meta}>{item.type.toUpperCase()}  ·  {fmt(item.createdAt)}</Text>
          </View>
          <View style={[s.safePill, { borderColor: `rgba(${isFlagged ? '255, 132, 132' : '74, 222, 128'}, 0.5)` }]}>
             <Text style={[s.safeTxt, { color: pillColor }]}>{isFlagged ? 'FLAGGED' : 'SAFE'}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <ActionModal visible={modalVisible} onClose={() => setModalVisible(false)} item={item} type={item.type} onDelete={(doc) => deleteToTrash(doc)} />
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card:       { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  recentCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 14 },
  recentRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  body:       { flex: 1, justifyContent: 'center' },
  iconWrap:   { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2, marginBottom: 4 },
  url:        { fontSize: 12, color: '#F5D1B0', fontWeight: '600' },
  subtitle:   { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  meta:       { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 0.5 },
  scoreCol:   { alignItems: 'flex-end', justifyContent: 'center' },
  score:      { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  scoreLbl:   { fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  tagsRow:    { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, alignItems: 'center', gap: 8 },
  tagPill:    { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  tagText:    { color: '#FFFFFF', fontSize: 10, fontWeight: '700', opacity: 0.9 },
  safePill:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.5)' },
  safeTxt:    { color: '#4ADE80', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#2D464C', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalDrag:    { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  modalIconWrap:{ width: 56, height: 56, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  modalSub:     { fontSize: 14, color: '#F5D1B0', fontWeight: '600' },
  actionGrid:   { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  actionBtn:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionTxt:    { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }
});