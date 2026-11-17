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

  if (!isMJ && statuses.length === 0) return null;

  const saveStatuses = async (newStatuses) => {
    if (!characterId) return;
    try {
      const charRef = doc(db, 'characters', characterId);
      await updateDoc(charRef, { statuses: newStatuses });
    } catch (err) {
      console.error('Erreur modification statuts :', err);
    }
  };

  const handleTogglePreset = (preset) => {
    const exists = statuses.some((s) => s.label === preset.label);
    const updated = exists
      ? statuses.filter((s) => s.label !== preset.label)
      : [...statuses, preset];
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
    const updated = statuses.filter((s) => s.label !== label);
    saveStatuses(updated);
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        {statuses.map((st, idx) => {
          const baseColor = st.color || '#718096';
          return (
            <span
              key={idx}
              onClick={() => handleRemove(st.label)}
              title={isMJ ? 'Cliquer pour retirer' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '1px 7px',
                borderRadius: '5px',
                fontSize: '10px',
                fontWeight: '600',
                lineHeight: '1.35',
                color: '#f7fafc',
                backgroundColor: `${baseColor}28`,
                border: `1px solid ${baseColor}88`,
                cursor: isMJ ? 'pointer' : 'default'
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: baseColor,
                  flexShrink: 0
                }}
              />
              {st.label}
              {isMJ && <span style={{ fontSize: '9px', opacity: 0.75, marginLeft: '1px' }}>×</span>}
            </span>
          );
        })}

        {isMJ && (
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="btn-secondary"
            style={{ padding: '1px 6px', fontSize: '10px', borderRadius: '5px', lineHeight: '1.35' }}
          >
            {showAddMenu ? 'Fermer' : '+ Statut'}
          </button>
        )}
      </div>

      {/* Menu d'ajout pour le MJ */}
      {isMJ && showAddMenu && (
        <div
          style={{
            marginTop: '8px',
            padding: '10px',
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text)' }}>Raccourcis d'états :</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PRESET_STATUSES.map((preset, idx) => {
              const isActive = statuses.some((s) => s.label === preset.label);
              return (
                <button
                  type="button"
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
              onChange={(e) => setCustomText(e.target.value)}
              style={{
                flex: 1,
                padding: '4px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid var(--border)'
              }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }}>
              Ajouter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}