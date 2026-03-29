import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

// Ensure your .env has EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://YOUR_LOCAL_IP:5000';

// ─── TypeScript Interfaces ──────────────────────────────────────────────────
interface DocumentContextType {
  docs: {
    Public: any[];
    Private: any[];
    Restricted: any[];
    Trash: any[];
  };
  stats: any;
  recent: any[];
  loading: boolean;
  refreshData: () => Promise<void>;
  deleteToTrash: (doc: any) => void;
  restoreFromTrash: (doc: any) => void;
  deletePermanently: (id: string | number) => Promise<void>;
  emptyTrash: () => Promise<void>; 
  markAsRecent: (doc: any) => void;
  logs: any[];
  addLog: (log: any) => void;
}

// ─── The Global Context (The Brain) ─────────────────────────────────────────
const DocumentContext = createContext<DocumentContextType | null>(null);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 👇 FIX: Added <DocumentContextType['docs']> so TypeScript knows these aren't "never[]" arrays
  const [docs, setDocs] = useState<DocumentContextType['docs']>({
    Public: [],
    Private: [],
    Restricted: [],
    Trash: [],
  });

  const [recent, setRecent] = useState<any[]>([]);
  const [serverStats, setServerStats] = useState<any>({});
  // ─── LIVE LOGS & WEBSOCKET LISTENER ───────────────────────────────────────
  const [logs, setLogs] = useState<any[]>([]);

  const addLog = (newLog: any) => {
    setLogs(prev => [newLog, ...prev].slice(0, 50)); // Keeps memory light (max 50)
  };

  useEffect(() => {
    // Only connect and listen if a user is actually logged in
    if (!userId) return; 

    const socket = io(API_URL);

    socket.on('AI_UPDATE', (liveLog) => {
      console.log("📣 Caught broadcast from Node:", liveLog.message);
      
      // 1. Save the log to state so the LogsScreen updates instantly
      setLogs(prev => [liveLog, ...prev].slice(0, 50));
      
      // 2. Silently fetch the fresh data Python just saved to MongoDB
      fetchAllData(userId); 
    });

    return () => {
      socket.disconnect(); // Cleans up if the app closes
    };
  }, [userId]);
  // ─── INITIALIZATION: Fetch User & Data ────────────────────────────────────
  useEffect(() => {
    const initialize = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        
        if (storedUserId) {
          setUserId(storedUserId);
          await fetchAllData(storedUserId);
        }
      } catch (error) {
        console.error('Error loading user from AsyncStorage:', error);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  // ─── API FETCH LOGIC ──────────────────────────────────────────────────────
  const fetchAllData = async (uid: string) => {
    try {
      const [pubRes, privRes, restRes, trashRes, recentRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/documents/category/${uid}/Public`),
        fetch(`${API_URL}/api/documents/category/${uid}/Private`),
        fetch(`${API_URL}/api/documents/category/${uid}/Restricted`),
        fetch(`${API_URL}/api/documents/category/${uid}/Trash`),
        fetch(`${API_URL}/api/documents/recent/${uid}`),
        fetch(`${API_URL}/api/documents/stats/${uid}`)
      ]);

      const [Public, Private, Restricted, Trash, recentData, statsData] = await Promise.all([
        pubRes.json(), privRes.json(), restRes.json(), trashRes.json(), recentRes.json(), statsRes.json()
      ]);

      setDocs({ Public, Private, Restricted, Trash });
      setRecent(recentData);
      setServerStats(statsData);

    } catch (error) {
      console.error("Failed to fetch documents from server:", error);
    }
  };

  const refreshData = async () => {
    if (userId) {
      setLoading(true);
      await fetchAllData(userId);
      setLoading(false);
    }
  };

  // ─── DYNAMIC STATS ────────────────────────────────────────────────────────
  const allActiveDocs = [...docs.Public, ...docs.Private, ...docs.Restricted];
  const dynamicStats = {
    total_docs: serverStats.total_docs || allActiveDocs.length,
    total_links: serverStats.total_links || allActiveDocs.filter(d => d.type === 'link').length,
    total_pdfs: serverStats.total_pdfs || allActiveDocs.filter(d => d.type === 'pdf').length,
    safe_docs: serverStats.safe_docs || allActiveDocs.filter(d => d.security_status === 'safe').length,
    private_count: docs.Private.length,
    public_count: docs.Public.length,
    restricted_count: docs.Restricted.length,
    trash_count: docs.Trash.length,
  };

  // ─── THE STACK LOGIC ──────────────────────────────────────────────────────
  const markAsRecent = (doc: any) => {
    setRecent(prevStack => {
      const filteredStack = prevStack.filter(d => d._id !== doc._id);
      return [doc, ...filteredStack].slice(0, 10);
    });
  };

  // ─── THE GLOBAL ACTIONS (Optimistic UI + API Sync) ────────────────────────
 // 1. Update Trash Action
  const deleteToTrash = async (doc: any) => {
    const cat = doc.category || 'Private';
    
    setDocs(prev => ({
      ...prev,
      [cat as keyof typeof prev]: prev[cat as keyof typeof prev].filter((d: any) => d._id !== doc._id), 
      Trash: [{ ...doc, category: 'Trash', previousCategory: cat, status: 'TRASH' }, ...prev.Trash] 
    }));
    setRecent(prevStack => prevStack.filter(d => d._id !== doc._id)); 

    try {
      await fetch(`${API_URL}/api/documents/trash/${doc._id}`, { method: 'PUT' });
      // 👇 ADD THIS: Re-fetch stats so the dashboard updates
      await refreshData(); 
    } catch (error) {
      console.error("Failed to trash document on server", error);
    }
  };

  // 2. Update Restore Action
  const restoreFromTrash = async (doc: any) => {
    let targetCategory = doc.previousCategory || 'Private';
    if (doc.security_status !== 'safe') {
      targetCategory = 'Restricted';
    }
    
    const restoredDoc = { ...doc, category: targetCategory };
    
    setDocs(prev => ({
      ...prev,
      Trash: prev.Trash.filter((d: any) => d._id !== doc._id), 
      [targetCategory]: [restoredDoc, ...prev[targetCategory as keyof typeof prev]] 
    }));
    markAsRecent(restoredDoc);

    try {
      await fetch(`${API_URL}/api/documents/restore/${doc._id}`, { method: 'PUT' });
      // 👇 ADD THIS: Re-fetch stats
      await refreshData();
    } catch (error) {
      console.error("Failed to restore document on server", error);
    }
  };

  // 3. Update Permanent Delete
  const deletePermanently = async (id: string | number) => {
    setDocs(prev => ({ 
      ...prev, 
      Trash: prev.Trash.filter((d: any) => d._id !== id) 
    }));

    try {
      await fetch(`${API_URL}/api/documents/${id}`, { method: 'DELETE' });
      // 👇 ADD THIS: Re-fetch stats (especially for trash_count)
      await refreshData();
    } catch (error) {
      console.error("Failed to permanently delete document:", error);
    }
  };

  const emptyTrash = async () => {
    if (!userId) return;

    setDocs(prev => ({ 
      ...prev, 
      Trash: [] 
    }));

    try {
      await fetch(`${API_URL}/api/documents/empty-trash/${userId}`, { method: 'DELETE' });
    } catch (error) {
      console.error("Failed to empty trash:", error);
    }
  };

  return (
    <DocumentContext.Provider value={{ 
      docs, 
      stats: dynamicStats, 
      recent, 
      loading,
      refreshData,
      deleteToTrash, 
      restoreFromTrash, 
      deletePermanently,
      emptyTrash, 
      markAsRecent,
      logs,
      addLog 
    }}>
      {children}
    </DocumentContext.Provider>
  );
};

// ─── Custom Hooks ───────────────────────────────────────────────────────────
export const useDocuments = () => {
  const context = useContext(DocumentContext);
  if (!context) throw new Error('useDocuments must be used within a DocumentProvider');
  return context;
};

export const useStats = () => { 
  const { stats, loading } = useDocuments(); 
  return { stats, loading }; 
};

export const useRecentDocuments = () => { 
  const { recent, loading } = useDocuments(); 
  return { recent, loading }; 
};