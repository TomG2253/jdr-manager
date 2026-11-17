import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import GroupRoster from './GroupRoster';
import CombatTracker from './CombatTracker';

export default function SpectatorView() {
  const { mjId } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('group'); // 'group' | 'combat'

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

    return () => unsubCampaign();
  }, [mjId]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* HEADER COMPACT */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 28px',
          background: 'var(--code-bg)',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <img
            src="./assets/logo.png"
            alt="JDR Manager"
            style={{ height: '28px', width: '28px', objectFit: 'contain' }}
          />
          <h2 style={{ margin: 0, fontSize: '17px', color: 'var(--text-h)' }}>
            {campaign?.name || 'Table en Direct'}
          </h2>
          <span
            style={{
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
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isLiveConnected ? '#48bb78' : '#d69e2e',
                boxShadow: isLiveConnected ? '0 0 6px #48bb78' : 'none'
              }}
            />
            Spectateur
          </span>

          {/* ONGLETS SPECTATEUR : GROUPE -> COMBAT */}
          <nav style={{ display: 'flex', gap: '6px', marginLeft: '6px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('group')}
              className={activeTab === 'group' ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '12px', padding: '5px 12px' }}
            >
              Groupe
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('combat')}
              className={activeTab === 'combat' ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '12px', padding: '5px 12px' }}
            >
              Combat
            </button>
          </nav>
        </div>

        <Link
          to="/"
          className="btn-secondary"
          style={{ textDecoration: 'none', fontSize: '12px', padding: '6px 14px' }}
        >
          Quitter la vue
        </Link>
      </header>

      {/* CONTENU DE L'ONGLET ACTIF (LECTURE SEULE) */}
      <main
        style={{
          maxWidth: activeTab === 'combat' ? '1100px' : '880px',
          margin: '0 auto',
          padding: '28px 20px',
          textAlign: 'left'
        }}
      >
        {activeTab === 'group' ? (
          <GroupRoster mjId={mjId} onConnectionChange={setIsLiveConnected} />
        ) : (
          <CombatTracker mjUid={mjId} readOnly={true} />
        )}
      </main>
    </div>
  );
}