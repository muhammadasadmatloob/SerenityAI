import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogOut, AlertTriangle, MapPin, Phone, CheckCircle, ShieldAlert, Send, X, Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'donnaserenity25@gmail.com';

interface Alert {
  id: string;
  uid: string;
  username: string;
  reason: string;
  location: { lat: number; lng: number };
  emergency_contact: { name: string; phone: string; email: string };
  status: string;
  timestamp: any;
}

export default function AdminDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Intervention State
  const [activeIntervention, setActiveIntervention] = useState<Alert | null>(null);
  const [interventionText, setInterventionText] = useState('');
  const [sendingIntervention, setSendingIntervention] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== ADMIN_EMAIL) {
        navigate('/admin');
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
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
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const handleResolve = async (id: string) => {
    try {
      const alertRef = doc(db, 'crisis_alerts', id);
      await updateDoc(alertRef, { status: 'resolved' });
    } catch (err) {
      console.error("Failed to resolve alert", err);
      alert("Failed to resolve alert. Please try again.");
    }
  };

  const constructMessage = (alert: Alert) => {
    const mapsLink = `https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`;
    return `*Urgent Support Requested*\n\nHello, this is Donna, the therapeutic AI companion for ${alert.username || 'the user'}. I am reaching out because they are currently experiencing a difficult mental health crisis and have designated you as their trusted emergency contact.\n\nThey are in need of immediate compassion and human support. Please reach out to them or proceed to their current location to ensure they are safe.\n\n*Crisis Context:* ${alert.reason}\n*Live Location:* ${mapsLink}\n\nYour presence could make all the difference right now.`;
  };

  const handleSendWhatsApp = (alert: Alert) => {
    const message = constructMessage(alert);
    let phone = alert.emergency_contact.phone.replace(/[^\d+]/g, '');
    if (phone.startsWith('+')) {
      phone = phone.substring(1);
    }
    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
  };

  // --- Intervention Methods ---
  const handleSendTextIntervention = async () => {
    if (!activeIntervention || !interventionText.trim()) return;
    setSendingIntervention(true);
    try {
      await addDoc(collection(db, `admin_overrides/${activeIntervention.uid}/messages`), {
        text: interventionText.trim(),
        audio_url: null,
        timestamp: serverTimestamp(),
        sender: 'ai',
      });
      setInterventionText('');
      setActiveIntervention(null);
      alert("Text intervention sent successfully!");
    } catch (err) {
      console.error("Failed to send text intervention", err);
      alert("Failed to send text intervention.");
    } finally {
      setSendingIntervention(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Header */}
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
        
        <button 
          onClick={handleLogout}
          className="flex items-center px-4 py-2 text-sm font-medium text-text-muted hover:text-red-500 bg-background border border-border rounded-lg transition-colors"
        >
          <LogOut size={16} className="mr-2" />
          Secure Logout
        </button>
      </header>

      {/* Main Content */}
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
            <h2 className="text-2xl font-bold text-text-main mb-2">All Clear</h2>
            <p className="text-text-muted text-center max-w-md">
              There are no pending crisis alerts at this moment. The system is actively monitoring for new events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-surface rounded-2xl border border-red-500/30 overflow-hidden shadow-lg shadow-red-500/5 relative flex flex-col">
                {/* Glowing alert header */}
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
                        <a 
                          href={`https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline mt-1 inline-block"
                        >
                          Open in Google Maps
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-border border-dashed space-y-3">
                    <button
                      onClick={() => setActiveIntervention(alert)}
                      className="w-full flex items-center justify-center py-3 rounded-xl font-bold transition-all bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20"
                    >
                      <ShieldAlert size={18} className="mr-2" />
                      Live Intervention (Be Donna)
                    </button>

                    <button
                      onClick={() => handleSendWhatsApp(alert)}
                      disabled={!alert.emergency_contact.phone}
                      className={`w-full flex items-center justify-center py-2.5 rounded-xl font-semibold transition-all ${
                        alert.emergency_contact.phone 
                          ? 'bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white border border-[#25D366]/20' 
                          : 'bg-background text-text-muted border border-border cursor-not-allowed'
                      }`}
                    >
                      <Phone size={18} className="mr-2" />
                      Send WhatsApp ({alert.emergency_contact.phone || 'N/A'})
                    </button>

                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="w-full mt-2 flex items-center justify-center py-2.5 rounded-xl font-semibold text-text-muted bg-background border border-border hover:bg-surface-hover transition-all"
                    >
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

      {/* Intervention Modal */}
      {activeIntervention && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border border-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-accent/5">
              <div className="flex items-center text-accent font-bold">
                <ShieldAlert size={20} className="mr-2" />
                Live Intervention Mode
              </div>
              <button 
                onClick={() => !sendingIntervention && setActiveIntervention(null)}
                className="text-text-muted hover:text-text-main p-1"
                disabled={sendingIntervention}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-text-muted mb-4">
                You are about to intervene as <strong>Donna</strong> for <strong>{activeIntervention.username}</strong>. 
                Any text message sent here will instantly override the AI and appear on their screen.
              </p>
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-text-muted uppercase mb-2">Send Text Message</label>
                <textarea 
                  value={interventionText}
                  onChange={(e) => setInterventionText(e.target.value)}
                  placeholder="Type a calming message..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-text-main focus:outline-none focus:border-accent resize-none h-24"
                  disabled={sendingIntervention}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSendTextIntervention}
                    disabled={sendingIntervention || !interventionText.trim()}
                    className="bg-accent/20 text-accent hover:bg-accent hover:text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingIntervention ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                    Send Text
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
