import { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import LiveResourceBar from './LiveResourceBar';
import SkillManager from './SkillManager';
import InventoryManager from './InventoryManager';
import StatusManager from './StatusManager';
import TraitManager from './TraitManager';
import NotesManager from './NotesManager';
import ImageInput from './ImageInput';
import { resolveAssetUrl } from './presets';

export default function CharacterCard({ character, isEditable, isMJ = false }) {
  const [activeTab, setActiveTab] = useState(null);

  const [liveStats, setLiveStats] = useState(character.liveStats || { pvCurrent: 100, pvMax: 100, pmCurrent: 50, pmMax: 50 });
  const [gold, setGold] = useState(character.gold || 0);
  const [isEditingGold, setIsEditingGold] = useState(false);
  const [tempGold, setTempGold] = useState(character.gold || 0);

  // Profil du joueur qui contrôle ce personnage (utilisé par le MJ)
  const [playerUser, setPlayerUser] = useState(null);

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

  // Récupération de l'avatar/pseudo du joueur pour la vue MJ uniquement
  useEffect(() => {
    if (!isMJ) {
      setPlayerUser(null);
      return;
    }

    const playerUid = character.ownerUid || character.ownerId || character.userId || character.playerId;
    if (!playerUid) {
      setPlayerUser(null);
      return;
    }

    const fetchPlayerUser = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", playerUid));
        if (userSnap.exists()) {
          setPlayerUser(userSnap.data());
        } else {
          setPlayerUser(null);
        }
      } catch (err) {
        console.error("Erreur récupération du profil joueur :", err);
        setPlayerUser(null);
      }
    };

    fetchPlayerUser();
  }, [character, isMJ]);

  useEffect(() => {
    if (character.liveStats) setLiveStats(character.liveStats);
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

  const handleToggleTab = (tabName) => {
    setActiveTab(prev => prev === tabName ? null : tabName);
  };

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
    if (!character.id) return;
    try {
      const charRef = doc(db, "characters", character.id);
      await updateDoc(charRef, { gold: safeVal });
    } catch (error) {
      console.error("Erreur PO :", error);
    }
  };

  const handleGoldDelta = (delta) => {
    if (!isMJ) return;
    handleSaveGold(gold + delta);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!character.id) {
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
      console.error("Erreur profil :", error);
    }
  };

  return (
    <div className="character-card">
      {isEditingProfile ? (
        <form onSubmit={handleSaveProfile} style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: 'var(--code-bg)', borderRadius: '8px', border: '1px solid var(--accent-border)' }}>
          <strong style={{ color: 'var(--text-h)', fontSize: '13px' }}>Éditer le profil</strong>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input required type="text" placeholder="Nom" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} style={{ flex: 2, minWidth: '140px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input required type="text" placeholder="Race" value={profileData.race} onChange={e => setProfileData({ ...profileData, race: e.target.value })} style={{ flex: 1, minWidth: '100px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input required type="text" placeholder="Classe" value={profileData.class} onChange={e => setProfileData({ ...profileData, class: e.target.value })} style={{ flex: 1, minWidth: '100px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Âge" value={profileData.age} onChange={e => setProfileData({ ...profileData, age: e.target.value })} style={{ flex: 1, minWidth: '80px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input type="text" placeholder="Taille" value={profileData.height} onChange={e => setProfileData({ ...profileData, height: e.target.value })} style={{ flex: 1, minWidth: '80px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input type="text" placeholder="Alignement" value={profileData.alignment} onChange={e => setProfileData({ ...profileData, alignment: e.target.value })} style={{ flex: 1, minWidth: '110px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          </div>

          <ImageInput
            value={profileData.avatarUrl}
            onChange={url => setProfileData({ ...profileData, avatarUrl: url })}
            placeholder="URL de l'avatar ou importer une photo..."
          />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsEditingProfile(false)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>Annuler</button>
            <button type="submit" className="btn-primary" style={{ padding: '4px 10px', fontSize: '11px' }}>Enregistrer</button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-h)' }}>{character.name}</h3>

              {/* PASTILLE DU JOUEUR (Affichée uniquement côté MJ) */}
              {isMJ && playerUser && (
                <div
                  title={`Joué par : ${playerUser.username || playerUser.pseudo || 'Joueur'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--code-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    padding: '2px 8px 2px 4px'
                  }}
                >
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={resolveAssetUrl(playerUser.avatarUrl)}
                      alt={playerUser.username || playerUser.pseudo}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = './assets/jdr-bag.jpg';
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-h)' }}>
                    {playerUser.username || playerUser.pseudo}
                  </span>
                </div>
              )}

              {isEditable && (
                <button onClick={() => setIsEditingProfile(true)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '11px', padding: 0, textDecoration: 'underline' }}>
                  Modifier
                </button>
              )}
            </div>

            <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '500', marginTop: '2px' }}>
              {character.race} - {character.class}
              {(character.age || character.height || character.alignment) && (
                <span style={{ opacity: 0.85, fontSize: '12px', marginLeft: '6px' }}>
                  ({[character.age, character.height, character.alignment].filter(Boolean).join(' - ')})
                </span>
              )}
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
            background: 'var(--code-bg)', border: '1px solid #d69e2e', borderRadius: '16px',
            fontSize: '13px', fontWeight: 'bold', color: '#d69e2e'
          }}>
            <span>PO</span>
            {isEditingGold && isMJ ? (
              <input
                type="number" autoFocus value={tempGold}
                onChange={(e) => setTempGold(e.target.value)}
                onBlur={() => handleSaveGold(tempGold)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveGold(tempGold)}
                style={{ width: '50px', padding: '1px 4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
              />
            ) : (
              <span
                onClick={() => { if (isMJ) { setTempGold(gold); setIsEditingGold(true); } }}
                style={{ cursor: isMJ ? 'pointer' : 'default', textDecoration: isMJ ? 'underline dotted' : 'none' }}
              >
                {gold} PO
              </span>
            )}
            {isMJ && (
              <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                <button onClick={() => handleGoldDelta(-10)} title="-10 PO" className="btn-secondary" style={{ padding: '0 3px', fontSize: '9px', height: '16px' }}>-10</button>
                <button onClick={() => handleGoldDelta(-1)} title="-1 PO" className="btn-secondary" style={{ padding: '0 3px', fontSize: '9px', height: '16px' }}>-1</button>
                <button onClick={() => handleGoldDelta(1)} title="+1 PO" className="btn-secondary" style={{ padding: '0 3px', fontSize: '9px', height: '16px' }}>+1</button>
                <button onClick={() => handleGoldDelta(10)} title="+10 PO" className="btn-secondary" style={{ padding: '0 3px', fontSize: '9px', height: '16px' }}>+10</button>
              </div>
            )}
          </div>
        </div>
      )}

      <StatusManager characterId={character.id} statuses={character.statuses || []} isMJ={isMJ} />
      <TraitManager characterId={character.id} traits={character.traits || []} isMJ={isMJ} />

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '8px', backgroundColor: 'var(--code-bg)',
          border: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <img
            src={resolveAssetUrl(character.avatarUrl)}
            alt={character.name}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = './assets/jdr-bag.jpg';
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <LiveResourceBar characterId={character.id} resourceKey="pv" currentVal={liveStats.pvCurrent} maxVal={liveStats.pvMax} color="#e53e3e" isEditable={isEditable} isMJ={isMJ} onUpdate={handleStatUpdate} />
          <LiveResourceBar characterId={character.id} resourceKey="pm" currentVal={liveStats.pmCurrent} maxVal={liveStats.pmMax} color="#3182ce" isEditable={isEditable} isMJ={isMJ} onUpdate={handleStatUpdate} />
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: activeTab ? '16px' : '0px', overflowX: 'auto' }}>
        <button
          onClick={() => handleToggleTab('skills')}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 'bold',
            border: 'none',
            background: 'none',
            color: activeTab === 'skills' ? 'var(--accent)' : 'var(--text)',
            borderBottom: activeTab === 'skills' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          Compétences
        </button>
        <button
          onClick={() => handleToggleTab('inventory')}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 'bold',
            border: 'none',
            background: 'none',
            color: activeTab === 'inventory' ? 'var(--accent)' : 'var(--text)',
            borderBottom: activeTab === 'inventory' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          Inventaire
        </button>
        <button
          onClick={() => handleToggleTab('journal')}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 'bold',
            border: 'none',
            background: 'none',
            color: activeTab === 'journal' ? 'var(--accent)' : 'var(--text)',
            borderBottom: activeTab === 'journal' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          Journal & Notes
        </button>
      </div>

      {activeTab && (
        <div>
          {activeTab === 'skills' && (
            <SkillManager
              characterId={character.id}
              initialSkills={character.skills || []}
              totalPC={character.totalPC || 0}
              isSkillsLocked={character.isSkillsLocked ?? true}
              isEditable={isEditable}
              isMJ={isMJ}
              skillCategories={character.skillCategories || []}
              lockedSpentPC={character.lockedSpentPC || 0}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryManager
              characterId={character.id}
              mjUid={character.mjUid || character.mjId}
              items={character.inventory || []}
              inventoryWidth={character.inventoryWidth || 4}
              inventoryHeight={character.inventoryHeight || 3}
              isEditable={isEditable}
              isMJ={isMJ}
            />
          )}
          {activeTab === 'journal' && (
            <NotesManager
              characterId={character.id}
              initialNotes={character.notes || []}
              isEditable={isEditable}
            />
          )}
        </div>
      )}
    </div>
  );
}