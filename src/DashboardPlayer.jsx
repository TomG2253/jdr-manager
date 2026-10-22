import CharacterCard from './CharacterCard';

export default function DashboardPlayer({ user }) {
  
  const mockCharacter = {
    id: 'test-id',
    name: 'Theldus Forgefeu',
    race: 'Nain',
    class: 'Barbare',
    avatarUrl: 'https://media.discordapp.net/attachments/1188295388415926323/1188297228847153162/1v8T__HjpwPxhlxMRg2EBye7YBDiFRgCkWlgaLyIuBjxwQy7Didhmfm07CfHP.png?ex=6adabd08&is=6ad96b88&hm=b7e222b48a58a53a101259b79a91070dc940e67047b27425010272e1dbdc2db4&=&format=webp&quality=lossless',
    liveStats: { pvCurrent: 89, pvMax: 100, pmCurrent: 20, pmMax: 50 },
    totalPC: 100, // Une grosse réserve pour tester
    skills: [
      { 
        id: 's1', 
        name: 'Haches à deux mains', 
        baseValue: 30, // Niveau de création (Nain Barbare)
        lockedValue: 50, // VALIDÉ PAR LE MJ (La jauge ne peut plus descendre sous 50)
        currentValue: 50, // Actuellement à 50
        limit: 90, 
        isNative: true 
      },
      { 
        id: 's2', 
        name: 'Esquive', 
        baseValue: 10, 
        lockedValue: 10, // Jamais montée
        currentValue: 10, 
        limit: 70, 
        isNative: false 
      }
      ,
      { 
        id: 's3', 
        name: 'Acrobatie', 
        baseValue: 10, 
        lockedValue: 10, // Jamais montée
        currentValue: 10, 
        limit: 70, 
        isNative: true 
      }
    ]
  };

  return (
    <div style={{ textAlign: 'left', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '24px' }}>Espace Joueur</h2>
      
      <div style={{ marginBottom: '32px' }}>
        <p style={{ color: 'var(--text)' }}>Aperçu de la carte complète avec Jauges et Verrous (Phase 3) :</p>
        <CharacterCard character={mockCharacter} isEditable={true} />
      </div>
    </div>
  );
}