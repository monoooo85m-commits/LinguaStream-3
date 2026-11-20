const STORAGE_KEYS = {
  GROQ: 'linguastream_groq_key',
  GEMINI: 'linguastream_gemini_key'
};

export function saveApiKeys(groqKey, geminiKey) {
  if (groqKey) localStorage.setItem(STORAGE_KEYS.GROQ, groqKey.trim());
  if (geminiKey) localStorage.setItem(STORAGE_KEYS.GEMINI, geminiKey.trim());
}

export function getApiKeys() {
  return {
    groq: localStorage.getItem(STORAGE_KEYS.GROQ) || '',
    gemini: localStorage.getItem(STORAGE_KEYS.GEMINI) || ''
  };
}

export function clearApiKeys() {
  localStorage.removeItem(STORAGE_KEYS.GROQ);
  localStorage.removeItem(STORAGE_KEYS.GEMINI);
}

export function hasValidKeys() {
  const { groq, gemini } = getApiKeys();
  return groq.length > 10 && gemini.length > 10;
}
