import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, setDoc, collection, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { resolveAssetUrl } from './presets';

export default function CombatTracker({ mjUid, players = [] }) {
  const [participants, setParticipants] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [npcBank, setNpcBank] = useState([]);

  // Synchronisation live des PV/PM des PJ pour leurs jauges ultra-fines
  const [liveCharsMap, setLiveCharsMap] = useState({});

  // Modales d'ajout rapide
  const [showAddPjModal, setShowAddPjModal] = useState(false);
  const [showAddNpcModal, setShowAddNpcModal] = useState(false);
  const [selectedNpcId, setSelectedNpcId] = useState('');
  const [npcAlign, setNpcAlign] = useState('');
  const [npcQty, setNpcQty] = useState(1);

  // Drag & Drop réorganisation
  const [dragIdx, setDragIdx] = useState(null);

  // Mesure responsive pour le quinconce sur 2 lignes + tracé du trait SVG actif
  const arenaRef = useRef(null);
  const activeCardRef = useRef(null);
  const hubTargetRef = useRef(null);
  const [arenaWidth, setArenaWidth] = useState(900);
  const [connectorLine, setConnectorLine] = useState(null);

  useEffect(() => {
    if (!mjUid) return;

    const unsubCombat = onSnapshot(doc(db, 'combats', mjUid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const list = data.participants || [];
        setParticipants(list);
        const safeIdx = list.length > 0 ? Math.min(data.activeIndex || 0, list.length - 1) : 0;
        setActiveIndex(safeIdx);
        setRound(data.round || 1);
      } else {
        setDoc(doc(db, 'combats', mjUid), { participants: [], activeIndex: 0, round: 1 });
      }
    });

    const unsubNpcs = onSnapshot(doc(db, 'npcBanks', mjUid), (snap) => {
      if (snap.exists()) {
        setNpcBank(snap.data().npcs || []);
      }
    });

    const qChars = query(collection(db, 'characters'), where('mjUid', '==', mjUid));
    const unsubChars = onSnapshot(qChars, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setLiveCharsMap(map);
    });

    return () => {
      unsubCombat();
      unsubNpcs();
      unsubChars();
    };
  }, [mjUid]);

  const saveCombatState = async (nextParticipants, nextActiveIndex, nextRound) => {
    if (!mjUid) return;
    await setDoc(
      doc(db, 'combats', mjUid),
      {
        participants: nextParticipants,
        activeIndex: nextActiveIndex,
        round: nextRound
      },
      { merge: true }
    );
  };

  // --- CONTRÔLES DE TOUR ---
  const handleNextTurn = () => {
    if (participants.length === 0) return;
    const nextIdx = (activeIndex + 1) % participants.length;
    const nextRound = nextIdx === 0 ? round + 1 : round;
    setActiveIndex(nextIdx);
    setRound(nextRound);
    saveCombatState(participants, nextIdx, nextRound);
  };

  const handlePrevTurn = () => {
    if (participants.length === 0) return;
    const prevIdx = (activeIndex - 1 + participants.length) % participants.length;
    const prevRound = activeIndex === 0 && round > 1 ? round - 1 : round;
    setActiveIndex(prevIdx);
    setRound(prevRound);
    saveCombatState(participants, prevIdx, prevRound);
  };

  const handleClearCombat = () => {
    setParticipants([]);
    setActiveIndex(0);
    setRound(1);
    saveCombatState([], 0, 1);
  };

  // --- PERMUTATION / RÉORGANISATION DYNAMIQUE ---
  const moveParticipant = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= participants.length || fromIdx === toIdx) return;
    const activeId = participants[activeIndex]?.id;
    const updated = [...participants];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    const newActiveIdx = activeId ? Math.max(0, updated.findIndex((p) => p.id === activeId)) : 0;
    setParticipants(updated);
    setActiveIndex(newActiveIdx);
    saveCombatState(updated, newActiveIdx, round);
  };

  const handleRemoveParticipant = (idx) => {
    const activeId = participants[activeIndex]?.id;
    const updated = participants.filter((_, i) => i !== idx);
    let newActiveIdx = 0;
    if (updated.length > 0) {
      const found = updated.findIndex((p) => p.id === activeId);
      newActiveIdx = found !== -1 ? found : Math.min(idx, updated.length - 1);
    }
    setParticipants(updated);
    setActiveIndex(newActiveIdx);
    saveCombatState(updated, newActiveIdx, round);
  };

  // --- AJOUT DE PJ / PNJ ---
  const handleAddSinglePj = (player) => {
    const entry = {
      id: crypto.randomUUID(),
      type: 'pj',
      characterId: player.id,
      name: player.name,
      avatarUrl: player.avatarUrl || '',
      alignment: 'ally'
    };
    const updated = [...participants, entry];
    saveCombatState(updated, activeIndex, round);
  };

  const handleAddAllPjs = () => {
    const existingCharIds = new Set(participants.filter((p) => p.type === 'pj').map((p) => p.characterId));
    const toAdd = players
      .filter((pl) => !existingCharIds.has(pl.id))
      .map((pl) => ({
        id: crypto.randomUUID(),
        type: 'pj',
        characterId: pl.id,
        name: pl.name,
        avatarUrl: pl.avatarUrl || '',
        alignment: 'ally'
      }));
    if (toAdd.length > 0) {
      saveCombatState([...participants, ...toAdd], activeIndex, round);
    }
    setShowAddPjModal(false);
  };

  const handleAddNpcSubmit = (e) => {
    e.preventDefault();
    const model = npcBank.find((n) => n.id === selectedNpcId);
    if (!model || !npcAlign) return;
    const count = Math.max(1, Math.min(20, parseInt(npcQty, 10) || 1));
    const newEntries = Array.from({ length: count }, (_, idx) => ({
      id: crypto.randomUUID(),
      type: 'npc',
      npcId: model.id,
      name: count > 1 ? `${model.name} ${idx + 1}` : model.name,
      avatarUrl: model.avatarUrl || '',
      alignment: npcAlign
    }));
    saveCombatState([...participants, ...newEntries], activeIndex, round);
    setShowAddNpcModal(false);
    setSelectedNpcId('');
    setNpcAlign('');
    setNpcQty(1);
  };

  // --- CALCUL QUINCONCE SUR 2 LIGNES & TRAIT SVG ---
  const cardWidth = arenaWidth < 520 ? 96 : 114;
  const cardGap = arenaWidth < 520 ? 8 : 12;
  const maxOneRow = Math.max(2, Math.floor((arenaWidth - 24) / (cardWidth + cardGap)));
  const isStaggered = participants.length > maxOneRow;

  const updateGeometry = useCallback(() => {
    if (!arenaRef.current) return;
    const arenaRect = arenaRef.current.getBoundingClientRect();
    setArenaWidth(arenaRect.width);

    if (!activeCardRef.current || !hubTargetRef.current || participants.length === 0) {
      setConnectorLine(null);
      return;
    }

    const cardRect = activeCardRef.current.getBoundingClientRect();
    const hubRect = hubTargetRef.current.getBoundingClientRect();

    setConnectorLine({
      x1: cardRect.left + cardRect.width / 2 - arenaRect.left,
      y1: cardRect.bottom - arenaRect.top,
      x2: hubRect.left + hubRect.width / 2 - arenaRect.left,
      y2: hubRect.top + hubRect.height / 2 - arenaRect.top
    });
  }, [participants.length, activeIndex]);

  useEffect(() => {
    updateGeometry();
    const raf = requestAnimationFrame(updateGeometry);
    window.addEventListener('resize', updateGeometry);
    let observer;
    if (arenaRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateGeometry);
      observer.observe(arenaRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateGeometry);
      if (observer) observer.disconnect();
    };
  }, [updateGeometry, participants, activeIndex, isStaggered]);

  const activeParticipant = participants[activeIndex] || null;
  const activeColor = activeParticipant
    ? activeParticipant.alignment === 'enemy'
      ? '#e53e3e'
      : '#3182ce'
    : 'var(--accent)';

  // --- RENDU D'UNE MINI-CARTE ---
  const renderParticipantCard = (p, idx) => {
    const isActive = idx === activeIndex;
    const isEnemy = p.alignment === 'enemy';
    const frameColor = isEnemy ? '#e53e3e' : '#3182ce';

    // Données live pour les PJ uniquement (pas de jauge pour les PNJ)
    const liveChar = p.type === 'pj' ? liveCharsMap[p.characterId] : null;
    const stats = liveChar?.liveStats || { pvCurrent: 100, pvMax: 100, pmCurrent: 50, pmMax: 50 };
    const pvPct = Math.max(0, Math.min(100, ((stats.pvCurrent ?? 0) / Math.max(1, stats.pvMax ?? 100)) * 100));
    const pmPct = Math.max(0, Math.min(100, ((stats.pmCurrent ?? 0) / Math.max(1, stats.pmMax ?? 100)) * 100));
    const displayName = liveChar?.name || p.name;
    const displayAvatar = liveChar?.avatarUrl || p.avatarUrl;

    return (
      <div
        key={p.id}
        ref={isActive ? activeCardRef : null}
        draggable
        onDragStart={() => setDragIdx(idx)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (dragIdx !== null) moveParticipant(dragIdx, idx);
          setDragIdx(null);
        }}
        onClick={() => {
          setActiveIndex(idx);
          saveCombatState(participants, idx, round);
        }}
        title="Cliquer pour activer le tour | Glisser pour réordonner"
        style={{
          width: `${cardWidth}px`,
          background: 'var(--bg)',
          border: `2px solid ${frameColor}`,
          borderRadius: '10px',
          padding: '6px',
          boxSizing: 'border-box',
          cursor: 'grab',
          userSelect: 'none',
          position: 'relative',
          zIndex: isActive ? 5 : 2,
          filter: isActive ? 'none' : 'grayscale(100%)',
          opacity: isActive ? 1 : 0.45,
          transform: isActive ? 'translateY(-3px) scale(1.03)' : 'none',
          boxShadow: isActive ? `0 0 14px ${isEnemy ? 'rgba(229,62,62,0.55)' : 'rgba(49,130,206,0.55)'}` : 'none',
          transition: 'all 0.22s ease'
        }}
      >
        {/* NUMÉRO D'ORDRE + SUPPRESSION DISCRÈTE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 'bold',
              padding: '0 5px',
              borderRadius: '8px',
              background: frameColor,
              color: '#fff'
            }}
          >
            #{idx + 1}
          </span>

          <div style={{ display: 'flex', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => moveParticipant(idx, idx - 1)}
              disabled={idx === 0}
              title="Avancer dans l'ordre"
              style={{
                background: 'var(--code-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-h)',
                borderRadius: '3px',
                fontSize: '9px',
                padding: '0 4px',
                cursor: idx === 0 ? 'default' : 'pointer',
                opacity: idx === 0 ? 0.35 : 1
              }}
            >
              &#9664;
            </button>
            <button
              type="button"
              onClick={() => moveParticipant(idx, idx + 1)}
              disabled={idx === participants.length - 1}
              title="Reculer dans l'ordre"
              style={{
                background: 'var(--code-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-h)',
                borderRadius: '3px',
                fontSize: '9px',
                padding: '0 4px',
                cursor: idx === participants.length - 1 ? 'default' : 'pointer',
                opacity: idx === participants.length - 1 ? 0.35 : 1
              }}
            >
              &#9654;
            </button>
            <button
              type="button"
              onClick={() => handleRemoveParticipant(idx)}
              title="Retirer du combat"
              style={{
                background: 'rgba(229,62,62,0.85)',
                border: 'none',
                color: '#fff',
                borderRadius: '3px',
                fontSize: '9px',
                padding: '0 4px',
                cursor: 'pointer'
              }}
            >
              X
            </button>
          </div>
        </div>

        {/* IMAGE */}
        <div
          style={{
            width: '100%',
            height: `${cardWidth - 36}px`,
            borderRadius: '6px',
            background: 'var(--code-bg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '5px'
          }}
        >
          <img
            src={resolveAssetUrl(displayAvatar)}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = './assets/jdr-bag.jpg';
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          />
        </div>

        {/* NOM */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'var(--text-h)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {displayName}
        </div>

        {/* JAUGES ULTRA-FINES SANS CHIFFRES (PJ UNIQUEMENT) */}
        {p.type === 'pj' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '5px' }}>
            <div style={{ height: '2px', width: '100%', background: 'rgba(229,62,62,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pvPct}%`, background: '#e53e3e', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ height: '2px', width: '100%', background: 'rgba(49,130,206,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pmPct}%`, background: '#3182ce', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- CONSTRUCTION DE LA ROULETTE DEMI-CERCLE ---
  const count = participants.length;
  const wheelRadius = 118;
  const wheelInnerRadius = 56;
  const cx = 160;
  const cy = 148;
  const stepAngle = count > 0 ? 360 / count : 360;

  const polarToCartesian = (centerX, centerY, r, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: centerX + r * Math.cos(rad),
      y: centerY + r * Math.sin(rad)
    };
  };

  const buildWedgePath = (startDeg, endDeg) => {
    if (endDeg - startDeg >= 359.9) {
      return `M ${cx} ${cy - wheelRadius} A ${wheelRadius} ${wheelRadius} 0 1 1 ${cx} ${cy + wheelRadius} A ${wheelRadius} ${wheelRadius} 0 1 1 ${cx} ${cy - wheelRadius} Z`;
    }
    const p1 = polarToCartesian(cx, cy, wheelRadius, startDeg);
    const p2 = polarToCartesian(cx, cy, wheelRadius, endDeg);
    const p3 = polarToCartesian(cx, cy, wheelInnerRadius, endDeg);
    const p4 = polarToCartesian(cx, cy, wheelInnerRadius, startDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${wheelRadius} ${wheelRadius} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${wheelInnerRadius} ${wheelInnerRadius} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* BARRE DE CONTRÔLE SUPÉRIEURE */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '12px 16px',
          background: 'var(--code-bg)',
          border: '1px solid var(--border)',
          borderRadius: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowAddPjModal(true)}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', borderColor: '#3182ce', color: '#63b3ed' }}
          >
            + PJ
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedNpcId(npcBank[0]?.id || '');
              setNpcAlign(npcBank[0]?.defaultAlignment || '');
              setNpcQty(1);
              setShowAddNpcModal(true);
            }}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            + PNJ
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '4px 10px',
              borderRadius: '14px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-h)'
            }}
          >
            Round {round}
          </span>

          <button
            type="button"
            onClick={handlePrevTurn}
            disabled={count === 0}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 10px' }}
          >
            Précédent
          </button>

          <button
            type="button"
            onClick={handleNextTurn}
            disabled={count === 0}
            className="btn-primary"
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Tour suivant
          </button>

          {count > 0 && (
            <button
              type="button"
              onClick={handleClearCombat}
              style={{
                background: 'none',
                border: '1px solid rgba(229,62,62,0.5)',
                color: '#fc8181',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Vider
            </button>
          )}
        </div>
      </div>

      {/* ARÈNE : CARTES EN HAUT + TRAIT DE LIAISON + ROULETTE EN BAS */}
      <div
        ref={arenaRef}
        style={{
          position: 'relative',
          minHeight: '350px',
          background: 'var(--code-bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px 12px 0 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* TRAIT SVG DYNAMIQUE RELIANT LA CARTE ACTIVE À LA CASE CENTRALE DE LA ROULETTE */}
        {connectorLine && activeParticipant && (
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            <path
              d={`M ${connectorLine.x1} ${connectorLine.y1} C ${connectorLine.x1} ${(connectorLine.y1 + connectorLine.y2) / 2}, ${connectorLine.x2} ${(connectorLine.y1 + connectorLine.y2) / 2}, ${connectorLine.x2} ${connectorLine.y2}`}
              fill="none"
              stroke={activeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx={connectorLine.x1} cy={connectorLine.y1} r="4" fill={activeColor} />
            <circle cx={connectorLine.x2} cy={connectorLine.y2} r="4.5" fill={activeColor} />
          </svg>
        )}

        {/* ZONE DES CARTES (1 LIGNE OU QUINCONCE SUR 2 LIGNES SI DÉPASSEMENT) */}
        {count === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 16px', color: 'var(--text)', fontSize: '14px' }}>
            Aucun combattant en lice. Ajoutez des PJ ou des PNJ pour démarrer le combat.
          </div>
        ) : !isStaggered ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: `${cardGap}px`,
              position: 'relative',
              zIndex: 2
            }}
          >
            {participants.map((p, idx) => renderParticipantCard(p, idx))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              position: 'relative',
              zIndex: 2
            }}
          >
            {/* Ligne 1 (indices pairs : #1, #3, #5...) */}
            <div style={{ display: 'flex', gap: `${cardGap}px`, justifyContent: 'center' }}>
              {participants.map((p, idx) => (idx % 2 === 0 ? renderParticipantCard(p, idx) : null))}
            </div>
            {/* Ligne 2 décalée en quinconce (indices impairs : #2, #4, #6...) */}
            <div
              style={{
                display: 'flex',
                gap: `${cardGap}px`,
                justifyContent: 'center',
                paddingLeft: `${Math.round((cardWidth + cardGap) / 2)}px`
              }}
            >
              {participants.map((p, idx) => (idx % 2 === 1 ? renderParticipantCard(p, idx) : null))}
            </div>
          </div>
        )}

        {/* ROULETTE DEMI-CERCLE ANCRÉE EN BAS */}
        <div
          style={{
            position: 'relative',
            width: '320px',
            height: '148px',
            margin: '42px auto 0 auto',
            zIndex: 3,
            flexShrink: 0
          }}
        >
          {/* Point d'ancrage exact de la case centrale du haut de la roulette */}
          <div
            ref={hubTargetRef}
            style={{
              position: 'absolute',
              top: '30px',
              left: '50%',
              width: '2px',
              height: '2px',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none'
            }}
          />

          <svg width="320" height="148" viewBox="0 0 320 148" style={{ display: 'block', overflow: 'visible' }}>
            {/* Fond du disque */}
            <circle
              cx={cx}
              cy={cy}
              r={wheelRadius + 4}
              fill="var(--bg)"
              stroke="var(--border)"
              strokeWidth="1.5"
            />

            {/* Cases dynamiques selon le nombre de combattants */}
            {count > 0 &&
              participants.map((p, idx) => {
                // Décalage angulaire pour placer la case active (idx === activeIndex) pile au sommet (0 deg)
                const relIdx = idx - activeIndex;
                const centerAngle = relIdx * stepAngle;
                const startAngle = centerAngle - stepAngle / 2;
                const endAngle = centerAngle + stepAngle / 2;
                const isSlotActive = idx === activeIndex;
                const slotColor = p.alignment === 'enemy' ? '#e53e3e' : '#3182ce';
                const labelPos = polarToCartesian(cx, cy, (wheelRadius + wheelInnerRadius) / 2, centerAngle);

                return (
                  <g
                    key={p.id}
                    onClick={() => {
                      setActiveIndex(idx);
                      saveCombatState(participants, idx, round);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <path
                      d={buildWedgePath(startAngle, endAngle)}
                      fill={isSlotActive ? slotColor : 'var(--code-bg)'}
                      fillOpacity={isSlotActive ? 0.35 : 0.9}
                      stroke={isSlotActive ? slotColor : 'var(--border)'}
                      strokeWidth={isSlotActive ? '2' : '1'}
                    />
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={isSlotActive ? '#fff' : 'var(--text)'}
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {idx + 1}
                    </text>
                  </g>
                );
              })}

            {/* Moyeu central */}
            <circle
              cx={cx}
              cy={cy}
              r={wheelInnerRadius}
              fill="var(--code-bg)"
              stroke={activeColor}
              strokeWidth="2"
            />

            <text
              x={cx}
              y={cy - 18}
              textAnchor="middle"
              fill="var(--text)"
              fontSize="10"
              fontWeight="bold"
            >
              {count > 0 ? `TOUR ${activeIndex + 1} / ${count}` : 'EN ATTENTE'}
            </text>
            <text
              x={cx}
              y={cy - 3}
              textAnchor="middle"
              fill="var(--text-h)"
              fontSize="11"
              fontWeight="bold"
            >
              {activeParticipant
                ? (liveCharsMap[activeParticipant.characterId]?.name || activeParticipant.name).slice(0, 14)
                : '-'}
            </text>
          </svg>
        </div>
      </div>

      {/* MODALE : AJOUTER DES PJ */}
      {showAddPjModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              background: 'var(--bg)',
              border: '1px solid var(--accent-border)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--text-h)', fontSize: '15px' }}>Importer des PJ</strong>
              {players.length > 0 && (
                <button type="button" onClick={handleAddAllPjs} className="btn-primary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                  Tous les ajouter
                </button>
              )}
            </div>

            {players.length === 0 ? (
              <p style={{ color: 'var(--text)', fontSize: '13px', margin: 0 }}>
                Aucun joueur dans cette campagne.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                {players.map((pl) => (
                  <div
                    key={pl.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: 'var(--code-bg)',
                      border: '1px solid #3182ce',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={resolveAssetUrl(pl.avatarUrl)}
                        alt={pl.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = './assets/jdr-bag.jpg';
                        }}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <strong style={{ fontSize: '13px', color: 'var(--text-h)' }}>{pl.name}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddSinglePj(pl)}
                      className="btn-primary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      Ajouter
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddPjModal(false)} className="btn-secondary">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE : AJOUTER UN PNJ (CHOIX ALLIÉ / ADVERSAIRE OBLIGATOIRE) */}
      {showAddNpcModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <form
            onSubmit={handleAddNpcSubmit}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: 'var(--bg)',
              border: '1px solid var(--accent-border)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <strong style={{ color: 'var(--text-h)', fontSize: '15px' }}>Importer un PNJ en combat</strong>

            {npcBank.length === 0 ? (
              <p style={{ color: 'var(--text)', fontSize: '13px', margin: 0 }}>
                Votre répertoire PNJ est vide. Créez d'abord un PNJ dans l'onglet PNJ.
              </p>
            ) : (
              <>
                <select
                  required
                  value={selectedNpcId}
                  onChange={(e) => {
                    const chosen = npcBank.find((n) => n.id === e.target.value);
                    setSelectedNpcId(e.target.value);
                    setNpcAlign(chosen?.defaultAlignment || '');
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--code-bg)',
                    color: 'var(--text-h)'
                  }}
                >
                  <option value="">-- Choisir un PNJ --</option>
                  {npcBank.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>

                <div>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}>
                    Camp dans ce combat (obligatoire) * :
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setNpcAlign('ally')}
                      style={{
                        flex: 1,
                        padding: '9px',
                        borderRadius: '8px',
                        border: npcAlign === 'ally' ? '2px solid #3182ce' : '1px solid var(--border)',
                        background: npcAlign === 'ally' ? 'rgba(49, 130, 206, 0.22)' : 'var(--code-bg)',
                        color: npcAlign === 'ally' ? '#63b3ed' : 'var(--text)',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Allié (Bleu)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNpcAlign('enemy')}
                      style={{
                        flex: 1,
                        padding: '9px',
                        borderRadius: '8px',
                        border: npcAlign === 'enemy' ? '2px solid #e53e3e' : '1px solid var(--border)',
                        background: npcAlign === 'enemy' ? 'rgba(229, 62, 62, 0.22)' : 'var(--code-bg)',
                        color: npcAlign === 'enemy' ? '#fc8181' : 'var(--text)',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Adversaire (Rouge)
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text)', marginBottom: '4px' }}>
                    Quantité :
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={npcQty}
                    onChange={(e) => setNpcQty(e.target.value)}
                    style={{
                      width: '90px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--code-bg)',
                      color: 'var(--text-h)'
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddNpcModal(false)} className="btn-secondary">
                Annuler
              </button>
              {npcBank.length > 0 && (
                <button
                  type="submit"
                  disabled={!selectedNpcId || !npcAlign}
                  className="btn-primary"
                  style={{ opacity: selectedNpcId && npcAlign ? 1 : 0.45 }}
                >
                  Ajouter
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}