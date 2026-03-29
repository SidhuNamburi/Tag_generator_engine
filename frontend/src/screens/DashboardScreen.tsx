import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Modal, Animated, Linking, Share, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useStats, useRecentDocuments, useDocuments } from '../hooks/useDocuments';

// ─── TYPESCRIPT INTERFACES ──────────────────────────────────────────────────
interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
}

interface ThemedAlertProps extends AlertConfig {
  onClose: () => void;
}

interface DashboardDocModalProps {
  doc: any | null; // Using 'any' for now since your doc structure is flexible
  onClose: () => void;
  onDelete: (doc: any) => void;
}

interface OverviewPanelProps {
  totalDocs?: number;
  linksCount?: number;
  pdfsCount?: number;
  onScanPress: () => void;
}

interface WorkspaceTabProps {
  label: string;
  count: number;
  icon: keyof typeof Feather.glyphMap; // Ensures only valid Feather icons are used!
  color: string;
  onPress: () => void;
}

// ─── Custom Themed Alert Component ──────────────────────────────────────────
const ThemedAlert: React.FC<ThemedAlertProps> = ({ visible, title, message, onClose }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={s.alertOverlay}>
      <View style={s.alertBox}>
        <View style={s.alertIcon}><Feather name="info" size={24} color="#F5D1B0" /></View>
        <Text style={s.alertTitle}>{title}</Text>
        <Text style={s.alertMsg}>{message}</Text>
        <TouchableOpacity style={s.alertBtn} onPress={onClose}>
          <Text style={s.alertBtnText}>Understood</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ─── Dashboard Action Modal ───────────────────────────────────────────────────
const DashboardDocModal: React.FC<DashboardDocModalProps> = ({ doc, onClose, onDelete }) => {
  if (!doc) return null;

  const docTitle = doc.title || 'Document';
  const docUrl = doc.contentUrl || 'https://google.com';

  const handleOpen = async () => {
    try { await Linking.openURL(docUrl); }
    catch (e) { Alert.alert("Error", "Could not open this link."); }
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
        {
          text: "Trash", style: "destructive", onPress: () => {
            if (onDelete) onDelete(doc);
            onClose();
          }
        }
      ]
    );
  };

  return (
    <Modal visible={!!doc} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modalContent}>
          <View style={s.modalDrag} />
          <View style={s.modalHeader}>
            <View style={s.modalIconWrap}>
              <Feather name={doc.type === 'pdf' ? 'file-text' : 'link'} size={24} color="#2D464C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle} numberOfLines={1}>{docTitle}</Text>
              <Text style={s.modalSub}>{doc.type === 'pdf' ? 'PDF Document' : 'Web Link'}</Text>
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

const OverviewPanel: React.FC<OverviewPanelProps> = ({ totalDocs, linksCount, pdfsCount, onScanPress }) => (
  <View style={s.panel}>
    <View style={s.panelTop}>
      <Text style={s.panelLabel}>Total Documents Indexed</Text>
      <TouchableOpacity onPress={onScanPress} activeOpacity={0.7} style={s.qrIcon}>
        <Feather name="maximize" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
    <Text style={s.panelMainValue}>{totalDocs || '0'}</Text>
    <View style={s.panelBottom}>
      <View style={s.panelStat}>
        <Text style={s.panelSubLabel}>Web Links</Text>
        <Text style={s.panelSubValue}>{linksCount || '0'}</Text>
      </View>
      <View style={s.panelStat}>
        <Text style={s.panelSubLabel}>PDF Documents</Text>
        <Text style={s.panelSubValue}>{pdfsCount || '0'}</Text>
      </View>
    </View>
  </View>
);

const WorkspaceTab: React.FC<WorkspaceTabProps> = ({ label, count, icon, color, onPress }) => (
  <TouchableOpacity style={[s.folderTab, { backgroundColor: color }]} onPress={onPress}>
    <View style={s.folderIcon}><Feather name={icon} size={20} color="#2D464C" /></View>
    <Text style={s.folderLabel}>{label}</Text>
    <Text style={s.folderCount}>{count || '0'}</Text>
  </TouchableOpacity>
);

const DashboardScreen: React.FC<any> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { stats, loading: docsLoading } = useStats();
  const { recent } = useRecentDocuments();
  const { docs, deleteToTrash } = useDocuments();

  const [isScannerVisible, setScannerVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({ visible: false, title: '', message: '' });
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const showAlert = (title: string, message: string) => setAlertConfig({ visible: true, title, message });

  const handleOpenScanner = async () => {
    const { granted } = await requestPermission();
    if (granted) {
      setScanned(false);
      setScannerVisible(true);
    } else {
      showAlert("Access Required", "Please enable camera permissions in settings to scan Intelligence QR codes.");
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScannerVisible(false);
    showAlert("Intelligence Linked", `Successfully indexed content from: ${data}`);
  };

  const cats = [
    { label: 'Private', icon: 'lock' as const, color: '#FDFBF7', count: docs.Private?.length || 0, screen: 'Private' },
    { label: 'Public', icon: 'globe' as const, color: '#FDFBF7', count: docs.Public?.length || 0, screen: 'Public' },
    { label: 'Restricted', icon: 'alert-triangle' as const, color: '#F5D1B0', count: docs.Restricted?.length || 0, screen: 'Restricted' },
  ];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <ThemedAlert
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />

      <DashboardDocModal
        doc={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onDelete={(doc) => deleteToTrash(doc)}
      />

      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={s.menuBtn}>
          <Feather name="menu" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.brandName}>
          TagAnd<Text style={{ color: '#F5D1B0' }}>Trail</Text>
        </Text>
      </View>

      <View style={s.mainBody}>
        <OverviewPanel
          totalDocs={stats?.total_docs}
          linksCount={stats?.total_links}
          pdfsCount={stats?.total_pdfs}
          onScanPress={handleOpenScanner}
        />

        <View style={s.section}>
          <Text style={s.sectionTitle}>Workspaces</Text>
          <View style={s.folderStack}>
            {cats.map((c, i) => (
              <WorkspaceTab key={i} {...c} onPress={() => navigation.navigate(c.screen)} />
            ))}
          </View>
        </View>

        <View style={s.sectionRecent}>
          <View style={s.rowBetween}>
            <Text style={s.sectionTitle}>Recent Activity</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.recentScroll} contentContainerStyle={{ paddingRight: 40 }}>
            {recent && recent.map(doc => (
              <TouchableOpacity
                key={doc._id} 
                style={s.recentCard}
                onPress={() => setSelectedDoc(doc)}
                activeOpacity={0.7}
              >
                <View style={s.recentType}><Feather name={doc.type === 'pdf' ? 'file' : 'link'} size={14} color="#2D464C" /></View>
                <Text style={s.recentName} numberOfLines={1}>{doc.title}</Text>
                <Text style={s.recentMeta}>{doc.type.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* --- QR SCANNER MODAL --- */}
      <Modal visible={isScannerVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>

          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />

          <View style={[StyleSheet.absoluteFill, s.cameraOverlay]}>
            <TouchableOpacity style={s.closeCamera} onPress={() => setScannerVisible(false)}>
              <Feather name="arrow-left" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={s.scannerFrame}>
              <View style={[s.corner, s.topLeft]} />
              <View style={[s.corner, s.topRight]} />
              <View style={[s.corner, s.bottomLeft]} />
              <View style={[s.corner, s.bottomRight]} />
              <View style={s.scanLine} />
            </View>

            <Text style={s.scanHint}>Align QR code within the frame</Text>
            <View style={{ height: 100 }} />
          </View>

        </View>
      </Modal>
    </View>
  );
};

export default DashboardScreen;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D464C' },
  mainBody: { flex: 1 },
  brandName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, height: 60, gap: 16 },
  menuBtn: { padding: 4 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  panel: { backgroundColor: '#F5D1B0', marginHorizontal: 24, marginTop: 10, borderRadius: 28, padding: 24, minHeight: 180 },
  panelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelLabel: { fontSize: 13, color: '#2D464C', opacity: 0.7, fontWeight: '700' },
  qrIcon: { width: 38, height: 38, backgroundColor: '#2D464C', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  panelMainValue: { fontSize: 52, fontWeight: '900', color: '#2D464C', marginVertical: 4, letterSpacing: -2 },
  panelBottom: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(45, 70, 76, 0.1)', paddingTop: 20, marginTop: 10, gap: 40 },
  panelStat: { flex: 1 },
  panelSubLabel: { fontSize: 10, color: '#2D464C', opacity: 0.6, fontWeight: '800', textTransform: 'uppercase' },
  panelSubValue: { fontSize: 22, fontWeight: '900', color: '#2D464C', marginTop: 2 },
  section: { marginTop: 25, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 14 },
  folderStack: { gap: 12 },
  folderTab: { height: 68, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  folderIcon: { width: 40, height: 40, backgroundColor: 'rgba(45, 70, 76, 0.1)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  folderLabel: { flex: 1, marginLeft: 15, fontSize: 16, fontWeight: '800', color: '#2D464C' },
  folderCount: { fontSize: 18, fontWeight: '800', color: '#2D464C', opacity: 0.3 },
  sectionRecent: { marginTop: 'auto', marginBottom: 40, paddingHorizontal: 24 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewAll: { color: '#F5D1B0', fontSize: 14, fontWeight: '700' },
  recentScroll: { marginLeft: -24, paddingLeft: 24, marginTop: 15 },
  recentCard: { width: 145, height: 160, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, padding: 20, marginRight: 16 },
  recentType: { width: 34, height: 34, backgroundColor: '#FDFBF7', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  recentName: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  recentMeta: { color: '#F5D1B0', fontSize: 12, fontWeight: '700', marginTop: 4 },

  // SCANNER UI
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(45, 70, 76, 0.7)', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 60 },
  closeCamera: { alignSelf: 'flex-start', marginLeft: 30 },
  scannerFrame: { width: 250, height: 250, position: 'relative', justifyContent: 'center' },
  scanLine: { width: '100%', height: 2, backgroundColor: '#F5D1B0', shadowColor: '#F5D1B0', shadowRadius: 10, shadowOpacity: 1, elevation: 5 },
  scanHint: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginTop: 20 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#F5D1B0', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  // THEMED ALERT
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  alertBox: { width: '80%', backgroundColor: '#2D464C', borderRadius: 32, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  alertIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(245, 209, 176, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  alertMsg: { color: '#FFFFFF', opacity: 0.7, textAlign: 'center', lineHeight: 20, marginBottom: 25 },
  alertBtn: { backgroundColor: '#F5D1B0', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 20 },
  alertBtnText: { color: '#2D464C', fontWeight: '800', fontSize: 16 },

  // DASHBOARD DOC MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#2D464C', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalDrag: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  modalIconWrap: { width: 56, height: 56, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#F5D1B0', fontWeight: '600' },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  actionBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }
});