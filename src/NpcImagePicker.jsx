import { useState, useEffect } from 'react';
import ImageInput from './ImageInput';
import { resolveAssetUrl } from './presets';

const DND_API_BASE = 'https://www.dnd5eapi.co';
const SCRYFALL_API_BASE = 'https://api.scryfall.com/cards/search';

let cachedDndMonsters = null;

const TABS = [
  { id: 'dnd5e', label: 'D&D 5e API' },
  { id: 'scryfall_dnd', label: 'Scryfall D&D' },
  { id: 'manual', label: 'Manuel / Fichier' }
];

export default function NpcImagePicker({ value, onChange }) {
  const [mode, setMode] = useState('dnd5e');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const [dndItems, setDndItems] = useState([]);
  const [scryfallDndItems, setScryfallDndItems] = useState([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [apiFeedback, setApiFeedback] = useState('');

  // 1. D&D 5e API : chargement et mise en cache de l'index
  useEffect(() => {
    if (mode !== 'dnd5e') return;
    if (cachedDndMonsters) {
      setDndItems(cachedDndMonsters);
      return;
    }

    let active = true;
    setLoadingList(true);
    setApiFeedback('');

    fetch(`${DND_API_BASE}/api/monsters`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        cachedDndMonsters = (data.results || []).map((m) => ({
          id: `dnd-${m.index}`,
          name: m.name,
          detailUrl: `${DND_API_BASE}${m.url}`
        }));
        setDndItems(cachedDndMonsters);
      })
      .catch(() => {
        if (active) setApiFeedback("Impossible de contacter l'API D&D 5e.");
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, [mode]);

  // 2. Scryfall D&D (extensions officielles AFR & CLB)
  useEffect(() => {
    if (mode !== 'scryfall_dnd') return;
    const queryText = searchTerm.trim();

    let active = true;
    const timer = setTimeout(async () => {
      setLoadingList(true);
      setApiFeedback('');
      try {
        const scryfallQuery = queryText
          ? `(set:afr or set:clb) ${queryText} unique:art`
          : '(set:afr or set:clb) t:creature unique:art';

        const res = await fetch(`${SCRYFALL_API_BASE}?q=${encodeURIComponent(scryfallQuery)}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (active) {
              setScryfallDndItems([]);
              setApiFeedback(`Aucun résultat sur Scryfall D&D pour "${queryText}".`);
            }
            return;
          }
          throw new Error('HTTP error');
        }

        const data = await res.json();
        if (!active) return;

        const mapped = (data.data || [])
          .map((card) => {
            const artUrl =
              card.image_uris?.art_crop ||
              card.card_faces?.[0]?.image_uris?.art_crop ||
              null;
            return artUrl
              ? { id: `sf-${card.id}`, name: card.name, imageUrl: artUrl }
              : null;
          })
          .filter(Boolean)
          .slice(0, 36);

        setScryfallDndItems(mapped);
        if (mapped.length === 0) {
          setApiFeedback(`Aucun résultat sur Scryfall D&D pour "${queryText}".`);
        }
      } catch {
        if (active) setApiFeedback("Impossible de contacter l'API Scryfall.");
      } finally {
        if (active) setLoadingList(false);
      }
    }, queryText ? 300 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, searchTerm]);

  const handleSelectItem = async (item) => {
    setSelectedId(item.id);
    setApiFeedback('');

    if (item.imageUrl) {
      onChange(item.imageUrl);
      return;
    }

    if (item.detailUrl) {
      setLoadingImage(true);
      try {
        const res = await fetch(item.detailUrl);
        const detail = await res.json();
        if (detail.image) {
          onChange(`${DND_API_BASE}${detail.image}`);
        } else {
          setApiFeedback(`"${item.name}" n'a pas d'illustration dans D&D 5e API. Essaie Scryfall D&D.`);
        }
      } catch {
        setApiFeedback("Erreur lors du chargement de l'image.");
      } finally {
        setLoadingImage(false);
      }
    }
  };

  let currentItems = [];
  const q = searchTerm.trim().toLowerCase();
  if (mode === 'dnd5e') {
    currentItems = dndItems.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 36);
  } else if (mode === 'scryfall_dnd') {
    currentItems = scryfallDndItems;
  }

  const isApiMode = mode !== 'manual';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '8px'
      }}
    >
      {/* EN-TÊTE : ONGLETS DES SOURCES + APERÇU AGRANDI */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
          {TABS.map((tab) => {
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setApiFeedback('');
                  setMode(tab.id);
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: active ? 'var(--accent)' : 'var(--code-bg)',
                  color: active ? '#fff' : 'var(--text)',
                  fontWeight: active ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* APERÇU (76x76 px) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--text)' }}>Aperçu :</span>
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '10px',
              border: '2px solid var(--accent-border)',
              background: 'var(--code-bg)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)'
            }}
          >
            <img
              src={resolveAssetUrl(value)}
              alt="Aperçu PNJ"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = './assets/jdr-bag.jpg';
                if (value && value !== './assets/jdr-bag.jpg') {
                  setApiFeedback("L'image distante de cette entrée est indisponible.");
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>
      </div>

      {/* BARRE DE RECHERCHE COMMUNE & LISTE UNIFIÉE */}
      {isApiMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Rechercher en anglais (ex: knight, goblin, wizard, bandit, dragon...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--code-bg)',
                color: 'var(--text-h)',
                fontSize: '12px'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="btn-secondary"
                title="Effacer la recherche"
                style={{ padding: '6px 9px', fontSize: '11px' }}
              >
                X
              </button>
            )}
          </div>

          {loadingList ? (
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Chargement des résultats...</span>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                maxHeight: '135px',
                overflowY: 'auto',
                padding: '6px',
                background: 'var(--code-bg)',
                borderRadius: '6px',
                border: '1px solid var(--border)'
              }}
            >
              {currentItems.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                  {searchTerm.trim()
                    ? `Aucun résultat pour "${searchTerm}".`
                    : 'Aucune suggestion disponible.'}
                </span>
              ) : (
                currentItems.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      disabled={loadingImage}
                      style={{
                        padding: '3px 9px',
                        fontSize: '11px',
                        borderRadius: '12px',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent)' : 'var(--bg)',
                        color: isSelected ? '#fff' : 'var(--text-h)',
                        cursor: 'pointer'
                      }}
                    >
                      {item.name}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {loadingImage && (
            <span style={{ fontSize: '11px', color: 'var(--accent)' }}>Chargement de l'illustration...</span>
          )}
          {apiFeedback && (
            <span style={{ fontSize: '11px', color: '#d69e2e' }}>{apiFeedback}</span>
          )}
        </div>
      )}

      {/* MODE MANUEL / FICHIER / PRESETS */}
      {mode === 'manual' && (
        <ImageInput
          value={value}
          onChange={onChange}
          placeholder="Coller une URL, importer un fichier ou choisir une icône..."
        />
      )}
    </div>
  );
}