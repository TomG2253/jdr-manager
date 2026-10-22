import { useState } from 'react';

// --- MOTEUR DE RÈGLES D100 ---
const getNextPointCost = (currentVal, isNative) => {
  if (currentVal >= 90) return Infinity;
  
  if (!isNative) {
    if (currentVal < 70) return 2; 
    return 3;
  } else {
    if (currentVal < 50) return 1;
    if (currentVal < 70) return 2;
    return 3;
  }
};

// Le calcul se fait désormais depuis un point de départ (base originelle ou plancher verrouillé)
const calculateTotalSpent = (startVal, currentVal, isNative) => {
  let cost = 0;
  for (let i = startVal; i < currentVal; i++) {
    cost += getNextPointCost(i, isNative);
  }
  return cost;
};

// --- SOUS-COMPOSANT : Gère une ligne de compétence avec la jauge ---
const SkillRow = ({ skill, remainingPC, isEditable, onUpdateValue, onReset }) => {
  const nextCost = getNextPointCost(skill.currentValue, skill.isNative);
  
  // LE NOUVEAU PLANCHER : On prend la valeur validée par le MJ, sinon la base originelle
  const floor = skill.lockedValue ?? skill.baseValue;
  
  const canDecrease = skill.currentValue > floor;
  const maxSlider = Math.min(skill.limit, 90);

  // Définition de la couleur (Vert -> Jaune -> Rouge)
  let barColor = '#48bb78';
  if (nextCost === 2) barColor = '#d69e2e';
  if (nextCost === 3 || skill.currentValue >= 90) barColor = '#e53e3e';

  // Calcul du remplissage visuel de la barre pour le CSS
  const range = maxSlider - floor;
  const fillPercentage = range === 0 ? 100 : ((skill.currentValue - floor) / range) * 100;
  const trackBackground = `linear-gradient(to right, ${barColor} ${fillPercentage}%, var(--border) ${fillPercentage}%)`;

  return (
    <div style={{ padding: '16px', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '8px', transition: 'border-color 0.2s' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ color: 'var(--text-h)', fontSize: '16px' }}>{skill.name}</strong>
            {skill.isNative ? 
              <span style={{ fontSize: '11px', background: 'rgba(49, 130, 206, 0.2)', color: '#3182ce', padding: '2px 6px', borderRadius: '4px' }}>Native</span> 
              : 
              <span style={{ fontSize: '11px', background: 'rgba(229, 62, 62, 0.2)', color: '#e53e3e', padding: '2px 6px', borderRadius: '4px' }}>Non-native</span>
            }
          </div>
          
          <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '4px' }}>
            Base absolue : {skill.baseValue}
          </div>
          
          {isEditable && canDecrease && (
            <button 
              onClick={() => onReset(skill.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', padding: '4px 0 0 0', textDecoration: 'underline' }}
            >
              Rembourser (Retour à {floor})
            </button>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: barColor, lineHeight: '1' }}>
            {skill.currentValue}
          </div>
          {isEditable && skill.currentValue < maxSlider && (
            <div style={{ fontSize: '11px', color: 'var(--text)', marginTop: '4px' }}>
              Prochain point : {nextCost} PC
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-h)', fontWeight: 'bold', width: '24px', textAlign: 'right' }}>
          {floor}
        </span>
        
        <input 
          type="range" 
          className="skill-slider"
          min={floor} 
          max={maxSlider} 
          value={skill.currentValue}
          onChange={(e) => onUpdateValue(skill.id, parseInt(e.target.value, 10))}
          disabled={!isEditable}
          style={{ 
            flex: 1, 
            background: trackBackground, // On applique la barre dynamique ici
            cursor: isEditable ? 'pointer' : 'not-allowed'
          }} 
        />
        
        <span style={{ fontSize: '14px', color: 'var(--text-h)', fontWeight: 'bold', width: '24px' }}>
          {maxSlider}
        </span>
      </div>
      
    </div>
  );
};


// --- COMPOSANT PRINCIPAL ---
export default function SkillManager({ initialSkills, totalPC, isEditable }) {
  const [skills, setSkills] = useState(initialSkills);

  // Le calcul total pioche désormais dans le "floor" (lockedValue ou baseValue) pour cette session
  const spentPC = skills.reduce((acc, skill) => {
    const floor = skill.lockedValue ?? skill.baseValue;
    return acc + calculateTotalSpent(floor, skill.currentValue, skill.isNative);
  }, 0);
  
  const remainingPC = totalPC - spentPC;

  const handleReset = (skillId) => {
    if (!isEditable) return;
    setSkills(skills.map(skill => {
      if (skill.id !== skillId) return skill;
      const floor = skill.lockedValue ?? skill.baseValue;
      return { ...skill, currentValue: floor };
    }));
  };

  const handleUpdateValue = (skillId, targetValue) => {
    if (!isEditable) return;

    setSkills(skills.map(skill => {
      if (skill.id === skillId) {
        const floor = skill.lockedValue ?? skill.baseValue;
        
        // On bloque la jauge entre le nouveau plancher et le plafond
        let safeTarget = Math.max(floor, Math.min(targetValue, skill.limit, 90));

        const currentlySpentOnThis = calculateTotalSpent(floor, skill.currentValue, skill.isNative);
        const maxPcForThisSkill = remainingPC + currentlySpentOnThis;

        let affordableTarget = floor; // On simule l'achat depuis le plancher de la session
        let cost = 0;

        for (let i = floor; i < safeTarget; i++) {
          const nextCost = getNextPointCost(i, skill.isNative);
          if (cost + nextCost > maxPcForThisSkill) {
            break; 
          }
          cost += nextCost;
          affordableTarget = i + 1;
        }

        return { ...skill, currentValue: affordableTarget };
      }
      return skill;
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '16px', background: 'var(--accent-bg)', borderRadius: '8px', border: '1px solid var(--accent-border)' }}>
        <strong style={{ color: 'var(--text-h)' }}>Points de Compétence (PC)</strong>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent)' }}>
          {remainingPC} / {totalPC} restants
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {skills.map(skill => (
          <SkillRow 
            key={skill.id} 
            skill={skill} 
            remainingPC={remainingPC} 
            isEditable={isEditable}
            onUpdateValue={handleUpdateValue}
            onReset={handleReset}
          />
        ))}
      </div>
    </div>
  );
}