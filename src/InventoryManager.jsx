import { useState, useEffect } from 'react';
import {
  doc,
  updateDoc,
  setDoc,
  arrayUnion,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import ItemForm, { getItemBaseShape } from './ItemForm';
import { resolveAssetUrl } from './presets';

export default function InventoryManager({
  characterId,
  mjUid,
  items = [],
  heldItem = null,
  inventoryWidth = 5,
  inventoryHeight = 5,
  isEditable = true,
  isMJ = false
}) {
  const [editingItem, setEditingItem] = useState(null);
  const [draggedInfo, setDraggedInfo] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showTradeMenu, setShowTradeMenu] = useState(false);
  const [partyMembers, setPartyMembers] = useState([]);
  const [transferBusy, setTransferBusy] = useState(false);

  const gridW = inventoryWidth;
  const gridH = inventoryHeight;
  const cellSize = 54;
  const cellGap = 4;
  const extensionGap = 3 * (cellSize + cellGap);

  // Écoute des autres membres du groupe pour l'échange
  useEffect(() => {
    if (!mjUid || !isEditable) return;
    const q = query(collection(db, 'characters'), where('mjUid', '==', mjUid));
    const unsub = onSnapshot(q, (snap) => {
      const others = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => c.id !== characterId);
      others.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
      setPartyMembers(others);
    });
    return () => unsub();
  }, [mjUid, characterId, isEditable]);

  // Ferme le menu d'échange si la case spéciale se vide
  useEffect(() => {
    if (!heldItem) setShowTradeMenu(false);
  }, [heldItem]);

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

  const sanitizeItemForBank = (item) => {
    const { slotIndex, rotation, isRotated, ...cleanItem } = item;
    return {
      ...cleanItem,
      id: cleanItem.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    };
  };

  const returnItemToBank = async (item) => {
    if (!mjUid || !item) return;
    const bankRef = doc(db, 'itemBanks', mjUid);
    await setDoc(
      bankRef,
      { items: arrayUnion(sanitizeItemForBank(item)) },
      { merge: true }
    );
  };

  const handleUpdateGridSize = async (newW, newH) => {
    if (!characterId || !isMJ) return;
    const safeW = Math.max(2, Math.min(12, newW));
    const safeH = Math.max(2, Math.min(12, newH));
    try {
      await updateDoc(doc(db, 'characters', characterId), {
        inventoryWidth: safeW,
        inventoryHeight: safeH
      });
    } catch (err) {
      console.error('Erreur mise à jour taille inventaire :', err);
    }
  };

  const canPlaceItem = (item, originSlot, currentInventory, excludeItemId = null) => {
    const startX = originSlot % gridW;
    const startY = Math.floor(originSlot / gridW);
    const offsets = getItemActiveOffsets(item);

    const occupiedSlots = new Set();
    currentInventory.forEach((other) => {
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
      const updatedInventory = items.map((i) => (i.id === item.id ? itemCw : i));
      try {
        await updateDoc(doc(db, 'characters', characterId), { inventory: updatedInventory });
      } catch (err) {
        console.error('Erreur rotation :', err);
      }
      return;
    }

    // 2. Sens anti-horaire (-90 deg) si bloqué
    const rotCcw = (currentRot + 3) % 4;
    const itemCcw = { ...item, rotation: rotCcw, isRotated: rotCcw % 2 === 1 };
    if (canPlaceItem(itemCcw, originSlot, items, item.id)) {
      const updatedInventory = items.map((i) => (i.id === item.id ? itemCcw : i));
      try {
        await updateDoc(doc(db, 'characters', characterId), { inventory: updatedInventory });
      } catch (err) {
        console.error('Erreur rotation inverse :', err);
      }
    }
  };

  // Drag depuis la grille principale
  const handleDragStart = (e, item, clickedCellX, clickedCellY) => {
    if (!isEditable) return;
    const itemSlot = item.slotIndex ?? 0;
    const itemX = itemSlot % gridW;
    const itemY = Math.floor(itemSlot / gridW);
    const grabDx = clickedCellX - itemX;
    const grabDy = clickedCellY - itemY;
    setDraggedInfo({ item, grabDx, grabDy, source: 'grid' });
    e.dataTransfer.setData('text/plain', item.id);
  };

  // Drag depuis la case spéciale
  const handleDragStartHeld = (e) => {
    if (!isEditable || !heldItem) return;
    setDraggedInfo({ item: heldItem, grabDx: 0, grabDy: 0, source: 'held' });
    e.dataTransfer.setData('text/plain', heldItem.id);
  };

  // Drop sur la grille principale
  const handleDropOnGrid = async (e, targetSlot) => {
    e.preventDefault();
    if (!draggedInfo || !characterId) return;

    const { item, grabDx, grabDy, source } = draggedInfo;
    const targetX = targetSlot % gridW;
    const targetY = Math.floor(targetSlot / gridW);

    const newOriginX = targetX - grabDx;
    const newOriginY = targetY - grabDy;
    const newOriginSlot = newOriginY * gridW + newOriginX;

    if (source === 'held') {
      const itemToPlace = { ...item, slotIndex: newOriginSlot, rotation: 0, isRotated: false };
      if (canPlaceItem(itemToPlace, newOriginSlot, items)) {
        try {
          await updateDoc(doc(db, 'characters', characterId), {
            inventory: [...items, itemToPlace],
            heldItem: null
          });
        } catch (err) {
          console.error('Erreur placement depuis la case spéciale :', err);
        }
      }
    } else if (canPlaceItem(item, newOriginSlot, items, item.id)) {
      const updatedInventory = items.map((i) =>
        i.id === item.id ? { ...i, slotIndex: newOriginSlot } : i
      );
      try {
        await updateDoc(doc(db, 'characters', characterId), { inventory: updatedInventory });
      } catch (err) {
        console.error('Erreur déplacement objet :', err);
      }
    }
    setDraggedInfo(null);
  };

  // Drop sur la case spéciale
  const handleDropOnHeld = async (e) => {
    e.preventDefault();
    if (!draggedInfo || !characterId || !isEditable) return;

    const { item, source } = draggedInfo;
    if (source === 'held' || heldItem !== null) {
      setDraggedInfo(null);
      return;
    }

    const updatedInventory = items.filter((i) => i.id !== item.id);
    const { slotIndex, rotation, isRotated, ...cleanHeldItem } = item;

    try {
      await updateDoc(doc(db, 'characters', characterId), {
        inventory: updatedInventory,
        heldItem: cleanHeldItem
      });
    } catch (err) {
      console.error('Erreur déplacement vers la case spéciale :', err);
    }
    setDraggedInfo(null);
  };

  // Donner l'objet de la case spéciale à un autre joueur
  const handleGiveToAlly = async (targetPlayer) => {
    if (!heldItem || !characterId || !targetPlayer?.id || transferBusy) return;
    if (targetPlayer.heldItem) return;

    setTransferBusy(true);
    try {
      const sourceRef = doc(db, 'characters', characterId);
      const targetRef = doc(db, 'characters', targetPlayer.id);

      await runTransaction(db, async (transaction) => {
        const targetSnap = await transaction.get(targetRef);
        if (!targetSnap.exists()) throw new Error('Personnage introuvable');
        if (targetSnap.data().heldItem) {
          throw new Error('La case spéciale du destinataire est déjà occupée');
        }
        transaction.update(targetRef, { heldItem });
        transaction.update(sourceRef, { heldItem: null });
      });

      setShowTradeMenu(false);
      setHoveredItem(null);
    } catch (err) {
      console.error('Erreur transfert entre joueurs :', err);
      alert(err.message || "Impossible d'effectuer le transfert.");
    } finally {
      setTransferBusy(false);
    }
  };

  // Jeter l'objet de la case spéciale (retour dans la banque du MJ)
  const handleThrowToMJ = async () => {
    if (!heldItem || !characterId || transferBusy) return;
    setTransferBusy(true);
    try {
      await returnItemToBank(heldItem);
      await updateDoc(doc(db, 'characters', characterId), { heldItem: null });
      setShowTradeMenu(false);
      setHoveredItem(null);
    } catch (err) {
      console.error('Erreur retour objet au MJ :', err);
    } finally {
      setTransferBusy(false);
    }
  };

  const handleSaveEdit = async (updatedItem) => {
    if (!characterId || !isMJ) return;
    try {
      if (heldItem && heldItem.id === updatedItem.id) {
        const { slotIndex, rotation, isRotated, ...cleanHeld } = updatedItem;
        await updateDoc(doc(db, 'characters', characterId), { heldItem: cleanHeld });
      } else {
        const updatedInventory = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
        await updateDoc(doc(db, 'characters', characterId), { inventory: updatedInventory });
      }
      setEditingItem(null);
    } catch (err) {
      console.error('Erreur édition objet :', err);
    }
  };

  // Suppression par le MJ -> retour automatique dans la banque
  const handleDeleteItem = async (itemToDelete, fromHeld = false) => {
    if (!characterId || !isMJ || !itemToDelete) return;
    try {
      await returnItemToBank(itemToDelete);
      if (fromHeld) {
        await updateDoc(doc(db, 'characters', characterId), { heldItem: null });
      } else {
        const updatedInventory = items.filter((i) => i.id !== itemToDelete.id);
        await updateDoc(doc(db, 'characters', characterId), { inventory: updatedInventory });
      }
      setHoveredItem(null);
    } catch (err) {
      console.error('Erreur retour objet en banque :', err);
    }
  };

  const gridCells = Array.from({ length: gridW * gridH }, (_, i) => i);

  return (
    <div style={{ marginTop: '16px', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
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

      {/* ZONE INVENTAIRE : GRILLE PRINCIPALE + CASE SPÉCIALE À 3 CASES */}
      <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', rowGap: '16px' }}>
        {/* GRILLE PRINCIPALE */}
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

            const coveringItem = items.find((item) => {
              const startSlot = item.slotIndex ?? 0;
              const oX = startSlot % gridW;
              const oY = Math.floor(startSlot / gridW);
              const offsets = getItemActiveOffsets(item);
              return offsets.some(({ rx, ry }) => oX + rx === cellX && oY + ry === cellY);
            });

            const isOrigin = coveringItem && (coveringItem.slotIndex ?? 0) === slotIndex;
            const rotDegree = coveringItem
              ? ((coveringItem.rotation ?? (coveringItem.isRotated ? 1 : 0)) % 4) * 90
              : 0;

            return (
              <div
                key={slotIndex}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnGrid(e, slotIndex)}
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
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = './assets/jdr-bag.jpg';
                          }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotateItem(coveringItem);
                          }}
                          title="Pivoter (90 deg)"
                          style={{ background: 'rgba(0,0,0,0.85)', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '1px 4px' }}
                        >
                          R
                        </button>
                        {isMJ && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(coveringItem);
                              }}
                              title="Modifier l'objet"
                              style={{ background: 'rgba(0,0,0,0.85)', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', padding: '1px 4px' }}
                            >
                              E
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(coveringItem, false);
                              }}
                              title="Renvoyer dans la banque"
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

        {/* CASE SPÉCIALE UNIQUE À 3 CASES DE L'INVENTAIRE (AFFICHAGE FAÇON BANQUE, SANS LIBELLÉ) */}
        <div
          style={{
            marginLeft: `${extensionGap}px`,
            background: 'var(--code-bg)',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            position: 'relative',
            flexShrink: 0
          }}
        >
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnHeld}
            onMouseEnter={() => heldItem && setHoveredItem(heldItem)}
            onMouseLeave={() => setHoveredItem(null)}
            onMouseMove={(e) => setTooltipPos({ x: e.clientX + 14, y: e.clientY + 14 })}
            style={{
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              background: heldItem ? 'var(--bg)' : 'rgba(255,255,255,0.02)',
              border: heldItem ? '1px solid var(--accent-border)' : '1px dashed var(--border)',
              borderRadius: '6px',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            {heldItem && (
              <div
                draggable={isEditable}
                onDragStart={handleDragStartHeld}
                style={{
                  width: '100%',
                  height: '100%',
                  cursor: isEditable ? 'grab' : 'default',
                  position: 'relative'
                }}
              >
                <div style={{ position: 'absolute', inset: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={resolveAssetUrl(heldItem.iconUrl)}
                    alt={heldItem.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = './assets/jdr-bag.jpg';
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      pointerEvents: 'none'
                    }}
                  />
                </div>

                {/* Badge dimensions façon banque */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: '2px',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: '8px',
                    fontWeight: 'bold',
                    padding: '0px 3px',
                    borderRadius: '3px',
                    lineHeight: '1.3',
                    pointerEvents: 'none'
                  }}
                >
                  {heldItem.width || 1}x{heldItem.height || 1}
                </span>

                {/* Boutons d'action : Échange (remplace R) + actions MJ */}
                {isEditable && (
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTradeMenu((prev) => !prev);
                      }}
                      title="Donner à un joueur ou rendre au MJ"
                      style={{
                        background: showTradeMenu ? 'var(--accent)' : 'rgba(0,0,0,0.85)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        padding: '1px 4px'
                      }}
                    >
                      ⇄
                    </button>
                    {isMJ && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(heldItem);
                          }}
                          title="Modifier l'objet"
                          style={{ background: 'rgba(0,0,0,0.85)', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', padding: '1px 4px' }}
                        >
                          E
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(heldItem, true);
                          }}
                          title="Renvoyer dans la banque"
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

          {/* POPOVER D'ÉCHANGE / JET */}
          {showTradeMenu && heldItem && isEditable && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                minWidth: '190px',
                background: 'var(--bg)',
                border: '1px solid var(--accent-border)',
                borderRadius: '8px',
                padding: '8px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.55)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text)', textTransform: 'uppercase', padding: '0 4px' }}>
                Donner à un allié
              </span>

              {partyMembers.length === 0 ? (
                <span style={{ fontSize: '11px', color: 'var(--text)', fontStyle: 'italic', padding: '2px 4px' }}>
                  Aucun autre joueur
                </span>
              ) : (
                partyMembers.map((ally) => {
                  const isBusy = Boolean(ally.heldItem);
                  return (
                    <button
                      key={ally.id}
                      type="button"
                      disabled={isBusy || transferBusy}
                      onClick={() => handleGiveToAlly(ally)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '5px 8px',
                        fontSize: '11px',
                        borderRadius: '5px',
                        border: '1px solid var(--border)',
                        background: isBusy ? 'transparent' : 'var(--code-bg)',
                        color: isBusy ? 'var(--text)' : 'var(--text-h)',
                        opacity: isBusy ? 0.45 : 1,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ally.name}
                      </span>
                      {isBusy && <span style={{ fontSize: '9px' }}>Occupé</span>}
                    </button>
                  );
                })
              )}

              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

              <button
                type="button"
                disabled={transferBusy}
                onClick={handleThrowToMJ}
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  borderRadius: '5px',
                  border: '1px solid rgba(229, 62, 62, 0.45)',
                  background: 'rgba(229, 62, 62, 0.14)',
                  color: '#feb2b2',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                Jeter (rendre au MJ)
              </button>
            </div>
          )}
        </div>
      </div>

      {hoveredItem && (
        <div
          style={{
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
          }}
        >
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