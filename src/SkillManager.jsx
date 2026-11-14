import { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const DEFAULT_CATEGORIES = ['Force', 'Dextérité', 'Magie', 'Social / Intelligence'];

const getNextPointCost = (currentVal, isNative) => {
  if (currentVal >= 90) return Infinity;
  if (!isNative) return currentVal < 70 ? 2 : 3;
  if (currentVal < 50) return 1;
  if (currentVal < 70) return 2;
  return 3;
};

const calculateTotalSpent = (startVal, currentVal, isNative) => {
  if (currentVal <= startVal) return 0;
  let cost = 0;
  for (let i = startVal; i < currentVal; i++) cost += getNextPointCost(i, isNative);
  return cost;
};

// --- LIGNE DE COMPÉTENCE (IDENTIQUE MJ / JOUEUR) ---
const SkillRow = ({
  skill,
  index,
  canInteract,
  canReorder,
  isMJ,
  onUpdateValue,
  onEditClick,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const [isDraggable, setIsDraggable] = useState(false);

  const nextCost = getNextPointCost(skill.currentValue, skill.isNative);
  const floor = skill.lockedValue ?? skill.baseValue;
  const maxLimit = Math.min(skill.limit, 90);

  let barColor = '#48bb78'; // Vert (1 PC)
  if (nextCost === 2) barColor = '#d69e2e'; // Jaune (2 PC)
  if (nextCost === 3 || skill.currentValue >= 90) barColor = '#e53e3e'; // Rouge (3 PC ou max)

  const lockedColor = 'var(--bg)';
  const availableColor = 'var(--border)';

  const trackBackground = `linear-gradient(to right, 
    ${barColor} 0%, ${barColor} ${skill.currentValue}%, 
    ${availableColor} ${skill.currentValue}%, ${availableColor} ${maxLimit}%, 
    ${lockedColor} ${maxLimit}%, ${lockedColor} 100%
  )`;

  return (
    <div
      draggable={isDraggable && canReorder}
      onDragStart={(e) => canReorder && onDragStart(e, index)}
      onDragOver={(e) => canReorder && onDragOver(e, index)}
      onDrop={(e) => canReorder && onDrop(e, index)}
      onDragEnd={() => setIsDraggable(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: 'var(--code-bg)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        fontSize: '13px'
      }}
    >
      {/* Poignée Drag & Drop ::: */}
      {canReorder && (
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
            paddingRight: '2px'
          }}
        >
          :::
        </div>
      )}

      {/* Nom, Badges & Métadonnées */}
      <div style={{ width: '215px', minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text-h)' }}>{skill.name}</span>
          <span
            style={{
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '3px',
              background: skill.isNative ? 'rgba(49, 130, 206, 0.2)' : 'rgba(229, 62, 62, 0.2)',
              color: skill.isNative ? '#3182ce' : '#e53e3e'
            }}
          >
            {skill.isNative ? 'Native' : 'Non-native'}
          </span>
          {skill.category && (
            <span
              style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)'
              }}
            >
              {skill.category}
            </span>
          )}
        </div>

        <div style={{ fontSize: '10px', color: 'var(--text)', opacity: 0.85 }}>
          Base : {skill.baseValue} | Bloqué : {floor} | Max : {skill.limit}
        </div>
      </div>

      {/* Jauge fine colorée */}
      <input
        type="range"
        className="skill-slider"
        min={0}
        max={100}
        value={skill.currentValue}
        onChange={(e) => onUpdateValue(skill.id, parseInt(e.target.value, 10))}
        disabled={!canInteract}
        style={{
          flex: 1,
          minWidth: '100px',
          height: '6px',
          background: trackBackground,
          cursor: canInteract ? 'pointer' : 'not-allowed'
        }}
      />

      {/* Valeur numérique */}
      <div style={{ fontWeight: 'bold', color: barColor, width: '30px', textAlign: 'right', fontSize: '15px' }}>
        {skill.currentValue}
      </div>

      {/* Boutons compacts réservés au MJ */}
      {isMJ && (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => onEditClick(skill)}
            title="Modifier la compétence"
            className="btn-secondary"
            style={{ fontSize: '11px', padding: '2px 7px' }}
          >
            Editer
          </button>
          <button
            type="button"
            onClick={() => onDelete(skill.id)}
            title="Supprimer"
            style={{
              background: 'none',
              border: 'none',
              color: '#e53e3e',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '2px 5px'
            }}
          >
            X
          </button>
        </div>
      )}
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
export default function SkillManager({
  characterId,
  initialSkills = [],
  totalPC = 0,
  isSkillsLocked = true,
  isEditable = true,
  isMJ = false,
  skillCategories = []
}) {
  const [skills, setSkills] = useState(initialSkills);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Filtres et tris
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('index'); // 'index' | 'points' | 'native' | 'category'
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Ajout rapide de catégorie (MJ)
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Formulaire création / édition MJ
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [skillForm, setSkillForm] = useState({
    name: '',
    category: 'Force',
    baseValue: 10,
    lockedValue: 10,
    limit: 80,
    isNative: true
  });

  const canInteract = isMJ || (isEditable && !isSkillsLocked);

  useEffect(() => {
    if (!hasUnsavedChanges) setSkills(initialSkills);
  }, [initialSkills, hasUnsavedChanges]);

  const allCategories = useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...(skillCategories || [])]);
    skills.forEach((s) => {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    });
    return Array.from(set);
  }, [skillCategories, skills]);

  const spentPC = skills.reduce((acc, skill) => {
    const floor = skill.lockedValue ?? skill.baseValue;
    return acc + calculateTotalSpent(floor, skill.currentValue, skill.isNative);
  }, 0);

  const remainingPC = Math.max(0, totalPC - spentPC);

  const saveToFirebase = async (updatedSkills, extraFields = {}) => {
    if (!characterId) return;
    try {
      const charRef = doc(db, 'characters', characterId);
      const payload = { ...extraFields };
      if (updatedSkills !== undefined) payload.skills = updatedSkills;

      await updateDoc(charRef, payload);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Erreur de sauvegarde :', error);
    }
  };

  // Jauge soumise exactement aux mêmes règles PC / plancher / plafond pour MJ et Joueur
  const handleUpdateValue = (skillId, targetValue) => {
    if (!canInteract) return;

    const updated = skills.map((skill) => {
      if (skill.id !== skillId) return skill;

      const floor = skill.lockedValue ?? skill.baseValue;
      const safeTarget = Math.max(floor, Math.min(targetValue, skill.limit, 90));
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
    });

    setSkills(updated);
    setHasUnsavedChanges(true);
  };

  // --- DRAG AND DROP ---
  const isDefaultOrderView =
    sortBy === 'index' &&
    selectedCategory === 'ALL' &&
    !searchQuery.trim() &&
    !groupByCategory;

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...skills];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setSkills(updated);
    saveToFirebase(updated);
    setDraggedIndex(null);
  };

  // --- VERROUILLAGE / DÉVERROUILLAGE DE PHASE (MJ) ---
  const handleToggleLock = () => {
    if (!isMJ) return;

    if (!isSkillsLocked) {
      // Verrouillage : fige le palier atteint comme nouveau plancher et remet le budget de phase à 0
      const lockedSkills = skills.map((s) => ({
        ...s,
        lockedValue: s.currentValue
      }));
      setSkills(lockedSkills);
      saveToFirebase(lockedSkills, {
        isSkillsLocked: true,
        totalPC: 0
      });
    } else {
      // Déverrouillage : ouvre une nouvelle phase d'XP à 0 / 0 PC restants
      saveToFirebase(undefined, {
        isSkillsLocked: false,
        totalPC: 0
      });
    }
  };

  const handleUpdatePCDelta = (delta) => {
    const newPC = Math.max(0, totalPC + delta);
    saveToFirebase(undefined, { totalPC: newPC });
  };

  const handleSetTotalPC = (value) => {
    const newPC = Math.max(0, value);
    saveToFirebase(undefined, { totalPC: newPC });
  };

  // --- CRÉATION & ÉDITION D'UNE COMPÉTENCE (MJ) ---
  const openCreateForm = () => {
    setEditingSkill(null);
    setSkillForm({
      name: '',
      category: allCategories[0] || 'Force',
      baseValue: 10,
      lockedValue: 10,
      limit: 80,
      isNative: true
    });
    setShowAddSkill(!showAddSkill);
  };

  const openEditForm = (skill) => {
    setShowAddSkill(false);
    setEditingSkill(skill);
    setSkillForm({
      name: skill.name || '',
      category: skill.category || allCategories[0] || 'Force',
      baseValue: skill.baseValue ?? 0,
      lockedValue: skill.lockedValue ?? skill.baseValue ?? 0,
      limit: skill.limit ?? 80,
      isNative: Boolean(skill.isNative)
    });
  };

  const handleSaveSkillForm = (e) => {
    e.preventDefault();
    if (!skillForm.name.trim() || !isMJ) return;

    const chosenCat = skillForm.category.trim() || 'Force';
    const updatedCats = allCategories.includes(chosenCat)
      ? allCategories
      : [...allCategories, chosenCat];

    const cleanBase = Math.max(0, Math.min(90, parseInt(skillForm.baseValue, 10) || 0));
    const cleanLimit = Math.max(cleanBase, Math.min(90, parseInt(skillForm.limit, 10) || 80));
    const rawLocked = parseInt(skillForm.lockedValue, 10);
    const cleanLocked = Math.max(cleanBase, Math.min(cleanLimit, isNaN(rawLocked) ? cleanBase : rawLocked));

    if (editingSkill) {
      const updated = skills.map((s) => {
        if (s.id !== editingSkill.id) return s;
        // Ajuste currentValue uniquement s'il sort des nouvelles bornes [cleanLocked, cleanLimit]
        const adjustedCurrent = Math.max(cleanLocked, Math.min(cleanLimit, s.currentValue));
        return {
          ...s,
          name: skillForm.name.trim(),
          category: chosenCat,
          baseValue: cleanBase,
          lockedValue: cleanLocked,
          currentValue: adjustedCurrent,
          limit: cleanLimit,
          isNative: skillForm.isNative
        };
      });
      setSkills(updated);
      saveToFirebase(updated, { skillCategories: updatedCats });
      setEditingSkill(null);
    } else {
      const createdSkill = {
        id: crypto.randomUUID(),
        name: skillForm.name.trim(),
        category: chosenCat,
        baseValue: cleanBase,
        lockedValue: cleanBase,
        currentValue: cleanBase,
        limit: cleanLimit,
        isNative: skillForm.isNative
      };
      const updated = [...skills, createdSkill];
      setSkills(updated);
      saveToFirebase(updated, { skillCategories: updatedCats });
      setShowAddSkill(false);
    }
  };

  const handleDeleteSkill = (skillId) => {
    const updated = skills.filter((s) => s.id !== skillId);
    setSkills(updated);
    saveToFirebase(updated);
    if (editingSkill?.id === skillId) setEditingSkill(null);
  };

  const handleAddCategorySubmit = (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (!allCategories.includes(trimmed)) {
      saveToFirebase(undefined, { skillCategories: [...allCategories, trimmed] });
    }
    setSelectedCategory(trimmed);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  // --- FILTRAGE & TRI ---
  const filteredAndSortedSkills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const withOriginalIndex = skills.map((s, idx) => ({ ...s, _defaultIndex: idx }));

    const filtered = withOriginalIndex.filter((s) => {
      const cat = s.category || 'Sans catégorie';
      if (selectedCategory !== 'ALL' && cat !== selectedCategory) return false;
      if (!q) return true;
      return (s.name || '').toLowerCase().includes(q) || cat.toLowerCase().includes(q);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'points') {
        const diff = (b.currentValue || 0) - (a.currentValue || 0);
        return diff !== 0 ? diff : a._defaultIndex - b._defaultIndex;
      }
      if (sortBy === 'native') {
        const natA = a.isNative ? 1 : 0;
        const natB = b.isNative ? 1 : 0;
        if (natB !== natA) return natB - natA;
        return a._defaultIndex - b._defaultIndex;
      }
      if (sortBy === 'category') {
        const catA = (a.category || 'zzz').toLowerCase();
        const catB = (b.category || 'zzz').toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB, 'fr');
        return a._defaultIndex - b._defaultIndex;
      }
      return a._defaultIndex - b._defaultIndex;
    });
  }, [skills, searchQuery, selectedCategory, sortBy]);

  const groupedSkills = useMemo(() => {
    if (!groupByCategory) return null;
    const groups = {};
    filteredAndSortedSkills.forEach((skill) => {
      const cat = skill.category || 'Sans catégorie';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(skill);
    });
    return groups;
  }, [filteredAndSortedSkills, groupByCategory]);

  const pillStyle = (active) => ({
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '14px',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent)' : 'var(--bg)',
    color: active ? '#fff' : 'var(--text)',
    cursor: 'pointer',
    fontWeight: active ? 'bold' : 'normal',
    whiteSpace: 'nowrap'
  });

  return (
    <div>
      {/* EN-TÊTE COMPACT : PC RESTANTS + STATUT */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 14px',
          marginBottom: '12px',
          background: 'var(--code-bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: remainingPC > 0 ? '#48bb78' : 'var(--text-h)' }}>
            {remainingPC} / {totalPC} PC restants
          </span>

          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: isSkillsLocked ? 'rgba(229, 62, 62, 0.12)' : 'rgba(72, 187, 120, 0.12)',
              color: isSkillsLocked ? '#e53e3e' : '#48bb78'
            }}
          >
            {isSkillsLocked ? 'Verrouillé' : 'Déverrouillé'}
          </span>

          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={() => saveToFirebase(skills)}
              className="btn-primary"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Sauvegarder
            </button>
          )}
        </div>

        {/* CONTRÔLES MJ */}
        {isMJ && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {!isSkillsLocked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                <button type="button" onClick={() => handleUpdatePCDelta(-1)} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }}>
                  -1
                </button>
                <input
                  type="number"
                  title="Budget PC de la phase"
                  value={totalPC}
                  onChange={(e) => handleSetTotalPC(parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '48px',
                    padding: '2px 4px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text-h)'
                  }}
                />
                <button type="button" onClick={() => handleUpdatePCDelta(1)} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }}>
                  +1
                </button>
                <button type="button" onClick={() => handleUpdatePCDelta(10)} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }}>
                  +10
                </button>
              </div>
            )}

            <button type="button" onClick={handleToggleLock} className="btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
              {isSkillsLocked ? 'Déverrouiller' : 'Verrouiller'}
            </button>

            <button type="button" onClick={openCreateForm} className="btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }}>
              {showAddSkill ? 'Fermer' : '+ Compétence'}
            </button>
          </div>
        )}
      </div>

      {/* FORMULAIRE CRÉATION OU ÉDITION D'UNE COMPÉTENCE (MJ) */}
      {isMJ && (showAddSkill || editingSkill) && (
        <form
          onSubmit={handleSaveSkillForm}
          style={{
            padding: '14px',
            background: 'var(--code-bg)',
            border: '1px solid var(--accent-border)',
            borderRadius: '8px',
            marginBottom: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <strong style={{ color: 'var(--text-h)', fontSize: '13px' }}>
            {editingSkill ? `Modifier : ${editingSkill.name}` : 'Nouvelle compétence'}
          </strong>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              required
              type="text"
              placeholder="Nom *"
              value={skillForm.name}
              onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
              style={{ flex: 2, minWidth: '150px', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
            />

            <select
              value={skillForm.category}
              onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
              style={{ flex: 1, minWidth: '130px', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }}
            >
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <label style={{ fontSize: '11px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Base :
              <input
                required
                type="number"
                min="0"
                max="90"
                value={skillForm.baseValue}
                onChange={(e) => setSkillForm({ ...skillForm, baseValue: e.target.value })}
                style={{ width: '52px', padding: '5px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </label>

            {editingSkill && (
              <label style={{ fontSize: '11px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Bloqué :
                <input
                  required
                  type="number"
                  min="0"
                  max="90"
                  value={skillForm.lockedValue}
                  onChange={(e) => setSkillForm({ ...skillForm, lockedValue: e.target.value })}
                  style={{ width: '52px', padding: '5px', borderRadius: '4px', border: '1px solid var(--border)' }}
                />
              </label>
            )}

            <label style={{ fontSize: '11px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Plafond :
              <input
                required
                type="number"
                min="1"
                max="90"
                value={skillForm.limit}
                onChange={(e) => setSkillForm({ ...skillForm, limit: e.target.value })}
                style={{ width: '52px', padding: '5px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={skillForm.isNative}
                onChange={(e) => setSkillForm({ ...skillForm, isNative: e.target.checked })}
              />
              Compétence native
            </label>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAddSkill(false);
                  setEditingSkill(null);
                }}
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                Annuler
              </button>
              <button type="submit" className="btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }}>
                {editingSkill ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* BARRE DE RECHERCHE, TRI ET CATÉGORIES EN 1 CLIC */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '160px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--code-bg)',
              color: 'var(--text-h)',
              fontSize: '13px'
            }}
          />

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text)', marginRight: '2px' }}>Tri :</span>
            <button type="button" onClick={() => setSortBy('index')} style={pillStyle(sortBy === 'index')}>Index</button>
            <button type="button" onClick={() => setSortBy('points')} style={pillStyle(sortBy === 'points')}>Points</button>
            <button type="button" onClick={() => setSortBy('native')} style={pillStyle(sortBy === 'native')}>Natives</button>
            <button type="button" onClick={() => setSortBy('category')} style={pillStyle(sortBy === 'category')}>Catégorie</button>
          </div>

          <button
            type="button"
            onClick={() => setGroupByCategory(!groupByCategory)}
            style={pillStyle(groupByCategory)}
          >
            Grouper
          </button>
        </div>

        {/* PILULES DE CATÉGORIES */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            style={pillStyle(selectedCategory === 'ALL')}
          >
            Toutes ({skills.length})
          </button>

          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
              style={pillStyle(selectedCategory === cat)}
            >
              {cat}
            </button>
          ))}

          {isMJ && !isAddingCategory && (
            <button
              type="button"
              onClick={() => setIsAddingCategory(true)}
              title="Ajouter une catégorie"
              style={{
                padding: '3px 9px',
                fontSize: '12px',
                borderRadius: '14px',
                border: '1px dashed var(--accent-border)',
                background: 'transparent',
                color: 'var(--accent)',
                cursor: 'pointer'
              }}
            >
              + Catégorie
            </button>
          )}

          {isMJ && isAddingCategory && (
            <form onSubmit={handleAddCategorySubmit} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                autoFocus
                type="text"
                placeholder="Nom catégorie..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={{
                  padding: '3px 8px',
                  fontSize: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--accent)',
                  background: 'var(--bg)',
                  color: 'var(--text-h)',
                  width: '130px'
                }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '3px 8px', fontSize: '11px' }}>OK</button>
              <button type="button" onClick={() => setIsAddingCategory(false)} className="btn-secondary" style={{ padding: '3px 7px', fontSize: '11px' }}>X</button>
            </form>
          )}
        </div>
      </div>

      {/* LISTE DES COMPÉTENCES */}
      {filteredAndSortedSkills.length === 0 ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic', fontSize: '14px' }}>
          Aucune compétence à afficher.
        </p>
      ) : groupByCategory && groupedSkills ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {Object.entries(groupedSkills).map(([catName, catSkills]) => (
            <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '3px' }}>
                {catName} ({catSkills.length})
              </div>
              {catSkills.map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  index={skill._defaultIndex}
                  canInteract={canInteract}
                  canReorder={false}
                  isMJ={isMJ}
                  onUpdateValue={handleUpdateValue}
                  onEditClick={openEditForm}
                  onDelete={handleDeleteSkill}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredAndSortedSkills.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              index={skill._defaultIndex}
              canInteract={canInteract}
              canReorder={isEditable && isDefaultOrderView}
              isMJ={isMJ}
              onUpdateValue={handleUpdateValue}
              onEditClick={openEditForm}
              onDelete={handleDeleteSkill}
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