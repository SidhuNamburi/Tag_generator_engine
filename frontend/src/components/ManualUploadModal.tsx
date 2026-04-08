import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDocuments } from '../hooks/useDocuments'; 
interface ManualUploadModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ManualUploadModal: React.FC<ManualUploadModalProps> = ({ visible, onClose }) => {
  const [mode, setMode] = useState<'link' | 'pdf'>('link'); 
  const [linkInput, setLinkInput] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<any>(null); // 'any' fixes the Expo file object error
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const { refreshData } = useDocuments(); 

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
      }
    } catch (err) {
      console.log("Error picking document:", err);
    }
  };

  const handleUpload = async () => {
    if (mode === 'link' && !linkInput) return;
    if (mode === 'pdf' && !selectedFile) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('type', mode);
      
      // Grab the user ID from storage
      const uid = await AsyncStorage.getItem('userId');
      if (uid) {
        formData.append('userId', uid);
      }
      
      if (mode === 'link') {
        formData.append('url', linkInput);
      } else {
        formData.append('file', {
          uri: selectedFile.uri,
          name: selectedFile.name || 'document.pdf',
          type: selectedFile.mimeType || 'application/pdf',
        } as any); // "as any" helps bypass strict TypeScript errors for React Native FormData
      }

      // Hit your local Node.js server via Ngrok
      const NODE_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unrocked-gentler-asa.ngrok-free.dev';
      
      const response = await fetch(`${NODE_API_URL}/api/documents/manual-upload`, {
        method: 'POST',
        body: formData,
        headers: { 
          // VIP Pass to bypass Ngrok's warning page
          'ngrok-skip-browser-warning': 'true' 
          // Notice we DO NOT manually set Content-Type here. React Native does it automatically with the boundary!
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      // Fake delay for UI flow
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Cleanup & Close
      setLinkInput('');
      setSelectedFile(null);
    //   refreshData();
      onClose();
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modalContainer}>
          
          <View style={s.header}>
            <Text style={s.title}>Add to Trail</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* MODE TOGGLES */}
          <View style={s.toggleContainer}>
            <TouchableOpacity 
              style={[s.toggleBtn, mode === 'link' && s.toggleActive]} 
              onPress={() => setMode('link')}
            >
              <Feather name="link" size={18} color={mode === 'link' ? '#FFF' : '#A0A0A0'} />
              <Text style={[s.toggleText, mode === 'link' && { color: '#FFF' }]}>Web Link</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[s.toggleBtn, mode === 'pdf' && s.toggleActive]} 
              onPress={() => setMode('pdf')}
            >
              <Feather name="file-text" size={18} color={mode === 'pdf' ? '#FFF' : '#A0A0A0'} />
              <Text style={[s.toggleText, mode === 'pdf' && { color: '#FFF' }]}>Upload PDF</Text>
            </TouchableOpacity>
          </View>

          {/* INPUT AREA */}
          <View style={s.inputArea}>
            {mode === 'link' ? (
              <TextInput
                style={s.textInput}
                placeholder="Paste URL here (e.g., https://...)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={linkInput}
                onChangeText={setLinkInput}
                autoCapitalize="none"
              />
            ) : (
              <TouchableOpacity style={s.filePickerBox} onPress={handlePickFile}>
                <Feather name={selectedFile ? "check-circle" : "upload-cloud"} size={32} color={selectedFile ? "#4ADE80" : "#F5D1B0"} />
                <Text style={s.filePickerText}>
                  {selectedFile ? selectedFile.name : "Tap to browse files"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity 
            style={[s.submitBtn, (!linkInput && !selectedFile) && { opacity: 0.5 }]} 
            onPress={handleUpload}
            disabled={isUploading || (!linkInput && mode === 'link') || (!selectedFile && mode === 'pdf')}
          >
            {isUploading ? (
              <ActivityIndicator color="#2D464C" />
            ) : (
              <Text style={s.submitText}>Analyze & Save</Text>
            )}
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#2D464C', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  toggleActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  toggleText: { color: '#A0A0A0', fontWeight: '700', fontSize: 14 },
  inputArea: { marginBottom: 24 },
  textInput: { backgroundColor: 'rgba(0,0,0,0.2)', color: '#FFF', borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filePickerBox: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' },
  filePickerText: { color: '#FFF', marginTop: 12, fontWeight: '600', textAlign: 'center' },
  submitBtn: { backgroundColor: '#F5D1B0', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#2D464C', fontSize: 16, fontWeight: '800' }
});