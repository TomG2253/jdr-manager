import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import ItemBank from './ItemBank';
import CharacterCard from './CharacterCard';

export default function DashboardMJ({ user, activeMainTab = 'players' }) {
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [campaignName, setCampaignName] = useState('');
  const [spectatorCode, setSpectatorCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    getDoc(doc(db, "campaigns", user.uid)).then((snap) => {
      if (snap.exists()) {
        setCampaignName(snap.data().name || '');
        setSpectatorCode(snap.data().spectatorCode || '');
      }
    });

    const q = query(collection(db, "characters"), where("mjUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chars = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlayers(chars);
    });

    return () => unsubscribe();
  }, [user]);

  const handleTogglePlayer = (id) => {
    setSelectedPlayerId(prev => prev === id ? null : id);
  };

  const handleCopySpectatorCode = () => {
    if (!spectatorCode) return;
    navigator.clipboard.writeText(spectatorCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-h)', fontSize: '20px' }}>
                {campaignName || 'Fiches des Joueurs'}
              </h3>
              {campaignName && (
                <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                  Joueurs de la campagne ({players.length})
                </span>
              )}
            </div>

            {spectatorCode && (
              <button
                onClick={handleCopySpectatorCode}
                className="btn-secondary"
                title="Cliquer pour copier le code spectateur"
                style={{ fontSize: '12px', padding: '7px 12px', borderRadius: '8px' }}
              >
                {copiedCode ? 'Code copié !' : `Code spectateur : ${spectatorCode}`}
              </button>
            )}
          </div>

          {/* BANDEAU MINI-CARTES */}
          {players.length === 0 ? (
            <p style={{ color: 'var(--text)', fontStyle: 'italic', margin: 0 }}>
              Aucun joueur n'est encore rattaché à votre campagne.
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
                    <img
                      src={player.avatarUrl || '/assets/jdr-bag.jpg'}
                      alt={player.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/assets/jdr-bag.jpg';
                      }}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--border)'
                      }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '13px', color: isSelected ? 'var(--text-h)' : 'var(--text)' }}>
                        {player.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--text)' }}>
                        {[player.race, player.class].filter(Boolean).join(' - ') || 'Personnage vierge'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* FICHE COMPLÈTE DU PERSONNAGE SÉLECTIONNÉ */}
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