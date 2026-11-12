import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import ImageInput from './ImageInput';
import { ITEM_PRESETS } from './presets';

export default function InventoryManager({ characterId, mjUid, items = [], inventoryWidth = 5, inventoryHeight = 5, isEditable = true, isMJ = false }) {
  const [editingItem, setEditingItem] = useState(null);
  const [draggedInfo, setDraggedInfo] = useState(null);

  // Hover & Tooltip
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const gridW = inventoryWidth;
  const gridH = inventoryHeight;
  const cellSize = 54;
  const cellGap = 4;

  const createDefaultShape = (w, h) => Array(w * h).fill(1);

  const getItemBaseShape = (item) => {
    const w = item.width || 1;
    const h = item.height || 1;
    if (item.shape && Array.isArray(item.shape)) {
      if (Array.isArray(item.shape[0])) return item.shape.flat();
      if (item.shape.length === w * h) return item.shape;
    }
    return createDefaultShape(w, h);
  };

  // Coordonnées relatives (rx, ry) des cases occupées autour de la case principale (0,0)
  const getItemActiveOffsets = (item) => {
    const w = item.width || 1;
    const h = item.height || 1;
    const rawShape = getItemBaseShape(item);
    const rot = (item.rotation ?? (item.isRotated ? 1 : 0)) % 4;

    const offsets = [];
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (rawShape[r * w + c] === 1) {
          let rx = c;
          let ry = r;

          if (rot === 1) { // 90 deg
            rx = -r;
            ry = c;
          } else if (rot === 2) { // 180 deg
            rx = -c;
            ry = -r;
          } else if (rot === 3) { // 270 deg
            rx = r;
            ry = -c;
          }

          offsets.push({ rx, ry });
        }
      }
    }
    return offsets;
  };

  const handleUpdateGridSize = async (newW, newH) => {
    if (!characterId || !isMJ) return;
    const safeW = Math.max(2, Math.min(12, newW));
    const safeH = Math.max(2, Math.min(12, newH));
    try {
      await updateDoc(doc(db, "characters", characterId), {
        inventoryWidth: safeW,
        inventoryHeight: safeH
      });
    } catch (err) {
      console.error("Erreur mise à jour taille inventaire :", err);
    }
  };

  const canPlaceItem = (item, originSlot, currentInventory, excludeItemId = null) => {
    const startX = originSlot % gridW;
    const startY = Math.floor(originSlot / gridW);
    const offsets = getItemActiveOffsets(item);

    const occupiedSlots = new Set();
    currentInventory.forEach(other => {
      if (other.id === excludeItemId) return;
      const otherSlot = other.slotIndex ?? 0;
      const oX = otherSlot % gridW;
      const oY = Math.floor(otherSlot / gridW);
      const otherOffsets = getItemActiveOffsets(other);

      otherOffsets.forEach(({ rx, ry }) => {
        const gx = oX + rx;
        const gy = oY + ry;
        if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
          occupiedSlots.add(gy * gridW + gx);
        }
      });
    });

    for (const { rx, ry } of offsets) {
      const targetX = startX + rx;
      const targetY = startY + ry;

      if (targetX < 0 || targetX >= gridW || targetY < 0 || targetY >= gridH) {
        return false;
      }

      if (occupiedSlots.has(targetY * gridW + targetX)) {
        return false;
      }
    }

    return true;
  };

  // Rotation sans alerte avec tentative inverse si bloqué
  const handleRotateItem = async (item) => {
    if (!characterId || !isEditable) return;
    const currentRot = item.rotation ?? (item.isRotated ? 1 : 0);
    const originSlot = item.slotIndex ?? 0;

    // 1. Essayer dans le sens horaire (+90 deg)
    const rotCw = (currentRot + 1) % 4;
    const itemCw = { ...item, rotation: rotCw, isRotated: rotCw % 2 === 1 };

    if (canPlaceItem(itemCw, originSlot, items, item.id)) {
      const updatedInventory = items.map(i => i.id === item.id ? itemCw : i);
      try {
        await updateDoc(doc(db, "characters", characterId), { inventory: updatedInventory });
      } catch (err) {
        console.error("Erreur rotation :", err);
      }
      return;
    }

    // 2. Si bloqué, essayer dans le sens anti-horaire (-90 deg)
    const rotCcw = (currentRot + 3) % 4;
    const itemCcw = { ...item, rotation: rotCcw, isRotated: rotCcw % 2 === 1 };

    if (canPlaceItem(itemCcw, originSlot, items, item.id)) {
      const updatedInventory = items.map(i => i.id === item.id ? itemCcw : i);
      try {
        await updateDoc(doc(db, "characters", characterId), { inventory: updatedInventory });
      } catch (err) {
        console.error("Erreur rotation inverse :", err);
      }
      return;
    }

    // 3. Si aucun sens n'est possible, ne rien faire
  };

  const handleDragStart = (e, item, clickedCellX, clickedCellY) => {
    if (!isEditable) return;
    const itemSlot = item.slotIndex ?? 0;
    const itemX = itemSlot % gridW;
    const itemY = Math.floor(itemSlot / gridW);

    const grabDx = clickedCellX - itemX;
    const grabDy = clickedCellY - itemY;

    setDraggedInfo({ item, grabDx, grabDy });
    e.dataTransfer.setData('text/plain', item.id);
  };

  const handleDrop = async (e, targetSlot) => {
    e.preventDefault();
    if (!draggedInfo || !characterId) return;

    const { item, grabDx, grabDy } = draggedInfo;
    const targetX = targetSlot % gridW;
    const targetY = Math.floor(targetSlot / gridW);

    const newOriginX = targetX - grabDx;
    const newOriginY = targetY - grabDy;
    const newOriginSlot = newOriginY * gridW + newOriginX;

    if (canPlaceItem(item, newOriginSlot, items, item.id)) {
      const updatedInventory = items.map(i => 
        i.id === item.id ? { ...i, slotIndex: newOriginSlot } : i
      );

      try {
        await updateDoc(doc(db, "characters", characterId), { inventory: updatedInventory });
      } catch (err) {
        console.error("Erreur déplacement objet :", err);
      }
    }

    setDraggedInfo(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingItem || !characterId || !isMJ) return;

    const updatedInventory = items.map(i => i.id === editingItem.id ? editingItem : i);
    try {
      await updateDoc(doc(db, "characters", characterId), { inventory: updatedInventory });
      setEditingItem(null);
    } catch (err) {
      console.error("Erreur édition objet :", err);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!characterId || !isMJ) return;
    const updatedInventory = items.filter(i => i.id !== itemId);
    try {
      await updateDoc(doc(db, "characters", characterId), { inventory: updatedInventory });
      setHoveredItem(null);
    } catch (err) {
      console.error("Erreur suppression objet :", err);
    }
  };

  const handleDimensionChange = (w, h) => {
    const newW = Math.max(1, parseInt(w, 10) || 1);
    const newH = Math.max(1, parseInt(h, 10) || 1);
    setEditingItem(prev => ({
      ...prev,
      width: newW,
      height: newH,
      shape: createDefaultShape(newW, newH)
    }));
  };

  const toggleShapeCell = (r, c) => {
    if (!editingItem) return;
    const w = editingItem.width || 1;
    const index = r * w + c;
    const currentShape = getItemBaseShape(editingItem);
    const newShape = [...currentShape];
    newShape[index] = newShape[index] === 1 ? 0 : 1;
    setEditingItem(prev => ({ ...prev, shape: newShape }));
  };

  const gridCells = Array.from({ length: gridW * gridH }, (_, i) => i);

  return (
    <div style={{ marginTop: '16px', position: 'relative' }}>
      
      {/* EN-TÊTE ET COMMANDE DE REDIMENSIONNEMENT DE LA GRILLE (MJ) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <strong style={{ fontSize: '14px', color: 'var(--text-h)' }}>Inventaire</strong>
        {isMJ && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)' }}>
            <span>Grille (L * H) :</span>
            <button type="button" onClick={() => handleUpdateGridSize(gridW - 1, gridH)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '11px' }}>-</button>
            <strong style={{ color: 'var(--text-h)' }}>{gridW}</strong>
            <button type="button" onClick={() => handleUpdateGridSize(gridW + 1, gridH)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '11px' }}>+</button>
            <span style={{ margin: '0 2px' }}>*</span>
            <button type="button" onClick={() => handleUpdateGridSize(gridW, gridH - 1)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '11px' }}>-</button>
            <strong style={{ color: 'var(--text-h)' }}>{gridH}</strong>
            <button type="button" onClick={() => handleUpdateGridSize(gridW, gridH + 1)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '11px' }}>+</button>
          </div>
        )}
      </div>

      {/* FORMULAIRE D'ÉDITION D'OBJET (MJ UNIQUEMENT) */}
      {isMJ && editingItem && (
        <form onSubmit={handleSaveEdit} style={{ padding: '16px', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '8px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <strong style={{ color: 'var(--accent)', fontSize: '14px' }}>Éditer l'objet : {editingItem.name}</strong>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input required type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text)' }}>Dimensions :</span>
              <input type="number" min="1" max="4" value={editingItem.width || 1} onChange={e => handleDimensionChange(e.target.value, editingItem.height || 1)} style={{ width: '45px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
              <span style={{ color: 'var(--text)' }}>*</span>
              <input type="number" min="1" max="4" value={editingItem.height || 1} onChange={e => handleDimensionChange(editingItem.width || 1, e.target.value)} style={{ width: '45px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            </div>
          </div>

          <div style={{ background: 'var(--code-bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-h)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
              Forme personnalisée (cliquez sur les cases pour activer/désactiver) :
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${editingItem.width || 1}, 28px)`, gap: '4px' }}>
              {Array.from({ length: (editingItem.width || 1) * (editingItem.height || 1) }).map((_, idx) => {
                const w = editingItem.width || 1;
                const rIdx = Math.floor(idx / w);
                const cIdx = idx % w;
                const shape = getItemBaseShape(editingItem);
                const active = shape[idx];
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
              value={ITEM_PRESETS.some(p => p.url === editingItem.iconUrl) ? editingItem.iconUrl : ''} 
              onChange={e => setEditingItem({ ...editingItem, iconUrl: e.target.value })} 
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }}
            >
              <option value="">-- Icônes par défaut --</option>
              {ITEM_PRESETS.map(p => (
                <option key={p.id} value={p.url}>{p.label}</option>
              ))}
            </select>

            <ImageInput 
              value={editingItem.iconUrl || ''} 
              onChange={url => setEditingItem({ ...editingItem, iconUrl: url })} 
              placeholder="URL ou importer une image..." 
            />
          </div>

          <input type="text" placeholder="Effet (ex: +5 Armure)" value={editingItem.effect || ''} onChange={e => setEditingItem({ ...editingItem, effect: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          <textarea placeholder="Description..." value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} rows={2} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }} />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">Enregistrer</button>
          </div>
        </form>
      )}

      {/* GRILLE INVENTAIRE */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${gridW}, ${cellSize}px)`, 
          gridTemplateRows: `repeat(${gridH}, ${cellSize}px)`, 
          gap: `${cellGap}px`, 
          background: 'var(--code-bg)', 
          padding: '10px', 
          borderRadius: '10px', 
          border: '1px solid var(--border)',
          width: 'fit-content',
          position: 'relative'
        }}
      >
        {gridCells.map((slotIndex) => {
          const cellX = slotIndex % gridW;
          const cellY = Math.floor(slotIndex / gridW);

          const coveringItem = items.find(item => {
            const startSlot = item.slotIndex ?? 0;
            const oX = startSlot % gridW;
            const oY = Math.floor(startSlot / gridW);
            const offsets = getItemActiveOffsets(item);

            return offsets.some(({ rx, ry }) => oX + rx === cellX && oY + ry === cellY);
          });

          const isOrigin = coveringItem && (coveringItem.slotIndex ?? 0) === slotIndex;
          const rotDegree = coveringItem ? (((coveringItem.rotation ?? (coveringItem.isRotated ? 1 : 0)) % 4) * 90) : 0;

          return (
            <div
              key={slotIndex}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, slotIndex)}
              onMouseEnter={() => coveringItem && setHoveredItem(coveringItem)}
              onMouseLeave={() => setHoveredItem(null)}
              onMouseMove={(e) => setTooltipPos({ x: e.clientX + 14, y: e.clientY + 14 })}
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                background: coveringItem ? 'var(--bg)' : 'rgba(255,255,255,0.02)',
                border: coveringItem ? '1px solid var(--accent-border)' : '1px dashed var(--border)',
                borderRadius: '6px',
                position: 'relative',
                boxSizing: 'border-box'
              }}
            >
              {coveringItem && (
                <div
                  draggable={isEditable}
                  onDragStart={(e) => handleDragStart(e, coveringItem, cellX, cellY)}
                  style={{
                    width: '100%',
                    height: '100%',
                    cursor: isEditable ? 'grab' : 'default',
                    position: 'relative'
                  }}
                >
                  {/* IMAGE DANS LA CASE PRINCIPALE (0,0) UNIQUEMENT */}
                  {isOrigin && (
                    <div style={{ position: 'absolute', inset: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img 
                        src={coveringItem.iconUrl || '/assets/jdr-bag.jpg'} 
                        alt={coveringItem.name} 
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.target.onerror = null; e.target.src = '/assets/jdr-bag.jpg'; }}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'contain', 
                          pointerEvents: 'none',
                          transform: `rotate(${rotDegree}deg)`,
                          transition: 'transform 0.2s ease'
                        }} 
                      />
                    </div>
                  )}

                  {/* BOUTONS D'ACTION SUR LA CASE PRINCIPALE (0,0) */}
                  {isOrigin && isEditable && (
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: 2, 
                        right: 2, 
                        display: 'flex', 
                        gap: '2px', 
                        zIndex: 20,
                        pointerEvents: 'auto'
                      }}
                    >
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRotateItem(coveringItem); }} 
                        title="Pivoter (90 deg)"
                        style={{ background: 'rgba(0,0,0,0.85)', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '1px 4px' }}
                      >
                        R
                      </button>

                      {isMJ && (
                        <>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingItem(coveringItem); }} 
                            title="Éditer l'objet"
                            style={{ background: 'rgba(0,0,0,0.85)', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', padding: '1px 4px' }}
                          >
                            E
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(coveringItem.id); }} 
                            title="Supprimer"
                            style={{ background: '#e53e3e', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', padding: '1px 4px' }}
                          >
                            X
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* INFO-BULLE DE SURVOL DE L'OBJET (TOOLTIP) */}
      {hoveredItem && (
        <div style={{
          position: 'fixed',
          top: tooltipPos.y,
          left: tooltipPos.x,
          zIndex: 1000,
          pointerEvents: 'none',
          padding: '10px 14px',
          background: 'rgba(20, 20, 25, 0.95)',
          border: '1px solid var(--accent)',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          maxWidth: '220px',
          backdropFilter: 'blur(4px)'
        }}>
          <strong style={{ color: 'var(--accent)', display: 'block', fontSize: '14px', marginBottom: '2px' }}>
            {hoveredItem.name}
          </strong>
          <span style={{ fontSize: '10px', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
            Dimensions : {hoveredItem.width || 1} * {hoveredItem.height || 1} cases
          </span>

          {hoveredItem.effect && (
            <div style={{ color: '#48bb78', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
              + {hoveredItem.effect}
            </div>
          )}

          {hoveredItem.description && (
            <p style={{ color: 'var(--text)', fontSize: '11px', margin: 0, lineHeight: '1.3' }}>
              {hoveredItem.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}