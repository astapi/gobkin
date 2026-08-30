const elements = {
  anatomyFrames: document.querySelector('#anatomy-frames'),
  anatomySummary: document.querySelector('#anatomy-summary'),
  duration: document.querySelector('#duration'),
  durationValue: document.querySelector('#duration-value'),
  error: document.querySelector('#error-banner'),
  filmstrip: document.querySelector('#filmstrip'),
  framePosition: document.querySelector('#frame-position'),
  frameStats: document.querySelector('#frame-stats'),
  machineReport: document.querySelector('#machine-report'),
  motionTabs: document.querySelector('#motion-tabs'),
  motionTitle: document.querySelector('#motion-title'),
  nextFrame: document.querySelector('#next-frame'),
  playState: document.querySelector('#play-state'),
  prevFrame: document.querySelector('#prev-frame'),
  qaCards: document.querySelector('#qa-cards'),
  qaSummary: document.querySelector('#qa-summary'),
  reviewSource: document.querySelector('#review-source'),
  setForm: document.querySelector('#set-form'),
  setPath: document.querySelector('#set-path'),
  showDiff: document.querySelector('#show-diff'),
  showGuides: document.querySelector('#show-guides'),
  showOnion: document.querySelector('#show-onion'),
  showSemanticMarkers: document.querySelector('#show-semantic-markers'),
  showSilhouette: document.querySelector('#show-silhouette'),
  stage: document.querySelector('#stage'),
  stageWrap: document.querySelector('#stage-wrap'),
  togglePlay: document.querySelector('#toggle-play'),
  zoom: document.querySelector('#zoom'),
  zoomValue: document.querySelector('#zoom-value'),
};

const semanticIssueLabels = {
  'duplicate-arm-chain': '同じ側の腕が二重化',
  'extra-or-missing-limb': '手足の増殖・欠損',
  'joint-disconnect': '関節・接続の破綻',
  'prop-grip': '装備・握りの破綻',
  'identity-drift': '顔・体格の変化',
  'foot-slide': '接地足の滑り',
};

const state = {
  analysis: null,
  duration: 140,
  frameIndex: 0,
  images: [],
  lastTick: performance.now(),
  manifest: null,
  motion: null,
  playing: true,
  zoom: 6,
};

const stageContext = elements.stage.getContext('2d', { alpha: true });
stageContext.imageSmoothingEnabled = false;

function imageDataFor(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function analyzeFrame(image, imageData) {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaquePixels = 0;
  let sumX = 0;
  let sumY = 0;
  let edgeTouch = false;
  const colors = new Set();
  const alphaLevels = new Set();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      alphaLevels.add(a);
      if (a === 0) continue;
      colors.add(`${r},${g},${b},${a}`);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      opaquePixels += 1;
      sumX += x;
      sumY += y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edgeTouch = true;
    }
  }

  const empty = maxX < 0;
  return {
    alphaLevels: [...alphaLevels].sort((a, b) => a - b),
    bbox: empty ? null : { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
    center: empty ? null : { x: Number((sumX / opaquePixels).toFixed(2)), y: Number((sumY / opaquePixels).toFixed(2)) },
    colorCount: colors.size,
    dimensions: `${image.naturalWidth}x${image.naturalHeight}`,
    edgeTouch,
    opaquePixels,
  };
}

function changedPixels(a, b) {
  if (a.width !== b.width || a.height !== b.height) return null;
  let changed = 0;
  for (let offset = 0; offset < a.data.length; offset += 4) {
    if (
      a.data[offset] !== b.data[offset]
      || a.data[offset + 1] !== b.data[offset + 1]
      || a.data[offset + 2] !== b.data[offset + 2]
      || a.data[offset + 3] !== b.data[offset + 3]
    ) changed += 1;
  }
  return changed;
}

function analyzeMotion(images, motionId) {
  const imageData = images.map(imageDataFor);
  const frames = images.map((image, index) => ({
    index: index + 1,
    ...analyzeFrame(image, imageData[index]),
  }));
  const transitions = frames.map((_, index) => ({
    from: index + 1,
    to: ((index + 1) % frames.length) + 1,
    changedPixels: changedPixels(imageData[index], imageData[(index + 1) % frames.length]),
  }));
  const dimensions = [...new Set(frames.map((frame) => frame.dimensions))];
  const grounds = [...new Set(frames.map((frame) => frame.bbox?.maxY).filter(Number.isFinite))];
  const alphaBinary = frames.every((frame) => frame.alphaLevels.every((alpha) => alpha === 0 || alpha === 255));
  const noEdgeTouch = frames.every((frame) => !frame.edgeTouch);
  const centers = frames.map((frame) => frame.center).filter(Boolean);
  const centerRangeX = centers.length ? Math.max(...centers.map(({ x }) => x)) - Math.min(...centers.map(({ x }) => x)) : 0;
  const centerRangeY = centers.length ? Math.max(...centers.map(({ y }) => y)) - Math.min(...centers.map(({ y }) => y)) : 0;
  const internalChanges = transitions.slice(0, -1).map(({ changedPixels: value }) => value ?? 0);
  const meanInternalChange = internalChanges.length
    ? internalChanges.reduce((sum, value) => sum + value, 0) / internalChanges.length
    : 0;
  const loopChange = transitions.at(-1)?.changedPixels ?? 0;
  const loopRatio = meanInternalChange === 0 ? 0 : loopChange / meanInternalChange;
  const meanOpaquePixels = frames.reduce((sum, frame) => sum + frame.opaquePixels, 0) / frames.length;
  const meanChangedPixels = transitions.reduce((sum, transition) => sum + (transition.changedPixels ?? 0), 0) / transitions.length;
  const motionEnergy = meanOpaquePixels === 0 ? 0 : meanChangedPixels / meanOpaquePixels;
  const heightRange = Math.max(...frames.map((frame) => frame.bbox?.height ?? 0))
    - Math.min(...frames.map((frame) => frame.bbox?.height ?? 0));
  const energyStatus = motionId === 'idle'
    ? (motionEnergy <= 0.42 ? 'good' : 'warn')
    : (motionEnergy >= 0.45 ? 'good' : 'warn');
  const loopingMotion = motionId !== 'attack';

  const checks = [
    { id: 'dimensions', label: '寸法統一', status: dimensions.length === 1 ? 'good' : 'bad', detail: dimensions.join(', ') },
    { id: 'alpha', label: 'アルファ2値', status: alphaBinary ? 'good' : 'bad', detail: alphaBinary ? '0 / 255' : '中間値あり' },
    { id: 'edges', label: '外周余白', status: noEdgeTouch ? 'good' : 'bad', detail: noEdgeTouch ? '端接触なし' : '端接触あり' },
    { id: 'ground', label: '接地ライン', status: grounds.length === 1 ? 'good' : 'warn', detail: `Y: ${grounds.join(', ')}` },
    { id: 'center', label: '重心の揺れ', status: centerRangeX <= 8 && centerRangeY <= 8 ? 'good' : 'warn', detail: `Δx ${centerRangeX.toFixed(1)} / Δy ${centerRangeY.toFixed(1)}` },
    { id: 'shape', label: '身長の安定', status: heightRange <= 4 ? 'good' : 'warn', detail: `高さ差 ${heightRange}px` },
    { id: 'energy', label: '動き量', status: energyStatus, detail: `面積比 ${motionEnergy.toFixed(2)}×` },
    {
      id: 'loop',
      label: loopingMotion ? 'ループ継ぎ目' : '攻撃の復帰差分',
      status: loopingMotion && loopRatio > 1.6 ? 'warn' : 'good',
      detail: loopingMotion ? `平均比 ${loopRatio.toFixed(2)}×` : `${loopChange}px（参考値）`,
    },
  ];

  return {
    alphaBinary,
    centerRange: { x: Number(centerRangeX.toFixed(2)), y: Number(centerRangeY.toFixed(2)) },
    checks,
    dimensions,
    frames,
    groundLines: grounds,
    imageData,
    loopChange,
    loopRatio: Number(loopRatio.toFixed(3)),
    motionEnergy: Number(motionEnergy.toFixed(3)),
    noEdgeTouch,
    transitions,
  };
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`画像を読み込めません: ${source}`));
    image.src = `${source}?t=${Date.now()}`;
  });
}

function reviewForFrame(index) {
  return state.motion?.semanticReview?.frames?.[String(index + 1)] ?? {
    issues: [],
    markers: [],
    note: '未確認です。左右の肩から手までを別々に追跡してください。',
    status: 'unreviewed',
  };
}

function semanticSummary() {
  const reviews = state.images.map((_, index) => reviewForFrame(index));
  return {
    failed: reviews.filter(({ status }) => status === 'fail').length,
    passed: reviews.filter(({ status }) => status === 'pass').length,
    reviews,
    unreviewed: reviews.filter(({ status }) => status !== 'pass' && status !== 'fail').length,
  };
}

function canvasPlacement(image) {
  const scale = state.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  return {
    height,
    scale,
    width,
    x: Math.round((elements.stage.width - width) / 2),
    y: Math.round((elements.stage.height - height) / 2),
  };
}

function drawSilhouette(image, placement) {
  const source = imageDataFor(image);
  for (let offset = 0; offset < source.data.length; offset += 4) {
    if (source.data[offset + 3] > 0) {
      source.data[offset] = 210;
      source.data[offset + 1] = 255;
      source.data[offset + 2] = 74;
      source.data[offset + 3] = 255;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d').putImageData(source, 0, 0);
  stageContext.drawImage(canvas, placement.x, placement.y, placement.width, placement.height);
}

function drawDifference(currentIndex, placement) {
  const current = state.analysis.imageData[currentIndex];
  const previous = state.analysis.imageData[(currentIndex - 1 + state.images.length) % state.images.length];
  const output = new ImageData(current.width, current.height);
  for (let offset = 0; offset < current.data.length; offset += 4) {
    const differs = current.data[offset] !== previous.data[offset]
      || current.data[offset + 1] !== previous.data[offset + 1]
      || current.data[offset + 2] !== previous.data[offset + 2]
      || current.data[offset + 3] !== previous.data[offset + 3];
    if (differs) {
      const appeared = current.data[offset + 3] > previous.data[offset + 3];
      output.data[offset] = appeared ? 198 : 255;
      output.data[offset + 1] = appeared ? 255 : 77;
      output.data[offset + 2] = appeared ? 74 : 184;
      output.data[offset + 3] = 235;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  canvas.getContext('2d').putImageData(output, 0, 0);
  stageContext.drawImage(canvas, placement.x, placement.y, placement.width, placement.height);
}

function drawSemanticMarkers(placement) {
  const review = reviewForFrame(state.frameIndex);
  if (review.status !== 'fail' || !Array.isArray(review.markers)) return;
  stageContext.save();
  stageContext.strokeStyle = '#ff6e88';
  stageContext.fillStyle = 'rgba(255, 53, 102, 0.12)';
  stageContext.lineWidth = 2;
  stageContext.font = 'bold 11px ui-monospace, monospace';
  review.markers.forEach((marker) => {
    const x = placement.x + marker.x * placement.scale;
    const y = placement.y + marker.y * placement.scale;
    const width = marker.width * placement.scale;
    const height = marker.height * placement.scale;
    stageContext.fillRect(x, y, width, height);
    stageContext.strokeRect(x + 0.5, y + 0.5, width, height);
    const label = marker.label ?? '解剖学的破綻';
    const labelWidth = stageContext.measureText(label).width + 10;
    stageContext.fillStyle = '#ff6e88';
    stageContext.fillRect(x, Math.max(0, y - 20), labelWidth, 18);
    stageContext.fillStyle = '#1b0b10';
    stageContext.fillText(label, x + 5, Math.max(13, y - 7));
    stageContext.fillStyle = 'rgba(255, 53, 102, 0.12)';
  });
  stageContext.restore();
}

function renderStage() {
  if (!state.images.length || !state.analysis) return;
  const image = state.images[state.frameIndex];
  const placement = canvasPlacement(image);
  stageContext.clearRect(0, 0, elements.stage.width, elements.stage.height);
  stageContext.imageSmoothingEnabled = false;

  if (elements.showOnion.checked) {
    const previous = state.images[(state.frameIndex - 1 + state.images.length) % state.images.length];
    stageContext.globalAlpha = 0.22;
    stageContext.drawImage(previous, placement.x, placement.y, placement.width, placement.height);
    stageContext.globalAlpha = 1;
  }

  if (elements.showSilhouette.checked) {
    drawSilhouette(image, placement);
  } else {
    stageContext.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  }

  if (elements.showDiff.checked) drawDifference(state.frameIndex, placement);

  if (elements.showGuides.checked) {
    const frame = state.analysis.frames[state.frameIndex];
    const box = frame.bbox;
    stageContext.save();
    stageContext.lineWidth = 1;
    stageContext.setLineDash([5, 5]);
    stageContext.strokeStyle = 'rgba(198,255,74,0.7)';
    stageContext.beginPath();
    stageContext.moveTo(0, placement.y + (box.maxY + 1) * placement.scale + 0.5);
    stageContext.lineTo(elements.stage.width, placement.y + (box.maxY + 1) * placement.scale + 0.5);
    stageContext.stroke();
    stageContext.setLineDash([]);
    stageContext.strokeStyle = '#ffcf52';
    stageContext.strokeRect(
      placement.x + box.minX * placement.scale + 0.5,
      placement.y + box.minY * placement.scale + 0.5,
      box.width * placement.scale,
      box.height * placement.scale,
    );
    stageContext.fillStyle = '#ffcf52';
    stageContext.fillRect(
      placement.x + frame.center.x * placement.scale - 2,
      placement.y + frame.center.y * placement.scale - 2,
      5,
      5,
    );
    stageContext.restore();
  }

  if (elements.showSemanticMarkers.checked) drawSemanticMarkers(placement);
}

function renderFilmstrip() {
  elements.filmstrip.replaceChildren();
  state.images.forEach((image, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `frame-card${index === state.frameIndex ? ' selected' : ''}`;
    card.dataset.frameIndex = String(index);
    card.setAttribute('aria-label', `フレーム ${index + 1}`);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth * 3;
    canvas.height = image.naturalHeight * 3;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const label = document.createElement('span');
    const frame = state.analysis.frames[index];
    label.textContent = `F${index + 1} · BBox ${frame.bbox.width}×${frame.bbox.height} · Y${frame.bbox.maxY}`;
    card.append(canvas, label);
    card.addEventListener('click', () => {
      state.frameIndex = index;
      state.playing = false;
      updateUi();
    });
    elements.filmstrip.append(card);
  });
}

function renderAnatomy() {
  const summary = semanticSummary();
  if (summary.failed > 0) {
    elements.anatomySummary.textContent = `FAIL ${summary.failed}`;
    elements.anatomySummary.className = 'status-pill bad';
  } else if (summary.unreviewed > 0) {
    elements.anatomySummary.textContent = `${summary.unreviewed} UNREVIEWED`;
    elements.anatomySummary.className = 'status-pill warn';
  } else {
    elements.anatomySummary.textContent = 'PASS';
    elements.anatomySummary.className = 'status-pill good';
  }

  elements.reviewSource.textContent = state.manifest.reviewSource
    ? `review: ${state.manifest.reviewSource}`
    : 'motion-review.json がありません。全フレーム未確認として扱います。';
  elements.anatomyFrames.replaceChildren();

  state.images.forEach((image, index) => {
    const review = reviewForFrame(index);
    const status = ['pass', 'fail'].includes(review.status) ? review.status : 'unreviewed';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `anatomy-frame ${status}${index === state.frameIndex ? ' selected' : ''}`;
    card.setAttribute('aria-label', `解剖学レビュー フレーム${index + 1} ${status}`);

    const imageWrap = document.createElement('div');
    imageWrap.className = 'anatomy-image';
    const frameImage = document.createElement('img');
    frameImage.src = state.motion.frames[index];
    frameImage.alt = `${state.motion.label} フレーム${index + 1}`;
    imageWrap.append(frameImage);

    if (elements.showSemanticMarkers.checked && Array.isArray(review.markers)) {
      review.markers.forEach((marker) => {
        const markerElement = document.createElement('div');
        markerElement.className = 'semantic-marker';
        markerElement.style.left = `${(marker.x / image.naturalWidth) * 100}%`;
        markerElement.style.top = `${(marker.y / image.naturalHeight) * 100}%`;
        markerElement.style.width = `${(marker.width / image.naturalWidth) * 100}%`;
        markerElement.style.height = `${(marker.height / image.naturalHeight) * 100}%`;
        const label = document.createElement('span');
        label.textContent = marker.label ?? '解剖学的破綻';
        markerElement.append(label);
        imageWrap.append(markerElement);
      });
    }

    const heading = document.createElement('div');
    heading.className = 'anatomy-frame-heading';
    const title = document.createElement('strong');
    title.textContent = `FRAME ${index + 1}`;
    const statusLabel = document.createElement('span');
    statusLabel.className = `review-status ${status}`;
    statusLabel.textContent = status.toUpperCase();
    heading.append(title, statusLabel);

    const issueList = document.createElement('div');
    issueList.className = 'issue-list';
    (review.issues ?? []).forEach((issue) => {
      const tag = document.createElement('span');
      tag.className = 'issue-tag';
      tag.textContent = semanticIssueLabels[issue] ?? issue;
      issueList.append(tag);
    });

    const note = document.createElement('p');
    note.className = 'review-note';
    note.textContent = review.note ?? '';
    card.append(imageWrap, heading, issueList, note);
    card.addEventListener('click', () => {
      state.frameIndex = index;
      state.playing = false;
      updateUi();
    });
    elements.anatomyFrames.append(card);
  });
}

function renderQa() {
  const semantic = semanticSummary();
  const anatomyCheck = semantic.failed > 0
    ? { id: 'anatomy', label: '解剖学レビュー', status: 'bad', detail: `${semantic.failed}フレーム異常` }
    : semantic.unreviewed > 0
      ? { id: 'anatomy', label: '解剖学レビュー', status: 'warn', detail: `${semantic.unreviewed}フレーム未確認` }
      : { id: 'anatomy', label: '解剖学レビュー', status: 'good', detail: '全フレーム確認済み' };
  const checks = [...state.analysis.checks, anatomyCheck];
  const issueCount = checks.filter(({ status }) => status !== 'good').length;
  if (semantic.failed > 0) {
    elements.qaSummary.textContent = `FAIL ${semantic.failed}`;
    elements.qaSummary.className = 'status-pill bad';
  } else if (issueCount === 0) {
    elements.qaSummary.textContent = 'PASS';
    elements.qaSummary.className = 'status-pill good';
  } else {
    elements.qaSummary.textContent = `${issueCount} CHECK`;
    elements.qaSummary.className = 'status-pill warn';
  }
  elements.qaCards.replaceChildren();
  checks.forEach((check) => {
    const card = document.createElement('div');
    card.className = `qa-card ${check.status}`;
    card.dataset.check = check.id;
    card.innerHTML = `<strong>${check.status === 'good' ? '✓' : '!'} ${check.label}</strong><span>${check.detail}</span>`;
    elements.qaCards.append(card);
  });
}

function renderFrameStats() {
  const frame = state.analysis.frames[state.frameIndex];
  const transition = state.analysis.transitions[(state.frameIndex - 1 + state.images.length) % state.images.length];
  const rows = [
    ['フレーム', `${frame.index} / ${state.images.length}`],
    ['寸法', frame.dimensions],
    ['BBox', `${frame.bbox.width}×${frame.bbox.height} +${frame.bbox.minX}+${frame.bbox.minY}`],
    ['接地Y', String(frame.bbox.maxY)],
    ['不透明px', String(frame.opaquePixels)],
    ['使用色', String(frame.colorCount)],
    ['前フレーム差分', `${transition.changedPixels} px`],
    ['重心', `${frame.center.x}, ${frame.center.y}`],
  ];
  elements.frameStats.innerHTML = rows.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join('');
}

function machineReport() {
  const semantic = semanticSummary();
  return {
    set: state.manifest.set,
    motion: state.motion.id,
    frameDurationMs: state.duration,
    checks: state.analysis.checks,
    centerRange: state.analysis.centerRange,
    frames: state.analysis.frames,
    groundLines: state.analysis.groundLines,
    loopRatio: state.analysis.loopRatio,
    motionEnergy: state.analysis.motionEnergy,
    reviewSource: state.manifest.reviewSource,
    semanticReview: {
      failed: semantic.failed,
      frames: semantic.reviews,
      passed: semantic.passed,
      unreviewed: semantic.unreviewed,
    },
    transitions: state.analysis.transitions,
  };
}

function updateUi({ rebuildFilmstrip = true } = {}) {
  elements.motionTitle.textContent = `${state.motion.label} · ${state.images.length}フレーム`;
  elements.framePosition.textContent = `${state.frameIndex + 1} / ${state.images.length}`;
  elements.togglePlay.textContent = state.playing ? '一時停止' : '再生';
  elements.playState.textContent = state.playing ? 'PLAY' : 'PAUSE';
  elements.duration.value = String(state.duration);
  elements.durationValue.textContent = `${state.duration} ms`;
  elements.zoom.value = String(state.zoom);
  elements.zoomValue.textContent = `${state.zoom}×`;
  elements.machineReport.textContent = JSON.stringify(machineReport(), null, 2);
  renderStage();
  renderQa();
  renderFrameStats();
  if (rebuildFilmstrip) renderFilmstrip();
  renderAnatomy();
}

async function selectMotion(id) {
  const motion = state.manifest.motions.find((item) => item.id === id);
  if (!motion) return;
  state.motion = motion;
  state.duration = motion.duration;
  state.frameIndex = 0;
  state.images = await Promise.all(motion.frames.map(loadImage));
  state.analysis = analyzeMotion(state.images, motion.id);
  state.lastTick = performance.now();
  document.querySelectorAll('.motion-tab').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.motion === id));
  });
  updateUi();
}

function renderMotionTabs() {
  elements.motionTabs.replaceChildren();
  state.manifest.motions.forEach((motion) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'motion-tab';
    button.dataset.motion = motion.id;
    button.setAttribute('aria-selected', 'false');
    button.textContent = `${motion.label} ${motion.frames.length}F`;
    button.addEventListener('click', () => selectMotion(motion.id).catch(showError));
    elements.motionTabs.append(button);
  });
}

async function loadSet(set) {
  const response = await fetch(`/api/manifest?set=${encodeURIComponent(set)}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'セットの読み込みに失敗しました');
  state.manifest = body;
  elements.setPath.value = body.set;
  const url = new URL(window.location.href);
  url.searchParams.set('set', body.set);
  history.replaceState(null, '', url);
  renderMotionTabs();
  await selectMotion(body.motions[0].id);
}

function showError(error) {
  elements.error.textContent = error instanceof Error ? error.message : String(error);
  elements.error.hidden = false;
  window.setTimeout(() => { elements.error.hidden = true; }, 7000);
}

function stepFrame(delta) {
  if (!state.images.length) return;
  state.frameIndex = (state.frameIndex + delta + state.images.length) % state.images.length;
  state.lastTick = performance.now();
  updateUi();
}

function animationLoop(now) {
  if (state.playing && state.images.length && now - state.lastTick >= state.duration) {
    const elapsedFrames = Math.max(1, Math.floor((now - state.lastTick) / state.duration));
    state.frameIndex = (state.frameIndex + elapsedFrames) % state.images.length;
    state.lastTick = now;
    updateUi();
  }
  requestAnimationFrame(animationLoop);
}

elements.setForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadSet(elements.setPath.value.trim()).catch(showError);
});
elements.togglePlay.addEventListener('click', () => {
  state.playing = !state.playing;
  state.lastTick = performance.now();
  updateUi({ rebuildFilmstrip: false });
});
elements.prevFrame.addEventListener('click', () => { state.playing = false; stepFrame(-1); });
elements.nextFrame.addEventListener('click', () => { state.playing = false; stepFrame(1); });
elements.duration.addEventListener('input', () => {
  state.duration = Number(elements.duration.value);
  elements.durationValue.textContent = `${state.duration} ms`;
  elements.machineReport.textContent = JSON.stringify(machineReport(), null, 2);
});
elements.zoom.addEventListener('input', () => {
  state.zoom = Number(elements.zoom.value);
  elements.zoomValue.textContent = `${state.zoom}×`;
  renderStage();
});
[elements.showDiff, elements.showGuides, elements.showOnion, elements.showSilhouette].forEach((input) => {
  input.addEventListener('change', renderStage);
});
elements.showSemanticMarkers.addEventListener('change', () => {
  renderStage();
  renderAnatomy();
});
document.querySelectorAll('input[name="background"]').forEach((input) => {
  input.addEventListener('change', () => {
    elements.stageWrap.className = `stage-wrap ${input.value}`;
  });
});
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === 'text') return;
  if (event.code === 'Space') {
    event.preventDefault();
    elements.togglePlay.click();
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault();
    state.playing = false;
    stepFrame(-1);
  } else if (event.code === 'ArrowRight') {
    event.preventDefault();
    state.playing = false;
    stepFrame(1);
  } else if (event.key.toLowerCase() === 'g') {
    elements.showGuides.click();
  } else if (event.key.toLowerCase() === 'o') {
    elements.showOnion.click();
  } else if (event.key.toLowerCase() === 'd') {
    elements.showDiff.click();
  }
});

const initialSet = new URL(window.location.href).searchParams.get('set')
  ?? 'artifacts/pixel-art-demo/game-base-goblin-motion-v2/strict64';
loadSet(initialSet).catch(showError);
requestAnimationFrame(animationLoop);
