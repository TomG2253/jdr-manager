import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import LiveResourceBar from './LiveResourceBar';
import SkillManager from './SkillManager';
import InventoryManager from './InventoryManager';
import StatusManager from './StatusManager';
import TraitManager from './TraitManager';
import NotesManager from './NotesManager';

export default function CharacterCard({ character, isEditable, isMJ = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [liveStats, setLiveStats] = useState(character.liveStats || { pvCurrent: 100, pvMax: 100, pmCurrent: 50, pmMax: 50 });
  
  // Pièces d'or
  const [gold, setGold] = useState(character.gold || 0);
  const [isEditingGold, setIsEditingGold] = useState(false);
  const [tempGold, setTempGold] = useState(character.gold || 0);

  // Profil
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: character.name || '',
    race: character.race || '',
    class: character.class || '',
    age: character.age || '',
    height: character.height || '',
    alignment: character.alignment || '',
    avatarUrl: character.avatarUrl || ''
  });

  useEffect(() => {
    if (character.liveStats) {
      setLiveStats(character.liveStats);
    }
    setGold(character.gold || 0);
    setTempGold(character.gold || 0);
  }, [character]);

  useEffect(() => {
    setProfileData({
      name: character.name || '',
      race: character.race || '',
      class: character.class || '',
      age: character.age || '',
      height: character.height || '',
      alignment: character.alignment || '',
      avatarUrl: character.avatarUrl || ''
    });
  }, [character]);

  const handleStatUpdate = (resourceKey, newValue) => {
    setLiveStats(prev => ({
      ...prev,
      [`${resourceKey}Current`]: newValue
    }));
  };

  const handleSaveGold = async (newVal) => {
    if (!isMJ) return;
    const safeVal = Math.max(0, parseInt(newVal, 10) || 0);
    setGold(safeVal);
    setIsEditingGold(false);
    if (!character.id || character.id === 'test-id') return;

    try {
      const charRef = doc(db, "characters", character.id);
      await updateDoc(charRef, { gold: safeVal });
    } catch (error) {
      console.error("Erreur mise à jour PO :", error);
    }
  };

  const handleGoldDelta = (delta) => {
    if (!isMJ) return;
    const safeVal = Math.max(0, gold + delta);
    handleSaveGold(safeVal);
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
        age: profileData.age,
        height: profileData.height,
        alignment: profileData.alignment,
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

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Âge (ex: 28 ans)" value={profileData.age} onChange={e => setProfileData({...profileData, age: e.target.value})} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input type="text" placeholder="Taille (ex: 1m75)" value={profileData.height} onChange={e => setProfileData({...profileData, height: e.target.value})} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input type="text" placeholder="Alignement (ex: Loyal Bon)" value={profileData.alignment} onChange={e => setProfileData({...profileData, alignment: e.target.value})} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          </div>

          <input type="url" placeholder="URL Avatar" value={profileData.avatarUrl} onChange={e => setProfileData({...profileData, avatarUrl: e.target.value})} style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsEditingProfile(false)} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }}>Annuler</button>
            <button type="submit" className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }}>Enregistrer</button>
          </div>
        </form>
      ) : (
        /* EN-TÊTE CLASSIQUE */
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--text-h)' }}>{character.name}</h3>
              {isEditable && (
                <button onClick={() => setIsEditingProfile(true)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', padding: 0, textDecoration: 'underline' }}>
                  ✏️ Modifier
                </button>
              )}
            </div>
            
            <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: '500', marginTop: '2px' }}>
              {character.race} • {character.class}
              {(character.age || character.height || character.alignment) && (
                <span style={{ opacity: 0.85, fontSize: '13px', marginLeft: '6px' }}>
                  ({[character.age, character.height, character.alignment].filter(Boolean).join(' • ')})
                </span>
              )}
            </div>
          </div>

          {/* COMPTEUR DE PIÈCES D'OR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 12px', 
              background: 'var(--code-bg)', 
              border: '1px solid #d69e2e', 
              borderRadius: '20px', 
              fontSize: '14px', 
              fontWeight: 'bold', 
              color: '#d69e2e' 
            }}>
              <span>🪙</span>
              {isEditingGold && isMJ ? (
                <input 
                  type="number" 
                  autoFocus
                  value={tempGold} 
                  onChange={(e) => setTempGold(e.target.value)}
                  onBlur={() => handleSaveGold(tempGold)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveGold(tempGold)}
                  style={{ width: '60px', padding: '1px 4px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
                />
              ) : (
                <span 
                  onClick={() => { if (isMJ) { setTempGold(gold); setIsEditingGold(true); } }}
                  title={isMJ ? "Cliquer pour modifier les PO" : undefined}
                  style={{ cursor: isMJ ? 'pointer' : 'default', textDecoration: isMJ ? 'underline dotted' : 'none' }}
                >
                  {gold} PO
                </span>
              )}

              {isMJ && (
                <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                  <button onClick={() => handleGoldDelta(-10)} title="-10 PO" className="btn-secondary" style={{ padding: '0 4px', fontSize: '10px', height: '18px' }}>-10</button>
                  <button onClick={() => handleGoldDelta(-1)} title="-1 PO" className="btn-secondary" style={{ padding: '0 4px', fontSize: '10px', height: '18px' }}>-1</button>
                  <button onClick={() => handleGoldDelta(1)} title="+1 PO" className="btn-secondary" style={{ padding: '0 4px', fontSize: '10px', height: '18px' }}>+1</button>
                  <button onClick={() => handleGoldDelta(10)} title="+10 PO" className="btn-secondary" style={{ padding: '0 4px', fontSize: '10px', height: '18px' }}>+10</button>
                </div>
              )}
            </div>

            <button onClick={() => setIsExpanded(!isExpanded)} className="btn-secondary" style={{ fontSize: '14px' }}>
              {isExpanded ? 'Réduire la fiche' : 'Ouvrir la fiche'}
            </button>
          </div>
        </div>
      )}

      {/* GESTIONNAIRES DE STATUTS ET DE TRAITS (MJ UNIQUEMENT) */}
      <StatusManager 
        characterId={character.id} 
        statuses={character.statuses || []} 
        isMJ={isMJ} 
      />

      <TraitManager 
        characterId={character.id} 
        traits={character.traits || []} 
        isMJ={isMJ} 
      />

      {/* BLOC AVATAR + BARRES PV/PM */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <div style={{ 
          width: '120px', height: '120px', borderRadius: '8px', backgroundColor: 'var(--code-bg)',
          border: '1px solid var(--border)', backgroundImage: `url(${character.avatarUrl || ''})`,
          backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0
        }} />
        
        <div style={{ flex: 1 }}>
          <LiveResourceBar 
            characterId={character.id} 
            resourceKey="pv" 
            currentVal={liveStats.pvCurrent} 
            maxVal={liveStats.pvMax} 
            color="#e53e3e" 
            isEditable={isEditable} 
            isMJ={isMJ} 
            onUpdate={handleStatUpdate}
          />
          <LiveResourceBar 
            characterId={character.id} 
            resourceKey="pm" 
            currentVal={liveStats.pmCurrent} 
            maxVal={liveStats.pmMax} 
            color="#3182ce" 
            isEditable={isEditable} 
            isMJ={isMJ} 
            onUpdate={handleStatUpdate}
          />
        </div>
      </div>

      {/* VOLET DÉPLIABLE */}
      {isExpanded && (
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
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

          <NotesManager 
            characterId={character.id}
            initialNotes={character.notes || []}
            isEditable={isEditable}
          />
        </div>
      )}
    </div>
  );
}