import { useState } from 'react';
import { auth, db } from './firebase'; // <-- Ajout de db ici
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; // <-- Outils Firestore

export default function Login() {
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isMJ, setIsMJ] = useState(false); // <-- Nouveau state pour le rôle
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    
    const fakeEmail = `${pseudo.trim().toLowerCase().replace(/\s+/g, '')}@jdr.com`;
    const paddedPassword = password + "_JDR_";

    try {
      if (isRegistering) {
        // 1. Création du compte Firebase Auth
        const userCred = await createUserWithEmailAndPassword(auth, fakeEmail, paddedPassword);
        
        // 2. Création du profil dans Firestore
        await setDoc(doc(db, "users", userCred.user.uid), {
          pseudo: pseudo.trim(),
          role: isMJ ? "mj" : "joueur"
        });
        
      } else {
        await signInWithEmailAndPassword(auth, fakeEmail, paddedPassword);
      }
    } catch (err) {
      setError("Erreur d'authentification : " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '300px', margin: '100px auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <h2>{isRegistering ? 'Créer un compte' : 'Connexion'}</h2>
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="Pseudo (ex: Gandalf)" 
          value={pseudo} 
          onChange={(e) => setPseudo(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Mot de passe" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        
        {/* La case à cocher n'apparaît qu'à l'inscription */}
        {isRegistering && (
          <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={isMJ} 
              onChange={(e) => setIsMJ(e.target.checked)} 
            />
            Je suis Maître du Jeu (MJ)
          </label>
        )}

        <button type="submit">
          {isRegistering ? "S'inscrire" : "Se connecter"}
        </button>
      </form>
      
      {error && <p style={{ color: 'red', fontSize: '14px' }}>{error}</p>}
      
      <button 
        onClick={() => setIsRegistering(!isRegistering)} 
        style={{ background: 'none', border: 'none', color: '#aa3bff', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {isRegistering ? "Déjà un compte ?" : "Pas de compte ?"}
      </button>
    </div>
  );
}