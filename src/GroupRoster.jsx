import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { resolveAssetUrl } from './presets';

function CompactResourceBar({ label, current = 0, max = 100, color }) {
  const safeMax = Math.max(1, max);
  const percentage = Math.max(0, Math.min(100, (current / safeMax) * 100));

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: '10px',
          marginBottom: '3px'
        }}
      >
        <span style={{ fontWeight: 'bold', color: 'var(--text)', letterSpacing: '0.5px' }}>
          {label}
        </span>
        <span style={{ fontWeight: 'bold', color: 'var(--text-h)', fontSize: '11px' }}>
          {current}
          <span style={{ color: 'var(--text)', fontWeight: 'normal', fontSize: '10px' }}>
            /{max}
          </span>
        </span>
      </div>
      <div
        style={{
          height: '6px',
          background: 'var(--bg)',
          borderRadius: '999px',
          overflow: 'hidden',
          border: '1px solid var(--border)'
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: color,
            borderRadius: '999px',
            transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        />
      </div>
    </div>
  );
}

export default function GroupRoster({ mjId, onConnectionChange }) {
  const [players, setPlayers] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mjId) return;

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
        if (onConnectionChange) onConnectionChange(true);
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
      unsubChars();
      unsubUsers();
    };
  }, [mjId, onConnectionChange]);

  if (loading) {
    return (
      <p style={{ color: 'var(--text)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
        Connexion à la table en cours...
      </p>
    );
  }

  if (players.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '48px 24px',
          border: '1px dashed var(--border)',
          borderRadius: '12px',
          color: 'var(--text)'
        }}
      >
        Aucun aventurier n'est encore présent à cette table.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '16px'
      }}
    >
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
              border: isDown ? '1px solid rgba(229, 62, 62, 0.55)' : '1px solid var(--border)',
              borderTop: isDown ? '3px solid #e53e3e' : '3px solid var(--accent)',
              borderRadius: '12px',
              padding: '14px 16px',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              opacity: isDown ? 0.78 : 1,
              transition: 'all 0.25s ease'
            }}
          >
            {/* EN-TÊTE : PORTRAIT + IDENTITÉ + OR */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <img
                src={resolveAssetUrl(char.avatarUrl)}
                alt={char.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = './assets/jdr-bag.jpg';
                }}
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  border: '1px solid var(--accent-border)',
                  flexShrink: 0,
                  background: 'var(--bg)',
                  filter: isDown ? 'grayscale(70%)' : 'none'
                }}
              />

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', minWidth: 0 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        color: 'var(--text-h)',
                        lineHeight: 1.2
                      }}
                    >
                      {char.name}
                    </h3>

                    {ownerUser && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          color: 'var(--text)',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: '999px',
                          padding: '1px 7px 1px 2px'
                        }}
                      >
                        <img
                          src={resolveAssetUrl(ownerUser.avatarUrl)}
                          alt={ownerUser.username}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = './assets/jdr-bag.jpg';
                          }}
                          style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        {ownerUser.username}
                      </span>
                    )}
                  </div>

                  {/* COMPTEUR OR COMPACT EN HAUT À DROITE */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: '3px',
                      padding: '2px 8px',
                      background: 'rgba(214, 158, 46, 0.1)',
                      border: '1px solid rgba(214, 158, 46, 0.35)',
                      borderRadius: '6px',
                      flexShrink: 0
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ecc94b' }}>
                      {char.gold || 0}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#d69e2e' }}>
                      PO
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '3px' }}>
                  {subtitle || 'Aventurier'}
                </div>

                {details && (
                  <div style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.65, marginTop: '1px' }}>
                    {details}
                  </div>
                )}
              </div>
            </div>

            {/* JAUGES PV / PM CÔTE À CÔTE */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                padding: '8px 10px',
                background: 'rgba(0, 0, 0, 0.16)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}
            >
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

            {/* STATUTS & TRAITS FINS */}
            {(statuses.length > 0 || traits.length > 0) && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '4px',
                  paddingTop: '2px'
                }}
              >
                {statuses.map((st, idx) => {
                  const baseColor = st.color || '#9f7aea';
                  return (
                    <span
                      key={`st-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '1px 7px',
                        borderRadius: '5px',
                        fontSize: '10px',
                        fontWeight: '600',
                        lineHeight: '1.35',
                        color: '#f7fafc',
                        backgroundColor: `${baseColor}28`,
                        border: `1px solid ${baseColor}88`
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: baseColor,
                          flexShrink: 0
                        }}
                      />
                      {st.label}
                    </span>
                  );
                })}

                {traits.map((tr, idx) => {
                  const isPos = tr.type === 'positive';
                  return (
                    <span
                      key={`tr-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '1px 7px',
                        borderRadius: '5px',
                        fontSize: '10px',
                        fontWeight: '500',
                        lineHeight: '1.35',
                        color: isPos ? '#9ae6b4' : '#feb2b2',
                        backgroundColor: isPos
                          ? 'rgba(72, 187, 120, 0.12)'
                          : 'rgba(245, 101, 101, 0.12)',
                        border: isPos
                          ? '1px solid rgba(72, 187, 120, 0.35)'
                          : '1px solid rgba(245, 101, 101, 0.35)'
                      }}
                    >
                      {tr.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}