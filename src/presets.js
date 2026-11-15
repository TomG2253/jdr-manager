export const resolveAssetUrl = (url, fallback = './assets/jdr-bag.jpg') => {
  if (!url) return fallback;
  if (url.startsWith('/assets/')) return `.${url}`;
  if (url.startsWith('../assets/')) return url.slice(1);
  return url;
};

export const ITEM_PRESETS = [
  { id: 'weapon', label: 'Arme / Dague', url: './assets/jdr-weapon.jpg' },
  { id: 'armor', label: 'Armure / Casque', url: './assets/jdr-armor.jpg' },
  { id: 'bag', label: 'Sac / Bourse', url: './assets/jdr-bag.jpg' },
  { id: 'beer', label: 'Boisson / Chope', url: './assets/jdr-bierre.jpg' },
  { id: 'book', label: 'Livre / Grimoire', url: './assets/jdr-book.jpg' },
  { id: 'bread', label: 'Nourriture / Pain', url: './assets/jdr-bread.jpg' },
  { id: 'flower', label: 'Plante / Fleur', url: './assets/jdr-flower.jpg' },
  { id: 'key', label: 'Clé / Artefact', url: './assets/jdr-key.jpg' },
  { id: 'paper', label: 'Parchemin / Carte', url: './assets/jdr-paper.jpg' },
  { id: 'rock', label: 'Minerai / Cristal', url: './assets/jdr-rock.jpg' }
];