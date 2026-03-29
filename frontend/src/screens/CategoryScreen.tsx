import React, { useState, useRef, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, StatusBar, 
  TextInput, ScrollView, Animated, Easing 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; 

import { LinkItem, PDFItem } from '../components/DocItems';
import { useDocuments } from '../hooks/useDocuments';

// ─── CUSTOM ANIMATED LIST WRAPPER ───
const AnimatedListItem = ({ children, index }: { children: React.ReactNode, index: number }) => {
  const slide = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      slide.setValue(50);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(slide, { 
          toValue: 0, tension: 60, friction: 7, delay: index * 50, useNativeDriver: true 
        }),
        Animated.timing(opacity, { 
          toValue: 1, duration: 400, delay: index * 50, useNativeDriver: true 
        })
      ]).start();
      
      return () => {
        slide.stopAnimation();
        opacity.stopAnimation();
      };
    }, [index])
  );

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: slide }] }}>
      {children}
    </Animated.View>
  );
};

const CategoryScreen = ({ navigation, category = 'Public' }: any) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const { docs } = useDocuments();

  // 1. Map to your real MongoDB Categories
  const configMap: Record<string, { icon: string; title: string; data: any[] }> = {
    Private: { icon: 'lock', title: 'Private Workspace', data: docs.Private || [] },
    Public: { icon: 'globe', title: 'Public Workspace', data: docs.Public || [] },
    Restricted: { icon: 'alert-triangle', title: 'Restricted Workspace', data: docs.Restricted || [] },
    Trash: { icon: 'trash-2', title: 'Trash Bin', data: docs.Trash || [] }
  };

  const config = configMap[category] || { 
    icon: 'folder', 
    title: `${category} Workspace`, 
    data: [] 
  };

  // 2. Filter logic using MongoDB fields (title/contentUrl)
  const filteredDocs = config.data.filter((doc: any) => {
    const searchLower = searchQuery.toLowerCase();
    
    // 1. Search the AI Tags (The core feature of the app!)
    const matchesTags = doc.tags && Array.isArray(doc.tags) 
      ? doc.tags.some((tag: string) => tag.toLowerCase().includes(searchLower))
      : false;
      
    // 2. Fallback: Search the title just in case the AI hasn't tagged it yet
    const matchesTitle = doc.title ? doc.title.toLowerCase().includes(searchLower) : false;

    // 3. If the search bar is empty, show everything. Otherwise, match tags or title.
    const matchesSearch = searchQuery === '' || matchesTags || matchesTitle;

    // 4. Handle Tabs (All, Links, PDFs)
    const matchesTab = activeTab === 'All' || 
                      (activeTab === 'Links' && (doc.type === 'link' || doc.type === 'url')) || 
                      (activeTab === 'PDFs' && doc.type === 'pdf');
                      
    return matchesSearch && matchesTab;
  });

  const linksList = filteredDocs.filter((d: any) => d.type === 'link' || d.type === 'url');
  const pdfsList = filteredDocs.filter((d: any) => d.type === 'pdf');

  // ─── HEADER ANIMATIONS ───
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const sweepX = useRef(new Animated.Value(-500)).current;

  useFocusEffect(
    useCallback(() => {
      headerOpacity.setValue(0);
      headerSlide.setValue(-20);
      sweepX.setValue(-500);

      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true })
      ]).start(() => {
        Animated.timing(sweepX, { 
          toValue: 500, 
          duration: 1200, 
          easing: Easing.inOut(Easing.ease), 
          useNativeDriver: true 
        }).start();
      });

      return () => {
        headerOpacity.stopAnimation();
        headerSlide.stopAnimation();
        sweepX.stopAnimation();
      };
    }, [category])
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={s.header}>
        <TouchableOpacity style={s.menuBtn} onPress={() => navigation.openDrawer()}>
          <Feather name="menu" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerSlide }] }}>
        <View style={s.titleSection}>
          <View style={s.titleIconWrap}>
            <Feather name={config.icon as any} size={32} color="#2D464C" />
          </View>
          <View>
            <Text style={s.pageTitle}>{config.title}</Text>
            <Text style={s.pageStats}>{filteredDocs.length} TOTAL · {linksList.length} LINKS · {pdfsList.length} PDFS</Text>
          </View>
        </View>

        <View style={s.sweepContainer}>
          <Animated.View style={[s.sweepTrail, { transform: [{ translateX: sweepX }] }]}>
            <View style={s.sweepDot} />
            <View style={[s.sweepDot, { opacity: 0.6, width: 30 }]} />
            <View style={[s.sweepDot, { opacity: 0.3, width: 60 }]} />
          </Animated.View>
        </View>

        <View style={s.searchWrapper}>
          <Feather name="search" size={20} color="rgba(255,255,255,0.4)" />
          <TextInput 
            style={s.searchInput}
            placeholder={`Search ${category.toLowerCase()}...`}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={s.tabContainer}>
          {['All', 'Links', 'PDFs'].map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={[s.tab, activeTab === tab && s.activeTab]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, activeTab === tab && s.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      <ScrollView style={s.listContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {filteredDocs.length === 0 && (
          <AnimatedListItem index={0}>
            <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.3 }}>
              <Feather name="inbox" size={60} color="#FFFFFF" style={{ marginBottom: 12 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Workspace Empty</Text>
            </View>
          </AnimatedListItem>
        )}

        {(activeTab === 'All' || activeTab === 'Links') && linksList.length > 0 && (
          <View>
            <AnimatedListItem index={0}>
              <View style={s.sectionTitleRow}>
                <View style={s.dot} />
                <Text style={s.sectionTitleText}>Indexed Links</Text>
                <Text style={s.sectionCount}>{linksList.length}</Text>
              </View>
            </AnimatedListItem>
            
            {linksList.map((doc, index) => (
              <AnimatedListItem key={doc._id} index={index + 1}>
                <LinkItem item={doc} />
              </AnimatedListItem>
            ))}
          </View>
        )}

        {(activeTab === 'All' || activeTab === 'PDFs') && pdfsList.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <AnimatedListItem index={linksList.length + 1}>
              <View style={s.sectionTitleRow}>
                <View style={[s.dot, { backgroundColor: '#FF8484' }]} />
                <Text style={s.sectionTitleText}>Document Intelligence</Text>
                <Text style={s.sectionCount}>{pdfsList.length}</Text>
              </View>
            </AnimatedListItem>
            
            {pdfsList.map((doc, index) => (
              <AnimatedListItem key={doc._id} index={linksList.length + 2 + index}>
                <PDFItem item={doc} />
              </AnimatedListItem>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default CategoryScreen;

// Styles remain identical to your original post
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D464C' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  menuBtn: { padding: 4, marginLeft: -4 }, 
  titleSection: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 15, gap: 16 },
  titleIconWrap: { width: 64, height: 64, backgroundColor: '#FFFFFF', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  pageStats: { fontSize: 11, fontWeight: '800', color: '#F5D1B0', marginTop: 6, letterSpacing: 1.5, textTransform: 'uppercase' },
  sweepContainer: { height: 2, width: '100%', backgroundColor: 'rgba(255,255,255,0.02)', overflow: 'hidden', marginBottom: 20 },
  sweepTrail: { flexDirection: 'row', alignItems: 'center', height: 2, width: 150, gap: 2 },
  sweepDot: { height: 2, width: 15, backgroundColor: '#4ADE80', shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 5, elevation: 3 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 24, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 20 },
  searchInput: { flex: 1, marginLeft: 12, color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', marginHorizontal: 24, borderRadius: 16, padding: 6, marginBottom: 15 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 15 },
  activeTabText: { color: '#2D464C', fontWeight: '800' },
  listContainer: { paddingHorizontal: 24 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }, 
  sectionTitleText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  sectionCount: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
});