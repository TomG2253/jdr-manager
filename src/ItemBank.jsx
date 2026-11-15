import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import ItemForm, { getItemBaseShape } from './ItemForm';
import { resolveAssetUrl } from './presets';

export default function ItemBank({ mjUid, players = [] }) {
  const [bankItems, setBankItems] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mjUid) return;
    const bankRef = doc(db, "itemBanks", mjUid);
    const unsubscribe = onSnapshot(bankRef, (docSnap) => {
      if (docSnap.exists()) {
        setBankItems(docSnap.data().items || []);
      } else {
        setDoc(bankRef, { items: [] });
      }
    });
    return () => unsubscribe();
  }, [mjUid]);

  const saveBank = async (newItems) => {
    if (!mjUid) return;
    const bankRef = doc(db, "itemBanks", mjUid);
    await setDoc(bankRef, { items: newItems }, { merge: true });
  };

  const handleCreateItem = async (newItem, targetPlayerId) => {
    if (targetPlayerId) {
      const player = players.find(p => p.id === targetPlayerId);
      if (player) {
        const gridW = player.inventoryWidth || 5;
        const gridH = player.inventoryHeight || 5;
        const currentInv = player.inventory || [];
        const nextSlot = findFreeSlot(currentInv, gridW, gridH, newItem);

        if (nextSlot === -1) {
          alert("L'inventaire du joueur est trop petit ou plein pour cet objet !");
          return;
        }

        const charRef = doc(db, "characters", player.id);
        await updateDoc(charRef, {
          inventory: [...currentInv, { ...newItem, slotIndex: nextSlot }]
        });
      }
    } else {
      await saveBank([...bankItems, newItem]);
    }
    setShowCreateForm(false);
  };

  const handleGiveToPlayer = async (item, playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const gridW = player.inventoryWidth || 5;
    const gridH = player.inventoryHeight || 5;
    const currentInv = player.inventory || [];
    const nextSlot = findFreeSlot(currentInv, gridW, gridH, item);

    if (nextSlot === -1) {
      alert("L'inventaire du joueur n'a pas assez d'espace libre !");
      return;
    }

    const charRef = doc(db, "characters", player.id);
    await updateDoc(charRef, {
      inventory: [...currentInv, { ...item, slotIndex: nextSlot }]
    });

    const updatedBank = bankItems.filter(i => i.id !== item.id);
    await saveBank(updatedBank);
    setHoveredItem(null);
  };

  const handleSaveEdit = async (updatedItem) => {
    const updatedBank = bankItems.map(i => i.id === updatedItem.id ? updatedItem : i);
    await saveBank(updatedBank);
    setEditingItem(null);
  };

  const handleDeleteFromBank = async (itemId) => {
    const updatedBank = bankItems.filter(i => i.id !== itemId);
    await saveBank(updatedBank);
    setHoveredItem(null);
  };

  return (
    <div style={{ padding: '20px', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-h)' }}>Banque d'objets</h3>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setEditingItem(null);
          }}
          className="btn-primary"
          style={{ fontSize: '13px' }}
        >
          {showCreateForm ? 'Annuler' : '+ Créer un objet'}
        </button>
      </div>

      {showCreateForm && (
        <ItemForm
          title="Créer un nouvel objet"
          submitLabel="Générer l'objet"
          onSubmit={handleCreateItem}
          onCancel={() => setShowCreateForm(false)}
          players={players}
          allowDirectGive={true}
        />
      )}

      {editingItem && (
        <ItemForm
          initialItem={editingItem}
          title={`Modifier l'objet : ${editingItem.name}`}
          submitLabel="Enregistrer"
          onSubmit={handleSaveEdit}
          onCancel={() => setEditingItem(null)}
        />
      )}

      {bankItems.length === 0 ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic', fontSize: '14px', margin: 0 }}>La banque d'objets est vide.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
          {bankItems.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '8px',
                background: 'var(--bg)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}
            >
              <div
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX + 12, y: e.clientY + 12 })}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent-border)',
                  position: 'relative',
                  backgroundColor: 'var(--code-bg)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={resolveAssetUrl(item.iconUrl)}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = './assets/jdr-bag.jpg';
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <span style={{ position: 'absolute', top: '2px', left: '2px', background: 'var(--accent)', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px', zIndex: 1 }}>
                  {item.width}x{item.height}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%' }}>
                {players.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) handleGiveToPlayer(item, e.target.value); }}
                    defaultValue=""
                    style={{ flex: 1, fontSize: '10px', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)', cursor: 'pointer', maxWidth: '80px' }}
                  >
                    <option value="" disabled>Donner...</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setShowCreateForm(false);
                  }}
                  title="Modifier"
                  style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', color: 'var(--text-h)', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }}
                >
                  E
                </button>
                <button
                  onClick={() => handleDeleteFromBank(item.id)}
                  title="Supprimer définitivement"
                  style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }}
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
            Dimensions : {hoveredItem.width} x {hoveredItem.height} cases
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

function getItemActiveOffsets(item) {
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
        if (rot === 1) { rx = -r; ry = c; }
        else if (rot === 2) { rx = -c; ry = -r; }
        else if (rot === 3) { rx = r; ry = -c; }
        offsets.push({ rx, ry });
      }
    }
  }
  return offsets;
}

function findFreeSlot(inventory, gridW, gridH, newItem) {
  const occupied = new Set();
  inventory.forEach(item => {
    const startSlot = item.slotIndex ?? 0;
    const oX = startSlot % gridW;
    const oY = Math.floor(startSlot / gridW);
    getItemActiveOffsets(item).forEach(({ rx, ry }) => {
      const gx = oX + rx;
      const gy = oY + ry;
      if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
        occupied.add(gy * gridW + gx);
      }
    });
  });

  const itemOffsets = getItemActiveOffsets(newItem);
  const totalSlots = gridW * gridH;

  for (let slot = 0; slot < totalSlots; slot++) {
    const startX = slot % gridW;
    const startY = Math.floor(slot / gridW);
    let canFit = true;

    for (const { rx, ry } of itemOffsets) {
      const tx = startX + rx;
      const ty = startY + ry;
      if (tx < 0 || tx >= gridW || ty < 0 || ty >= gridH || occupied.has(ty * gridW + tx)) {
        canFit = false;
        break;
      }
    }
    if (canFit) return slot;
  }
  return -1;
}