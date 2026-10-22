import { useParams, Link } from 'react-router-dom';

export default function SpectatorView() {
  // Récupère l'ID du MJ depuis l'URL (ex: /spectator/12345)
  const { mjId } = useParams();

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '32px' }}>
        <h2 style={{ margin: 0 }}>Vue Spectateur</h2>
        <Link to="/" style={{ color: 'var(--text-h)', textDecoration: 'none', padding: '8px 16px', background: 'var(--social-bg)', borderRadius: '6px' }}>
          Retour à l'accueil
        </Link>
      </div>
      
      <p>Observation de la table du MJ : <strong style={{ color: 'var(--accent)' }}>{mjId}</strong></p>
      
      <p style={{ color: 'var(--text)', fontStyle: 'italic', marginTop: '24px' }}>
        Les cartes des joueurs en direct apparaîtront ici (Prochaine étape).
      </p>
    </div>
  );
}