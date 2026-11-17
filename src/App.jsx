import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import DashboardMJ from './DashboardMJ';
import DashboardPlayer from './DashboardPlayer';
import SpectatorView from './SpectatorView';
import UserMenu from './UserMenu';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState('players');
  const [playerTab, setPlayerTab] = useState('player');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        } else {
          setUserRole(null);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div style={{ marginTop: '100px', textAlign: 'center' }}>Chargement de l'univers...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/spectator/:mjId" element={<SpectatorView />} />

        <Route
          path="/"
          element={
            !user ? (
              <Login />
            ) : userRole === 'admin' ? (
              <AdminDashboard currentUser={user} />
            ) : (
              <div>
                <header className="app-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src="./assets/logo.png"
                        alt="JDR Manager Logo"
                        style={{ height: '30px', width: '30px', objectFit: 'contain' }}
                      />
                      <h2 style={{ margin: 0, fontSize: '17px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                        JDR Manager
                      </h2>
                    </div>

                    {userRole === 'mj' ? (
                      <nav style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setMainTab('players')}
                          className={mainTab === 'players' ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          Joueurs
                        </button>
                        <button
                          onClick={() => setMainTab('group')}
                          className={mainTab === 'group' ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          Groupe
                        </button>
                        <button
                          onClick={() => setMainTab('items')}
                          className={mainTab === 'items' ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          Objets
                        </button>
                        <button
                          onClick={() => setMainTab('npcs')}
                          className={mainTab === 'npcs' ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          PNJ
                        </button>
                        <button
                          onClick={() => setMainTab('combat')}
                          className={mainTab === 'combat' ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          Combat
                        </button>
                        <button disabled className="btn-secondary" style={{ fontSize: '12px', padding: '5px 10px', opacity: 0.45 }} title="Bientôt disponible">
                          Map
                        </button>
                      </nav>
                    ) : (
                      <nav style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setPlayerTab('player')}
                          className={playerTab === 'player' ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          Joueur
                        </button>
                        <button
                          onClick={() => setPlayerTab('group')}
                          className={playerTab === 'group' ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          Groupe
                        </button>
                        <button
                          onClick={() => setPlayerTab('combat')}
                          className={playerTab === 'combat' ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                        >
                          Combat
                        </button>
                      </nav>
                    )}
                  </div>

                  <div style={{ marginLeft: 'auto' }}>
                    <UserMenu user={user} userRole={userRole} />
                  </div>
                </header>

                <main className="app-main">
                  {userRole === 'mj' ? (
                    <DashboardMJ user={user} activeMainTab={mainTab} onSelectMainTab={setMainTab} />
                  ) : (
                    <DashboardPlayer
                      user={user}
                      activePlayerTab={playerTab}
                      onSelectPlayerTab={setPlayerTab}
                    />
                  )}
                </main>
              </div>
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;