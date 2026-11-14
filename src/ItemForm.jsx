import { useState } from 'react';
import ImageInput from './ImageInput';
import { ITEM_PRESETS } from './presets';

export function createDefaultShape(w, h) {
  return Array(w * h).fill(1);
}

export function getItemBaseShape(item) {
  const w = item?.width || 1;
  const h = item?.height || 1;
  if (item?.shape && Array.isArray(item.shape)) {
    if (Array.isArray(item.shape[0])) return item.shape.flat();
    if (item.shape.length === w * h) return item.shape;
  }
  return createDefaultShape(w, h);
}

export default function ItemForm({
  initialItem = null,
  title,
  submitLabel = 'Enregistrer',
  onSubmit,
  onCancel,
  players = [],
  allowDirectGive = false
}) {
  const [formData, setFormData] = useState(() => ({
    name: initialItem?.name || '',
    iconUrl: initialItem?.iconUrl || '',
    description: initialItem?.description || '',
    width: initialItem?.width || 1,
    height: initialItem?.height || 1,
    shape: initialItem ? getItemBaseShape(initialItem) : createDefaultShape(1, 1),
    effect: initialItem?.effect || ''
  }));
  const [targetPlayerId, setTargetPlayerId] = useState('');

  const handleDimensionChange = (w, h) => {
    const newW = Math.max(1, Math.min(4, parseInt(w, 10) || 1));
    const newH = Math.max(1, Math.min(4, parseInt(h, 10) || 1));
    setFormData(prev => ({
      ...prev,
      width: newW,
      height: newH,
      shape: createDefaultShape(newW, newH)
    }));
  };

  const toggleShapeCell = (r, c) => {
    const w = formData.width || 1;
    const index = r * w + c;
    const newShape = [...formData.shape];
    newShape[index] = newShape[index] === 1 ? 0 : 1;
    if (!newShape.includes(1)) return;
    setFormData(prev => ({ ...prev, shape: newShape }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const finalIconUrl = formData.iconUrl.trim() || ITEM_PRESETS[0]?.url || '/assets/jdr-bag.jpg';
    const itemPayload = {
      ...(initialItem || {}),
      id: initialItem?.id || crypto.randomUUID(),
      name: formData.name.trim(),
      iconUrl: finalIconUrl,
      description: formData.description.trim(),
      width: parseInt(formData.width, 10) || 1,
      height: parseInt(formData.height, 10) || 1,
      shape: formData.shape,
      rotation: initialItem?.rotation ?? (initialItem?.isRotated ? 1 : 0),
      isRotated: initialItem?.isRotated ?? false,
      effect: formData.effect.trim()
    };

    onSubmit(itemPayload, targetPlayerId);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: '16px',
        background: 'var(--bg)',
        border: '1px solid var(--accent)',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <strong style={{ color: 'var(--accent)', fontSize: '14px' }}>
        {title || (initialItem ? `Modifier l'objet : ${initialItem.name}` : 'Créer un nouvel objet')}
      </strong>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          required
          type="text"
          placeholder="Nom de l'objet *"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
        />

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text)' }}>Taille (L x H) :</span>
          <input
            type="number"
            min="1"
            max="4"
            value={formData.width}
            onChange={e => handleDimensionChange(e.target.value, formData.height)}
            style={{ width: '48px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }}
          />
          <span style={{ color: 'var(--text)' }}>x</span>
          <input
            type="number"
            min="1"
            max="4"
            value={formData.height}
            onChange={e => handleDimensionChange(formData.width, e.target.value)}
            style={{ width: '48px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      {/* Sélecteur de forme personnalisée */}
      <div style={{ background: 'var(--code-bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-h)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
          Forme personnalisée (cliquez sur les cases pour activer/désactiver) :
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${formData.width || 1}, 28px)`, gap: '4px' }}>
          {Array.from({ length: (formData.width || 1) * (formData.height || 1) }).map((_, idx) => {
            const w = formData.width || 1;
            const rIdx = Math.floor(idx / w);
            const cIdx = idx % w;
            const active = formData.shape[idx];
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleShapeCell(rIdx, cIdx)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  border: '1px solid var(--accent-border)',
                  background: active === 1 ? 'var(--accent)' : 'transparent',
                  cursor: 'pointer',
                  opacity: active === 1 ? 1 : 0.3
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={ITEM_PRESETS.some(p => p.url === formData.iconUrl) ? formData.iconUrl : ''}
          onChange={e => setFormData({ ...formData, iconUrl: e.target.value })}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'var(--code-bg)',
            color: 'var(--text-h)'
          }}
        >
          <option value="">-- Icônes par défaut --</option>
          {ITEM_PRESETS.map(p => (
            <option key={p.id} value={p.url}>{p.label}</option>
          ))}
        </select>

        <div style={{ flex: 2, minWidth: '220px' }}>
          <ImageInput
            value={formData.iconUrl}
            onChange={url => setFormData({ ...formData, iconUrl: url })}
            placeholder="URL ou importer une image..."
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Effet (ex: +5 Armure, +10 PV)"
          value={formData.effect}
          onChange={e => setFormData({ ...formData, effect: e.target.value })}
          style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
        />

        {allowDirectGive && (
          <select
            value={targetPlayerId}
            onChange={e => setTargetPlayerId(e.target.value)}
            style={{
              flex: 2,
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--code-bg)',
              color: 'var(--text-h)'
            }}
          >
            <option value="">Placer dans la Banque d'objets</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>Donner directement à {p.name}</option>
            ))}
          </select>
        )}
      </div>

      <textarea
        placeholder="Description..."
        value={formData.description}
        onChange={e => setFormData({ ...formData, description: e.target.value })}
        rows={2}
        style={{
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          background: 'var(--code-bg)',
          color: 'var(--text-h)'
        }}
      />

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            Annuler
          </button>
        )}
        <button type="submit" className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}