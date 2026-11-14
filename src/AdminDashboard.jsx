import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  signOut
} from 'firebase/auth';
import { db, secondaryAuth, auth } from './firebase';
import ImageInput from './ImageInput';
import { formatLoginEmail, formatAuthPassword } from './Login';

export default function AdminDashboard({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Formulaire de création
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [role, setRole] = useState('pj'); // 'mj' | 'pj'
  const [campaignName, setCampaignName] = useState('');
  const [selectedMjUid, setSelectedMjUid] = useState('');

  // Édition d'un utilisateur existant
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: '',
    avatarUrl: '',
    newPassword: '',
    campaignName: '',
    mjUid: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
    });
    return () => unsubscribe();
  }, []);

  const mjList = users.filter((u) => u.role === 'mj');

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setFeedback({ type: 'error', text: 'Identifiant et mot de passe requis.' });
      return;
    }

    if (role === 'pj' && !selectedMjUid) {
      setFeedback({ type: 'error', text: 'Veuillez rattacher ce joueur à un MJ / une campagne.' });
      return;
    }

    setLoading(true);
    try {
      const email = formatLoginEmail(cleanUsername);
      const authPassword = formatAuthPassword(cleanPassword);

      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, authPassword);
      const newUid = cred.user.uid;
      await signOut(secondaryAuth);

      const finalAvatar = avatarUrl.trim() || '/assets/jdr-bag.jpg';

      if (role === 'mj') {
        const finalCampaignName = campaignName.trim() || `Campagne de ${cleanUsername}`;

        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          username: cleanUsername,
          email,
          role: 'mj',
          avatarUrl: finalAvatar,
          campaignName: finalCampaignName,
          managedPassword: cleanPassword,
          createdAt: new Date().toISOString()
        });

        await setDoc(doc(db, 'campaigns', newUid), {
          id: newUid,
          name: finalCampaignName,
          mjUid: newUid,
          spectatorCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          createdAt: new Date().toISOString()
        });
      } else {
        const chosenMj = mjList.find((m) => m.uid === selectedMjUid);

        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          username: cleanUsername,
          email,
          role: 'pj',
          avatarUrl: finalAvatar,
          mjUid: selectedMjUid,
          campaignId: selectedMjUid,
          managedPassword: cleanPassword,
          createdAt: new Date().toISOString()
        });

        // Création immédiate du personnage vierge lié au PJ et au MJ
        await addDoc(collection(db, 'characters'), {
          name: cleanUsername,
          race: '',
          class: '',
          avatarUrl: finalAvatar,
          ownerUid: newUid,
          mjUid: selectedMjUid,
          campaignId: selectedMjUid,
          campaignName: chosenMj?.campaignName || '',
          liveStats: {
            pvCurrent: 100,
            pvMax: 100,
            pmCurrent: 50,
            pmMax: 50
          },
          gold: 0,
          totalPC: 0,
          isSkillsLocked: true,
          skills: [],
          skillCategories: ['Force', 'Dextérité', 'Magie', 'Social / Intelligence'],
          inventory: [],
          inventoryWidth: 5,
          inventoryHeight: 5,
          notes: [],
          createdAt: new Date().toISOString()
        });
      }

      setUsername('');
      setPassword('');
      setAvatarUrl('');
      setCampaignName('');
      setFeedback({ type: 'success', text: `Utilisateur "${cleanUsername}" (${role.toUpperCase()}) créé avec succès.` });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setFeedback({ type: 'error', text: 'Cet identifiant est déjà utilisé.' });
      } else {
        setFeedback({ type: 'error', text: `Erreur : ${err.message}` });
      }
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (user) => {
    setEditingUser(user);
    setEditForm({
      username: user.username || '',
      avatarUrl: user.avatarUrl || '',
      newPassword: '',
      campaignName: user.campaignName || '',
      mjUid: user.mjUid || ''
    });
    setFeedback({ type: '', text: '' });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    setFeedback({ type: '', text: '' });

    try {
      const updates = {
        username: editForm.username.trim(),
        avatarUrl: editForm.avatarUrl.trim() || '/assets/jdr-bag.jpg'
      };

      if (editingUser.role === 'mj') {
        updates.campaignName = editForm.campaignName.trim() || `Campagne de ${editForm.username.trim()}`;
        await setDoc(doc(db, 'campaigns', editingUser.uid), { name: updates.campaignName }, { merge: true });
      }

      if (editingUser.role === 'pj' && editForm.mjUid) {
        updates.mjUid = editForm.mjUid;
        updates.campaignId = editForm.mjUid;

        const charQuery = query(collection(db, 'characters'), where('ownerUid', '==', editingUser.uid));
        const charSnap = await getDocs(charQuery);
        for (const charDoc of charSnap.docs) {
          await updateDoc(doc(db, 'characters', charDoc.id), {
            mjUid: editForm.mjUid,
            campaignId: editForm.mjUid
          });
        }
      }

      // Changement de mot de passe via reconnexion sur l'instance secondaire
      const cleanNewPass = editForm.newPassword.trim();
      if (cleanNewPass) {
        if (editingUser.managedPassword) {
          const cred = await signInWithEmailAndPassword(
            secondaryAuth,
            editingUser.email,
            formatAuthPassword(editingUser.managedPassword)
          );
          await updatePassword(cred.user, formatAuthPassword(cleanNewPass));
          await signOut(secondaryAuth);
          updates.managedPassword = cleanNewPass;
        } else {
          setFeedback({ type: 'error', text: 'Ancien mot de passe inconnu pour ce compte hérité.' });
          setLoading(false);
          return;
        }
      }

      await updateDoc(doc(db, 'users', editingUser.uid), updates);
      setEditingUser(null);
      setFeedback({ type: 'success', text: `Utilisateur "${updates.username}" mis à jour.` });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: `Erreur lors de la modification : ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {/* En-tête Admin */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        background: 'var(--code-bg)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-h)', fontSize: '18px' }}>Administration des utilisateurs</h2>
          <span style={{ fontSize: '12px', color: 'var(--text)' }}>
            Connecté : {currentUser?.email}
          </span>
        </div>
        <button onClick={() => signOut(auth)} className="btn-secondary" style={{ fontSize: '13px' }}>
          Déconnexion
        </button>
      </div>

      {feedback.text && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          borderRadius: '8px',
          fontSize: '13px',
          background: feedback.type === 'error' ? 'rgba(229, 62, 62, 0.12)' : 'rgba(72, 187, 120, 0.12)',
          border: `1px solid ${feedback.type === 'error' ? '#e53e3e' : '#48bb78'}`,
          color: feedback.type === 'error' ? '#fc8181' : '#68d391'
        }}>
          {feedback.text}
        </div>
      )}

      {/* FORMULAIRE DE CRÉATION D'UTILISATEUR */}
      <form
        onSubmit={handleCreateUser}
        style={{
          padding: '20px',
          background: 'var(--code-bg)',
          border: '1px solid var(--accent-border)',
          borderRadius: '10px',
          marginBottom: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <strong style={{ color: 'var(--accent)', fontSize: '15px' }}>Créer un compte (MJ ou PJ)</strong>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            required
            type="text"
            placeholder="Identifiant (ex: gandalf) *"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ flex: 1, minWidth: '180px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
          />

          <input
            required
            type="text"
            placeholder="Mot de passe *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1, minWidth: '180px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-h)',
              fontWeight: 'bold'
            }}
          >
            <option value="pj">Rôle : Joueur (PJ)</option>
            <option value="mj">Rôle : Maître du Jeu (MJ)</option>
          </select>
        </div>

        {role === 'mj' ? (
          <input
            type="text"
            placeholder="Nom de la campagne du MJ (ex: Les Ombres de Roche-Brume)"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
          />
        ) : (
          <select
            required
            value={selectedMjUid}
            onChange={(e) => setSelectedMjUid(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-h)'
            }}
          >
            <option value="">-- Rattacher à un MJ / une Campagne * --</option>
            {mjList.map((mj) => (
              <option key={mj.uid} value={mj.uid}>
                {mj.campaignName || `Campagne de ${mj.username}`} (MJ : {mj.username})
              </option>
            ))}
          </select>
        )}

        <div>
          <span style={{ fontSize: '12px', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
            Photo de profil (PP) :
          </span>
          <ImageInput
            value={avatarUrl}
            onChange={setAvatarUrl}
            placeholder="URL ou importer une photo de profil..."
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '10px', fontSize: '13px' }}>
          {loading ? 'Création en cours...' : 'Créer le compte'}
        </button>
      </form>

      {/* FORMULAIRE DE MODIFICATION */}
      {editingUser && (
        <form
          onSubmit={handleSaveEdit}
          style={{
            padding: '20px',
            background: 'var(--bg)',
            border: '1px solid var(--accent)',
            borderRadius: '10px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <strong style={{ color: 'var(--accent)', fontSize: '14px' }}>
            Modifier le compte : {editingUser.username} ({editingUser.role.toUpperCase()})
          </strong>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              required
              type="text"
              placeholder="Identifiant"
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              style={{ flex: 1, minWidth: '180px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />

            <input
              type="text"
              placeholder="Nouveau mot de passe (laisser vide si inchangé)"
              value={editForm.newPassword}
              onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
              style={{ flex: 1, minWidth: '220px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
          </div>

          {editingUser.role === 'mj' && (
            <input
              type="text"
              placeholder="Nom de la campagne"
              value={editForm.campaignName}
              onChange={(e) => setEditForm({ ...editForm, campaignName: e.target.value })}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
          )}

          {editingUser.role === 'pj' && (
            <select
              value={editForm.mjUid}
              onChange={(e) => setEditForm({ ...editForm, mjUid: e.target.value })}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--code-bg)',
                color: 'var(--text-h)'
              }}
            >
              <option value="">-- MJ / Campagne --</option>
              {mjList.map((mj) => (
                <option key={mj.uid} value={mj.uid}>
                  {mj.campaignName || `Campagne de ${mj.username}`} (MJ : {mj.username})
                </option>
              ))}
            </select>
          )}

          <ImageInput
            value={editForm.avatarUrl}
            onChange={(url) => setEditForm({ ...editForm, avatarUrl: url })}
            placeholder="URL ou importer une nouvelle photo de profil..."
          />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary" style={{ fontSize: '12px' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ fontSize: '12px' }}>
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* LISTE DES UTILISATEURS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <strong style={{ color: 'var(--text-h)', fontSize: '15px' }}>
          Utilisateurs enregistrés ({users.filter(u => u.role !== 'admin').length})
        </strong>

        {users
          .filter((u) => u.role !== 'admin')
          .map((u) => {
            const linkedMj = u.role === 'pj' ? mjList.find((m) => m.uid === u.mjUid) : null;
            return (
              <div
                key={u.uid}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--code-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={u.avatarUrl || '/assets/jdr-bag.jpg'}
                    alt={u.username}
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.target.onerror = null; e.target.src = '/assets/jdr-bag.jpg'; }}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--accent-border)' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: 'var(--text-h)', fontSize: '14px' }}>{u.username}</strong>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        background: u.role === 'mj' ? 'var(--accent)' : 'rgba(72, 187, 120, 0.2)',
                        color: u.role === 'mj' ? '#fff' : '#48bb78'
                      }}>
                        {u.role.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '2px' }}>
                      {u.role === 'mj'
                        ? `Campagne : ${u.campaignName || 'Sans nom'}`
                        : `Campagne : ${linkedMj ? `${linkedMj.campaignName} (MJ: ${linkedMj.username})` : 'Non rattaché'}`}
                      {u.managedPassword ? ` | Mdp : ${u.managedPassword}` : ''}
                    </div>
                  </div>
                </div>

                <button onClick={() => startEditing(u)} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                  Modifier
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}