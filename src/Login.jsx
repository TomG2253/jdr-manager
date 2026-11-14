import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';

export const formatLoginEmail = (identifier) => {
  const clean = identifier.trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean.replace(/[^a-z0-9._-]/g, '')}@jdr.com`;
};

export const formatAuthPassword = (rawPassword) => {
  return `${rawPassword.trim()}_JDR_`;
};

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('user'); // 'user' | 'spectator'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [spectatorCode, setSpectatorCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUserLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = formatLoginEmail(identifier);
    const paddedPassword = formatAuthPassword(password);

    try {
      await signInWithEmailAndPassword(auth, email, paddedPassword);
    } catch {
      try {
        await signInWithEmailAndPassword(auth, email, password.trim());
      } catch (err) {
        console.error(err);
        setError("Identifiant ou mot de passe incorrect.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSpectatorSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanCode = spectatorCode.trim().toUpperCase();
    if (!cleanCode) return;

    setLoading(true);
    try {
      const q = query(collection(db, 'campaigns'), where('spectatorCode', '==', cleanCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("Code de campagne introuvable.");
      } else {
        const campaignData = snap.docs[0].data();
        const targetMjId = campaignData.mjUid || snap.docs[0].id;
        navigate(`/spectator/${targetMjId}`);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la vérification du code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '28px',
        background: 'var(--code-bg)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 6px 0', color: 'var(--text-h)' }}>JDR Manager</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)' }}>
            Accès privé sur invitation du Maître du Jeu
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          padding: '4px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <button
            type="button"
            onClick={() => { setMode('user'); setError(''); }}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              background: mode === 'user' ? 'var(--accent)' : 'transparent',
              color: mode === 'user' ? '#fff' : 'var(--text)'
            }}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => { setMode('spectator'); setError(''); }}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              background: mode === 'spectator' ? 'var(--accent)' : 'transparent',
              color: mode === 'spectator' ? '#fff' : 'var(--text)'
            }}
          >
            Spectateur
          </button>
        </div>

        {error && (
          <div style={{
            padding: '10px',
            borderRadius: '6px',
            background: 'rgba(229, 62, 62, 0.12)',
            border: '1px solid #e53e3e',
            color: '#fc8181',
            fontSize: '13px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {mode === 'user' ? (
          <form onSubmit={handleUserLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text)' }}>Identifiant</label>
              <input
                required
                type="text"
                placeholder="Ex: aragorn"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-h)'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text)' }}>Mot de passe</label>
              <input
                required
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-h)'
                }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '10px', marginTop: '4px' }}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSpectatorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text)' }}>Code de campagne</label>
              <input
                required
                type="text"
                placeholder="Ex: A7K9P2"
                value={spectatorCode}
                onChange={(e) => setSpectatorCode(e.target.value.toUpperCase())}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-h)',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '15px'
                }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '10px', marginTop: '4px' }}>
              {loading ? 'Recherche...' : 'Rejoindre en spectateur'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}