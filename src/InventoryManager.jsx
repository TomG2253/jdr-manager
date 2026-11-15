import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import ItemForm, { getItemBaseShape } from './ItemForm';
import { resolveAssetUrl } from './presets';

export default function InventoryManager({
  characterId,
  mjUid,
  items = [],
  inventoryWidth = 5,
  inventoryHeight = 5,
  isEditable = true,
  isMJ = false
}) {
  const [editingItem, setEditingItem] = useState(null);
  const [draggedInfo, setDraggedInfo] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const gridW = inventoryWidth;
  const gridH = inventoryHeight;
  const cellSize = 54;
  const cellGap = 4;

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
          if (rot === 1) {
            rx = -r;
            ry = c;
          } else if (rot === 2) {
            rx = -c;
            ry = -r;
          } else if (rot === 3) {
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

  const handleRotateItem = async (item) => {
    if (!characterId || !isEditable) return;
    const currentRot = item.rotation ?? (item.isRotated ? 1 : 0);
    const originSlot = item.slotIndex ?? 0;

    // 1. Sens horaire (+90 deg)
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

    // 2. Sens anti-horaire (-90 deg) si bloqué
    const rotCcw = (currentRot + 3) % 4;
    const itemCcw = { ...item, rotation: rotCcw, isRotated: rotCcw % 2 === 1 };
    if (canPlaceItem(itemCcw, originSlot, items, item.id)) {
      const updatedInventory = items.map(i => i.id === item.id ? itemCcw : i);
      try {
        await updateDoc(doc(db, "characters", characterId), { inventory: updatedInventory });
      } catch (err) {
        console.error("Erreur rotation inverse :", err);
      }
    }
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

  const handleSaveEdit = async (updatedItem) => {
    if (!characterId || !isMJ) return;
    const updatedInventory = items.map(i => i.id === updatedItem.id ? updatedItem : i);
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

  const gridCells = Array.from({ length: gridW * gridH }, (_, i) => i);

  return (
    <div style={{ marginTop: '16px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <strong style={{ fontSize: '14px', color: 'var(--text-h)' }}>Inventaire</strong>
        {isMJ && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)' }}>
            <span>Grille (L x H) :</span>
            <button type="button" onClick={() => handleUpdateGridSize(gridW - 1, gridH)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '11px' }}>-</button>
            <strong style={{ color: 'var(--text-h)' }}>{gridW}</strong>
            <button type="button" onClick={() => handleUpdateGridSize(gridW + 1, gridH)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '11px' }}>+</button>
            <span style={{ margin: '0 2px' }}>x</span>
            <button type="button" onClick={() => handleUpdateGridSize(gridW, gridH - 1)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '11px' }}>-</button>
            <strong style={{ color: 'var(--text-h)' }}>{gridH}</strong>
            <button type="button" onClick={() => handleUpdateGridSize(gridW, gridH + 1)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '11px' }}>+</button>
          </div>
        )}
      </div>

      {/* PANNEAU D'ÉDITION NORMALISÉ (MJ UNIQUEMENT) */}
      {isMJ && editingItem && (
        <ItemForm
          initialItem={editingItem}
          title={`Modifier l'objet : ${editingItem.name}`}
          submitLabel="Enregistrer"
          onSubmit={handleSaveEdit}
          onCancel={() => setEditingItem(null)}
        />
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
          maxWidth: '100%',
          overflowX: 'auto',
          boxSizing: 'border-box',
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
                  {isOrigin && (
                    <div style={{ position: 'absolute', inset: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={resolveAssetUrl(coveringItem.iconUrl)}
                        alt={coveringItem.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.target.onerror = null; e.target.src = './assets/jdr-bag.jpg'; }}
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
                            title="Modifier l'objet"
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
            Dimensions : {hoveredItem.width || 1} x {hoveredItem.height || 1} cases
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