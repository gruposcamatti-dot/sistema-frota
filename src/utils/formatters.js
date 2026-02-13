
// Create formatter once to reuse across calls (PERFORMANCE OPTIMIZATION)
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberFormatter = new Intl.NumberFormat('pt-BR');

// Pre-compile regex for performance
const quotesRegex = /^["']|["']$/g;

// Map for character replacement - faster than multiple replace calls
const encodingMap = {
  'Ã§': 'ç', 'Ã‡': 'Ç', 'Ã£': 'ã', 'Ãƒ': 'Ã', 'Ã¡': 'á', 'Ã': 'Á', 'Ã¢': 'â', 'Ã‚': 'Â',
  'Ã©': 'é', 'Ã‰': 'É', 'Ãª': 'ê', 'ÃŠ': 'Ê', 'Ã­': 'í', 'Ã\u008d': 'Í', 'Ã³': 'ó',
  'Ã"': 'Ó', 'Ãµ': 'õ', 'Ã•': 'Õ', 'Ãº': 'ú', 'Ãš': 'Ú', 'Â°': '°', 'Âª': 'ª', 'Âº': 'º',
};

// Create a single regex for all replacements
const encodingRegex = new RegExp(Object.keys(encodingMap).join('|'), 'g');

export const formatCurrency = (val) => {
  if (val === undefined || val === null) return '—';
  return currencyFormatter.format(val);
};

export const formatNumber = (val) => numberFormatter.format(val || 0);

export const cleanValue = (val) => {
  if (typeof val !== 'string') return val;
  if (!val) return '';

  // Single pass replacement
  let cleaned = val.replace(quotesRegex, '').trim();

  // Only run encoding replacement if needed (common case optimization)
  if (cleaned.includes('Ã') || cleaned.includes('Â')) {
    cleaned = cleaned.replace(encodingRegex, (match) => encodingMap[match]);
  }

  return cleaned;
};
