import { useState, useEffect } from 'react';
import {
  signOut,
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import ImageInput from './ImageInput';
import { formatLoginEmail, formatAuthPassword } from './Login';
import { resolveAssetUrl } from './presets';

export default function UserMenu({ user, userRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [username, setUsername] = useState(user?.email?.split('@')[0] || '');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [managedPassword, setManagedPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (userSnap) => {
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUsername(data.username || data.pseudo || user.email?.split('@')[0] || '');
        setAvatarUrl(data.avatarUrl || '');
        setManagedPassword(data.managedPassword || '');
      }
    });
    return () => unsubscribe();
  }, [user]);

  const reauthIfNeeded = async () => {
    if (!auth.currentUser?.email || !managedPassword) return;
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      formatAuthPassword(managedPassword)
    );
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    const cleanUsername = username.trim();
    const cleanNewPassword = newPassword.trim();

    if (!cleanUsername) {
      setStatusMsg({ type: 'error', text: "Le nom d'utilisateur est obligatoire." });
      return;
    }

    setLoading(true);
    try {
      const firestoreUpdates = {
        username: cleanUsername,
        avatarUrl: avatarUrl.trim() || './assets/jdr-bag.jpg'
      };

      // 1. Mise à jour de l'identifiant de connexion (@jdr.com) si modifié
      const targetEmail = formatLoginEmail(cleanUsername);
      if (auth.currentUser && auth.currentUser.email !== targetEmail) {
        try {
          await updateEmail(auth.currentUser, targetEmail);
          firestoreUpdates.email = targetEmail;
        } catch (emailErr) {
          if (emailErr.code === 'auth/requires-recent-login') {
            await reauthIfNeeded();
            await updateEmail(auth.currentUser, targetEmail);
            firestoreUpdates.email = targetEmail;
          } else if (emailErr.code === 'auth/email-already-in-use') {
            setStatusMsg({ type: 'error', text: "Cet identifiant est déjà pris par un autre utilisateur." });
            setLoading(false);
            return;
          } else {
            throw emailErr;
          }
        }
      }

      // 2. Mise à jour du mot de passe (avec suffixe _JDR_ et synchro Admin)
      if (cleanNewPassword) {
        const paddedPassword = formatAuthPassword(cleanNewPassword);
        try {
          await updatePassword(auth.currentUser, paddedPassword);
        } catch (passErr) {
          if (passErr.code === 'auth/requires-recent-login') {
            await reauthIfNeeded();
            await updatePassword(auth.currentUser, paddedPassword);
          } else {
            throw passErr;
          }
        }
        firestoreUpdates.managedPassword = cleanNewPassword;
      }

      // 3. Mise à jour Firestore (synchronisé en direct avec l'Admin)
      await updateDoc(doc(db, "users", user.uid), firestoreUpdates);

      setStatusMsg({ type: 'success', text: 'Profil mis à jour avec succès !' });
      setNewPassword('');
      setTimeout(() => {
        setShowModal(false);
        setStatusMsg({ type: '', text: '' });
      }, 1200);
    } catch (err) {
      console.error("Erreur modification compte :", err);
      setStatusMsg({ type: 'error', text: `Erreur : ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* BOUTON PROFIL HEADER */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--code-bg)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '4px 12px 4px 6px',
          cursor: 'pointer',
          color: 'var(--text-h)'
        }}
      >
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img
            src={resolveAssetUrl(avatarUrl)}
            alt={username}
            referrerPolicy="no-referrer"
            onError={(e) => { e.target.onerror = null; e.target.src = './assets/jdr-bag.jpg'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
          {username} ({userRole?.toUpperCase()})
        </span>
      </button>

      {/* MENU DÉROULANT */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'absolute',
            top: '40px',
            right: 0,
            width: '180px',
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow)',
            zIndex: 100,
            overflow: 'hidden'
          }}
        >
          <button
            onClick={() => {
              setStatusMsg({ type: '', text: '' });
              setNewPassword('');
              setShowModal(true);
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: 'none',
              background: 'none',
              color: 'var(--text-h)',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              borderBottom: '1px solid var(--border)'
            }}
          >
            Mon compte
          </button>
          <button
            onClick={() => signOut(auth)}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: 'none',
              background: 'none',
              color: '#e53e3e',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold'
            }}
          >
            Déconnexion
          </button>
        </div>
      )}

      {/* MODAL ÉDITION DU COMPTE */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <form
            onSubmit={handleSaveAccount}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: 'var(--bg)',
              border: '1px solid var(--accent-border)',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              textAlign: 'left'
            }}
          >
            <h3 style={{ margin: 0, color: 'var(--text-h)' }}>Paramètres du compte</h3>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>
                Identifiant (connexion et affichage)
              </label>
              <input
                required
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>
                Photo de profil (PP)
              </label>
              <ImageInput
                value={avatarUrl}
                onChange={url => setAvatarUrl(url)}
                placeholder="URL ou importer une photo..."
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>
                Nouveau mot de passe (laisser vide si inchangé)
              </label>
              <input
                type="password"
                placeholder="Nouveau mot de passe..."
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', boxSizing: 'border-box' }}
              />
            </div>

            {statusMsg.text && (
              <div style={{
                padding: '8px',
                borderRadius: '4px',
                fontSize: '12px',
                background: statusMsg.type === 'error' ? 'rgba(229, 62, 62, 0.15)' : 'rgba(72, 187, 120, 0.15)',
                color: statusMsg.type === 'error' ? '#e53e3e' : '#48bb78',
                border: `1px solid ${statusMsg.type === 'error' ? '#e53e3e' : '#48bb78'}`
              }}>
                {statusMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" disabled={loading}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}