import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import Login from './login';
import DashboardMJ from './DashboardMJ';
import DashboardPlayer from './DashboardPlayer';
import SpectatorView from './SpectatorView';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

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
        {/* Route publique : Accessible via une simple URL, sans connexion */}
        <Route path="/spectator/:mjId" element={<SpectatorView />} />

        {/* Route protégée : L'accueil dynamique (Login ou Dashboard) */}
        <Route path="/" element={
          !user ? <Login /> : (
            <div>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                <span>Connecté : <strong>{user.email.split('@')[0]}</strong> ({userRole})</span>
                <button className="btn-secondary" onClick={() => signOut(auth)}>
                  Déconnexion
                </button>
              </header>
                    
              <main style={{ padding: '40px' }}>
                {userRole === 'mj' ? <DashboardMJ user={user} /> : <DashboardPlayer user={user} />}
              </main>
            </div>
          )
        } />
        
        {/* Sécurité : Redirige toute URL inconnue vers l'accueil */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;