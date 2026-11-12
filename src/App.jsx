import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './login';
import DashboardMJ from './DashboardMJ';
import DashboardPlayer from './DashboardPlayer';
import SpectatorView from './SpectatorView';
import UserMenu from './UserMenu';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Onglet global actif pour le MJ : 'players' | 'items' | 'pnj' | 'combat' | 'map'
  const [mainTab, setMainTab] = useState('players');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{ marginTop: '100px' }}>Chargement de l'univers...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/spectator/:mjId" element={<SpectatorView />} />
        
        <Route path="/" element={
          !user ? <Login /> : (
            <div>
              {/* HEADER DE NAVIGATION GLOBAL */}
              <header style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '12px 24px', 
                borderBottom: '1px solid var(--border)',
                background: 'var(--code-bg)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {/* BLOC GAUCHE : TITRE ET ONGLETS */}
                {/* BLOC GAUCHE : LOGO, TITRE ET ONGLETS */}
<div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <img 
      src="/assets/logo.png" 
      alt="JDR Manager Logo" 
      style={{ height: '32px', width: '32px', objectFit: 'contain' }} 
    />
    <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
      JDR Manager
    </h2>
  </div>

  {userRole === 'mj' && (
    <nav style={{ display: 'flex', gap: '6px' }}>
      <button
        onClick={() => setMainTab('players')}
        className={mainTab === 'players' ? "btn-primary" : "btn-secondary"}
        style={{ fontSize: '13px' }}
      >
        Joueurs
      </button>

      <button
        onClick={() => setMainTab('items')}
        className={mainTab === 'items' ? "btn-primary" : "btn-secondary"}
        style={{ fontSize: '13px' }}
      >
        Objets
      </button>

      {/* FUTURS ONGLETS */}
      <button disabled className="btn-secondary" style={{ fontSize: '13px', opacity: 0.45 }} title="Bientôt disponible">
        PNJ
      </button>
      <button disabled className="btn-secondary" style={{ fontSize: '13px', opacity: 0.45 }} title="Bientôt disponible">
        Combat
      </button>
      <button disabled className="btn-secondary" style={{ fontSize: '13px', opacity: 0.45 }} title="Bientôt disponible">
        Map
      </button>
    </nav>
  )}
</div>

                {/* BLOC DROITE : MENU UTILISATEUR COLLÉ À DROITE */}
                <div style={{ marginLeft: 'auto' }}>
                  <UserMenu user={user} userRole={userRole} />
                </div>
              </header>

              <main style={{ padding: '24px 40px' }}>
                {userRole === 'mj' ? (
                  <DashboardMJ user={user} activeMainTab={mainTab} />
                ) : (
                  <DashboardPlayer user={user} />
                )}
              </main>
            </div>
          )
        } />
         
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;