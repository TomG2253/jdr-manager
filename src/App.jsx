import { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './login';
import './App.css';

// Ces composants n'existent pas encore, on crée des "placeholders"
const DashboardMJ = () => <div><h2>Vue Maître du Jeu</h2><p>Gestion des groupes et invitations.</p></div>;
const DashboardPlayer = () => <div><h2>Vue Joueur</h2><p>Mes personnages et fiches libres.</p></div>;

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'mj' ou 'joueur'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Récupération du rôle dans Firestore
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

  if (!user) return <Login />;

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #e5e4e7' }}>
        <span>Connecté : <strong>{user.email.split('@')[0]}</strong> ({userRole})</span>
        <button onClick={() => signOut(auth)} style={{ padding: '5px 10px', cursor: 'pointer' }}>
          Déconnexion
        </button>
      </header>
      
      <main style={{ padding: '40px' }}>
        {userRole === 'mj' ? <DashboardMJ /> : <DashboardPlayer />}
      </main>
    </div>
  );
}

export default App;