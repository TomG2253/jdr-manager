import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import LiveResourceBar from './LiveResourceBar';
import SkillManager from './SkillManager'; 
import InventoryManager from './InventoryManager';

export default function CharacterCard({ character, isEditable, isMJ = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [liveStats, setLiveStats] = useState(character.liveStats);
  
  // Édition des infos de profil
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: character.name || '',
    race: character.race || '',
    class: character.class || '',
    avatarUrl: character.avatarUrl || ''
  });

  useEffect(() => {
    setLiveStats(character.liveStats);
  }, [character.liveStats]);

  useEffect(() => {
    setProfileData({
      name: character.name || '',
      race: character.race || '',
      class: character.class || '',
      avatarUrl: character.avatarUrl || ''
    });
  }, [character]);

  const handleStatUpdate = (resourceKey, newValue) => {
    setLiveStats(prev => ({
      ...prev,
      [`${resourceKey}Current`]: newValue
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!character.id || character.id === 'test-id') {
      setIsEditingProfile(false);
      return;
    }

    try {
      const charRef = doc(db, "characters", character.id);
      await updateDoc(charRef, {
        name: profileData.name,
        race: profileData.race,
        class: profileData.class,
        avatarUrl: profileData.avatarUrl
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Erreur mise à jour profil :", error);
    }
  };

  return (
    <div style={{ 
      border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', 
      backgroundColor: 'var(--bg)', transition: 'all 0.3s ease', boxShadow: 'var(--shadow)',
      position: 'relative', overflow: 'hidden'
    }}>
      
      {/* MODE ÉDITION DU PROFIL */}
      {isEditingProfile ? (
        <form onSubmit={handleSaveProfile} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--code-bg)', borderRadius: '8px', border: '1px solid var(--accent-border)' }}>
          <strong style={{ color: 'var(--text-h)', fontSize: '14px' }}>Éditer le personnage</strong>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input required type="text" placeholder="Nom" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} style={{ flex: 2, padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input required type="text" placeholder="Race" value={profileData.race} onChange={e => setProfileData({...profileData, race: e.target.value})} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input required type="text" placeholder="Classe" value={profileData.class} onChange={e => setProfileData({...profileData, class: e.target.value})} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          </div>
          <input type="url" placeholder="URL Avatar" value={profileData.avatarUrl} onChange={e => setProfileData({...profileData, avatarUrl: e.target.value})} style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsEditingProfile(false)} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }}>Annuler</button>
            <button type="submit" className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }}>Enregistrer</button>
          </div>
        </form>
      ) : (
        /* EN-TÊTE CLASSIQUE */
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--text-h)' }}>{character.name}</h3>
              {isEditable && (
                <button onClick={() => setIsEditingProfile(true)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', padding: 0, textDecoration: 'underline' }}>
                  ✏️ Modifier
                </button>
              )}
            </div>
            <span style={{ color: 'var(--text)', fontSize: '15px', fontWeight: '500' }}>
              {character.race} • {character.class}
            </span>
          </div>

          <button onClick={() => setIsExpanded(!isExpanded)} className="btn-secondary" style={{ fontSize: '14px' }}>
            {isExpanded ? 'Réduire la fiche' : 'Ouvrir la fiche'}
          </button>
        </div>
      )}

      {/* BLOC AVATAR + BARS PV/PM */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <div style={{ 
          width: '120px', height: '120px', borderRadius: '8px', backgroundColor: 'var(--code-bg)',
          border: '1px solid var(--border)', backgroundImage: `url(${character.avatarUrl || ''})`,
          backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0
        }} />
        
        <div style={{ flex: 1 }}>
          <LiveResourceBar 
            characterId={character.id} resourceKey="pv" currentVal={liveStats.pvCurrent} 
            maxVal={liveStats.pvMax} color="#e53e3e" isEditable={isEditable} onUpdate={handleStatUpdate}
          />
          <LiveResourceBar 
            characterId={character.id} resourceKey="pm" currentVal={liveStats.pmCurrent} 
            maxVal={liveStats.pmMax} color="#3182ce" isEditable={isEditable} onUpdate={handleStatUpdate}
          />
        </div>
      </div>

      {/* VOLET DÉPLIABLE DES COMPÉTENCES */}
      {isExpanded && (
        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-h)' }}>Évolution du Personnage</h4>
          <SkillManager 
            characterId={character.id}
            initialSkills={character.skills || []} 
            totalPC={character.totalPC || 0} 
            isSkillsLocked={character.isSkillsLocked ?? true}
            isEditable={isEditable} 
            isMJ={isMJ}
          />
          <InventoryManager 
  characterId={character.id}
  mjUid={character.mjId}
  items={character.inventory || []}
  inventoryWidth={character.inventoryWidth || 4}
  inventoryHeight={character.inventoryHeight || 3}
  isEditable={isEditable}
  isMJ={isMJ}
/>
        </div>
      )}
    </div>
  );
}