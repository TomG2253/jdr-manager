import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import NpcImagePicker from './NpcImagePicker';
import { resolveAssetUrl } from './presets';

export default function NpcManager({ mjUid, onGoToCombat }) {
  const [npcs, setNpcs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlign, setFilterAlign] = useState('ALL'); // 'ALL' | 'ally' | 'enemy' | 'none'

  // Formulaire création / édition
  const [showForm, setShowForm] = useState(false);
  const [editingNpc, setEditingNpc] = useState(null);
  const [form, setForm] = useState({
    name: '',
    avatarUrl: '',
    defaultAlignment: '',
    note: ''
  });

  // Modale "Envoyer au combat" (choix obligatoire Allié / Adversaire)
  const [deployNpc, setDeployNpc] = useState(null);
  const [deployAlignment, setDeployAlignment] = useState('');
  const [deployCount, setDeployCount] = useState(1);
  const [deployStatus, setDeployStatus] = useState('');

  useEffect(() => {
    if (!mjUid) return;
    const bankRef = doc(db, 'npcBanks', mjUid);
    const unsub = onSnapshot(bankRef, (snap) => {
      if (snap.exists()) {
        setNpcs(snap.data().npcs || []);
      } else {
        setDoc(bankRef, { npcs: [] });
      }
    });
    return () => unsub();
  }, [mjUid]);

  const saveNpcs = async (updatedList) => {
    if (!mjUid) return;
    await setDoc(doc(db, 'npcBanks', mjUid), { npcs: updatedList }, { merge: true });
  };

  const openCreate = () => {
    setEditingNpc(null);
    setForm({ name: '', avatarUrl: '', defaultAlignment: '', note: '' });
    setShowForm(!showForm);
  };

  const openEdit = (npc) => {
    setShowForm(false);
    setEditingNpc(npc);
    setForm({
      name: npc.name || '',
      avatarUrl: npc.avatarUrl || '',
      defaultAlignment: npc.defaultAlignment || '',
      note: npc.note || ''
    });
  };

  const handleSaveNpc = async (e) => {
    e.preventDefault();
    const cleanName = form.name.trim();
    if (!cleanName) return;

    const finalAvatar = form.avatarUrl.trim() || './assets/jdr-bag.jpg';

    if (editingNpc) {
      const updated = npcs.map((n) =>
        n.id === editingNpc.id
          ? {
              ...n,
              name: cleanName,
              avatarUrl: finalAvatar,
              defaultAlignment: form.defaultAlignment,
              note: form.note.trim()
            }
          : n
      );
      await saveNpcs(updated);
      setEditingNpc(null);
    } else {
      const newNpc = {
        id: crypto.randomUUID(),
        name: cleanName,
        avatarUrl: finalAvatar,
        defaultAlignment: form.defaultAlignment,
        note: form.note.trim()
      };
      await saveNpcs([...npcs, newNpc]);
      setShowForm(false);
    }
  };

  const handleDeleteNpc = async (npcId) => {
    const updated = npcs.filter((n) => n.id !== npcId);
    await saveNpcs(updated);
    if (editingNpc?.id === npcId) setEditingNpc(null);
  };

  const openDeployModal = (npc) => {
    setDeployNpc(npc);
    setDeployAlignment(npc.defaultAlignment || '');
    setDeployCount(1);
    setDeployStatus('');
  };

  const handleConfirmDeploy = async (e) => {
    e.preventDefault();
    if (!deployNpc || !deployAlignment || !mjUid) return;

    const count = Math.max(1, Math.min(20, parseInt(deployCount, 10) || 1));
    const combatRef = doc(db, 'combats', mjUid);
    const snap = await getDoc(combatRef);
    const currentData = snap.exists() ? snap.data() : { participants: [], activeIndex: 0, round: 1 };
    const existingList = currentData.participants || [];

    const newEntries = Array.from({ length: count }, (_, idx) => ({
      id: crypto.randomUUID(),
      type: 'npc',
      npcId: deployNpc.id,
      name: count > 1 ? `${deployNpc.name} ${idx + 1}` : deployNpc.name,
      avatarUrl: deployNpc.avatarUrl,
      alignment: deployAlignment // 'ally' | 'enemy'
    }));

    await setDoc(
      combatRef,
      {
        participants: [...existingList, ...newEntries],
        activeIndex: currentData.activeIndex || 0,
        round: currentData.round || 1
      },
      { merge: true }
    );

    setDeployNpc(null);
    setDeployStatus(`${count > 1 ? `${count}x ` : ''}${deployNpc.name} envoyé(s) en combat.`);
    setTimeout(() => setDeployStatus(''), 3500);
  };

  const filteredNpcs = npcs.filter((n) => {
    const align = n.defaultAlignment || 'none';
    if (filterAlign !== 'ALL' && align !== filterAlign) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (n.name || '').toLowerCase().includes(q) ||
      (n.note || '').toLowerCase().includes(q)
    );
  });

  const pillStyle = (active) => ({
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '14px',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--bg)',
    color: active ? '#fff' : 'var(--text)',
    cursor: 'pointer',
    fontWeight: active ? 'bold' : 'normal'
  });

  return (
    <div style={{ padding: '20px', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '12px' }}>
      {/* EN-TÊTE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-h)' }}>Répertoire des PNJ</h3>
          <span style={{ fontSize: '12px', color: 'var(--text)' }}>
            Bibliothèque de personnages et créatures prêts à rejoindre le combat
          </span>
        </div>

        <button type="button" onClick={openCreate} className="btn-primary" style={{ fontSize: '13px' }}>
          {showForm ? 'Annuler' : '+ Nouveau PNJ'}
        </button>
      </div>

      {deployStatus && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: '14px',
            borderRadius: '8px',
            background: 'rgba(72, 187, 120, 0.14)',
            border: '1px solid #48bb78',
            color: '#68d391',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <span>{deployStatus}</span>
          {onGoToCombat && (
            <button type="button" onClick={onGoToCombat} className="btn-primary" style={{ fontSize: '11px', padding: '4px 10px' }}>
              Voir le combat
            </button>
          )}
        </div>
      )}

      {/* FORMULAIRE CRÉATION / ÉDITION */}
      {(showForm || editingNpc) && (
        <form
          onSubmit={handleSaveNpc}
          style={{
            padding: '16px',
            background: 'var(--bg)',
            border: '1px solid var(--accent-border)',
            borderRadius: '10px',
            marginBottom: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <strong style={{ color: 'var(--text-h)', fontSize: '14px' }}>
            {editingNpc ? `Modifier : ${editingNpc.name}` : 'Créer un PNJ'}
          </strong>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              required
              type="text"
              placeholder="Nom du PNJ / Monstre *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ flex: 2, minWidth: '170px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
            />

            <select
              value={form.defaultAlignment}
              onChange={(e) => setForm({ ...form, defaultAlignment: e.target.value })}
              style={{
                flex: 1,
                minWidth: '170px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--code-bg)',
                color: 'var(--text-h)'
              }}
            >
              <option value="">Alignement par défaut : Aucun</option>
              <option value="ally">Allié (Bleu)</option>
              <option value="enemy">Adversaire (Rouge)</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Note courte facultative (ex: Garde de la porte, Embuscade...)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
          />

          <NpcImagePicker
            value={form.avatarUrl}
            onChange={(url) => setForm({ ...form, avatarUrl: url })}
          />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingNpc(null);
              }}
              className="btn-secondary"
              style={{ fontSize: '12px' }}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" style={{ fontSize: '12px' }}>
              {editingNpc ? 'Enregistrer' : 'Créer le PNJ'}
            </button>
          </div>
        </form>
      )}

      {/* RECHERCHE & FILTRES */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Rechercher un PNJ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '170px',
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-h)',
            fontSize: '13px'
          }}
        />

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setFilterAlign('ALL')} style={pillStyle(filterAlign === 'ALL')}>
            Tous ({npcs.length})
          </button>
          <button type="button" onClick={() => setFilterAlign('ally')} style={pillStyle(filterAlign === 'ally')}>
            Alliés
          </button>
          <button type="button" onClick={() => setFilterAlign('enemy')} style={pillStyle(filterAlign === 'enemy')}>
            Adversaires
          </button>
          <button type="button" onClick={() => setFilterAlign('none')} style={pillStyle(filterAlign === 'none')}>
            Non définis
          </button>
        </div>
      </div>

      {/* GRILLE DES PNJ */}
      {filteredNpcs.length === 0 ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic', fontSize: '14px', margin: 0 }}>
          Aucun PNJ enregistré.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px'
          }}
        >
          {filteredNpcs.map((npc) => {
            const borderColor =
              npc.defaultAlignment === 'ally'
                ? '#3182ce'
                : npc.defaultAlignment === 'enemy'
                ? '#e53e3e'
                : 'var(--border)';

            return (
              <div
                key={npc.id}
                style={{
                  background: 'var(--bg)',
                  border: `1px solid ${borderColor}`,
                  borderLeft: `4px solid ${borderColor}`,
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={resolveAssetUrl(npc.avatarUrl)}
                    alt={npc.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = './assets/jdr-bag.jpg';
                    }}
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '8px',
                      objectFit: 'contain',
                      background: 'var(--code-bg)',
                      border: '1px solid var(--border)',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: 'var(--text-h)', fontSize: '14px', wordBreak: 'break-word' }}>
                      {npc.name}
                    </strong>
                    {npc.defaultAlignment && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: '2px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: npc.defaultAlignment === 'ally' ? 'rgba(49,130,206,0.2)' : 'rgba(229,62,62,0.2)',
                          color: npc.defaultAlignment === 'ally' ? '#63b3ed' : '#fc8181'
                        }}
                      >
                        {npc.defaultAlignment === 'ally' ? 'Allié' : 'Adversaire'}
                      </span>
                    )}
                    {npc.note && (
                      <div style={{ fontSize: '11px', color: 'var(--text)', marginTop: '3px', lineHeight: 1.3 }}>
                        {npc.note}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => openDeployModal(npc)}
                    className="btn-primary"
                    style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }}
                  >
                    + Combat
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(npc)}
                    title="Modifier"
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '5px 8px' }}
                  >
                    Editer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNpc(npc.id)}
                    title="Supprimer"
                    style={{
                      background: '#e53e3e',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    X
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE : ENVOYER AU COMBAT (ALIGNEMENT OBLIGATOIRE) */}
      {deployNpc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <form
            onSubmit={handleConfirmDeploy}
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--bg)',
              border: '1px solid var(--accent-border)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <strong style={{ fontSize: '16px', color: 'var(--text-h)' }}>
              Ajouter au combat : {deployNpc.name}
            </strong>

            <div>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}>
                Camp dans ce combat (obligatoire) * :
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDeployAlignment('ally')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: deployAlignment === 'ally' ? '2px solid #3182ce' : '1px solid var(--border)',
                    background: deployAlignment === 'ally' ? 'rgba(49, 130, 206, 0.22)' : 'var(--code-bg)',
                    color: deployAlignment === 'ally' ? '#63b3ed' : 'var(--text)',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Allié (Bleu)
                </button>
                <button
                  type="button"
                  onClick={() => setDeployAlignment('enemy')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: deployAlignment === 'enemy' ? '2px solid #e53e3e' : '1px solid var(--border)',
                    background: deployAlignment === 'enemy' ? 'rgba(229, 62, 62, 0.22)' : 'var(--code-bg)',
                    color: deployAlignment === 'enemy' ? '#fc8181' : 'var(--text)',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Adversaire (Rouge)
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>
                Nombre d'exemplaires :
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={deployCount}
                onChange={(e) => setDeployCount(e.target.value)}
                style={{
                  width: '90px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--code-bg)',
                  color: 'var(--text-h)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={() => setDeployNpc(null)} className="btn-secondary">
                Annuler
              </button>
              <button
                type="submit"
                disabled={!deployAlignment}
                className="btn-primary"
                style={{ opacity: deployAlignment ? 1 : 0.45 }}
              >
                Ajouter au combat
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}