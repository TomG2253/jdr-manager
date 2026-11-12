import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import ItemBank from './ItemBank';
import CharacterCard from './CharacterCard';

export default function DashboardMJ({ user, activeMainTab = 'players' }) {
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "characters"), where("mjId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlayers(chars);
    });

    return () => unsubscribe();
  }, [user]);

  const handleTogglePlayer = (id) => {
    setSelectedPlayerId(prev => prev === id ? null : id);
  };

  const handleCopyMjCode = () => {
    if (!user?.uid) return;
    // Copie directement le code MJ brut (ex: MW6OnjHc7SfirOu2hIGBvWato1r1)
    navigator.clipboard.writeText(user.uid);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* VUE BANQUE D'OBJETS */}
      {activeMainTab === 'items' && (
        <ItemBank mjUid={user.uid} players={players} />
      )}

      {/* VUE JOUEURS */}
      {activeMainTab === 'players' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-h)', fontSize: '20px' }}>
              Fiches des Joueurs
            </h3>

            <button
              onClick={handleCopyMjCode}
              className="btn-primary"
              style={{ fontSize: '12px', padding: '8px 14px', borderRadius: '8px' }}
            >
              {copiedLink ? 'Code copié !' : 'Copier le code MJ'}
            </button>
          </div>

          {/* BANDEAU MINI-CARTES */}
          {players.length === 0 ? (
            <p style={{ color: 'var(--text)', fontStyle: 'italic', margin: 0 }}>
              Aucun joueur n'a encore rejoint la session. Transmettez-leur votre code MJ ci-dessus !
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
              {players.map((player) => {
                const isSelected = player.id === selectedPlayerId;
                return (
                  <div
                    key={player.id}
                    onClick={() => handleTogglePlayer(player.id)}
                    title={isSelected ? "Cliquer pour fermer la fiche" : "Cliquer pour afficher la fiche"}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: isSelected ? 'var(--code-bg)' : 'var(--bg)',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      opacity: isSelected ? 1 : 0.65,
                      boxShadow: isSelected ? '0 0 12px rgba(124, 58, 237, 0.3)' : 'none'
                    }}
                  >
                    {player.avatarUrl ? (
                      <img 
                        src={player.avatarUrl} 
                        alt={player.name} 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/assets/default-avatar.jpg';
                        }}
                        style={{ 
                          width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', 
                          border: '1px solid var(--border)', backgroundColor: 'var(--border)' 
                        }} 
                      />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', backgroundColor: 'var(--border)' }} />
                    )}

                    <div>
                      <strong style={{ display: 'block', fontSize: '13px', color: isSelected ? 'var(--text-h)' : 'var(--text)' }}>
                        {player.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--text)' }}>
                        {player.race} • {player.class}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* FICHE RÉDUITE DU PERSONNAGE SÉLECTIONNÉ */}
          {selectedPlayer && (
            <CharacterCard 
              key={selectedPlayer.id} 
              character={selectedPlayer} 
              isEditable={true} 
              isMJ={true} 
            />
          )}
        </div>
      )}
    </div>
  );
}