import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import CharacterCard from './CharacterCard';

export default function DashboardPlayer({ user }) {
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const q = query(collection(db, "characters"), where("ownerUid", "==", user.uid));
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

  return (
    <div style={{ textAlign: 'left', maxWidth: '850px', margin: '0 auto' }}>
      {loading ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>Chargement de votre fiche...</p>
      ) : !character ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text)', fontSize: '16px', margin: 0 }}>
            Aucun personnage n'est encore rattaché à votre compte. Contactez l'administrateur.
          </p>
        </div>
      ) : (
        <CharacterCard character={character} isEditable={true} />
      )}
    </div>
  );
}