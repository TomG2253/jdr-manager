import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export const ITEM_PRESETS = [
  { id: 'weapon', label: 'Arme / Dague', url: '/assets/jdr-weapon.jpg' },
  { id: 'armor', label: 'Armure / Casque', url: '/assets/jdr-armor.jpg' },
  { id: 'bag', label: 'Sac / Bourse', url: '/assets/jdr-bag.jpg' },
  { id: 'beer', label: 'Boisson / Chope', url: '/assets/jdr-bierre.jpg' },
  { id: 'book', label: 'Livre / Grimoire', url: '/assets/jdr-book.jpg' },
  { id: 'bread', label: 'Nourriture / Pain', url: '/assets/jdr-bread.jpg' },
  { id: 'flower', label: 'Plante / Fleur', url: '/assets/jdr-flower.jpg' },
  { id: 'key', label: 'Clé / Artefact', url: '/assets/jdr-key.jpg' },
  { id: 'paper', label: 'Parchemin / Carte', url: '/assets/jdr-paper.jpg' },
  { id: 'rock', label: 'Minerai / Cristal', url: '/assets/jdr-rock.jpg' }
];

export default function ItemBank({ mjUid, players = [] }) {
  const [bankItems, setBankItems] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [targetPlayerId, setTargetPlayerId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    iconUrl: ITEM_PRESETS[0].url,
    description: '',
    width: 1,
    height: 1,
    effect: ''
  });

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
    const bankRef = doc(db, "itemBanks", mjUid);
    await setDoc(bankRef, { items: newItems }, { merge: true });
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newItem = {
      id: crypto.randomUUID(),
      name: formData.name.trim(),
      iconUrl: formData.iconUrl || ITEM_PRESETS[0].url,
      description: formData.description.trim(),
      width: parseInt(formData.width, 10) || 1,
      height: parseInt(formData.height, 10) || 1,
      isRotated: false,
      effect: formData.effect.trim()
    };

    if (targetPlayerId) {
      const player = players.find(p => p.id === targetPlayerId);
      if (player) {
        const gridW = player.inventoryWidth || 4;
        const gridH = player.inventoryHeight || 3;
        const currentInv = player.inventory || [];
        const nextSlot = findFreeSlot(currentInv, gridW, gridH, newItem.width, newItem.height);
        
        if (nextSlot === -1) {
          alert("L'inventaire du joueur est trop petit pour cet objet !");
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

    setFormData({ name: '', iconUrl: ITEM_PRESETS[0].url, description: '', width: 1, height: 1, effect: '' });
    setShowCreateForm(false);
    setTargetPlayerId('');
  };

  const handleGiveToPlayer = async (item, playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const gridW = player.inventoryWidth || 4;
    const gridH = player.inventoryHeight || 3;
    const currentInv = player.inventory || [];
    const nextSlot = findFreeSlot(currentInv, gridW, gridH, item.width, item.height);

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
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const updatedBank = bankItems.map(i => i.id === editingItem.id ? editingItem : i);
    await saveBank(updatedBank);
    setEditingItem(null);
  };

  const handleDeleteFromBank = async (itemId) => {
    const updatedBank = bankItems.filter(i => i.id !== itemId);
    await saveBank(updatedBank);
  };

  return (
    <div style={{ padding: '20px', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-h)' }}>🏰 Banque d'Objets du MJ</h3>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-primary" style={{ fontSize: '13px' }}>
          {showCreateForm ? 'Annuler' : '+ Créer un objet'}
        </button>
      </div>

      {/* FORMULAIRE CREATION OBJET */}
      {showCreateForm && (
        <form onSubmit={handleCreateItem} style={{ padding: '16px', background: 'var(--bg)', border: '1px solid var(--accent-border)', borderRadius: '8px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <strong style={{ color: 'var(--text-h)', fontSize: '14px' }}>Créer un nouvel objet</strong>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input required type="text" placeholder="Nom de l'objet" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text)' }}>Taille (L × H) :</span>
              <input type="number" min="1" max="4" value={formData.width} onChange={e => setFormData({...formData, width: e.target.value})} style={{ width: '45px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
              <span style={{ color: 'var(--text)' }}>×</span>
              <input type="number" min="1" max="4" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} style={{ width: '45px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select onChange={e => setFormData({...formData, iconUrl: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }}>
              <option value="">-- Icônes par défaut --</option>
              {ITEM_PRESETS.map(p => (
                <option key={p.id} value={p.url}>{p.label}</option>
              ))}
            </select>
            <input type="text" placeholder="URL image personnalisée (https://...)" value={formData.iconUrl} onChange={e => setFormData({...formData, iconUrl: e.target.value})} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <input type="text" placeholder="Effet (ex: +5 Armure, +10 PV)" value={formData.effect} onChange={e => setFormData({...formData, effect: e.target.value})} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <select value={targetPlayerId} onChange={e => setTargetPlayerId(e.target.value)} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }}>
              <option value="">Placer dans la Banque MJ</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>Donner directement à {p.name}</option>
              ))}
            </select>
          </div>

          <textarea placeholder="Description..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }} />

          <button type="submit" className="btn-primary" style={{ padding: '8px', fontSize: '13px' }}>Générer l'objet</button>
        </form>
      )}

      {/* FORMULAIRE EDITION OBJET BANQUE */}
      {editingItem && (
        <form onSubmit={handleSaveEdit} style={{ padding: '16px', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '8px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <strong style={{ color: 'var(--accent)', fontSize: '14px' }}>Modifier l'objet : {editingItem.name}</strong>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input required type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text)' }}>Taille (L × H) :</span>
              <input type="number" min="1" max="4" value={editingItem.width} onChange={e => setEditingItem({...editingItem, width: parseInt(e.target.value, 10) || 1})} style={{ width: '45px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
              <span style={{ color: 'var(--text)' }}>×</span>
              <input type="number" min="1" max="4" value={editingItem.height} onChange={e => setEditingItem({...editingItem, height: parseInt(e.target.value, 10) || 1})} style={{ width: '45px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select onChange={e => setEditingItem({...editingItem, iconUrl: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }}>
              <option value="">-- Icônes par défaut --</option>
              {ITEM_PRESETS.map(p => (
                <option key={p.id} value={p.url}>{p.label}</option>
              ))}
            </select>
            <input type="text" value={editingItem.iconUrl} onChange={e => setEditingItem({...editingItem, iconUrl: e.target.value})} placeholder="URL d'image" style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          </div>

          <input type="text" value={editingItem.effect || ''} onChange={e => setEditingItem({...editingItem, effect: e.target.value})} placeholder="Effet" style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          <textarea value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} rows={2} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }} />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Annuler</button>
            <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Enregistrer</button>
          </div>
        </form>
      )}

      {/* LISTE BANQUE */}
      {bankItems.length === 0 ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic', fontSize: '14px', margin: 0 }}>La banque du MJ est vide.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {bankItems.map(item => (
            <div 
              key={item.id} 
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '8px', 
                border: '1px solid var(--accent-border)',
                backgroundImage: `url(${item.iconUrl})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                position: 'relative',
                boxShadow: 'var(--shadow)'
              }}
              title={`${item.name} (${item.width}×${item.height})\n${item.effect ? '✨ ' + item.effect + '\n' : ''}${item.description}`}
            >
              <span style={{ position: 'absolute', top: '-6px', left: '-6px', background: 'var(--accent)', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '3px' }}>
                {item.width}×{item.height}
              </span>

              <div style={{ position: 'absolute', bottom: '-22px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '4px' }}>
                {players.length > 0 && (
                  <select 
                    onChange={(e) => { if (e.target.value) handleGiveToPlayer(item, e.target.value); }} 
                    defaultValue=""
                    style={{ fontSize: '10px', padding: '1px 2px', borderRadius: '3px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', cursor: 'pointer' }}
                  >
                    <option value="" disabled>Donner à...</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                
                <button onClick={() => setEditingItem(item)} title="Modifier" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '1px 4px' }}>✏️</button>
                <button onClick={() => handleDeleteFromBank(item.id)} title="Supprimer définitivement" style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '1px 4px' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Fonction utilitaire pour trouver une place libre pour une taille (W x H)
function findFreeSlot(inventory, gridW, gridH, itemW, itemH) {
  const occupied = new Set();
  
  inventory.forEach(item => {
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

  const totalSlots = gridW * gridH;
  for (let slot = 0; slot < totalSlots; slot++) {
    const x = slot % gridW;
    const y = Math.floor(slot / gridW);

    if (x + itemW <= gridW && y + itemH <= gridH) {
      let isBlocked = false;
      for (let dy = 0; dy < itemH; dy++) {
        for (let dx = 0; dx < itemW; dx++) {
          const checkSlot = (y + dy) * gridW + (x + dx);
          if (occupied.has(checkSlot)) {
            isBlocked = true;
            break;
          }
        }
        if (isBlocked) break;
      }
      if (!isBlocked) return slot;
    }
  }
  return -1;
}