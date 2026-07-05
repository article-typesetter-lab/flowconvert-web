const typeConfig = {
  image: {
    label: '图片', formats: ['JPG', 'JPEG', 'PNG', 'GIF'], accept: '.jpg,.jpeg,.png,.gif,image/*', support: '支持 JPG、JPEG、PNG、GIF · 最大 20 GB', dimension: true, compression: true, hint: '兼顾清晰度与体积'
  },
  document: {
    label: '文档', formats: ['PDF', 'DOC', 'DOCX'], accept: '.pdf,.doc,.docx,application/pdf', support: '支持 Word、PDF · 最大 200 MB', dimension: false, compression: false, hint: ''
  },
  audio: {
    label: '音频', formats: ['MP3', 'AAC', 'WAV', 'M4A'], accept: '.mp3,.aac,.wav,.m4a,audio/*', support: '支持 MP3、AAC、WAV、M4A · 最大 2 GB', dimension: false, compression: true, hint: '智能调节音频码率'
  },
  video: {
    label: '视频', formats: ['MP4', 'MOV', 'RAW'], accept: '.mp4,.mov,.raw,video/*', support: '支持 MP4、MOV、RAW · 最大 50 GB', dimension: true, compression: true, hint: '按目标体积智能压缩'
  }
};

let currentType = 'image';
let selectedFile = null;
let isConverting = false;
let conversionTimer = null;
let resultUrl = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const uploadZone = $('#upload-zone');
const fileInput = $('#file-input');
const fileCard = $('#file-card');
const formatSelect = $('#format-select');
const dimensionSetting = $('#dimension-setting');
const compressionSetting = $('#compression-setting');
const sizeRange = $('#size-range');
const sizeOutput = $('#size-output');
const convertButton = $('#convert-button');
const settingsPanel = $('#settings-panel');
const resultPanel = $('#result-panel');
const resultDownload = $('#result-download');
const buttonLabel = $('.button-label', convertButton);
const progressBar = $('.progress-track i', convertButton);
const toast = $('#toast');

function setType(type, options = {}) {
  if (!typeConfig[type]) return;
  currentType = type;
  const config = typeConfig[type];

  $$('.converter-tab').forEach((tab) => {
    const active = tab.dataset.type === type;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  $('#upload-type-label').textContent = config.label;
  $('#support-copy').textContent = config.support;
  $('#size-hint').textContent = config.hint;
  fileInput.accept = config.accept;
  formatSelect.innerHTML = config.formats.map((format) => `<option value="${format}">${format}</option>`).join('');
  dimensionSetting.hidden = !config.dimension;
  compressionSetting.hidden = !config.compression;

  if (selectedFile && !options.keepFile) clearFile();
  if (options.scroll) document.querySelector('#converter').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setStory(type) {
  $$('.story-tab').forEach((tab) => {
    const active = tab.dataset.story === type;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.story-panel').forEach((panel) => {
    const active = panel.dataset.panel === type;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
    if (active) {
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    }
  });
}

function friendlySize(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function handleFile(file) {
  if (!file) return;
  selectedFile = file;
  const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : typeConfig[currentType].formats[0];
  $('#file-name').textContent = file.name;
  $('#file-ext').textContent = ext.slice(0, 5);
  $('#file-meta').textContent = `${friendlySize(file.size)} · ${typeConfig[currentType].label}`;

  const thumb = $('#file-thumbnail');
  thumb.classList.remove('has-image');
  thumb.style.backgroundImage = '';
  if (currentType === 'image' && file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    thumb.style.backgroundImage = `url("${url}")`;
    thumb.classList.add('has-image');
  }

  uploadZone.hidden = true;
  fileCard.hidden = false;
  resultPanel.hidden = true;
  settingsPanel.hidden = false;
  convertButton.disabled = false;
  buttonLabel.textContent = `转换为 ${formatSelect.value}`;
}

function clearFile() {
  if (conversionTimer) {
    clearInterval(conversionTimer);
    conversionTimer = null;
  }
  selectedFile = null;
  if (resultUrl) {
    URL.revokeObjectURL(resultUrl);
    resultUrl = null;
  }
  fileInput.value = '';
  uploadZone.hidden = false;
  fileCard.hidden = true;
  resultPanel.hidden = true;
  settingsPanel.hidden = false;
  convertButton.disabled = true;
  buttonLabel.textContent = '请先添加文件';
  convertButton.classList.remove('is-converting');
  progressBar.style.width = '0';
  isConverting = false;
}

function buildOutputName(fileName, format) {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  return `${baseName}_converted.${format.toLowerCase()}`;
}

function showResult(file) {
  const outputFormat = formatSelect.value;
  const outputName = buildOutputName(file.name, outputFormat);
  const ratio = typeConfig[currentType].compression ? Number(sizeRange.value) / 100 : 0.94;
  const outputBytes = Math.max(1024, Math.round(file.size * ratio));
  const saving = Math.max(0, Math.round((1 - outputBytes / Math.max(file.size, 1)) * 100));

  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(file);
  resultDownload.href = resultUrl;
  resultDownload.download = outputName;

  $('#result-name').textContent = outputName;
  $('#result-ext').textContent = outputFormat.slice(0, 5);
  $('#result-meta').textContent = `${friendlySize(outputBytes)} · ${outputFormat}`;
  $('#result-original-size').textContent = friendlySize(file.size);
  $('#result-output-size').textContent = friendlySize(outputBytes);
  $('#result-saving').textContent = saving ? `−${saving}%` : '保持原样';

  const sourceThumb = $('#file-thumbnail');
  const resultThumb = $('#result-thumbnail');
  resultThumb.style.backgroundImage = sourceThumb.style.backgroundImage;
  resultThumb.classList.toggle('has-image', sourceThumb.classList.contains('has-image'));

  fileCard.hidden = true;
  settingsPanel.hidden = true;
  resultPanel.hidden = false;
}

function startConversion() {
  if (!selectedFile || isConverting) return;
  const convertingFile = selectedFile;
  isConverting = true;
  convertButton.classList.add('is-converting');
  convertButton.disabled = true;
  buttonLabel.textContent = '正在转换 · 0%';

  let progress = 0;
  conversionTimer = setInterval(() => {
    progress += Math.max(2, Math.round((100 - progress) / 10));
    progress = Math.min(progress, 100);
    progressBar.style.width = `${progress}%`;
    buttonLabel.textContent = progress < 100 ? `正在转换 · ${progress}%` : '转换完成';

    if (progress >= 100) {
      clearInterval(conversionTimer);
      conversionTimer = null;
      setTimeout(() => {
        if (selectedFile !== convertingFile) return;
        isConverting = false;
        convertButton.classList.remove('is-converting');
        convertButton.disabled = false;
        buttonLabel.textContent = `转换为 ${formatSelect.value}`;
        showResult(convertingFile);
        $('#toast-copy').textContent = `${convertingFile.name} → ${formatSelect.value}`;
        toast.classList.add('is-visible');
        setTimeout(() => toast.classList.remove('is-visible'), 5000);
      }, 350);
    }
  }, 120);
}

$$('.story-tab').forEach((tab) => tab.addEventListener('click', () => setStory(tab.dataset.story)));
$$('.story-action').forEach((button) => button.addEventListener('click', () => setType(button.dataset.openType, { scroll: true })));
$$('.converter-tab').forEach((tab) => tab.addEventListener('click', () => setType(tab.dataset.type)));

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
$('#remove-file').addEventListener('click', clearFile);

['dragenter', 'dragover'].forEach((name) => uploadZone.addEventListener(name, (event) => {
  event.preventDefault();
  uploadZone.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach((name) => uploadZone.addEventListener(name, (event) => {
  event.preventDefault();
  uploadZone.classList.remove('is-dragging');
}));
uploadZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));

formatSelect.addEventListener('change', () => {
  if (selectedFile) buttonLabel.textContent = `转换为 ${formatSelect.value}`;
});
sizeRange.addEventListener('input', () => {
  sizeOutput.value = `${sizeRange.value}%`;
  sizeRange.style.background = `linear-gradient(90deg,var(--lime) 0 ${sizeRange.value}%,#3f423b ${sizeRange.value}%)`;
});
convertButton.addEventListener('click', startConversion);
$('#convert-another').addEventListener('click', clearFile);
resultDownload.addEventListener('click', () => {
  const label = $('span', resultDownload);
  label.textContent = '已开始下载';
  setTimeout(() => { label.textContent = '下载文件'; }, 1800);
});
$('#toast-close').addEventListener('click', () => toast.classList.remove('is-visible'));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.3 });
revealObserver.observe($('.scroll-statement'));

if (window.matchMedia('(pointer: fine)').matches) {
  const glow = $('.cursor-glow');
  window.addEventListener('pointermove', (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }, { passive: true });
}

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ticking = true;
  requestAnimationFrame(() => {
    const scrolled = window.scrollY;
    const stage = $('.hero-stage');
    if (scrolled < window.innerHeight) {
      stage.style.transform = `translateY(${scrolled * 0.08}px)`;
      stage.style.opacity = Math.max(0.3, 1 - scrolled / (window.innerHeight * 1.15));
    }
    ticking = false;
  });
}, { passive: true });

setType('image', { keepFile: true });
