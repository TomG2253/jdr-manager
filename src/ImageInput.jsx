import { useState } from 'react';

export default function ImageInput({ value, onChange, placeholder = "URL ou importer..." }) {
  const [loading, setLoading] = useState(false);

  // Clé d'API publique ImgBB
  const IMGBB_API_KEY = '11a9d9c4ee1d16b84b97b3107f5997e2';

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        onChange(data.data.url);
      } else {
        alert("Échec de l'envoi de l'image.");
      }
    } catch (err) {
      console.error("Erreur ImgBB :", err);
      alert("Erreur lors de l'envoi de l'image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          background: 'var(--code-bg)',
          color: 'var(--text-h)'
        }}
      />
      
      <label className="btn-secondary" style={{ 
        cursor: 'pointer', 
        fontSize: '12px', 
        padding: '8px 12px', 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '4px',
        whiteSpace: 'nowrap'
      }}>
        {loading ? 'Envoi...' : '📁 Importer'}
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileUpload} 
          disabled={loading}
          style={{ display: 'none' }} 
        />
      </label>
    </div>
  );
}