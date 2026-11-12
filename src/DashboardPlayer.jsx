import { useState, useEffect } from 'react';
import { collection, query, where, addDoc, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import CharacterCard from './CharacterCard';
import ImageInput from './ImageInput';

export default function DashboardPlayer({ user }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', race: '', charClass: '', avatarUrl: '', mjId: ''
  });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    const q = query(collection(db, "characters"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedCharacters = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCharacters(fetchedCharacters);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleCreateCharacter = async (e) => {
    e.preventDefault();

    // Extraction et nettoyage de l'ID MJ
    let rawMjInput = formData.mjId.trim();

    // Si l'utilisateur colle une URL entière (ex: http://localhost:5173?mj=xyz...), on extrait la valeur du paramètre ?mj=
    if (rawMjInput.includes('?mj=')) {
      try {
        const urlObj = new URL(rawMjInput);
        rawMjInput = urlObj.searchParams.get('mj') || rawMjInput;
      } catch {
        const parts = rawMjInput.split('?mj=');
        if (parts.length > 1) rawMjInput = parts[1].split('&')[0];
      }
    }

    if (!rawMjInput) {
      alert("Veuillez renseigner un ID de Maître du Jeu valide.");
      return;
    }

    try {
      // Vérification dans Firestore que le MJ existe bien
      const mjUserSnap = await getDoc(doc(db, "users", rawMjInput));

      if (!mjUserSnap.exists()) {
        alert("L'ID renseigné ne correspond à aucun utilisateur actif.");
        return;
      }

      if (mjUserSnap.data().role !== 'mj') {
        alert("L'ID renseigné appartient à un compte Joueur, pas à un Maître du Jeu.");
        return;
      }

      // Si le MJ est valide, création du personnage
      const newCharacter = {
        ownerId: user.uid,
        mjId: rawMjInput,
        name: formData.name.trim(),
        race: formData.race.trim(),
        class: formData.charClass.trim(),
        avatarUrl: formData.avatarUrl.trim(),
        totalPC: 0,
        isSkillsLocked: true,
        liveStats: {
          pvCurrent: 100, pvMax: 100,
          pmCurrent: 50, pmMax: 50
        },
        skills: [],
        createdAt: new Date()
      };

      await addDoc(collection(db, "characters"), newCharacter);
      setShowForm(false);
      setFormData({ name: '', race: '', charClass: '', avatarUrl: '', mjId: '' });

    } catch (error) {
      console.error("Erreur lors de la vérification/création :", error);
      alert("Erreur de communication avec la base de données : " + error.message);
    }
  };

  return (
    <div style={{ textAlign: 'left', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '32px' }}>
        <h2 style={{ margin: 0 }}>Mes Personnages</h2>
        <button className={showForm ? "btn-secondary" : "btn-primary"} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuler' : '+ Créer un personnage'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateCharacter} style={{ padding: '24px', backgroundColor: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Nouvelle Fiche</h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <input required type="text" placeholder="Nom" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            <input required type="text" placeholder="Race" value={formData.race} onChange={e => setFormData({...formData, race: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            <input required type="text" placeholder="Classe" value={formData.charClass} onChange={e => setFormData({...formData, charClass: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }} />
          </div>

          <ImageInput 
            value={formData.avatarUrl} 
            onChange={url => setFormData({...formData, avatarUrl: url})} 
            placeholder="URL de l'avatar ou importer une photo..." 
          />
          
          <div style={{ padding: '16px', background: 'var(--bg)', border: '1px dashed var(--accent-border)', borderRadius: '6px' }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-h)', fontWeight: 'bold' }}>Rejoindre une partie</label>
            <input required type="text" placeholder="ID du MJ (ex: MW6Onjhc7... ou lien complet)" value={formData.mjId} onChange={e => setFormData({...formData, mjId: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>Gérer le personnage</button>
        </form>
      )}

      {loading ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>Recherche de vos personnages...</p>
      ) : characters.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <p style={{ color: 'var(--text)', fontSize: '18px', margin: '0 0 16px 0' }}>Vous n'avez aucun personnage actif.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Créer mon premier personnage</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {characters.map(char => (
            <CharacterCard key={char.id} character={char} isEditable={true} />
          ))}
        </div>
      )}
    </div>
  );
}