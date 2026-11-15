import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import { resolveAssetUrl } from './presets';

function CompactResourceBar({ label, current = 0, max = 100, color }) {
  const safeMax = Math.max(1, max);
  const percentage = Math.max(0, Math.min(100, (current / safeMax) * 100));

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: '11px',
        marginBottom: '3px'
      }}>
        <span style={{ fontWeight: 'bold', color: 'var(--text)', letterSpacing: '0.6px' }}>
          {label}
        </span>
        <span style={{ fontWeight: 'bold', color: 'var(--text-h)', fontSize: '12px' }}>
          {current} <span style={{ color: 'var(--text)', fontWeight: 'normal', fontSize: '11px' }}>/ {max}</span>
        </span>
      </div>
      <div style={{
        height: '7px',
        background: 'var(--bg)',
        borderRadius: '999px',
        overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          borderRadius: '999px',
          transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
        }} />
      </div>
    </div>
  );
}

export default function SpectatorView() {
  const { mjId } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [players, setPlayers] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  useEffect(() => {
    if (!mjId) return;

    const unsubCampaign = onSnapshot(
      doc(db, 'campaigns', mjId),
      (docSnap) => {
        if (docSnap.exists()) {
          setCampaign(docSnap.data());
        }
      },
      (err) => console.error('Erreur écoute campagne :', err)
    );

    const charsQuery = query(collection(db, 'characters'), where('mjUid', '==', mjId));
    const unsubChars = onSnapshot(
      charsQuery,
      (querySnapshot) => {
        const fetchedPlayers = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        fetchedPlayers.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
        setPlayers(fetchedPlayers);
        setLoading(false);
        setIsLiveConnected(true);
      },
      (err) => {
        console.error('Erreur écoute personnages :', err);
        setLoading(false);
      }
    );

    const usersQuery = query(collection(db, 'users'), where('mjUid', '==', mjId));
    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = d.data();
        });
        setUsersMap(map);
      },
      () => {}
    );

    return () => {
      unsubCampaign();
      unsubChars();
      unsubUsers();
    };
  }, [mjId]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* HEADER COMPACT */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 28px',
        background: 'var(--code-bg)',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="./assets/logo.png"
            alt="JDR Manager"
            style={{ height: '28px', width: '28px', objectFit: 'contain' }}
          />
          <h2 style={{ margin: 0, fontSize: '17px', color: 'var(--text-h)' }}>
            {campaign?.name || 'Table en Direct'}
          </h2>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            fontWeight: 'bold',
            padding: '3px 9px',
            borderRadius: '999px',
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-border)',
            color: 'var(--accent)',
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isLiveConnected ? '#48bb78' : '#d69e2e',
              boxShadow: isLiveConnected ? '0 0 6px #48bb78' : 'none'
            }} />
            Spectateur
          </span>
        </div>

        <Link
          to="/"
          className="btn-secondary"
          style={{ textDecoration: 'none', fontSize: '12px', padding: '6px 14px' }}
        >
          Quitter la vue
        </Link>
      </header>

      {/* LISTE VERTICALE DES PERSONNAGES */}
      <main style={{
        maxWidth: '880px',
        margin: '0 auto',
        padding: '28px 20px',
        textAlign: 'left'
      }}>
        {loading ? (
          <p style={{ color: 'var(--text)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
            Connexion à la table en cours...
          </p>
        ) : players.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            border: '1px dashed var(--border)',
            borderRadius: '12px',
            color: 'var(--text)'
          }}>
            Aucun aventurier n'est encore présent à cette table.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {players.map((char) => {
              const stats = char.liveStats || { pvCurrent: 100, pvMax: 100, pmCurrent: 50, pmMax: 50 };
              const statuses = char.statuses || [];
              const traits = char.traits || [];
              const ownerUser = usersMap[char.ownerUid || char.ownerId];
              const subtitle = [char.race, char.class].filter(Boolean).join(' • ');
              const details = [char.age, char.height, char.alignment].filter(Boolean).join(' • ');
              const isDown = (stats.pvCurrent ?? 0) <= 0;

              return (
                <div
                  key={char.id}
                  style={{
                    background: 'var(--code-bg)',
                    border: isDown ? '1px solid rgba(229, 62, 62, 0.6)' : '1px solid var(--border)',
                    borderLeft: isDown ? '4px solid #e53e3e' : '4px solid var(--accent)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: 'var(--shadow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px',
                    flexWrap: 'wrap',
                    opacity: isDown ? 0.78 : 1,
                    transition: 'all 0.25s ease'
                  }}
                >
                  {/* BLOC GAUCHE : PORTRAIT + IDENTITÉ + STATUTS */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flex: '1 1 320px',
                    minWidth: 0
                  }}>
                    <img
                      src={resolveAssetUrl(char.avatarUrl)}
                      alt={char.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = './assets/jdr-bag.jpg';
                      }}
                      style={{
                        width: '66px',
                        height: '66px',
                        borderRadius: '10px',
                        objectFit: 'cover',
                        border: '1px solid var(--accent-border)',
                        flexShrink: 0,
                        background: 'var(--bg)',
                        filter: isDown ? 'grayscale(70%)' : 'none'
                      }}
                    />

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: '18px',
                          color: 'var(--text-h)',
                          lineHeight: 1.2
                        }}>
                          {char.name}
                        </h3>

                        {ownerUser && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            color: 'var(--text)',
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: '999px',
                            padding: '1px 8px 1px 3px'
                          }}>
                            <img
                              src={resolveAssetUrl(ownerUser.avatarUrl)}
                              alt={ownerUser.username}
                              referrerPolicy="no-referrer"
                              onError={(e) => { e.target.onerror = null; e.target.src = './assets/jdr-bag.jpg'; }}
                              style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            {ownerUser.username}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--text)', marginTop: '3px' }}>
                        {subtitle || 'Aventurier'}
                        {details && (
                          <span style={{ opacity: 0.7, fontSize: '12px' }}> • {details}</span>
                        )}
                      </div>

                      {/* PASTILLES STATUTS & TRAITS */}
                      {(statuses.length > 0 || traits.length > 0) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                          {statuses.map((st, idx) => (
                            <span
                              key={`st-${idx}`}
                              style={{
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                color: '#fff',
                                backgroundColor: st.color || '#718096'
                              }}
                            >
                              {st.label}
                            </span>
                          ))}

                          {traits.map((tr, idx) => {
                            const isPos = tr.type === 'positive';
                            return (
                              <span
                                key={`tr-${idx}`}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  color: '#fff',
                                  backgroundColor: isPos ? '#2e7d32' : '#c62828',
                                  border: isPos ? '1px solid #4caf50' : '1px solid #ef5350'
                                }}
                              >
                                {tr.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BLOC DROITE : JAUGES PV/PM COMPACTES + OR */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flex: '1 1 240px',
                    maxWidth: '320px',
                    width: '100%'
                  }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <CompactResourceBar
                        label="PV"
                        current={stats.pvCurrent}
                        max={stats.pvMax}
                        color="#e53e3e"
                      />
                      <CompactResourceBar
                        label="PM"
                        current={stats.pmCurrent}
                        max={stats.pmMax}
                        color="#3182ce"
                      />
                    </div>

                    <div style={{
                      padding: '6px 10px',
                      background: 'var(--bg)',
                      border: '1px solid rgba(214, 158, 46, 0.5)',
                      borderRadius: '8px',
                      textAlign: 'center',
                      minWidth: '58px',
                      flexShrink: 0
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#d69e2e', lineHeight: 1.1 }}>
                        {char.gold || 0}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text)', marginTop: '2px' }}>
                        PO
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}