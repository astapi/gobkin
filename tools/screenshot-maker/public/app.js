"use strict";

const state = {
  bgSrc: null,
  canvasWidth: 850,
  canvasHeight: 1850,
  zoom: 0.5,
  layers: [],
  selectedId: null,
  nextId: 1,
};

const $stage = document.getElementById('stage');
const $layers = document.getElementById('layers');
const $bgImage = document.getElementById('bgImage');
const $zoom = document.getElementById('zoom');
const $zoomLabel = document.getElementById('zoomLabel');
const $canvasW = document.getElementById('canvasW');
const $canvasH = document.getElementById('canvasH');
const $applySize = document.getElementById('applySize');
const $bgUpload = document.getElementById('bgUpload');
const $bgPreset = document.getElementById('bgPreset');
const $localUpload = document.getElementById('localUpload');
const $assetTree = document.getElementById('assetTree');
const $assetSearch = document.getElementById('assetSearch');
const $exportBtn = document.getElementById('exportBtn');
const $saveBtn = document.getElementById('saveBtn');
const $resetBtn = document.getElementById('resetBtn');
const $selectedInfo = document.getElementById('selectedInfo');
const $stageScroll = document.getElementById('stageScroll');

function applyCanvasSize() {
  $stage.style.width = state.canvasWidth + 'px';
  $stage.style.height = state.canvasHeight + 'px';
  applyZoom();
}

function applyZoom() {
  $stage.style.transformOrigin = 'top left';
  $stage.style.transform = `scale(${state.zoom})`;
  $stage.style.marginRight = (state.canvasWidth * (state.zoom - 1)) + 'px';
  $stage.style.marginBottom = (state.canvasHeight * (state.zoom - 1)) + 'px';
  $zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
}

function stagePointToCanvas(clientX, clientY) {
  const rect = $stage.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / state.zoom,
    y: (clientY - rect.top) / state.zoom,
  };
}

function nextId() { return state.nextId++; }

function addLayer({ src, naturalWidth, naturalHeight, x, y, width, height }) {
  const id = nextId();
  const maxDim = Math.min(state.canvasWidth, state.canvasHeight) * 0.5;
  let w = width, h = height;
  if (w == null || h == null) {
    const aspect = naturalWidth / naturalHeight;
    if (aspect >= 1) {
      w = Math.min(naturalWidth, maxDim);
      h = w / aspect;
    } else {
      h = Math.min(naturalHeight, maxDim);
      w = h * aspect;
    }
  }
  const layer = {
    id,
    src,
    naturalWidth,
    naturalHeight,
    x: x ?? state.canvasWidth / 2,
    y: y ?? state.canvasHeight / 2,
    width: w,
    height: h,
    rotation: 0,
    flipped: false,
  };
  state.layers.push(layer);
  renderLayers();
  selectLayer(id);
  return layer;
}

function selectLayer(id) {
  state.selectedId = id;
  renderLayers();
  updateSelectedInfo();
}

function deselect() {
  state.selectedId = null;
  renderLayers();
  updateSelectedInfo();
}

function deleteLayer(id) {
  state.layers = state.layers.filter((l) => l.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  renderLayers();
  updateSelectedInfo();
}

function duplicateLayer(id) {
  const layer = state.layers.find((l) => l.id === id);
  if (!layer) return;
  const copy = { ...layer, id: nextId(), x: layer.x + 20, y: layer.y + 20 };
  state.layers.push(copy);
  selectLayer(copy.id);
}

function bringForward(id) {
  const idx = state.layers.findIndex((l) => l.id === id);
  if (idx < 0 || idx === state.layers.length - 1) return;
  const [l] = state.layers.splice(idx, 1);
  state.layers.splice(idx + 1, 0, l);
  renderLayers();
}
function sendBackward(id) {
  const idx = state.layers.findIndex((l) => l.id === id);
  if (idx <= 0) return;
  const [l] = state.layers.splice(idx, 1);
  state.layers.splice(idx - 1, 0, l);
  renderLayers();
}

function updateSelectedInfo() {
  const layer = state.layers.find((l) => l.id === state.selectedId);
  if (!layer) {
    $selectedInfo.textContent = `配置レイヤー数: ${state.layers.length} / 未選択`;
    return;
  }
  $selectedInfo.textContent = `#${layer.id} | ${Math.round(layer.width)}×${Math.round(layer.height)} | ${Math.round(layer.rotation)}°`;
}

function renderLayers() {
  $layers.innerHTML = '';
  for (const layer of state.layers) {
    const el = document.createElement('div');
    el.className = 'layer';
    if (layer.id === state.selectedId) el.classList.add('is-selected');
    el.style.left = (layer.x - layer.width / 2) + 'px';
    el.style.top = (layer.y - layer.height / 2) + 'px';
    el.style.width = layer.width + 'px';
    el.style.height = layer.height + 'px';
    el.style.transformOrigin = '50% 50%';
    el.style.transform = `rotate(${layer.rotation}deg)${layer.flipped ? ' scaleX(-1)' : ''}`;
    el.dataset.layerId = layer.id;

    const img = document.createElement('img');
    img.src = layer.src;
    img.draggable = false;
    el.appendChild(img);

    if (layer.id === state.selectedId) {
      ['nw','n','ne','w','e','sw','s','se'].forEach((k) => {
        const h = document.createElement('div');
        h.className = `handle ${k}`;
        h.dataset.handle = k;
        el.appendChild(h);
      });
      const rotateLine = document.createElement('div');
      rotateLine.className = 'rotate-line';
      el.appendChild(rotateLine);
      const r = document.createElement('div');
      r.className = 'handle is-rotate';
      r.dataset.handle = 'rotate';
      el.appendChild(r);
    }

    attachLayerEvents(el, layer);
    $layers.appendChild(el);
  }
  updateSelectedInfo();
}

function attachLayerEvents(el, layer) {
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const target = e.target;
    const handleKey = target?.dataset?.handle;
    if (handleKey === 'rotate') {
      startRotate(e, layer);
    } else if (handleKey) {
      startResize(e, layer, handleKey);
    } else {
      if (layer.id !== state.selectedId) selectLayer(layer.id);
      startMove(e, layer);
    }
  });
}

function startMove(e, layer) {
  e.preventDefault();
  const start = stagePointToCanvas(e.clientX, e.clientY);
  const orig = { x: layer.x, y: layer.y };
  const move = (ev) => {
    const p = stagePointToCanvas(ev.clientX, ev.clientY);
    layer.x = orig.x + (p.x - start.x);
    layer.y = orig.y + (p.y - start.y);
    renderLayers();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function handleSigns(k) {
  return {
    sx: k.includes('e') ? 1 : k.includes('w') ? -1 : 0,
    sy: k.includes('s') ? 1 : k.includes('n') ? -1 : 0,
  };
}

function startResize(e, layer, k) {
  e.preventDefault();
  const θ = layer.rotation * Math.PI / 180;
  const cos = Math.cos(θ), sin = Math.sin(θ);
  const { sx, sy } = handleSigns(k);
  const anchorLocal = { x: -sx * layer.width / 2, y: -sy * layer.height / 2 };
  const anchorWorld = {
    x: layer.x + cos * anchorLocal.x - sin * anchorLocal.y,
    y: layer.y + sin * anchorLocal.x + cos * anchorLocal.y,
  };
  const startW = layer.width, startH = layer.height;
  const ar = startW / startH;

  const move = (ev) => {
    const p = stagePointToCanvas(ev.clientX, ev.clientY);
    const dx = p.x - anchorWorld.x;
    const dy = p.y - anchorWorld.y;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    let newW = startW, newH = startH;
    if (sx !== 0) newW = Math.max(8, Math.abs(u));
    if (sy !== 0) newH = Math.max(8, Math.abs(v));
    const isCorner = sx !== 0 && sy !== 0;
    if (isCorner && !ev.shiftKey) {
      if (newW / newH > ar) newH = newW / ar;
      else newW = newH * ar;
    }
    const offX = sx * newW / 2;
    const offY = sy * newH / 2;
    layer.x = anchorWorld.x + cos * offX - sin * offY;
    layer.y = anchorWorld.y + sin * offX + cos * offY;
    layer.width = newW;
    layer.height = newH;
    renderLayers();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function startRotate(e, layer) {
  e.preventDefault();
  const p0 = stagePointToCanvas(e.clientX, e.clientY);
  const startAngle = Math.atan2(p0.y - layer.y, p0.x - layer.x);
  const startRot = layer.rotation;
  const move = (ev) => {
    const p = stagePointToCanvas(ev.clientX, ev.clientY);
    const ang = Math.atan2(p.y - layer.y, p.x - layer.x);
    let deg = startRot + (ang - startAngle) * 180 / Math.PI;
    if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
    layer.rotation = deg;
    renderLayers();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

$stage.addEventListener('pointerdown', (e) => {
  if (e.target === $stage || e.target === $bgImage || e.target === $layers) {
    deselect();
  }
});

window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const layer = state.layers.find((l) => l.id === state.selectedId);
  if (!layer) return;
  const step = e.shiftKey ? 10 : 1;
  let handled = true;
  switch (e.key) {
    case 'ArrowLeft': layer.x -= step; break;
    case 'ArrowRight': layer.x += step; break;
    case 'ArrowUp': layer.y -= step; break;
    case 'ArrowDown': layer.y += step; break;
    case 'Delete':
    case 'Backspace':
      deleteLayer(layer.id);
      return;
    case ']': bringForward(layer.id); return;
    case '[': sendBackward(layer.id); return;
    case 'h': case 'H':
      layer.flipped = !layer.flipped; break;
    case 'd': case 'D':
      if (e.ctrlKey || e.metaKey) { duplicateLayer(layer.id); e.preventDefault(); return; }
      handled = false; break;
    case '+': case '=': {
      const factor = 1.05;
      layer.width *= factor; layer.height *= factor; break;
    }
    case '-': case '_': {
      const factor = 1 / 1.05;
      layer.width *= factor; layer.height *= factor; break;
    }
    case ',': case '<':
      layer.rotation -= e.shiftKey ? 15 : 1; break;
    case '.': case '>':
      layer.rotation += e.shiftKey ? 15 : 1; break;
    default: handled = false;
  }
  if (handled) {
    e.preventDefault();
    renderLayers();
  }
});

$zoom.addEventListener('input', () => {
  state.zoom = Number($zoom.value) / 100;
  applyZoom();
});

$applySize.addEventListener('click', () => {
  state.canvasWidth = Math.max(100, Number($canvasW.value) || 850);
  state.canvasHeight = Math.max(100, Number($canvasH.value) || 1850);
  applyCanvasSize();
});

$resetBtn.addEventListener('click', () => {
  if (!confirm('配置をすべてリセットしますか？背景は維持されます。')) return;
  state.layers = [];
  state.selectedId = null;
  renderLayers();
});

$bgUpload.addEventListener('change', () => {
  const file = $bgUpload.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setBackground(reader.result);
  reader.readAsDataURL(file);
});

$localUpload.addEventListener('change', () => {
  const files = $localUpload.files;
  if (!files || files.length === 0) return;
  Array.from(files).forEach((f) => addImageFromFile(f));
  $localUpload.value = '';
});

function addImageFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => addImageFromUrl(reader.result);
  reader.readAsDataURL(file);
}

function addImageFromUrl(src, opts = {}) {
  const img = new Image();
  img.onload = () => {
    addLayer({
      src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      x: opts.x,
      y: opts.y,
    });
  };
  img.onerror = () => alert('画像を読み込めませんでした');
  img.src = src;
}

function setBackground(src) {
  state.bgSrc = src;
  $bgImage.src = src;
  $bgImage.onload = () => {
    state.canvasWidth = $bgImage.naturalWidth;
    state.canvasHeight = $bgImage.naturalHeight;
    $canvasW.value = state.canvasWidth;
    $canvasH.value = state.canvasHeight;
    applyCanvasSize();
  };
}

function projectUrl(relPath) {
  return '/project/' + relPath.split('/').map(encodeURIComponent).join('/');
}

$bgPreset.addEventListener('change', () => {
  const v = $bgPreset.value;
  if (!v) return;
  setBackground(projectUrl(v));
});

async function loadBackgrounds() {
  const res = await fetch('/api/backgrounds');
  const { list } = await res.json();
  for (const item of list) {
    const opt = document.createElement('option');
    opt.value = item.path;
    opt.textContent = item.name;
    $bgPreset.appendChild(opt);
  }
  const aaaa = list.find((x) => x.path.endsWith('aaaa.png'));
  if (aaaa) {
    $bgPreset.value = aaaa.path;
    setBackground(projectUrl(aaaa.path));
  }
}

async function loadAssetTree() {
  const res = await fetch('/api/assets');
  const { tree } = await res.json();
  $assetTree.innerHTML = '';
  $assetTree.appendChild(renderTree(tree, true));
}

function renderTree(nodes, isRoot) {
  const container = document.createElement('div');
  for (const node of nodes) {
    container.appendChild(renderNode(node, isRoot));
  }
  return container;
}

function renderNode(node, openByDefault) {
  if (node.type === 'dir') {
    const dir = document.createElement('div');
    dir.className = 'tree-node tree-dir';
    if (openByDefault) dir.classList.add('is-open');
    const label = document.createElement('div');
    label.className = 'tree-dir__label';
    label.innerHTML = `<span class="tree-dir__chev">▶</span>📁 ${node.name}`;
    label.addEventListener('click', () => dir.classList.toggle('is-open'));
    const children = document.createElement('div');
    children.className = 'tree-dir__children';
    children.appendChild(renderTree(node.children, false));
    dir.appendChild(label);
    dir.appendChild(children);
    return dir;
  }
  const item = document.createElement('div');
  item.className = 'tree-file';
  item.draggable = true;
  const url = '/assets/' + node.path.split('/').map(encodeURIComponent).join('/');
  const thumb = document.createElement('img');
  thumb.className = 'tree-file__thumb';
  thumb.src = url;
  thumb.draggable = false;
  const name = document.createElement('span');
  name.className = 'tree-file__name';
  name.textContent = node.name;
  name.title = node.path;
  item.appendChild(thumb);
  item.appendChild(name);
  item.addEventListener('click', () => addImageFromUrl(url));
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/asset-url', url);
    e.dataTransfer.effectAllowed = 'copy';
  });
  return item;
}

$assetSearch.addEventListener('input', () => {
  const q = $assetSearch.value.toLowerCase().trim();
  const allFiles = $assetTree.querySelectorAll('.tree-file');
  const allDirs = $assetTree.querySelectorAll('.tree-dir');
  if (!q) {
    allFiles.forEach((el) => (el.style.display = ''));
    allDirs.forEach((el) => el.classList.remove('is-open'));
    $assetTree.querySelectorAll(':scope > div > .tree-dir').forEach((el) => el.classList.add('is-open'));
    return;
  }
  allFiles.forEach((el) => {
    const text = el.querySelector('.tree-file__name').textContent.toLowerCase();
    el.style.display = text.includes(q) ? '' : 'none';
  });
  allDirs.forEach((el) => {
    const anyVisible = Array.from(el.querySelectorAll('.tree-file')).some((f) => f.style.display !== 'none');
    if (anyVisible) el.classList.add('is-open');
    else el.classList.remove('is-open');
  });
});

$stage.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
$stage.addEventListener('drop', (e) => {
  e.preventDefault();
  const p = stagePointToCanvas(e.clientX, e.clientY);
  const url = e.dataTransfer.getData('text/asset-url');
  if (url) {
    addImageFromUrl(url, { x: p.x, y: p.y });
    return;
  }
  const files = e.dataTransfer.files;
  if (files && files.length) {
    Array.from(files).forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => addLayer({
          src: reader.result,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          x: p.x + i * 16,
          y: p.y + i * 16,
        });
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    });
  }
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderToCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = state.canvasWidth;
  canvas.height = state.canvasHeight;
  const ctx = canvas.getContext('2d');
  if (state.bgSrc) {
    try {
      const bg = await loadImage(state.bgSrc);
      const ar = bg.naturalWidth / bg.naturalHeight;
      const tar = canvas.width / canvas.height;
      let sx, sy, sw, sh;
      if (ar > tar) {
        sh = bg.naturalHeight;
        sw = sh * tar;
        sx = (bg.naturalWidth - sw) / 2;
        sy = 0;
      } else {
        sw = bg.naturalWidth;
        sh = sw / tar;
        sx = 0;
        sy = (bg.naturalHeight - sh) / 2;
      }
      ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      console.warn('failed to draw background', e);
    }
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  for (const layer of state.layers) {
    try {
      const img = await loadImage(layer.src);
      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.rotation * Math.PI / 180);
      if (layer.flipped) ctx.scale(-1, 1);
      ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      ctx.restore();
    } catch (e) {
      console.warn('failed to draw layer', layer.id, e);
    }
  }
  return canvas;
}

$exportBtn.addEventListener('click', async () => {
  const c = await renderToCanvas();
  const a = document.createElement('a');
  a.download = `screenshot-${Date.now()}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
});

$saveBtn.addEventListener('click', async () => {
  const c = await renderToCanvas();
  const name = prompt('保存ファイル名 (PNG)', `screenshot-${Date.now()}.png`);
  if (!name) return;
  const dataUrl = c.toDataURL('image/png');
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dataUrl }),
  });
  const json = await res.json();
  if (json.error) alert('保存失敗: ' + json.error);
  else alert('保存しました: ' + json.savedTo);
});

const $processBtn = document.getElementById('processBtn');
const $processModal = document.getElementById('processModal');
const $procFile = document.getElementById('procFile');
const $procPreset = document.getElementById('procPreset');
const $procTop = document.getElementById('procTop');
const $procBottom = document.getElementById('procBottom');
const $procLeft = document.getElementById('procLeft');
const $procRight = document.getElementById('procRight');
const $procRadius = document.getElementById('procRadius');
const $procCanvas = document.getElementById('procCanvas');
const $procMeta = document.getElementById('procMeta');
const $procAddLayer = document.getElementById('procAddLayer');
const $procDownload = document.getElementById('procDownload');
const $procSaveServer = document.getElementById('procSaveServer');

const procState = { image: null, fileName: '' };

function guessPreset(image) {
  if (!image) return null;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const aspect = h / w;
  if (aspect > 2.0 && w >= 1100 && w <= 1400) {
    return { top: 180, radius: 60, label: 'iPhone Pro 3x' };
  }
  if (aspect > 2.0 && w >= 1000 && w <= 1180) {
    return { top: 156, radius: 56, label: 'iPhone 3x' };
  }
  if (aspect > 1.9 && w <= 850) {
    return { top: 88, radius: 36, label: 'iPhone 2x' };
  }
  if (aspect < 1.6) {
    return { top: 80, radius: 40, label: 'タブレット想定' };
  }
  return { top: Math.round(h * 0.06), radius: Math.round(w * 0.04), label: 'カスタム概算' };
}

function applyPresetToFields(preset) {
  if (!preset) return;
  $procTop.value = preset.top ?? 0;
  $procBottom.value = preset.bottom ?? 0;
  $procLeft.value = preset.left ?? 0;
  $procRight.value = preset.right ?? 0;
  $procRadius.value = preset.radius ?? 0;
}

function presetByKey(key, image) {
  if (key === 'auto') return guessPreset(image);
  if (key === 'sim-150-40-100') return { top: 150, bottom: 40, radius: 100, label: 'シミュレータ' };
  if (key === 'iphone-island') return { top: 180, radius: 60, label: 'Dynamic Island 3x' };
  if (key === 'iphone-notch') return { top: 132, radius: 56, label: 'ノッチ 3x' };
  if (key === 'iphone-classic') return { top: 40, radius: 0, label: 'Touch ID 2x' };
  return null;
}

function pathRoundedRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function processScreenshot() {
  const img = procState.image;
  if (!img) return null;
  const top = Math.max(0, Number($procTop.value) || 0);
  const bottom = Math.max(0, Number($procBottom.value) || 0);
  const left = Math.max(0, Number($procLeft.value) || 0);
  const right = Math.max(0, Number($procRight.value) || 0);
  const radius = Math.max(0, Number($procRadius.value) || 0);
  const sw = Math.max(1, img.naturalWidth - left - right);
  const sh = Math.max(1, img.naturalHeight - top - bottom);
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.save();
  pathRoundedRect(ctx, 0, 0, sw, sh, radius);
  ctx.clip();
  ctx.drawImage(img, left, top, sw, sh, 0, 0, sw, sh);
  ctx.restore();
  return canvas;
}

function updateProcPreview() {
  if (!procState.image) {
    const ctx = $procCanvas.getContext('2d');
    $procCanvas.width = 1;
    $procCanvas.height = 1;
    ctx.clearRect(0, 0, 1, 1);
    return;
  }
  const out = processScreenshot();
  $procCanvas.width = out.width;
  $procCanvas.height = out.height;
  $procCanvas.getContext('2d').drawImage(out, 0, 0);
  $procMeta.innerHTML = `元: ${procState.image.naturalWidth}×${procState.image.naturalHeight}<br>出力: ${out.width}×${out.height}<br>ファイル: ${procState.fileName || '—'}`;
}

function openProcessModal() {
  $processModal.hidden = false;
}
function closeProcessModal() {
  $processModal.hidden = true;
}

$processBtn.addEventListener('click', openProcessModal);
$processModal.addEventListener('click', (e) => {
  if (e.target.dataset && e.target.dataset.close != null) closeProcessModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$processModal.hidden) closeProcessModal();
});

$procFile.addEventListener('change', () => {
  const file = $procFile.files?.[0];
  if (!file) return;
  procState.fileName = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      procState.image = img;
      const preset = presetByKey($procPreset.value, img);
      applyPresetToFields(preset || guessPreset(img));
      updateProcPreview();
      $procAddLayer.disabled = false;
      $procDownload.disabled = false;
      $procSaveServer.disabled = false;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

$procPreset.addEventListener('change', () => {
  if ($procPreset.value === 'custom') return;
  const preset = presetByKey($procPreset.value, procState.image);
  if (preset) applyPresetToFields(preset);
  updateProcPreview();
});

[$procTop, $procBottom, $procLeft, $procRight, $procRadius].forEach((el) => {
  el.addEventListener('input', () => {
    $procPreset.value = 'custom';
    updateProcPreview();
  });
});

$procAddLayer.addEventListener('click', () => {
  const out = processScreenshot();
  if (!out) return;
  const dataUrl = out.toDataURL('image/png');
  addImageFromUrl(dataUrl, { x: state.canvasWidth / 2, y: state.canvasHeight / 2 });
  closeProcessModal();
});

$procDownload.addEventListener('click', () => {
  const out = processScreenshot();
  if (!out) return;
  const a = document.createElement('a');
  const base = (procState.fileName || `screenshot-${Date.now()}.png`).replace(/\.[^.]+$/, '');
  a.download = `${base}-cropped.png`;
  a.href = out.toDataURL('image/png');
  a.click();
});

$procSaveServer.addEventListener('click', async () => {
  const out = processScreenshot();
  if (!out) return;
  const base = (procState.fileName || `screenshot-${Date.now()}.png`).replace(/\.[^.]+$/, '');
  const name = prompt('保存ファイル名 (PNG)', `${base}-cropped.png`);
  if (!name) return;
  const dataUrl = out.toDataURL('image/png');
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dataUrl }),
  });
  const json = await res.json();
  if (json.error) alert('保存失敗: ' + json.error);
  else alert('保存しました: ' + json.savedTo);
});

applyCanvasSize();
loadBackgrounds().catch((e) => console.warn('backgrounds load failed', e));
loadAssetTree().catch((e) => console.warn('assets load failed', e));
