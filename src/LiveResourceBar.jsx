import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function LiveResourceBar({ characterId, resourceKey, currentVal, maxVal, color, isEditable }) {
  const [modifierValue, setModifierValue] = useState('');

  // Sécurité pour éviter les barres qui dépassent visuellement 100% ou descendent sous 0%
  const percentage = Math.max(0, Math.min(100, (currentVal / maxVal) * 100));

  const applyModifier = async (e) => {
    if (e.key === 'Enter' && modifierValue !== '' && isEditable) {
      const modifier = parseInt(modifierValue, 10);
      
      if (!isNaN(modifier)) {
        // Soustraction : un nombre positif fait des dégâts, un négatif soigne
        const newValue = Math.max(0, Math.min(maxVal, currentVal - modifier));
        setModifierValue(''); // On vide l'input
        
        // Si c'est un faux personnage de test, on ne contacte pas Firebase
        if (characterId === 'test-id') {
          alert(`Test UI : La valeur passerait à ${newValue}`);
          return;
        }

        // Mise à jour temps réel dans Firestore
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
      
      {/* Conteneur de la barre */}
      <div style={{ width: '100%', backgroundColor: 'var(--code-bg)', height: '24px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ 
          width: `${percentage}%`, 
          backgroundColor: color, 
          height: '100%', 
          transition: 'width 0.4s ease-out' 
        }}></div>
      </div>
      
      {/* Informations sous la barre */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-h)' }}>
          {currentVal} / {maxVal}
        </span>
        
        {/* Le champ n'apparaît que si l'utilisateur a le droit d'édition */}
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