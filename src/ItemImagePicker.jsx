import { useState, useEffect } from 'react';
import ImageInput from './ImageInput';
import { ITEM_PRESETS, resolveAssetUrl } from './presets';

const SCRYFALL_API_BASE = 'https://api.scryfall.com/cards/search';

const TABS = [
  { id: 'assets', label: 'Images Assets' },
  { id: 'scryfall', label: 'Scryfall' },
  { id: 'manual', label: 'Manuel / Fichier' }
];

function detectInitialTab(url) {
  if (!url) return 'assets';
  if (ITEM_PRESETS.some((p) => p.url === url)) return 'assets';
  if (url.includes('scryfall.io')) return 'scryfall';
  return 'manual';
}

export default function ItemImagePicker({ value, onChange }) {
  const [mode, setMode] = useState(() => detectInitialTab(value));
  const [searchTerm, setSearchTerm] = useState('');
  const [dndOnly, setDndOnly] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const [scryfallItems, setScryfallItems] = useState([]);
  const [loadingScryfall, setLoadingScryfall] = useState(false);
  const [apiFeedback, setApiFeedback] = useState('');

  useEffect(() => {
    if (mode !== 'scryfall') return;
    const queryText = searchTerm.trim();

    let active = true;
    const timer = setTimeout(async () => {
      setLoadingScryfall(true);
      setApiFeedback('');
      try {
        let scryfallQuery = '';
        if (dndOnly) {
          scryfallQuery = queryText
            ? `(set:afr or set:clb) (t:artifact or t:equipment) ${queryText} unique:art`
            : '(set:afr or set:clb) (t:artifact or t:equipment) unique:art';
        } else {
          scryfallQuery = queryText
            ? `(t:artifact or t:equipment) ${queryText} unique:art`
            : '(t:artifact or t:equipment) (sword or shield or potion or ring or staff or armor) unique:art';
        }

        const res = await fetch(`${SCRYFALL_API_BASE}?q=${encodeURIComponent(scryfallQuery)}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (active) {
              setScryfallItems([]);
              setApiFeedback(`Aucun objet trouvé sur Scryfall pour "${queryText}".`);
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
            return artUrl ? { id: `sf-item-${card.id}`, name: card.name, imageUrl: artUrl } : null;
          })
          .filter(Boolean)
          .slice(0, 36);

        setScryfallItems(mapped);
        if (mapped.length === 0) {
          setApiFeedback(`Aucun objet trouvé sur Scryfall pour "${queryText}".`);
        }
      } catch {
        if (active) setApiFeedback("Impossible de contacter l'API Scryfall.");
      } finally {
        if (active) setLoadingScryfall(false);
      }
    }, queryText ? 300 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, searchTerm, dndOnly]);

  const filteredAssets = ITEM_PRESETS.filter((a) =>
    a.label.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px',
        background: 'var(--code-bg)',
        border: '1px solid var(--border)',
        borderRadius: '8px'
      }}
    >
      {/* EN-TÊTE : CHOIX DE LA MÉTHODE + APERÇU */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                  background: active ? 'var(--accent)' : 'var(--bg)',
                  color: active ? '#fff' : 'var(--text)',
                  fontWeight: active ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* APERÇU */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--text)' }}>Aperçu :</span>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '8px',
              border: '2px solid var(--accent-border)',
              background: 'var(--bg)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={resolveAssetUrl(value)}
              alt="Aperçu objet"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = './assets/jdr-bag.jpg';
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>
      </div>

      {/* MODE 1 : IMAGES DE ASSETS */}
      {mode === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ITEM_PRESETS.length > 8 && (
            <input
              type="text"
              placeholder="Filtrer les icônes locales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-h)',
                fontSize: '12px'
              }}
            />
          )}

          {filteredAssets.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              Aucune icône locale trouvée.
            </span>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                gap: '6px',
                maxHeight: '150px',
                overflowY: 'auto',
                padding: '6px',
                background: 'var(--bg)',
                borderRadius: '6px',
                border: '1px solid var(--border)'
              }}
            >
              {filteredAssets.map((asset) => {
                const isSelected = value === asset.url;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onChange(asset.url)}
                    title={asset.label}
                    style={{
                      padding: '4px',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(124, 58, 237, 0.18)' : 'var(--code-bg)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <img
                      src={resolveAssetUrl(asset.url)}
                      alt={asset.label}
                      style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                    />
                    <span
                      style={{
                        fontSize: '9px',
                        color: 'var(--text-h)',
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {asset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODE 2 : SCRYFALL (ARTEFACTS & ÉQUIPEMENTS) */}
      {mode === 'scryfall' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Rechercher en anglais (ex: sword, potion, shield, ring, staff, armor...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                minWidth: '170px',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-h)',
                fontSize: '12px'
              }}
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="btn-secondary"
                title="Effacer"
                style={{ padding: '6px 9px', fontSize: '11px' }}
              >
                X
              </button>
            )}

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                color: 'var(--text-h)',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                checked={dndOnly}
                onChange={(e) => setDndOnly(e.target.checked)}
              />
              Sets D&D uniquement
            </label>
          </div>

          {loadingScryfall ? (
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
                background: 'var(--bg)',
                borderRadius: '6px',
                border: '1px solid var(--border)'
              }}
            >
              {scryfallItems.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                  Aucun résultat pour "{searchTerm}".
                </span>
              ) : (
                scryfallItems.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        onChange(item.imageUrl);
                      }}
                      style={{
                        padding: '3px 9px',
                        fontSize: '11px',
                        borderRadius: '12px',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent)' : 'var(--code-bg)',
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

          {apiFeedback && (
            <span style={{ fontSize: '11px', color: '#d69e2e' }}>{apiFeedback}</span>
          )}
        </div>
      )}

      {/* MODE 3 : IMAGEINPUT MANUEL / FICHIER */}
      {mode === 'manual' && (
        <ImageInput
          value={value}
          onChange={onChange}
          placeholder="Coller une URL ou importer un fichier..."
        />
      )}
    </div>
  );
}