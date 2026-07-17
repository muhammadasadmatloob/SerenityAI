import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogOut, AlertTriangle, MapPin, Phone, CheckCircle, ShieldAlert, Send, X, Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'donnaserenity25@gmail.com';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://serenityai-93qt.onrender.com';

interface Alert {
  id: string;
  uid: string;
  username: string;
  reason: string;
  location: { lat: number; lng: number };
  emergency_contact: { name: string; phone: string; email: string };
  status: string;
  timestamp: any;
  session_id?: number;
}

interface ChatMessage {
  id: string | number;
  text: string;
  sender: 'user' | 'ai' | 'admin';
  timestamp?: any;
  time?: number;
}

export default function AdminDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Intervention State
  const [activeIntervention, setActiveIntervention] = useState<Alert | null>(null);
  const [interventionText, setInterventionText] = useState('');
  const [sendingIntervention, setSendingIntervention] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean>(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== ADMIN_EMAIL) {
        navigate('/admin');
      } else {
        setIsAdminAuthenticated(true);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
    if (!isAdminAuthenticated) return;

    const q = query(
      collection(db, 'crisis_alerts'),
      where('status', '==', 'pending')
    );

    const unsubscribeDB = onSnapshot(q, (snapshot) => {
      const fetchedAlerts: Alert[] = [];
      snapshot.forEach((doc) => {
        fetchedAlerts.push({ id: doc.id, ...doc.data() } as Alert);
      });
      fetchedAlerts.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      
      setAlerts(fetchedAlerts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching alerts: ", error);
      setLoading(false);
    });

    return () => unsubscribeDB();
  }, [isAdminAuthenticated]);

  const [isSyncingSession, setIsSyncingSession] = useState(true);

  // Chat Polling Effect
  useEffect(() => {
    if (!activeIntervention?.session_id) return;
    
    setIsSyncingSession(true);
    
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval>;

    const fetchSessionData = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        // Fetch Postgres chat history
        const historyRes = await fetch(`${BACKEND_URL}/api/admin/chat/history/${activeIntervention.session_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (historyRes.ok && isMounted) {
          const historyData = await historyRes.json();
          setChatHistory(historyData);
          setHistoryError(null); // Clear any old error on success
        } else if (!historyRes.ok && isMounted) {
          const errText = await historyRes.text();
          console.error("Failed to load history", errText);
          // Only show error if we have no messages yet — don't flicker!
          setChatHistory(prev => {
            if (prev.length === 0) setHistoryError(`Server returned: ${historyRes.status} ${errText}`);
            return prev;
          });
        }

        // Fetch session status
        const statusRes = await fetch(`${BACKEND_URL}/api/admin/session/status/${activeIntervention.session_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (statusRes.ok && isMounted) {
          const statusData = await statusRes.json();
          if (statusData.status === "completed" || statusData.status === "ended") {
            setSessionActive(false);
          } else {
            setSessionActive(true);
          }
        }
      } catch (err: any) {
        console.error("Failed to poll chat history:", err);
        // Only show error if we have no messages — don't replace loaded chat with an error!
        if (isMounted) {
          setChatHistory(prev => {
            if (prev.length === 0) setHistoryError(`Network/Fetch Error: ${(err as Error).message}`);
            return prev;
          });
        }
      } finally {
        if (isMounted) setIsSyncingSession(false);
      }
    };

    // Initial fetch
    fetchSessionData();
    // Poll every 3 seconds
    // Poll every 5s — slow enough to avoid flicker, fast enough to feel live
    pollInterval = setInterval(fetchSessionData, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activeIntervention]);

  // Listen to Admin Overrides from Firestore in real-time
  const [adminMessages, setAdminMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!activeIntervention) return;

    const q = query(
      collection(db, `admin_overrides/${activeIntervention.uid}/sessions/${activeIntervention.session_id}/messages`),
      // orderBy not used here so we handle null serverTimestamp gracefully
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Use client-side timestamp stored in createdAt, fallback to Firestore serverTimestamp
        // This prevents null timestamps (pending server write) from sorting to year-0
        const ts = data.clientTimestamp
          ? new Date(data.clientTimestamp)
          : data.timestamp
            ? data.timestamp.toDate()
            : new Date();
        msgs.push({
          id: doc.id,
          text: data.text,
          sender: 'admin', // Mark clearly as admin so renderer puts it on the RIGHT
          timestamp: ts
        });
      });
      setAdminMessages(msgs);
    });

    return () => unsubscribe();
  }, [activeIntervention]);

  // Combine and sort messages
  // KEY FIX: Python's isoformat() returns timestamps WITHOUT a timezone suffix (e.g. "2026-07-17T05:23:25")
  // Without 'Z', JS treats them as LOCAL time, causing them to sort incorrectly vs Firestore UTC timestamps.
  // We force UTC by appending 'Z' to any timestamp string that lacks timezone info.
  const parseBackendTimestamp = (ts: any): number => {
    if (!ts) return Date.now();
    if (typeof ts === 'string') {
      // Append Z if no timezone info so JS parses as UTC (matches Firestore timestamps)
      const normalized = (!ts.endsWith('Z') && !ts.includes('+') && !ts.includes('-', 10))
        ? ts.replace(' ', 'T') + 'Z'
        : ts;
      const parsed = new Date(normalized).getTime();
      return isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
  };

  const mappedHistory = chatHistory.map(m => ({
    ...m,
    time: parseBackendTimestamp(m.timestamp)
  }));
  const mappedAdmin = adminMessages.map(m => ({
    ...m,
    time: m.timestamp instanceof Date && !isNaN(m.timestamp.getTime())
      ? m.timestamp.getTime()
      : Date.now()
  }));
  const allMessages = [...mappedHistory, ...mappedAdmin];
  allMessages.sort((a, b) => (a.time || 0) - (b.time || 0));

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [allMessages]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin');
  };

  const handleResolve = async (id: string) => {
    try {
      const alertRef = doc(db, 'crisis_alerts', id);
      await updateDoc(alertRef, { status: 'resolved' });
    } catch (err) {
      console.error("Error resolving alert", err);
    }
  };

  const handleSendWhatsApp = (alert: Alert) => {
    const phone = alert.emergency_contact.phone.replace(/[^0-9]/g, '');
    const message = `URGENT: SerenityAI has detected a severe crisis for ${alert.username}. They may need immediate assistance.`;
    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
  };

  const handleSendTextIntervention = async () => {
    if (!activeIntervention || !interventionText.trim() || !sessionActive) return;
    setSendingIntervention(true);
    try {
      await addDoc(collection(db, `admin_overrides/${activeIntervention.uid}/sessions/${activeIntervention.session_id}/messages`), {
        text: interventionText.trim(),
        audio_url: null,
        timestamp: serverTimestamp(),         // Server-authoritative time (async)
        clientTimestamp: new Date().toISOString(), // Client time (instant, used for sorting until server resolves)
        sender: 'admin',
      });
      setInterventionText('');
    } catch (err) {
      console.error("Failed to send text intervention", err);
    } finally {
      setSendingIntervention(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <header className="bg-surface border-b border-border px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center mr-3 border border-red-500/20">
            <AlertTriangle className="text-red-500" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-main">Crisis Command Center</h1>
            <p className="text-xs text-text-muted">Active Monitoring ({alerts.length} pending)</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center px-4 py-2 text-sm font-medium text-text-muted hover:text-red-500 bg-background border border-border rounded-lg transition-colors">
          <LogOut size={16} className="mr-2" />
          Secure Logout
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
            <p className="text-text-muted">Loading secure alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-surface rounded-3xl border border-border border-dashed">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="text-green-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-text-main mb-2">No Active Crises</h2>
            <p className="text-text-muted">All users are currently safe.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="bg-red-500/10 px-5 py-3 border-b border-red-500/20 flex justify-between items-center">
                  <div className="flex items-center text-red-500 font-bold">
                    <AlertTriangle size={18} className="mr-2 animate-pulse" />
                    URGENT ALERT
                  </div>
                  <span className="text-xs font-medium text-red-500/70">
                    {alert.timestamp ? new Date(alert.timestamp.seconds * 1000).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-text-main mb-1">{alert.username}</h3>
                  <div className="mt-4 space-y-3 flex-1">
                    <div className="bg-background rounded-xl p-3 border border-border">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Crisis Reason</p>
                      <p className="text-sm text-text-main leading-relaxed">{alert.reason}</p>
                    </div>
                    <div className="bg-background rounded-xl p-3 border border-border flex items-start">
                      <MapPin size={16} className="text-accent mt-0.5 mr-2 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Live Location</p>
                        <p className="text-sm text-text-main font-medium">
                          {alert.location.lat.toFixed(5)}, {alert.location.lng.toFixed(5)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-5 border-t border-border border-dashed space-y-3">
                    <button onClick={() => setActiveIntervention(alert)} className="w-full flex items-center justify-center py-3 rounded-xl font-bold transition-all bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20">
                      <ShieldAlert size={18} className="mr-2" />
                      Live Intervention (Be Donna)
                    </button>
                    <button onClick={() => handleSendWhatsApp(alert)} disabled={!alert.emergency_contact.phone} className={`w-full flex items-center justify-center py-2.5 rounded-xl font-semibold transition-all ${alert.emergency_contact.phone ? 'bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white border border-[#25D366]/20' : 'bg-background text-text-muted border border-border cursor-not-allowed'}`}>
                      <Phone size={18} className="mr-2" />
                      Send WhatsApp ({alert.emergency_contact.phone || 'N/A'})
                    </button>
                    <button onClick={() => handleResolve(alert.id)} className="w-full mt-2 flex items-center justify-center py-2.5 rounded-xl font-semibold text-text-muted bg-background border border-border hover:bg-surface-hover transition-all">
                      <CheckCircle size={18} className="mr-2" />
                      Mark as Resolved
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Intervention Chat Interface */}
      {activeIntervention && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-background/90 backdrop-blur-md">
          <div className="bg-surface border border-border w-full max-w-2xl h-full max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-accent/5 shrink-0">
              <div className="flex items-center text-accent font-bold">
                <ShieldAlert size={20} className="mr-2 animate-pulse" />
                Live Chat Intervention: {activeIntervention.username}
              </div>
              <button onClick={() => setActiveIntervention(null)} className="text-text-muted hover:text-text-main p-1 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            {/* Session Status Banner */}
            {!sessionActive && (
              <div className="bg-red-500/10 text-red-500 px-6 py-2 text-sm font-semibold flex items-center justify-center border-b border-red-500/20 shrink-0">
                <AlertTriangle size={16} className="mr-2" />
                Session ended by user. Chat is disabled.
              </div>
            )}
            
            {/* Chat History View */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
              {isSyncingSession ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted">
                  <Loader2 size={32} className="animate-spin mb-4 text-accent/50" />
                  <p>Syncing live session data...</p>
                </div>
              ) : historyError ? (
                <div className="h-full flex items-center justify-center text-red-500 p-4 text-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Error loading chat history: {historyError}
                </div>
              ) : allMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500">
                  No messages in this session yet.
                </div>
              ) : (
                allMessages.map((msg, idx) => {
                  // 'user' = client on the LEFT, 'ai' = AI Donna on the RIGHT, 'admin' = you (admin) on the RIGHT
                  const isClient = msg.sender === 'user';
                  const isAdminMsg = msg.sender === 'admin';
                  return (
                    <div key={idx} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                        isClient
                          ? 'bg-surface border border-border text-text-main rounded-tl-sm'
                          : isAdminMsg
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 rounded-tr-sm'
                            : 'bg-accent text-white shadow-lg shadow-accent/20 rounded-tr-sm'
                      }`}>
                        {isAdminMsg && (
                          <span className="text-[10px] text-blue-200 font-semibold mb-1 block">You (Admin)</span>
                        )}
                        <p className="text-[15px] leading-relaxed">{msg.text}</p>
                        <span className={`text-[10px] mt-2 block ${isClient ? 'text-text-muted' : 'text-white/70'}`}>
                          {new Date(msg.time).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Chat Input */}
            <div className="p-4 bg-surface border-t border-border shrink-0">
              <div className="flex gap-3">
                <input 
                  type="text"
                  value={interventionText}
                  onChange={(e) => setInterventionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendTextIntervention();
                  }}
                  placeholder={sessionActive ? "Type your intervention message..." : "Session ended. Please use WhatsApp."}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-accent disabled:opacity-50"
                  disabled={!sessionActive || sendingIntervention}
                />
                <button
                  onClick={handleSendTextIntervention}
                  disabled={!sessionActive || sendingIntervention || !interventionText.trim()}
                  className="bg-accent text-white px-6 py-3 rounded-xl font-semibold transition-all hover:bg-accent-hover flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingIntervention ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
