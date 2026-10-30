/**
 * PDF Word Cloud Generator - 100% Client-side In-Memory Processing
 * No data leaves the user's browser.
 */

// PDF.js 워커 세팅
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// 상태 관리
const state = {
  file: null,
  rawText: '',
  wordFrequencyMap: new Map(),
  extractedWordList: [], // [word, count]
  totalPages: 0,
  totalWordCount: 0,
  isProcessing: false
};

// 기본 한국어 및 영어 불용어 (Stop words) 세트
const DEFAULT_STOP_WORDS = new Set([
  // 한국어 조사 및 빈출 접속사/대명사
  '이', '그', '저', '것', '수', '등', '들', '및', '를', '을', '에', '와', '과', '은', '는',
  '로', '으로', '에서', '에게', '하여', '하고', '하면', '된다', '하는', '위한', '따른', '대한',
  '통해', '있다', '없다', '경우', '또한', '하지만', '그리고', '관련', '내용', '기준',
  // 영어 주요 관사/전치사/대명사
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on',
  'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
  'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year',
  'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look',
  'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
  'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'been', 'has', 'had'
]);

// DOM 엘리먼트 캐싱
const dropZone = document.getElementById('dropZone');
const pdfFileInput = document.getElementById('pdfFileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const fileInfoArea = document.getElementById('fileInfoArea');
const currentFileName = document.getElementById('currentFileName');
const currentFileSize = document.getElementById('currentFileSize');
const resetFileBtn = document.getElementById('resetFileBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressStatus = document.getElementById('progressStatus');

const colorThemeSelect = document.getElementById('colorTheme');
const shapeTypeSelect = document.getElementById('shapeType');
const minWordLengthInput = document.getElementById('minWordLength');
const minWordLengthVal = document.getElementById('minWordLengthVal');
const maxWordsInput = document.getElementById('maxWords');
const maxWordsVal = document.getElementById('maxWordsVal');
const rotationRatioInput = document.getElementById('rotationRatio');
const rotationRatioVal = document.getElementById('rotationRatioVal');
const fontFamilySelect = document.getElementById('fontFamily');
const stopWordsInput = document.getElementById('stopWordsInput');
const renderBtn = document.getElementById('renderBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');

const statTotalPages = document.getElementById('statTotalPages');
const statTotalWords = document.getElementById('statTotalWords');
const statUniqueWords = document.getElementById('statUniqueWords');
const statCloudWords = document.getElementById('statCloudWords');
const topWordsList = document.getElementById('topWordsList');

const canvasWrapper = document.getElementById('canvasWrapper');
const emptyState = document.getElementById('emptyState');
const wordCloudCanvas = document.getElementById('wordCloudCanvas');
const wordTooltip = document.getElementById('wordTooltip');
const renderingBadge = document.getElementById('renderingBadge');
const renderingStatusText = document.getElementById('renderingStatusText');

// 초기 불용어 텍스트 표시
stopWordsInput.value = '이, 그, 저, 것, 수, 등, 및, 을, 를, 에, 와, 과, the, to, of, and, in, is';

// 이벤트 리스너 바인딩
function initEventListeners() {
  selectFileBtn.addEventListener('click', () => pdfFileInput.click());
  pdfFileInput.addEventListener('change', handleFileSelect);

  // 드래그 앤 드롭
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        processUploadedPDF(file);
      } else {
        alert('PDF 파일만 업로드할 수 있습니다.');
      }
    }
  });

  resetFileBtn.addEventListener('click', resetAll);

  // 슬라이더 변경 감지
  minWordLengthInput.addEventListener('input', (e) => {
    minWordLengthVal.textContent = `${e.target.value}글자`;
  });

  maxWordsInput.addEventListener('input', (e) => {
    maxWordsVal.textContent = `${e.target.value}개`;
  });

  rotationRatioInput.addEventListener('input', (e) => {
    rotationRatioVal.textContent = `${e.target.value}%`;
  });

  renderBtn.addEventListener('click', () => {
    if (state.rawText) {
      analyzeTextAndGenerate();
    }
  });

  downloadPngBtn.addEventListener('click', downloadCanvasAsImage);

  // 윈도우 크기 변경 시 디바운스 리사이징
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (state.extractedWordList.length > 0 && !wordCloudCanvas.classList.contains('hidden')) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderWordCloud();
      }, 350);
    }
  });
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    processUploadedPDF(file);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 1. PDF 파일 로컬 파싱 (메모리에서 FileReader 및 PDF.js 사용)
async function processUploadedPDF(file) {
  state.file = file;
  state.isProcessing = true;
  
  // UI 갱신
  currentFileName.textContent = file.name;
  currentFileSize.textContent = formatBytes(file.size);
  fileInfoArea.classList.remove('hidden');
  progressContainer.classList.remove('hidden');
  progressBar.style.width = '5%';
  progressStatus.textContent = 'PDF 파일 로딩 중...';
  
  renderBtn.disabled = true;
  downloadPngBtn.disabled = true;
  setRenderingBadge('진행 중', true);

  try {
    const arrayBuffer = await file.arrayBuffer();
    progressBar.style.width = '15%';
    progressStatus.textContent = '문서 구조 분석 중...';

    // PDF 로드 (오직 클라이언트 메모리 내 Uint8Array)
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocument = await loadingTask.promise;
    
    state.totalPages = pdfDocument.numPages;
    statTotalPages.textContent = `${state.totalPages} p`;

    let fullExtractedText = '';

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageStrings = textContent.items.map(item => item.str);
      fullExtractedText += pageStrings.join(' ') + ' ';

      // 진행율 업데이트
      const percent = 15 + Math.round((pageNum / pdfDocument.numPages) * 75);
      progressBar.style.width = `${percent}%`;
      progressStatus.textContent = `페이지 추출 중: ${pageNum} / ${pdfDocument.numPages} (${percent}%)`;
    }

    progressBar.style.width = '100%';
    progressStatus.textContent = '텍스트 추출 완료!';
    state.rawText = fullExtractedText;

    setTimeout(() => {
      progressContainer.classList.add('hidden');
      renderBtn.disabled = false;
      analyzeTextAndGenerate();
    }, 400);

  } catch (error) {
    console.error('PDF 추출 실패:', error);
    alert('PDF 파일을 읽어오는 중 오류가 발생했습니다. 암호화되지 않은 정상적인 PDF인지 확인해 주세요.');
    progressStatus.textContent = '오류 발생';
    setRenderingBadge('오류', false);
    state.isProcessing = false;
  }
}

// 2. 단어 토큰화 & 빈도 분석 (한글/영문 지원)
function analyzeTextAndGenerate() {
  if (!state.rawText) return;

  const minLen = parseInt(minWordLengthInput.value, 10);
  const maxWords = parseInt(maxWordsInput.value, 10);
  
  // 사용자 정의 불용어
  const customStopWords = new Set(
    stopWordsInput.value
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0)
  );

  // 단어 분리: 한글 완성형 가-힣, 영문 알파벳, 숫자
  // 특수문자, 문장부호 제거
  const words = state.rawText
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .split(/\s+/);

  state.totalWordCount = 0;
  const freqMap = new Map();

  for (let rawWord of words) {
    const word = rawWord.trim();
    if (!word) continue;

    state.totalWordCount++;
    const lowerWord = word.toLowerCase();

    // 길이 조건 검사
    if (word.length < minLen) continue;

    // 불용어 검사
    if (DEFAULT_STOP_WORDS.has(lowerWord) || customStopWords.has(lowerWord)) continue;

    // 순수 숫자로만 구성된 단어 제외
    if (/^\d+$/.test(word)) continue;

    freqMap.set(word, (freqMap.get(word) || 0) + 1);
  }

  // 내림차순 정렬
  const sortedWords = Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1]);

  state.wordFrequencyMap = freqMap;
  state.extractedWordList = sortedWords.slice(0, maxWords);

  // 통계 업데이트
  statTotalWords.textContent = state.totalWordCount.toLocaleString();
  statUniqueWords.textContent = freqMap.size.toLocaleString();
  statCloudWords.textContent = state.extractedWordList.length.toLocaleString();

  // Top 10 리스트 렌더링
  updateTopWordsList(sortedWords.slice(0, 10));

  // 워드클라우드 캔버스 렌더링
  renderWordCloud();
}

function updateTopWordsList(top10) {
  topWordsList.innerHTML = '';
  if (top10.length === 0) {
    topWordsList.innerHTML = '<li class="placeholder-text">표시할 유효한 단어가 없습니다.</li>';
    return;
  }

  top10.forEach(([word, count], idx) => {
    const li = document.createElement('li');
    li.className = 'word-rank-item';
    li.innerHTML = `
      <div class="word-rank-left">
        <span class="word-rank-badge">${idx + 1}</span>
        <span class="word-rank-text">${escapeHtml(word)}</span>
      </div>
      <span class="word-rank-count">${count.toLocaleString()}회</span>
    `;
    topWordsList.appendChild(li);
  });
}

// 3. 컬러 테마 생성기
function getColorFunction(theme) {
  const palettes = {
    aurora: ['#38bdf8', '#818cf8', '#c084fc', '#34d399', '#f472b6', '#a78bfa'],
    cyberpunk: ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#06b6d4', '#e0e7ff'],
    ocean: ['#38bdf8', '#0284c7', '#06b6d4', '#14b8a6', '#0ea5e9', '#7dd3fc'],
    sunset: ['#fb923c', '#f87171', '#f43f5e', '#e11d48', '#fbbf24', '#f472b6'],
    emerald: ['#10b981', '#34d399', '#059669', '#6ee7b7', '#14b8a6', '#86efac'],
    mono: ['#ffffff', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#f8fafc']
  };

  const selectedPalette = palettes[theme] || palettes.aurora;
  return function() {
    return selectedPalette[Math.floor(Math.random() * selectedPalette.length)];
  };
}

// 4. 워드클라우드 렌더링 (WordCloud2 사용)
function renderWordCloud() {
  if (state.extractedWordList.length === 0) {
    emptyState.classList.remove('hidden');
    wordCloudCanvas.classList.add('hidden');
    downloadPngBtn.disabled = true;
    setRenderingBadge('단어 없음', false);
    return;
  }

  emptyState.classList.add('hidden');
  wordCloudCanvas.classList.remove('hidden');
  downloadPngBtn.disabled = false;
  setRenderingBadge('렌더링 중...', true);

  // 캔버스 크기 맞춤 (고해상도 Retina 디스플레이 대응)
  const rect = canvasWrapper.getBoundingClientRect();
  const width = Math.max(500, Math.floor(rect.width - 40));
  const height = Math.max(450, Math.floor(rect.height - 40));

  wordCloudCanvas.width = width;
  wordCloudCanvas.height = height;
  wordCloudCanvas.style.width = `${width}px`;
  wordCloudCanvas.style.height = `${height}px`;

  // 단어 크기 정규화 (지수/비율 스케일링)
  const maxFreq = state.extractedWordList[0][1];
  const minFreq = state.extractedWordList[state.extractedWordList.length - 1][1];
  const fontMultiplier = Math.min(width, height) / 10;

  // wordcloud2 형식: [[word, size], ...]
  const list = state.extractedWordList.map(([word, count]) => {
    let size;
    if (maxFreq === minFreq) {
      size = 28;
    } else {
      // 거듭제곱 스케일로 크기 차이를 조화롭게 분배
      const normalized = Math.pow((count - minFreq) / (maxFreq - minFreq), 0.7);
      size = 14 + normalized * (fontMultiplier * 0.7);
    }
    return [word, Math.max(12, Math.round(size))];
  });

  const theme = colorThemeSelect.value;
  const shape = shapeTypeSelect.value;
  const fontFamily = fontFamilySelect.value;
  const rotationRatio = parseInt(rotationRatioInput.value, 10) / 100;

  // WordCloud 실행
  WordCloud(wordCloudCanvas, {
    list: list,
    gridSize: Math.round(16 * width / 1024),
    weightFactor: 1,
    fontFamily: fontFamily,
    color: getColorFunction(theme),
    rotateRatio: rotationRatio,
    rotationSteps: 2,
    backgroundColor: 'transparent',
    shape: shape,
    ellipticity: 0.65,
    drawOutOfBound: false,
    shrinkToFit: true,
    hover: function(item, dimension, event) {
      if (item && dimension && event) {
        const origCount = state.wordFrequencyMap.get(item[0]) || item[1];
        wordTooltip.innerHTML = `<strong>${escapeHtml(item[0])}</strong> : ${origCount.toLocaleString()}회 등장`;
        
        // 캔버스 래퍼 상대 좌표
        const wrapperRect = canvasWrapper.getBoundingClientRect();
        const x = event.clientX - wrapperRect.left;
        const y = event.clientY - wrapperRect.top;

        wordTooltip.style.left = `${x}px`;
        wordTooltip.style.top = `${y}px`;
        wordTooltip.classList.remove('hidden');
      } else {
        wordTooltip.classList.add('hidden');
      }
    }
  });

  // 완료 리스너
  wordCloudCanvas.addEventListener('wordcloudstop', function() {
    setRenderingBadge('완료됨', false);
  }, { once: true });
}

// 5. PNG 다운로드 기능
function downloadCanvasAsImage() {
  if (!wordCloudCanvas) return;

  // 배경이 투명할 수 있으므로, 다크 배경을 채운 새 캔버스에 복사 후 저장
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = wordCloudCanvas.width;
  exportCanvas.height = wordCloudCanvas.height;
  const ctx = exportCanvas.getContext('2d');

  // 다크 배경 그라데이션 채우기
  const bgGrad = ctx.createLinearGradient(0, 0, exportCanvas.width, exportCanvas.height);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(1, '#0b0f19');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // 워드클라우드 그리기
  ctx.drawImage(wordCloudCanvas, 0, 0);

  // 워터마크/서명 살짝 추가
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Generated by Local PDF WordCloud Studio', exportCanvas.width - 15, exportCanvas.height - 15);

  const imageURL = exportCanvas.toDataURL('image/png');
  const downloadLink = document.createElement('a');
  const baseName = state.file ? state.file.name.replace(/\.[^/.]+$/, "") : "document";
  downloadLink.download = `${baseName}_wordcloud.png`;
  downloadLink.href = imageURL;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

// 상태 초기화
function resetAll() {
  state.file = null;
  state.rawText = '';
  state.wordFrequencyMap.clear();
  state.extractedWordList = [];
  state.totalPages = 0;
  state.totalWordCount = 0;
  pdfFileInput.value = '';

  fileInfoArea.classList.add('hidden');
  progressContainer.classList.add('hidden');
  emptyState.classList.remove('hidden');
  wordCloudCanvas.classList.add('hidden');
  renderBtn.disabled = true;
  downloadPngBtn.disabled = true;

  statTotalPages.textContent = '-';
  statTotalWords.textContent = '-';
  statUniqueWords.textContent = '-';
  statCloudWords.textContent = '-';
  topWordsList.innerHTML = '<li class="placeholder-text">PDF를 업로드하면 순위가 나타납니다.</li>';

  setRenderingBadge('대기 중', false);
}

function setRenderingBadge(text, isActive) {
  renderingStatusText.textContent = text;
  if (isActive) {
    renderingBadge.classList.add('active');
  } else {
    renderingBadge.classList.remove('active');
  }
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, function(s) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s];
  });
}

// 초기화 시작
document.addEventListener('DOMContentLoaded', initEventListeners);
