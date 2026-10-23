import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import CharacterCard from './CharacterCard';
import ItemBank from './ItemBank';

export default function DashboardMJ({ user }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const spectatorLink = `${window.location.origin}${window.location.pathname}#/spectator/${user.uid}`;

  useEffect(() => {
    // La requête cible tous les personnages liés à l'ID de ce MJ
    const q = query(collection(db, "characters"), where("mjId", "==", user.uid));
    
    // onSnapshot écoute en direct. Dès qu'un joueur modifie un truc, ça s'actualise ici.
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedPlayers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlayers(fetchedPlayers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  return (
    <div style={{ textAlign: 'left', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '40px', padding: '24px', backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Votre Table Virtuelle</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '16px' }}>
            Donnez cet ID à vos joueurs pour qu'ils rejoignent votre campagne :<br/>
            <strong style={{ color: 'var(--accent)', fontSize: '20px', letterSpacing: '1px' }}>{user.uid}</strong>
          </p>
          
          <p style={{ margin: 0, fontSize: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            Lien Spectateur public (lecture seule) :<br/>
            <a href={spectatorLink} target="_blank" rel="noreferrer" style={{ color: 'var(--text-h)', wordBreak: 'break-all' }}>
              {spectatorLink}
            </a>
          </p>
        </div>
      </div>

      <div>
        <h2 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '24px' }}>Fiches des Joueurs</h2>
        <ItemBank mjUid={user.uid} players={players} />
        
        {loading ? (
          <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>Connexion à la table...</p>
        ) : players.length === 0 ? (
          <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
            Aucun joueur n'a encore rejoint cette campagne avec votre ID.
          </p>
          
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'start' }}>
            
            {players.map(char => (
              // Le MJ a aussi le droit d'éditer les fiches depuis son écran
              // Dans le .map() des fiches du MJ :
            <CharacterCard key={char.id} character={char} isEditable={true} isMJ={true} />            ))}
          </div>
        )}
      </div>

    </div>
  );
}