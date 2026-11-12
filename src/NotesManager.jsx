import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function NotesManager({ characterId, initialNotes = [], isEditable }) {
  const [notes, setNotes] = useState(initialNotes);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  
  // Suivi de l'édition du titre d'une rubrique
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setNotes(initialNotes || []);
    }
  }, [initialNotes, hasUnsavedChanges]);

  const saveNotesToFirebase = async (updatedNotes) => {
    if (!characterId) return;
    try {
      const charRef = doc(db, "characters", characterId);
      await updateDoc(charRef, { notes: updatedNotes });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Erreur sauvegarde des notes :", error);
    }
  };

  // Ajouter une nouvelle rubrique
  const handleAddSection = (e) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;

    const newSection = {
      id: crypto.randomUUID(),
      title: newSectionTitle.trim(),
      content: '',
      isCollapsed: false
    };

    const updated = [...notes, newSection];
    setNotes(updated);
    saveNotesToFirebase(updated);
    setNewSectionTitle('');
    setShowAddForm(false);
  };

  // Réduire / Déplier une rubrique
  const handleToggleCollapse = (id) => {
    const updated = notes.map(n => n.id === id ? { ...n, isCollapsed: !n.isCollapsed } : n);
    setNotes(updated);
    saveNotesToFirebase(updated);
  };

  // Modification du texte dans une rubrique
  const handleContentChange = (id, newContent) => {
    const updated = notes.map(n => n.id === id ? { ...n, content: newContent } : n);
    setNotes(updated);
    setHasUnsavedChanges(true);
  };

  // Renommer une rubrique
  const handleSaveTitle = (id) => {
    if (!tempTitle.trim()) {
      setEditingTitleId(null);
      return;
    }
    const updated = notes.map(n => n.id === id ? { ...n, title: tempTitle.trim() } : n);
    setNotes(updated);
    saveNotesToFirebase(updated);
    setEditingTitleId(null);
  };

  // Supprimer une rubrique
  const handleDeleteSection = (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette rubrique et son contenu ?")) return;
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    saveNotesToFirebase(updated);
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: 'var(--text-h)', fontSize: '16px' }}>Journal et Notes</h4>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasUnsavedChanges && (
            <button 
              onClick={() => saveNotesToFirebase(notes)} 
              className="btn-primary" 
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              Sauvegarder les notes
            </button>
          )}

          {isEditable && (
            <button 
              onClick={() => setShowAddForm(!showAddForm)} 
              className="btn-secondary" 
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              {showAddForm ? 'Annuler' : '+ Nouvelle rubrique'}
            </button>
          )}
        </div>
      </div>

      {/* FORMULAIRE D'AJOUT DE RUBRIQUE */}
      {showAddForm && (
        <form onSubmit={handleAddSection} style={{ padding: '12px', background: 'var(--code-bg)', border: '1px solid var(--accent-border)', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            required
            placeholder="Titre de la rubrique (ex: Background, Quêtes, Session 1...)" 
            value={newSectionTitle} 
            onChange={e => setNewSectionTitle(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border)' }}
          />
          <button type="submit" className="btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            Créer
          </button>
        </form>
      )}

      {/* LISTE DES RUBRIQUES */}
      {notes.length === 0 ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic', fontSize: '13px', margin: 0 }}>
          Aucune rubrique dans le carnet pour le moment.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notes.map(section => (
            <div 
              key={section.id} 
              style={{ 
                background: 'var(--code-bg)', 
                border: '1px solid var(--border)', 
                borderRadius: '8px', 
                overflow: 'hidden' 
              }}
            >
              {/* BARRE DE TITRE / ACCORDÉON */}
              <div 
                style={{ 
                  display: 'flex', 
                  justify: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 14px', 
                  background: 'var(--bg)', 
                  borderBottom: section.isCollapsed ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleToggleCollapse(section.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>
                    {section.isCollapsed ? '►' : '▼'}
                  </span>

                  {/* Édition du titre de la rubrique */}
                  {editingTitleId === section.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="text" 
                        value={tempTitle} 
                        onChange={e => setTempTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveTitle(section.id)}
                        autoFocus
                        style={{ padding: '2px 6px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--code-bg)', color: 'var(--text-h)' }}
                      />
                      <button onClick={() => handleSaveTitle(section.id)} style={{ background: 'none', border: 'none', color: '#48bb78', cursor: 'pointer', fontSize: '13px' }}>✔</button>
                    </div>
                  ) : (
                    <strong style={{ color: 'var(--text-h)', fontSize: '14px' }}>
                      {section.title}
                    </strong>
                  )}
                </div>

                {/* Actions rubrique */}
                {isEditable && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => { setEditingTitleId(section.id); setTempTitle(section.title); }} 
                      title="Renommer la rubrique" 
                      style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleDeleteSection(section.id)} 
                      title="Supprimer la rubrique" 
                      style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* CONTENU TEXTE REPLIABLE */}
              {!section.isCollapsed && (
                <div style={{ padding: '12px' }}>
                  <textarea 
                    value={section.content || ''} 
                    onChange={e => handleContentChange(section.id, e.target.value)}
                    placeholder={isEditable ? "Rédigez vos notes ici..." : "Aucun contenu."}
                    readOnly={!isEditable}
                    rows={4}
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--border)', 
                      background: 'var(--bg)', 
                      color: 'var(--text-h)', 
                      fontSize: '13px', 
                      lineHeight: '1.5',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}