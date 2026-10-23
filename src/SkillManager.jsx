import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const getNextPointCost = (currentVal, isNative) => {
  if (currentVal >= 90) return Infinity;
  if (!isNative) return currentVal < 70 ? 2 : 3; 
  if (currentVal < 50) return 1;
  if (currentVal < 70) return 2;
  return 3;
};

const calculateTotalSpent = (startVal, currentVal, isNative) => {
  let cost = 0;
  for (let i = startVal; i < currentVal; i++) cost += getNextPointCost(i, isNative);
  return cost;
};

// --- COMPOSANT LIGNE COMPACTE ---
const SkillRow = ({ 
  skill, 
  index,
  isEditable, 
  isMJ, 
  onUpdateValue, 
  onValidate, 
  onUnlock, 
  onDelete, 
  onUpdateSkillProp,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  // Le drag & drop n'est activé que si l'utilisateur clique sur la poignée :::
  const [isDraggable, setIsDraggable] = useState(false);

  const nextCost = getNextPointCost(skill.currentValue, skill.isNative);
  const floor = skill.lockedValue ?? skill.baseValue;
  const maxLimit = Math.min(skill.limit, 90);

  let barColor = '#48bb78'; // Vert
  if (nextCost === 2) barColor = '#d69e2e'; // Jaune
  if (nextCost === 3 || skill.currentValue >= 90) barColor = '#e53e3e'; // Rouge

  const lockedColor = 'var(--bg)'; 
  const availableColor = 'var(--border)'; 
  
  const trackBackground = `linear-gradient(to right, 
    ${barColor} 0%, ${barColor} ${skill.currentValue}%, 
    ${availableColor} ${skill.currentValue}%, ${availableColor} ${maxLimit}%, 
    ${lockedColor} ${maxLimit}%, ${lockedColor} 100%
  )`;

  return (
    <div 
      draggable={isDraggable}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={() => setIsDraggable(false)}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '4px', 
        padding: '8px 12px', 
        background: 'var(--code-bg)', 
        border: '1px solid var(--border)', 
        borderRadius: '6px', 
        fontSize: '13px',
        transition: 'transform 0.1s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        
        {/* Poignée Drag & Drop ::: (Active le drag uniquement ici) */}
        {isEditable && (
          <div 
            title="Maintenir et glisser pour réordonner" 
            onMouseDown={() => setIsDraggable(true)}
            onMouseUp={() => setIsDraggable(false)}
            onTouchStart={() => setIsDraggable(true)}
            onTouchEnd={() => setIsDraggable(false)}
            style={{ 
              cursor: 'grab', 
              userSelect: 'none', 
              color: 'var(--text)', 
              opacity: 0.6, 
              fontWeight: 'bold', 
              letterSpacing: '-1px',
              fontSize: '14px',
              paddingRight: '4px'
            }}
          >
            :::
          </div>
        )}

        {/* Nom & Badges + Métadonnées Joueur */}
        <div style={{ width: '190px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-h)' }}>{skill.name}</span>
            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: skill.isNative ? 'rgba(49, 130, 206, 0.2)' : 'rgba(229, 62, 62, 0.2)', color: skill.isNative ? '#3182ce' : '#e53e3e' }}>
              {skill.isNative ? 'Native' : 'Non-native'}
            </span>
          </div>

          {!isMJ && (
            <div style={{ fontSize: '10px', color: 'var(--text)', opacity: 0.85 }}>
              Base : {skill.baseValue} | Bloqué : {floor} | Max : {skill.limit}
            </div>
          )}
        </div>

        {/* Jauge fine colorée */}
        <input 
          type="range" className="skill-slider" min={0} max={100} value={skill.currentValue}
          onChange={(e) => onUpdateValue(skill.id, parseInt(e.target.value, 10))} 
          disabled={!isEditable}
          style={{ flex: 1, height: '6px', background: trackBackground, cursor: isEditable ? 'pointer' : 'not-allowed' }} 
        />

        {/* Valeur numérique */}
        <div style={{ fontWeight: 'bold', color: barColor, width: '32px', textAlign: 'right', fontSize: '15px' }}>
          {skill.currentValue}
        </div>

        {/* Actions MJ */}
        {isMJ && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <label style={{ fontSize: '10px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              B :
              <input type="number" title="Base" value={skill.baseValue} onChange={(e) => onUpdateSkillProp(skill.id, 'baseValue', parseInt(e.target.value, 10) || 0)} style={{ width: '36px', padding: '1px 2px', fontSize: '11px', borderRadius: '3px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
            </label>
            <label style={{ fontSize: '10px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              P :
              <input type="number" title="Plafond" value={skill.limit} onChange={(e) => onUpdateSkillProp(skill.id, 'limit', parseInt(e.target.value, 10) || 0)} style={{ width: '36px', padding: '1px 2px', fontSize: '11px', borderRadius: '3px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
            </label>

            {skill.currentValue > floor ? (
              <button onClick={() => onValidate(skill.id)} title="Bloquer/Valider ce niveau" style={{ background: 'none', border: 'none', color: '#48bb78', cursor: 'pointer', fontSize: '13px', padding: '0 2px', fontWeight: 'bold' }}>✔</button>
            ) : (skill.lockedValue > skill.baseValue) ? (
              <button onClick={() => onUnlock(skill.id)} title="Débloquer" style={{ background: 'none', border: 'none', color: '#d69e2e', cursor: 'pointer', fontSize: '13px', padding: '0 2px' }}>🔓</button>
            ) : null}

            <button onClick={() => onDelete(skill.id)} title="Supprimer" style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '13px', padding: '0 2px' }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
};


// --- COMPOSANT PRINCIPAL ---
export default function SkillManager({ characterId, initialSkills, totalPC, isSkillsLocked, isEditable, isMJ = false }) {
  const [skills, setSkills] = useState(initialSkills);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', baseValue: 10, limit: 80, isNative: true });

  const canInteract = isMJ || (isEditable && !isSkillsLocked);

  useEffect(() => {
    if (!hasUnsavedChanges) setSkills(initialSkills);
  }, [initialSkills, hasUnsavedChanges]);

  const spentPC = skills.reduce((acc, skill) => {
    const floor = skill.lockedValue ?? skill.baseValue;
    return acc + calculateTotalSpent(floor, skill.currentValue, skill.isNative);
  }, 0);
  
  const remainingPC = totalPC - spentPC;

  const saveToFirebase = async (updatedSkills, newTotalPC, newLockState) => {
    if (!characterId) return;
    try {
      const charRef = doc(db, "characters", characterId);
      const payload = {};
      if (updatedSkills !== undefined) payload.skills = updatedSkills;
      if (newTotalPC !== undefined) payload.totalPC = newTotalPC;
      if (newLockState !== undefined) payload.isSkillsLocked = newLockState;

      await updateDoc(charRef, payload);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Erreur de sauvegarde :", error);
    }
  };

  const handleUpdateValue = (skillId, targetValue) => {
    if (!canInteract) return;

    const updated = skills.map(skill => {
      if (skill.id === skillId) {
        const floor = skill.lockedValue ?? skill.baseValue;
        let safeTarget = Math.max(floor, Math.min(targetValue, skill.limit, 90));
        const currentlySpent = calculateTotalSpent(floor, skill.currentValue, skill.isNative);
        const maxPc = remainingPC + currentlySpent;
        
        let affordable = floor;
        let cost = 0;
        
        for (let i = floor; i < safeTarget; i++) {
          const c = getNextPointCost(i, skill.isNative);
          if (cost + c > maxPc) break;
          cost += c;
          affordable = i + 1;
        }
        return { ...skill, currentValue: affordable };
      }
      return skill;
    });

    setSkills(updated);
    setHasUnsavedChanges(true);
  };

  // --- DRAG AND DROP ---
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...skills];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setSkills(updated);
    saveToFirebase(updated, undefined, undefined);
    setDraggedIndex(null);
  };

  const handleToggleLock = () => saveToFirebase(undefined, undefined, !isSkillsLocked);

  const handleUpdatePCDelta = (delta) => {
    const newPC = Math.max(0, totalPC + delta);
    saveToFirebase(undefined, newPC, undefined);
  };

  const handleSetTotalPC = (value) => {
    const newPC = Math.max(0, value);
    saveToFirebase(undefined, newPC, undefined);
  };

  const handleUpdateSkillProp = (skillId, prop, value) => {
    const updated = skills.map(skill => {
      if (skill.id === skillId) {
        const updatedSkill = { ...skill, [prop]: value };
        if (prop === 'baseValue') {
          if (updatedSkill.currentValue < value) updatedSkill.currentValue = value;
          if (updatedSkill.lockedValue < value) updatedSkill.lockedValue = value;
        }
        if (prop === 'limit' && updatedSkill.currentValue > value) {
          updatedSkill.currentValue = Math.min(value, 90);
        }
        return updatedSkill;
      }
      return skill;
    });

    setSkills(updated);
    saveToFirebase(updated, undefined, undefined);
  };

  const handleValidateSkill = (skillId) => {
    const updated = skills.map(s => s.id === skillId ? { ...s, lockedValue: s.currentValue } : s);
    setSkills(updated);
    saveToFirebase(updated, undefined, undefined);
  };

  const handleUnlockSkill = (skillId) => {
    const updated = skills.map(s => s.id === skillId ? { ...s, lockedValue: s.baseValue } : s);
    setSkills(updated);
    saveToFirebase(updated, undefined, undefined);
  };

  const handleDeleteSkill = (skillId) => {
    const updated = skills.filter(s => s.id !== skillId);
    setSkills(updated);
    saveToFirebase(updated, undefined, undefined);
  };

  const handleAddSkillSubmit = (e) => {
    e.preventDefault();
    if (!newSkill.name.trim()) return;

    const createdSkill = {
      id: crypto.randomUUID(),
      name: newSkill.name.trim(),
      baseValue: newSkill.baseValue,
      lockedValue: newSkill.baseValue,
      currentValue: newSkill.baseValue,
      limit: newSkill.limit,
      isNative: newSkill.isNative
    };

    const updated = [...skills, createdSkill];
    setSkills(updated);
    saveToFirebase(updated, undefined, undefined);
    setNewSkill({ name: '', baseValue: 10, limit: 80, isNative: true });
    setShowAddSkill(false);
  };

  return (
    <div>
      {/* BANDEAU RÉCAPITULATIF DES PC */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '16px', background: 'var(--accent-bg)', borderRadius: '8px', border: '1px solid var(--accent-border)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ color: 'var(--text-h)' }}>Points de Compétence (PC)</strong>
            {isSkillsLocked ? 
              <span style={{ fontSize: '12px', color: '#e53e3e', background: 'rgba(229, 62, 62, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>🔒 Verrouillé</span> :
              <span style={{ fontSize: '12px', color: '#48bb78', background: 'rgba(72, 187, 120, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>🔓 Édition Joueur active</span>
            }
          </div>

          {hasUnsavedChanges && (
            <button onClick={() => saveToFirebase(skills)} className="btn-primary" style={{ marginTop: '8px', padding: '6px 12px', fontSize: '13px' }}>
              Sauvegarder l'évolution
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isMJ ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent)' }}>
                {remainingPC} / {totalPC} restants
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text)' }}>PC Max :</span>
                <button onClick={() => handleUpdatePCDelta(-1)} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }}>-1</button>
                <input 
                  type="number" 
                  value={totalPC} 
                  onChange={(e) => handleSetTotalPC(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '50px', padding: '2px 4px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
                />
                <button onClick={() => handleUpdatePCDelta(1)} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }}>+1</button>
                <button onClick={() => handleUpdatePCDelta(10)} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }}>+10</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent)' }}>
              {remainingPC} / {totalPC} restants
            </div>
          )}
        </div>
      </div>

      {/* PANNEAU DE CONTRÔLE RÉSERVÉ AU MJ */}
      {isMJ && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button onClick={handleToggleLock} className="btn-secondary" style={{ fontSize: '13px' }}>
            {isSkillsLocked ? '🔓 Déverrouiller pour le Joueur' : '🔒 Verrouiller la fiche'}
          </button>
          <button onClick={() => setShowAddSkill(!showAddSkill)} className="btn-primary" style={{ fontSize: '13px' }}>
            {showAddSkill ? 'Annuler' : '+ Ajouter une compétence'}
          </button>
        </div>
      )}

      {/* FORMULAIRE D'AJOUT DE COMPÉTENCE (MJ) */}
      {isMJ && showAddSkill && (
        <form onSubmit={handleAddSkillSubmit} style={{ padding: '16px', background: 'var(--code-bg)', border: '1px solid var(--accent-border)', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <strong style={{ color: 'var(--text-h)', fontSize: '14px' }}>Nouvelle compétence pour ce personnage</strong>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input required type="text" placeholder="Nom" value={newSkill.name} onChange={e => setNewSkill({...newSkill, name: e.target.value})} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input required type="number" placeholder="Base" value={newSkill.baseValue} onChange={e => setNewSkill({...newSkill, baseValue: parseInt(e.target.value, 10) || 0})} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
            <input required type="number" placeholder="Plafond" value={newSkill.limit} onChange={e => setNewSkill({...newSkill, limit: parseInt(e.target.value, 10) || 80})} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} />
          </div>
          <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={newSkill.isNative} onChange={e => setNewSkill({...newSkill, isNative: e.target.checked})} />
            Compétence native
          </label>
          <button type="submit" className="btn-primary" style={{ padding: '8px', fontSize: '13px' }}>Ajouter la compétence</button>
        </form>
      )}

      {/* LISTE DES COMPÉTENCES */}
      {skills.length === 0 ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic', fontSize: '14px' }}>Aucune compétence n'a encore été attribuée par le MJ.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {skills.map((skill, idx) => (
            <SkillRow 
              key={skill.id} 
              skill={skill} 
              index={idx}
              isEditable={isEditable} 
              isMJ={isMJ}
              onUpdateValue={handleUpdateValue}
              onValidate={handleValidateSkill}
              onUnlock={handleUnlockSkill}
              onDelete={handleDeleteSkill}
              onUpdateSkillProp={handleUpdateSkillProp}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}