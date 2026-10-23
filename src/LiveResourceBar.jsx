import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function LiveResourceBar({ characterId, resourceKey, currentVal, maxVal, color, isEditable, isMJ, onUpdate }) {
  const [editingMax, setEditingMax] = useState(false);
  const [newMaxVal, setNewMaxVal] = useState(maxVal);

  useEffect(() => {
    setNewMaxVal(maxVal);
  }, [maxVal]);

  const percentage = Math.max(0, Math.min(100, (currentVal / maxVal) * 100));

  const handleApplyDelta = async (delta) => {
    if (!isEditable || !characterId) return;
    const updatedCurrent = Math.max(0, Math.min(maxVal, currentVal + delta));
    onUpdate(resourceKey, updatedCurrent);

    try {
      const charRef = doc(db, "characters", characterId);
      await updateDoc(charRef, {
        [`liveStats.${resourceKey}Current`]: updatedCurrent
      });
    } catch (err) {
      console.error("Erreur mise à jour stat :", err);
    }
  };

  const handleSaveMax = async () => {
    if (!characterId) return;
    const safeMax = Math.max(1, parseInt(newMaxVal, 10) || 1);
    const safeCurrent = Math.min(currentVal, safeMax);

    try {
      const charRef = doc(db, "characters", characterId);
      await updateDoc(charRef, {
        [`liveStats.${resourceKey}Max`]: safeMax,
        [`liveStats.${resourceKey}Current`]: safeCurrent
      });
      setEditingMax(false);
    } catch (err) {
      console.error("Erreur modification max :", err);
    }
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px' }}>
        <strong style={{ color: 'var(--text-h)', textTransform: 'uppercase' }}>{resourceKey}</strong>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text-h)' }}>{currentVal}</span>
          <span>/</span>
          
          {/* Édition du Max réservée au MJ */}
          {isMJ && editingMax ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input 
                type="number" 
                value={newMaxVal} 
                onChange={(e) => setNewMaxVal(e.target.value)}
                style={{ width: '45px', padding: '1px 4px', fontSize: '12px', borderRadius: '3px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }}
              />
              <button onClick={handleSaveMax} style={{ background: 'none', border: 'none', color: '#48bb78', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✔</button>
            </div>
          ) : (
            <span 
              onClick={() => isMJ && setEditingMax(true)} 
              title={isMJ ? "Cliquer pour modifier la valeur max" : undefined}
              style={{ fontWeight: 'bold', color: 'var(--text)', cursor: isMJ ? 'pointer' : 'default', textDecoration: isMJ ? 'underline dotted' : 'none' }}
            >
              {maxVal}
            </span>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ height: '10px', background: 'var(--code-bg)', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ width: `${percentage}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
      </div>

      {/* Boutons d'ajustement rapide */}
      {isEditable && (
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          <button onClick={() => handleApplyDelta(-10)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '10px' }}>-10</button>
          <button onClick={() => handleApplyDelta(-1)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '10px' }}>-1</button>
          <button onClick={() => handleApplyDelta(1)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '10px' }}>+1</button>
          <button onClick={() => handleApplyDelta(10)} className="btn-secondary" style={{ padding: '1px 6px', fontSize: '10px' }}>+10</button>
        </div>
      )}
    </div>
  );
}