import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import CharacterCard from './CharacterCard';

export default function SpectatorView() {
  const { mjId } = useParams();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mjId) return;
    
    // Écoute en direct tous les persos liés à ce MJ
    const q = query(collection(db, "characters"), where("mjId", "==", mjId));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedPlayers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlayers(fetchedPlayers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [mjId]);

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '32px' }}>
        <h2 style={{ margin: 0, color: 'var(--accent)' }}>🔴 Table en Direct</h2>
        <Link to="/" style={{ color: 'var(--text-h)', textDecoration: 'none', padding: '8px 16px', background: 'var(--social-bg)', borderRadius: '6px' }}>
          Menu Principal
        </Link>
      </div>
      
      {loading ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>Connexion à la table...</p>
      ) : players.length === 0 ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>Aucun joueur n'est actuellement à cette table.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'start' }}>
          {players.map(char => (
            // MAGIE : On passe isEditable à false, donc les inputs et sliders sont bloqués !
            <CharacterCard key={char.id} character={char} isEditable={false} />
          ))}
        </div>
      )}
    </div>
  );
}