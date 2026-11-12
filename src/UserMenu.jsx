import { useState, useEffect } from 'react';
import { signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import ImageInput from './ImageInput';

export default function UserMenu({ user, userRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [pseudo, setPseudo] = useState(user?.email?.split('@')[0] || '');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!user?.uid) return;
    const fetchUserData = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.pseudo) setPseudo(data.pseudo);
          if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
        }
      } catch (err) {
        console.error("Erreur chargement profil utilisateur :", err);
      }
    };
    fetchUserData();
  }, [user]);

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });

    try {
      // 1. Mise à jour Firestore (Pseudo & Avatar)
      await updateDoc(doc(db, "users", user.uid), {
        pseudo: pseudo.trim(),
        avatarUrl: avatarUrl.trim()
      });

      // 2. Mise à jour Mot de Passe avec le padding _JDR_
      if (newPassword.trim()) {
        const paddedPassword = newPassword.trim() + "_JDR_";
        await updatePassword(auth.currentUser, paddedPassword);
      }

      setStatusMsg({ type: 'success', text: 'Profil mis à jour avec succès !' });
      setNewPassword('');
      setTimeout(() => setShowModal(false), 1500);
    } catch (err) {
      console.error("Erreur modification compte :", err);

      if (err.code === 'auth/requires-recent-login') {
        setStatusMsg({ type: 'error', text: 'Par sécurité, veuillez vous déconnecter puis vous reconnecter pour changer de mot de passe.' });
      } else {
        setStatusMsg({ type: 'error', text: 'Erreur : ' + err.message });
      }
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
          justify: 'center'
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={pseudo} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '13px', opacity: 0.5 }}>?</span>
          )}
        </div>
        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{pseudo} ({userRole})</span>
        <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
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
            onClick={() => setShowModal(true)}
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
          justify: 'center',
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
              gap: '14px'
            }}
          >
            <h3 style={{ margin: 0, color: 'var(--text-h)' }}>Paramètres du compte</h3>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>Nom d'utilisateur / Pseudo</label>
              <input 
                required 
                type="text" 
                value={pseudo} 
                onChange={e => setPseudo(e.target.value)} 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', boxSizing: 'border-box' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>Photo de profil</label>
              <ImageInput 
                value={avatarUrl} 
                onChange={url => setAvatarUrl(url)} 
                placeholder="URL ou importer une photo..." 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', boxSizing: 'border-box' }} 
              />
            </div>

            {statusMsg.text && (
              <div style={{ 
                padding: '8px', borderRadius: '4px', fontSize: '12px',
                background: statusMsg.type === 'error' ? 'rgba(229, 62, 62, 0.15)' : 'rgba(72, 187, 120, 0.15)',
                color: statusMsg.type === 'error' ? '#e53e3e' : '#48bb78',
                border: `1px solid ${statusMsg.type === 'error' ? '#e53e3e' : '#48bb78'}`
              }}>
                {statusMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
              <button type="submit" className="btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}