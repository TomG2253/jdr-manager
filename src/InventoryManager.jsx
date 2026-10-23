import { useState } from 'react';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ITEM_PRESETS } from './ItemBank';

export default function InventoryManager({ 
  characterId, 
  mjUid, 
  items = [], 
  inventoryWidth = 4, 
  inventoryHeight = 3, 
  isEditable, 
  isMJ 
}) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [draggedItemId, setDraggedItemId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const saveInventory = async (newItems) => {
    if (!characterId) return;
    try {
      const charRef = doc(db, "characters", characterId);
      await updateDoc(charRef, { inventory: newItems });
    } catch (error) {
      console.error("Erreur sauvegarde inventaire :", error);
    }
  };

  const handleUpdateDimensions = async (newW, newH) => {
    if (!characterId || newW < 1 || newH < 1) return;
    try {
      const charRef = doc(db, "characters", characterId);
      await updateDoc(charRef, { inventoryWidth: newW, inventoryHeight: newH });
    } catch (error) {
      console.error("Erreur mise à jour dimensions grille :", error);
    }
  };

  const handleRotateItem = (itemToRotate) => {
    if (!isEditable) return;

    const currentRotated = !!itemToRotate.isRotated;
    const newRotated = !currentRotated;

    const effW = newRotated ? itemToRotate.height : itemToRotate.width;
    const effH = newRotated ? itemToRotate.width : itemToRotate.height;

    const startSlot = itemToRotate.slotIndex ?? 0;
    const startX = startSlot % inventoryWidth;
    const startY = Math.floor(startSlot / inventoryWidth);

    // Vérifie si la rotation rentre dans la grille
    if (startX + effW > inventoryWidth || startY + effH > inventoryHeight) {
      return; // Ne pivote pas si ça déborde du sac
    }

    // Vérifie si la rotation ne percute pas un autre objet
    const occupied = getOccupiedSlotsSet(items.filter(i => i.id !== itemToRotate.id), inventoryWidth);
    for (let dy = 0; dy < effH; dy++) {
      for (let dx = 0; dx < effW; dx++) {
        const checkSlot = (startY + dy) * inventoryWidth + (startX + dx);
        if (occupied.has(checkSlot)) return; // Collision
      }
    }

    const updatedInv = items.map(i => i.id === itemToRotate.id ? { ...i, isRotated: newRotated } : i);
    saveInventory(updatedInv);
  };

  const handleRemoveToBank = async (itemToRemove) => {
    if (!mjUid) return;

    const updatedInv = items.filter(i => i.id !== itemToRemove.id);
    await saveInventory(updatedInv);

    const bankRef = doc(db, "itemBanks", mjUid);
    const bankSnap = await getDoc(bankRef);
    const currentBank = bankSnap.exists() ? (bankSnap.data().items || []) : [];

    const { slotIndex, isRotated, ...cleanItem } = itemToRemove;
    await setDoc(bankRef, { items: [...currentBank, cleanItem] }, { merge: true });
  };

  const handleSaveItemEdit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const updatedInv = items.map(i => i.id === editingItem.id ? editingItem : i);
    await saveInventory(updatedInv);
    setEditingItem(null);
  };

  const handleDragStart = (e, item) => {
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDropOnSlot = (e, targetSlot) => {
    e.preventDefault();
    if (!draggedItemId || !isEditable) return;

    const draggedItem = items.find(i => i.id === draggedItemId);
    if (!draggedItem) return;

    const effW = draggedItem.isRotated ? draggedItem.height : draggedItem.width;
    const effH = draggedItem.isRotated ? draggedItem.width : draggedItem.height;

    const targetX = targetSlot % inventoryWidth;
    const targetY = Math.floor(targetSlot / inventoryWidth);

    if (targetX + effW > inventoryWidth || targetY + effH > inventoryHeight) return;

    const occupied = getOccupiedSlotsSet(items.filter(i => i.id !== draggedItemId), inventoryWidth);
    for (let dy = 0; dy < effH; dy++) {
      for (let dx = 0; dx < effW; dx++) {
        const checkSlot = (targetY + dy) * inventoryWidth + (targetX + dx);
        if (occupied.has(checkSlot)) return;
      }
    }

    const updatedInv = items.map(i => i.id === draggedItemId ? { ...i, slotIndex: targetSlot } : i);
    saveInventory(updatedInv);
    setDraggedItemId(null);
  };

  // Cartographie des cases du sac
  const totalSlots = inventoryWidth * inventoryHeight;
  const slotOccupancy = {}; // slotIndex -> { type: 'origin' | 'extension', item }

  items.forEach(item => {
    const startSlot = item.slotIndex ?? 0;
    const startX = startSlot % inventoryWidth;
    const startY = Math.floor(startSlot / inventoryWidth);
    const effW = item.isRotated ? item.height : item.width;
    const effH = item.isRotated ? item.width : item.height;

    for (let dy = 0; dy < effH; dy++) {
      for (let dx = 0; dx < effW; dx++) {
        const currentSlot = (startY + dy) * inventoryWidth + (startX + dx);
        if (dx === 0 && dy === 0) {
          slotOccupancy[currentSlot] = { type: 'origin', item };
        } else {
          slotOccupancy[currentSlot] = { type: 'extension', item };
        }
      }
    }
  });

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: 'var(--text-h)', fontSize: '16px' }}>🎒 Sac à Dos & Équipement</h4>

        {/* Réglage des dimensions de la grille par le MJ */}
        {isMJ && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text)' }}>Grille (L×H) :</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button onClick={() => handleUpdateDimensions(inventoryWidth - 1, inventoryHeight)} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '10px' }}>-</button>
              <strong style={{ color: 'var(--accent)' }}>{inventoryWidth}</strong>
              <button onClick={() => handleUpdateDimensions(inventoryWidth + 1, inventoryHeight)} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '10px' }}>+</button>
            </div>
            <span style={{ color: 'var(--text)' }}>×</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button onClick={() => handleUpdateDimensions(inventoryWidth, inventoryHeight - 1)} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '10px' }}>-</button>
              <strong style={{ color: 'var(--accent)' }}>{inventoryHeight}</strong>
              <button onClick={() => handleUpdateDimensions(inventoryWidth, inventoryHeight + 1)} className="btn-secondary" style={{ padding: '1px 5px', fontSize: '10px' }}>+</button>
            </div>
          </div>
        )}
      </div>

      {/* FORMULAIRE D'ÉDITION OBJET EN INVENTAIRE (MJ) */}
      {isMJ && editingItem && (
        <form onSubmit={handleSaveItemEdit} style={{ padding: '12px', background: 'var(--code-bg)', border: '1px solid var(--accent)', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <strong style={{ fontSize: '12px', color: 'var(--accent)' }}>Éditer l'objet : {editingItem.name}</strong>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} style={{ flex: 2, padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input type="number" min="1" max="4" value={editingItem.width} onChange={e => setEditingItem({...editingItem, width: parseInt(e.target.value, 10) || 1})} style={{ width: '35px', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)' }} />
              <span style={{ fontSize: '12px' }}>×</span>
              <input type="number" min="1" max="4" value={editingItem.height} onChange={e => setEditingItem({...editingItem, height: parseInt(e.target.value, 10) || 1})} style={{ width: '35px', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select onChange={e => setEditingItem({...editingItem, iconUrl: e.target.value})} style={{ flex: 1, padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}>
              <option value="">-- Icônes par défaut --</option>
              {ITEM_PRESETS.map(p => (
                <option key={p.id} value={p.url}>{p.label}</option>
              ))}
            </select>
            <input type="text" value={editingItem.iconUrl} onChange={e => setEditingItem({...editingItem, iconUrl: e.target.value})} placeholder="URL image" style={{ flex: 2, padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          </div>

          <input type="text" value={editingItem.effect || ''} onChange={e => setEditingItem({...editingItem, effect: e.target.value})} placeholder="Effet" style={{ padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }}>Annuler</button>
            <button type="submit" className="btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }}>Enregistrer</button>
          </div>
        </form>
      )}

      {/* GRILLE D'INVENTAIRE */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${inventoryWidth}, 64px)`, 
        gap: '6px', 
        padding: '12px', 
        background: 'var(--code-bg)', 
        border: '1px solid var(--border)', 
        borderRadius: '8px', 
        width: 'fit-content' 
      }}>
        {Array.from({ length: totalSlots }).map((_, slotIdx) => {
          const occ = slotOccupancy[slotIdx];

          // 1. Case ORIGINE de l'objet (Contient l'image 1x1 + contrôles)
          if (occ?.type === 'origin') {
            const item = occ.item;
            return (
              <div 
                key={slotIdx}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnSlot(e, slotIdx)}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent)',
                  backgroundColor: 'rgba(49, 130, 206, 0.15)',
                  backgroundImage: `url(${item.iconUrl})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  position: 'relative',
                  cursor: isEditable ? 'grab' : 'default'
                }}
                draggable={isEditable}
                onDragStart={(e) => handleDragStart(e, item)}
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX + 12, y: e.clientY + 12 })}
              >
                {/* Actions sur l'objet */}
                {isEditable && (
                  <div style={{ position: 'absolute', top: '-4px', right: '-4px', display: 'flex', gap: '2px', zIndex: 2 }}>
                    {(item.width > 1 || item.height > 1) && (
                      <button onClick={() => handleRotateItem(item)} title="Pivoter l'objet" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔄</button>
                    )}
                    {isMJ && (
                      <button onClick={() => setEditingItem(item)} title="Éditer" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '50%', width: '18px', height: '18px', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                    )}
                    <button onClick={() => handleRemoveToBank(item)} title="Renvoyer dans la banque du MJ" style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                )}
              </div>
            );
          }

          // 2. Case EXTENSION (Partie du corps de l'objet qui déborde)
          if (occ?.type === 'extension') {
            const item = occ.item;
            return (
              <div 
                key={slotIdx}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnSlot(e, slotIdx)}
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX + 12, y: e.clientY + 12 })}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '6px',
                  border: '1px dashed var(--accent-border)',
                  backgroundColor: 'rgba(49, 130, 206, 0.08)',
                  position: 'relative'
                }}
              />
            );
          }

          // 3. Case VIDE
          return (
            <div 
              key={slotIdx}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnSlot(e, slotIdx)}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '6px',
                border: '1px dashed var(--border)',
                backgroundColor: 'var(--bg)'
              }}
            />
          );
        })}
      </div>

      {/* TOOLTIP SURVOL */}
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
            Dimensions : {hoveredItem.isRotated ? hoveredItem.height : hoveredItem.width} × {hoveredItem.isRotated ? hoveredItem.width : hoveredItem.height} cases
          </span>

          {hoveredItem.effect && (
            <div style={{ color: '#48bb78', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
              ✨ {hoveredItem.effect}
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

// Fonction utilitaire de cartographie
function getOccupiedSlotsSet(itemList, gridW) {
  const occupied = new Set();
  itemList.forEach(item => {
    const startSlot = item.slotIndex ?? 0;
    const startX = startSlot % gridW;
    const startY = Math.floor(startSlot / gridW);
    const effW = item.isRotated ? item.height : item.width;
    const effH = item.isRotated ? item.width : item.height;

    for (let dy = 0; dy < effH; dy++) {
      for (let dx = 0; dx < effW; dx++) {
        const slot = (startY + dy) * gridW + (startX + dx);
        occupied.add(slot);
      }
    }
  });
  return occupied;
}