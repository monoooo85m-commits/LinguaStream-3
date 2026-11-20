import { saveApiKeys, getApiKeys, clearApiKeys, hasValidKeys } from './storage.js';
import { transcribeMedia, translateAndSummarize } from './api.js';

// State Aplikasi
let selectedFile = null;
let currentSegments = [];
let currentSummary = '';

// Selektor DOM
const dom = {
  apiBadge: document.getElementById('api-status-badge'),
  modal: document.getElementById('settings-modal'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnSaveKeys: document.getElementById('btn-save-keys'),
  btnClearKeys: document.getElementById('btn-clear-keys'),
  inputGroq: document.getElementById('input-groq-key'),
  inputGemini: document.getElementById('input-gemini-key'),

  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('media-file-input'),
  fileNameDisplay: document.getElementById('selected-file-name'),

  ytUrlInput: document.getElementById('youtube-url-input'),
  btnLoadYt: document.getElementById('btn-load-yt'),
  playerWrapper: document.getElementById('player-wrapper'),
  localPlayer: document.getElementById('local-media-player'),
  ytContainer: document.getElementById('yt-player-container'),

  sourceLang: document.getElementById('source-lang'),
  targetLang: document.getElementById('target-lang'),
  btnTranscribe: document.getElementById('btn-transcribe'),
  statusBox: document.getElementById('status-box'),
  statusText: document.getElementById('status-text'),

  searchInput: document.getElementById('search-transcript'),
  btnExportMd: document.getElementById('btn-export-md'),
  modeBtns: document.querySelectorAll('.mode-btn'),
  transcriptContainer: document.getElementById('transcript-container'),
  summaryContainer: document.getElementById('summary-container')
};

// Inisialisasi Awal
function init() {
  updateApiStatusUI();
  setupEventListeners();
}

function updateApiStatusUI() {
  const keys = getApiKeys();
  dom.inputGroq.value = keys.groq;
  dom.inputGemini.value = keys.gemini;

  if (hasValidKeys()) {
    dom.apiBadge.textContent = 'API Siap ✓';
    dom.apiBadge.className = 'badge badge-success';
  } else {
    dom.apiBadge.textContent = 'API Belum Diatur';
    dom.apiBadge.className = 'badge badge-warning';
  }
}

function setupEventListeners() {
  // Modal Pengaturan
  dom.btnOpenSettings.addEventListener('click', () => dom.modal.classList.remove('hidden'));
  dom.btnCloseSettings.addEventListener('click', () => dom.modal.classList.add('hidden'));
  
  dom.btnSaveKeys.addEventListener('click', () => {
    saveApiKeys(dom.inputGroq.value, dom.inputGemini.value);
    updateApiStatusUI();
    dom.modal.classList.add('hidden');
  });

  dom.btnClearKeys.addEventListener('click', () => {
    clearApiKeys();
    updateApiStatusUI();
  });

  // Navigasi Tab Input
  dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.tabBtns.forEach(b => b.classList.remove('active'));
      dom.tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Drag & Drop File
  dom.dropZone.addEventListener('click', () => dom.fileInput.click());
  dom.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropZone.classList.add('dragover');
  });
  dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('dragover'));
  dom.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFileSelection(e.dataTransfer.files[0]);
  });
  dom.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFileSelection(e.target.files[0]);
  });

  // Muat Pratinjau YouTube
  dom.btnLoadYt.addEventListener('click', loadYouTubeEmbed);

  // Eksekusi Proses AI
  dom.btnTranscribe.addEventListener('click', runPipeline);

  // Mode Tampilan Transkrip
  dom.modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchViewMode(btn.dataset.mode);
    });
  });

  // Pencarian Kata dalam Transkrip
  dom.searchInput.addEventListener('input', (e) => renderTranscript(e.target.value));

  // Ekspor Catatan Markdown
  dom.btnExportMd.addEventListener('click', exportToMarkdown);
}

function handleFileSelection(file) {
  selectedFile = file;
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  dom.fileNameDisplay.textContent = `File terpilih: ${file.name} (${sizeMB} MB)`;
  dom.fileNameDisplay.classList.remove('hidden');

  // Tampilkan di pemutar HTML5 lokal
  const objectURL = URL.createObjectURL(file);
  dom.playerWrapper.classList.remove('hidden');
  dom.ytContainer.classList.add('hidden');
  dom.localPlayer.src = objectURL;
  dom.localPlayer.classList.remove('hidden');

  dom.btnTranscribe.disabled = false;
}

function loadYouTubeEmbed() {
  const url = dom.ytUrlInput.value.trim();
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (!match) {
    alert('Link YouTube tidak valid. Pastikan format link benar.');
    return;
  }
  const videoId = match[1];
  dom.playerWrapper.classList.remove('hidden');
  dom.localPlayer.classList.add('hidden');
  dom.ytContainer.classList.remove('hidden');
  dom.ytContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
}

async function runPipeline() {
  if (!hasValidKeys()) {
    dom.modal.classList.remove('hidden');
    alert('Silakan masukkan Groq API Key dan Gemini API Key terlebih dahulu.');
    return;
  }
  if (!selectedFile) return;

  try {
    setLoading(true, 'Tahap 1/2: Mengenali suara & membuat transkrip...');
    const transcription = await transcribeMedia(selectedFile, dom.sourceLang.value);
    
    setLoading(true, `Tahap 2/2: Menerjemahkan ke ${dom.targetLang.value} & menyusun catatan...`);
    const result = await translateAndSummarize(transcription.segments, dom.targetLang.value);

    currentSegments = result.segments;
    currentSummary = result.summary;

    renderTranscript();
    dom.summaryContainer.textContent = currentSummary;
    dom.btnExportMd.disabled = false;
  } catch (error) {
    alert(`Terjadi kesalahan: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading, message = '') {
  dom.btnTranscribe.disabled = isLoading;
  dom.statusText.textContent = message;
  dom.statusBox.classList.toggle('hidden', !isLoading);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function renderTranscript(filterQuery = '') {
  if (!currentSegments.length) return;

  const query = filterQuery.toLowerCase();
  const filtered = currentSegments.filter(seg =>
    seg.originalText.toLowerCase().includes(query) ||
    seg.translatedText.toLowerCase().includes(query)
  );

  dom.transcriptContainer.innerHTML = filtered.map(seg => `
    <div class="segment-item" data-start="${seg.start}">
      <span class="timestamp">⏱ ${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
      <p class="text-original">${seg.originalText}</p>
      <p class="text-translated">${seg.translatedText}</p>
    </div>
  `).join('');

  // Fitur Klik Timestamp -> Lompat ke detik audio/video
  document.querySelectorAll('.segment-item').forEach(item => {
    item.addEventListener('click', () => {
      const startTime = parseFloat(item.dataset.start);
      if (!dom.localPlayer.classList.contains('hidden')) {
        dom.localPlayer.currentTime = startTime;
        dom.localPlayer.play();
      }
    });
  });
}

function switchViewMode(mode) {
  if (mode === 'summary') {
    dom.transcriptContainer.classList.add('hidden');
    dom.summaryContainer.classList.remove('hidden');
  } else {
    dom.summaryContainer.classList.add('hidden');
    dom.transcriptContainer.classList.remove('hidden');
    dom.transcriptContainer.className = `transcript-list mode-${mode}`;
  }
}

function exportToMarkdown() {
  const title = selectedFile ? selectedFile.name : 'Catatan Video';
  let mdContent = `# Catatan Belajar: ${title}\n\n`;
  mdContent += `## Ringkasan Materi\n${currentSummary}\n\n---\n\n## Transkrip Bilinggual\n\n`;

  currentSegments.forEach(seg => {
    mdContent += `**[${formatTime(seg.start)}]**\n`;
    mdContent += `- *Asli:* ${seg.originalText}\n`;
    mdContent += `- **Terjemahan:** ${seg.translatedText}\n\n`;
  });

  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Catatan_${title.replace(/\.[^/.]+$/, '')}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

init();
