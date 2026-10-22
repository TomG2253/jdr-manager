import { useState } from 'react';
import LiveResourceBar from './LiveResourceBar';
import SkillManager from './SkillManager'; // <-- Nouvel import

export default function CharacterCard({ character, isEditable }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{ 
      border: '1px solid var(--border)', 
      borderRadius: '12px', 
      padding: '24px', 
      backgroundColor: 'var(--bg)',
      transition: 'all 0.3s ease',
      boxShadow: 'var(--shadow)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      {/* --- EN-TÊTE --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '22px', color: 'var(--text-h)' }}>{character.name}</h3>
          <span style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '500' }}>
            {character.race} • {character.class}
          </span>
        </div>
        
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="btn-secondary"
          style={{ fontSize: '14px' }}
        >
          {isExpanded ? 'Réduire la fiche' : 'Ouvrir la fiche'}
        </button>
      </div>

      {/* --- VUE COMPACTE (Action) --- */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <div style={{ 
          width: '120px', 
          height: '120px', 
          borderRadius: '8px',
          backgroundColor: 'var(--code-bg)',
          border: '1px solid var(--border)',
          backgroundImage: `url(${character.avatarUrl || ''})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          flexShrink: 0
        }} />
        
        <div style={{ flex: 1 }}>
          <LiveResourceBar 
            characterId={character.id}
            resourceKey="pv"
            currentVal={character.liveStats.pvCurrent} 
            maxVal={character.liveStats.pvMax} 
            color="#e53e3e" 
            isEditable={isEditable}
          />
          <LiveResourceBar 
            characterId={character.id}
            resourceKey="pm"
            currentVal={character.liveStats.pmCurrent} 
            maxVal={character.liveStats.pmMax} 
            color="#3182ce" 
            isEditable={isEditable}
          />
        </div>
      </div>

      {/* --- VUE ÉTENDUE (Gestion des Compétences) --- */}
      {isExpanded && (
        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-h)' }}>Évolution du Personnage</h4>
          
          {/* Le calculateur magique */}
          <SkillManager 
            initialSkills={character.skills || []} 
            totalPC={character.totalPC || 0} 
            isEditable={isEditable} 
          />
          
        </div>
      )}

    </div>
  );
}