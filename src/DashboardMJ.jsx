export default function DashboardMJ({ user }) {
  // Génère dynamiquement le lien spectateur basé sur l'URL actuelle
  const spectatorLink = `${window.location.origin}${window.location.pathname}#/spectator/${user.uid}`;

  return (
    <div style={{ textAlign: 'left', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '40px', padding: '24px', backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Votre Table Virtuelle</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '16px' }}>
            Donnez cet ID à vos joueurs pour qu'ils rejoignent votre campagne :<br/>
            <strong style={{ color: 'var(--accent)', fontSize: '20px', letterSpacing: '1px' }}>{user.uid}</strong>
          </p>
          
          <p style={{ margin: 0, fontSize: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            Lien Spectateur public (lecture seule) :<br/>
            <a href={spectatorLink} target="_blank" rel="noreferrer" style={{ color: 'var(--text-h)', wordBreak: 'break-all' }}>
              {spectatorLink}
            </a>
          </p>
        </div>
      </div>

      <div>
        <h2 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '24px' }}>Fiches des Joueurs</h2>
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          Les cartes de personnages de vos joueurs apparaîtront ici (Prochaine étape).
        </p>
      </div>

    </div>
  );
}