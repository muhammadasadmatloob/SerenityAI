import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogOut, AlertTriangle, MapPin, Phone, CheckCircle } from 'lucide-react';

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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== ADMIN_EMAIL) {
        navigate('/admin');
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
    // Listen to pending crisis alerts
    const q = query(
      collection(db, 'crisis_alerts'),
      where('status', '==', 'pending')
    );

    const unsubscribeDB = onSnapshot(q, (snapshot) => {
      const fetchedAlerts: Alert[] = [];
      snapshot.forEach((doc) => {
        fetchedAlerts.push({ id: doc.id, ...doc.data() } as Alert);
      });
      // Sort client side since Firestore requires composite index for orderBy with where
      fetchedAlerts.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA; // Descending
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
    // Remove any non-numeric characters from phone number except leading +
    let phone = alert.emergency_contact.phone.replace(/[^\d+]/g, '');
    if (phone.startsWith('+')) {
      phone = phone.substring(1);
    }
    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border px-6 py-4 flex justify-between items-center sticky top-0 z-50">
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
              <div key={alert.id} className="bg-surface rounded-2xl border border-red-500/30 overflow-hidden shadow-lg shadow-red-500/5 relative">
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

                <div className="p-5">
                  <h3 className="text-xl font-bold text-text-main mb-1">{alert.username}</h3>
                  
                  <div className="mt-4 space-y-3">
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

                  <div className="mt-6 pt-5 border-t border-border border-dashed">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Emergency Actions</p>
                    <div className="space-y-3">
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

                      {/* Send Email button removed as requested */}
                    </div>

                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="w-full mt-4 flex items-center justify-center py-2.5 rounded-xl font-semibold text-text-muted bg-background border border-border hover:bg-surface-hover transition-all"
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
    </div>
  );
}
