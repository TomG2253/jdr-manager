import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function LiveResourceBar({ characterId, resourceKey, currentVal, maxVal, color, isEditable, onUpdate }) {
  const [modifierValue, setModifierValue] = useState('');

  const percentage = Math.max(0, Math.min(100, (currentVal / maxVal) * 100));

  const applyModifier = async (e) => {
    if (e.key === 'Enter' && modifierValue !== '' && isEditable) {
      const modifier = parseInt(modifierValue, 10);
      
      if (!isNaN(modifier)) {
        const newValue = Math.max(0, Math.min(maxVal, currentVal - modifier));
        setModifierValue(''); 
        
        // Met à jour l'interface instantanément
        if (onUpdate) {
          onUpdate(resourceKey, newValue);
        }

        // Si c'est le personnage de test, on s'arrête ici
        if (characterId === 'test-id') return;

        // Sinon, on sauvegarde silencieusement sur Firebase
        try {
          const charRef = doc(db, "characters", characterId);
          await updateDoc(charRef, {
            [`liveStats.${resourceKey}Current`]: newValue
          });
        } catch (error) {
          console.error("Erreur de mise à jour :", error);
        }
      }
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      
      <div style={{ width: '100%', backgroundColor: 'var(--code-bg)', height: '24px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ 
          width: `${percentage}%`, 
          backgroundColor: color, 
          height: '100%', 
          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
        }}></div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-h)' }}>
          {currentVal} / {maxVal}
        </span>
        
        {isEditable && (
          <input 
            type="number" 
            value={modifierValue}
            onChange={(e) => setModifierValue(e.target.value)}
            onKeyDown={applyModifier}
            placeholder="Dégâts..."
            style={{ 
              width: '80px', 
              padding: '4px 8px', 
              fontSize: '14px', 
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-h)'
            }}
          />
        )}
      </div>

    </div>
  );
}