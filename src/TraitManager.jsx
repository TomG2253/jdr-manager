import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const PRESET_TRAITS = [
  { label: 'Vision nocturne', type: 'positive' },
  { label: 'Résistance au feu', type: 'positive' },
  { label: 'Pied léger', type: 'positive' },
  { label: 'Alcoolique', type: 'negative' },
  { label: 'Phobie des araignées', type: 'negative' },
  { label: 'Maudit', type: 'negative' }
];

export default function TraitManager({ characterId, traits = [], isMJ }) {
  const [customLabel, setCustomLabel] = useState('');
  const [customType, setCustomType] = useState('positive');
  const [showAddMenu, setShowAddMenu] = useState(false);

  if (!isMJ && traits.length === 0) return null;

  const saveTraits = async (newTraits) => {
    if (!characterId) return;
    try {
      const charRef = doc(db, 'characters', characterId);
      await updateDoc(charRef, { traits: newTraits });
    } catch (err) {
      console.error('Erreur sauvegarde des traits :', err);
    }
  };

  const handleTogglePreset = (preset) => {
    if (!isMJ) return;
    const exists = traits.some((t) => t.label === preset.label);
    const updated = exists
      ? traits.filter((t) => t.label !== preset.label)
      : [...traits, preset];
    saveTraits(updated);
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!isMJ || !customLabel.trim()) return;
    const newTrait = { label: customLabel.trim(), type: customType };
    saveTraits([...traits, newTrait]);
    setCustomLabel('');
  };

  const handleRemove = (label) => {
    if (!isMJ) return;
    const updated = traits.filter((t) => t.label !== label);
    saveTraits(updated);
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        {traits.map((tr, idx) => {
          const isPos = tr.type === 'positive';
          return (
            <span
              key={idx}
              onClick={() => handleRemove(tr.label)}
              title={isMJ ? 'Cliquer pour retirer' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '1px 7px',
                borderRadius: '5px',
                fontSize: '10px',
                fontWeight: '500',
                lineHeight: '1.35',
                color: isPos ? '#9ae6b4' : '#feb2b2',
                backgroundColor: isPos
                  ? 'rgba(72, 187, 120, 0.12)'
                  : 'rgba(245, 101, 101, 0.12)',
                border: isPos
                  ? '1px solid rgba(72, 187, 120, 0.35)'
                  : '1px solid rgba(245, 101, 101, 0.35)',
                cursor: isMJ ? 'pointer' : 'default'
              }}
            >
              {tr.label}
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
            {showAddMenu ? 'Fermer' : '+ Trait'}
          </button>
        )}
      </div>

      {/* Menu d'ajout réservé au MJ */}
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
          <span style={{ fontSize: '11px', color: 'var(--text)' }}>Traits prédéfinis :</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PRESET_TRAITS.map((preset, idx) => {
              const isActive = traits.some((t) => t.label === preset.label);
              const isPos = preset.type === 'positive';
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
                    background: isActive ? (isPos ? '#2e7d32' : '#c62828') : 'var(--bg)',
                    color: isActive ? '#fff' : 'var(--text-h)',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleAddCustom} style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Nouveau trait personnalisé..."
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              style={{
                flex: 2,
                padding: '4px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid var(--border)'
              }}
            />
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              style={{
                flex: 1,
                padding: '4px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-h)'
              }}
            >
              <option value="positive">Positif (Vert)</option>
              <option value="negative">Négatif (Rouge)</option>
            </select>
            <button type="submit" className="btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }}>
              Ajouter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}