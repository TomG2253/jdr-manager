import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const PRESET_STATUSES = [
  { label: 'Empoisonné', color: '#38a169' },
  { label: 'Étourdi', color: '#d69e2e' },
  { label: 'Brûlé', color: '#dd6b20' },
  { label: 'Saignement', color: '#e53e3e' },
  { label: 'Sommeil', color: '#3182ce' },
  { label: 'Inconscient', color: '#805ad5' }
];

export default function StatusManager({ characterId, statuses = [], isMJ }) {
  const [customText, setCustomText] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const saveStatuses = async (newStatuses) => {
    if (!characterId) return;
    try {
      const charRef = doc(db, "characters", characterId);
      await updateDoc(charRef, { statuses: newStatuses });
    } catch (err) {
      console.error("Erreur modification statuts :", err);
    }
  };

  const handleTogglePreset = (preset) => {
    const exists = statuses.some(s => s.label === preset.label);
    let updated;
    if (exists) {
      updated = statuses.filter(s => s.label !== preset.label);
    } else {
      updated = [...statuses, preset];
    }
    saveStatuses(updated);
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!customText.trim()) return;
    const newStatus = { label: customText.trim(), color: '#718096' };
    saveStatuses([...statuses, newStatus]);
    setCustomText('');
  };

  const handleRemove = (label) => {
    if (!isMJ) return;
    const updated = statuses.filter(s => s.label !== label);
    saveStatuses(updated);
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {statuses.map((st, idx) => (
          <span 
            key={idx}
            onClick={() => handleRemove(st.label)}
            title={isMJ ? "Cliquer pour retirer" : undefined}
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#fff',
              backgroundColor: st.color,
              cursor: isMJ ? 'pointer' : 'default',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {st.label}
            {isMJ && <span style={{ fontSize: '9px', opacity: 0.8 }}>✕</span>}
          </span>
        ))}

        {isMJ && (
          <button 
            onClick={() => setShowAddMenu(!showAddMenu)} 
            className="btn-secondary" 
            style={{ padding: '2px 6px', fontSize: '11px', borderRadius: '12px' }}
          >
            {showAddMenu ? 'Fermer' : '+ Statut'}
          </button>
        )}
      </div>

      {/* Menu d'ajout pour le MJ */}
      {isMJ && showAddMenu && (
        <div style={{ marginTop: '10px', padding: '10px', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text)' }}>Raccourcis d'états :</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PRESET_STATUSES.map((preset, idx) => {
              const isActive = statuses.some(s => s.label === preset.label);
              return (
                <button
                  key={idx}
                  onClick={() => handleTogglePreset(preset)}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    border: '1px solid var(--border)',
                    background: isActive ? preset.color : 'var(--bg)',
                    color: isActive ? '#fff' : 'var(--text-h)',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleAddCustom} style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <input 
              type="text" 
              placeholder="Autre état personnalisé..." 
              value={customText} 
              onChange={e => setCustomText(e.target.value)}
              style={{ flex: 1, padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }}>Ajouter</button>
          </form>
        </div>
      )}
    </div>
  );
}