import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import CharacterCard from './CharacterCard';
import GroupRoster from './GroupRoster';
import CombatTracker from './CombatTracker';

export default function DashboardPlayer({ user, activePlayerTab = 'player' }) {
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const q = query(collection(db, 'characters'), where('ownerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const firstDoc = querySnapshot.docs[0];
        setCharacter({ id: firstDoc.id, ...firstDoc.data() });
      } else {
        setCharacter(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div style={{ textAlign: 'left', maxWidth: '850px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>Chargement de votre fiche...</p>
      </div>
    );
  }

  if (!character) {
    return (
      <div style={{ textAlign: 'left', maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text)', fontSize: '16px', margin: 0 }}>
            Aucun personnage n'est encore rattaché à votre compte. Contactez l'administrateur.
          </p>
        </div>
      </div>
    );
  }

  if (activePlayerTab === 'group') {
    return (
      <div style={{ textAlign: 'left', maxWidth: '880px', margin: '0 auto' }}>
        {!character.mjUid ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
            Votre personnage n'est rattaché à aucune campagne pour le moment.
          </div>
        ) : (
          <GroupRoster mjId={character.mjUid} />
        )}
      </div>
    );
  }

  if (activePlayerTab === 'combat') {
    return (
      <div style={{ textAlign: 'left', maxWidth: '1100px', margin: '0 auto' }}>
        {!character.mjUid ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
            Votre personnage n'est rattaché à aucune campagne pour le moment.
          </div>
        ) : (
          <CombatTracker mjUid={character.mjUid} readOnly={true} />
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'left', maxWidth: '850px', margin: '0 auto' }}>
      <CharacterCard character={character} isEditable={true} />
    </div>
  );
}