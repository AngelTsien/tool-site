/* 控制台主程序 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const uid = p => p + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DEFAULT_TAGS = ['赞美', '敬拜', '感恩', '奉献', '祷告', '福音', '圣诞', '复活节', '受难节', '儿童', '青年', '诗歌本', '回应诗', '经文'];
  const DEFAULT_SETTINGS = { maxLines: 0, titleSlide: false, ai: false, aiUrl: '', aiModel: '', aiKey: '' };

  const S = {
    songs: [], setlists: [], theme: LP.theme(), logo: { image: '', text: '' }, settings: Object.assign({}, DEFAULT_SETTINGS),
    curSongId: null, curSetId: null, tagFilter: '',
    live: { setId: null, items: [], slides: [], idx: 0, mode: 'slide' },
    pm: { playing: false, pos: 0, toProj: false }
  };
  window.__LPS = S; // 方便调试/测试

  /* ---------- 存储 ---------- */
  async function load() {
    const inited = await LP.db.get('inited', false);
    if (!inited) {
      const sd = LP.seed(todayStr());
      await LP.db.set('songs', sd.songs); await LP.db.set('setlists', sd.setlists); await LP.db.set('inited', true);
    }
    S.songs = await LP.db.get('songs', []);
    S.setlists = await LP.db.get('setlists', []);
    S.theme = LP.theme(await LP.db.get('theme', {}));
    S.logo = Object.assign({ image: '', text: '欢迎来到主日崇拜' }, await LP.db.get('logo', {}));
    S.settings = Object.assign({}, DEFAULT_SETTINGS, await LP.db.get('settings', {}));
    S.live.setId = await LP.db.get('liveSetId', null);
  }
  const saveSongs = () => LP.db.set('songs', S.songs);
  const saveSets = () => LP.db.set('setlists', S.setlists);
  const saveTheme = () => LP.db.set('theme', S.theme);
  const saveLogo = () => LP.db.set('logo', S.logo);
  const saveSettings = () => LP.db.set('settings', S.settings);

  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms || 2200); }
  const songById = id => S.songs.find(s => s.id === id);
  const setById = id => S.setlists.find(s => s.id === id);
  const slideOpts = () => ({ maxLines: +S.settings.maxLines || 0, titleSlide: !!S.settings.titleSlide });

  /* 使用记录：从歌单历史计算 */
  function usage(songId) {
    let count = 0, last = '';
    S.setlists.forEach(sl => { if (sl.items.some(it => it.type === 'song' && it.songId === songId)) { count++; if ((sl.date || '') > last) last = sl.date; } });
    return { count, last };
  }

  /* 歌单 → 幻灯片 */
  function itemSlides(it) {
    if (it.type === 'song') { const s = songById(it.songId); if (!s) return [{ lines: ['（歌曲已删除）'], title: '?' }]; return LP.songSlides(s, slideOpts()); }
    if (it.type === 'text') return LP.textSlides(it, slideOpts());
    if (it.type === 'logo') return [{ kind: 'logo', lines: [], title: '标志页', label: '标志' }];
    return [];
  }
  function itemName(it) {
    if (it.type === 'song') { const s = songById(it.songId); return s ? s.title : '（已删除）'; }
    if (it.type === 'text') return '📖 ' + (it.title || '文字页');
    return '⛪ 标志页';
  }
  function flatten(items) {
    const out = [];
    items.forEach((it, i) => itemSlides(it).forEach((sl, k) => out.push(Object.assign({}, sl, { itemIdx: i, inItem: k }))));
    return out;
  }

  /* ---------- 投影窗口 ---------- */
  let projWin = null, projAlive = 0;
  const ch = LP.channel(m => {
    if (m.type === 'hello') { projAlive = Date.now(); broadcast(); updProjStatus(true); }
    else if (m.type === 'key') handleKey(m.data.key);
  });
  function updProjStatus(on) {
    const el = $('#projStatus');
    on = on ?? (projWin && !projWin.closed);
    el.textContent = on ? '● 投影中' : '● 投影未打开'; el.className = 'status ' + (on ? 'on' : 'off');
  }
  setInterval(() => updProjStatus(projWin ? !projWin.closed : (Date.now() - projAlive < 3e5 && projAlive > 0)), 2000);
  function openProjector() {
    const feat = 'popup=yes,width=1280,height=720,left=' + (screen.availWidth || 1280) + ',top=0';
    projWin = window.open('projector.html', 'lp-projector', feat);
    if (!projWin) { toast('浏览器拦截了弹出窗口，请允许本网站弹窗后再试', 4000); return; }
    setTimeout(broadcast, 400); updProjStatus(true);
  }
  function liveState() {
    const L = S.live; const sl = L.slides[L.idx];
    let mode = L.mode;
    if (mode === 'slide') mode = !sl ? 'blank' : sl.kind === 'logo' ? 'logo' : 'slide';
    return { mode, slide: sl && sl.kind !== 'logo' ? { lines: sl.lines, isTitle: sl.isTitle, ref: sl.ref } : null, theme: S.theme, logo: S.logo };
  }
  function broadcast() {
    if (S.pm.toProj && S.pm.active) {
      ch.send('state', { mode: 'prompter', theme: S.theme, prompter: pmState() }, projWin);
    } else ch.send('state', liveState(), projWin);
  }

  /* ---------- 现场 ---------- */
  function setLive(setId, items) {
    const L = S.live;
    L.setId = setId; L.items = items || (setById(setId) ? setById(setId).items : []);
    L.slides = flatten(L.items); L.idx = Math.min(L.idx, Math.max(0, L.slides.length - 1)); L.mode = 'slide';
    LP.db.set('liveSetId', setId && setId !== '__temp' ? setId : null);
    renderLive(); broadcast();
  }
  function go(i) {
    const L = S.live; if (!L.slides.length) return;
    L.idx = Math.max(0, Math.min(L.slides.length - 1, i)); L.mode = 'slide';
    renderLiveCur(); broadcast();
  }
  function toggleMode(m) { S.live.mode = S.live.mode === m ? 'slide' : m; renderLiveCur(); broadcast(); }
  function renderLive() {
    const L = S.live;
    const sel = $('#liveSetSelect');
    const sets = [...S.setlists].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    sel.innerHTML = (L.setId === '__temp' ? '<option value="__temp">（临时投影）</option>' : '') + '<option value="">— 选择歌单 —</option>' + sets.map(s => `<option value="${s.id}">${esc(s.date || '')} ${esc(s.name)}</option>`).join('');
    sel.value = L.setId || '';
    $('#liveItems').innerHTML = L.items.map((it, i) => `<li data-i="${i}">${esc(itemName(it))}</li>`).join('') || '<li class="muted">还没有内容：先在「歌单」里建一个，或在「歌曲库」点「立即投影这首」</li>';
    const grid = $('#slideGrid'); grid.innerHTML = '';
    let lastItem = -1;
    L.slides.forEach((sl, i) => {
      if (sl.itemIdx !== lastItem) { lastItem = sl.itemIdx; const h = document.createElement('div'); h.className = 'grid-head'; h.textContent = itemName(L.items[sl.itemIdx]); grid.appendChild(h); }
      const card = document.createElement('div'); card.className = 'thumb'; card.dataset.i = i;
      const st = document.createElement('div'); st.className = 'lp-stage thumb-stage'; card.appendChild(st);
      const cap = document.createElement('div'); cap.className = 'thumb-cap'; cap.textContent = (i + 1) + (sl.label ? ' · ' + sl.label : ''); card.appendChild(cap);
      grid.appendChild(card);
      requestAnimationFrame(() => LP.renderStage(st, { mode: sl.kind === 'logo' ? 'logo' : 'slide', slide: sl }, S.theme, S.logo));
    });
    renderLiveCur();
  }
  function renderLiveCur() {
    const L = S.live; const cur = L.slides[L.idx], nx = L.slides[L.idx + 1];
    const st = liveState();
    LP.renderStage($('#pvCur'), st, S.theme, S.logo);
    LP.renderStage($('#pvNext'), nx ? { mode: nx.kind === 'logo' ? 'logo' : 'slide', slide: nx } : { mode: 'blank' }, S.theme, S.logo);
    $('#curInfo').textContent = cur ? `${L.idx + 1}/${L.slides.length} · ${itemName(L.items[cur.itemIdx])}${cur.label ? ' · ' + cur.label : ''}` + (L.mode === 'black' ? ' 【黑屏中】' : L.mode === 'logo' ? ' 【标志页】' : '') : '';
    $('#nextInfo').textContent = nx ? (nx.itemIdx !== cur.itemIdx ? '下一首：' + itemName(L.items[nx.itemIdx]) : (nx.label || '')) : '（最后一页）';
    $('#btnBlack').classList.toggle('on', L.mode === 'black');
    $('#btnLogo').classList.toggle('on', L.mode === 'logo');
    $$('#slideGrid .thumb').forEach(t => t.classList.toggle('active', +t.dataset.i === L.idx));
    $$('#liveItems li').forEach(li => li.classList.toggle('active', cur && +li.dataset.i === cur.itemIdx));
    const a = $('#slideGrid .thumb.active'); if (a && $('#tab-live').classList.contains('active')) a.scrollIntoView({ block: 'nearest' });
  }
  $('#liveSetSelect').onchange = e => { if (e.target.value !== '__temp') { S.live.idx = 0; setLive(e.target.value || null); } };
  $('#liveItems').onclick = e => { const li = e.target.closest('li[data-i]'); if (!li) return; const i = S.live.slides.findIndex(s => s.itemIdx === +li.dataset.i); if (i >= 0) go(i); };
  $('#slideGrid').onclick = e => { const t = e.target.closest('.thumb'); if (t) go(+t.dataset.i); };
  $('#btnNext').onclick = () => go(S.live.idx + 1);
  $('#btnPrev').onclick = () => go(S.live.idx - 1);
  $('#btnBlack').onclick = () => toggleMode('black');
  $('#btnLogo').onclick = () => toggleMode('logo');
  $('#btnOpenProj').onclick = openProjector;

  function handleKey(k) {
    if (S.pm.active && $('#tab-prompter').classList.contains('active')) {
      if (k === ' ') return pmToggle();
      if (k === 'ArrowUp') return pmSpeed(5); if (k === 'ArrowDown') return pmSpeed(-5);
      if (k === 'Home') return pmResetPos();
    }
    switch (k) {
      case ' ': case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'Enter': go(S.live.idx + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': go(S.live.idx - 1); break;
      case 'Home': go(0); break;
      case 'End': go(S.live.slides.length - 1); break;
      case 'b': case 'B': case '.': toggleMode('black'); break;
      case 'l': case 'L': toggleMode('logo'); break;
      case 'Escape': if (S.live.mode !== 'slide') toggleMode(S.live.mode); break;
    }
  }
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const keys = [' ', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'b', 'B', 'l', 'L', '.', 'Escape', 'Enter', 'Backspace'];
    if (!keys.includes(e.key)) return;
    const onLive = $('#tab-live').classList.contains('active'), onPm = $('#tab-prompter').classList.contains('active');
    // 现场/提词器页面全部快捷键有效；其他页面只响应翻页笔常用键
    if (!onLive && !onPm && !['PageUp', 'PageDown', 'b', 'B', '.'].includes(e.key)) return;
    if (e.key === 'Enter' || e.key === 'Backspace') { if (!onLive) return; }
    e.preventDefault(); handleKey(e.key);
  });

  /* ---------- 标签页 ---------- */
  $('#tabs').onclick = e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    $$('#tabs button').forEach(x => x.classList.toggle('active', x === b));
    $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
    const tab = b.dataset.tab;
    S.pm.active = tab === 'prompter';
    if (tab === 'live') renderLive();
    if (tab === 'look') renderLook();
    if (tab === 'prompter') { pmRender(); }
    if (tab === 'sets') renderSets();
    if (tab === 'songs') renderSongs();
    broadcast();
  };

  /* ---------- 歌曲库 ---------- */
  function allTags() { const s = new Set(DEFAULT_TAGS); S.songs.forEach(x => (x.tags || []).forEach(t => s.add(t))); return [...s]; }
  function renderSongs() {
    const q = $('#songSearch').value.trim().toLowerCase();
    const tags = allTags();
    $('#tagFilter').innerHTML = `<span class="chip ${!S.tagFilter ? 'on' : ''}" data-t="">全部 ${S.songs.length}</span>` +
      tags.filter(t => S.songs.some(s => (s.tags || []).includes(t))).map(t => `<span class="chip ${S.tagFilter === t ? 'on' : ''}" data-t="${esc(t)}">${esc(t)} ${S.songs.filter(s => (s.tags || []).includes(t)).length}</span>`).join('');
    const list = S.songs.filter(s => (!S.tagFilter || (s.tags || []).includes(S.tagFilter)) &&
      (!q || s.title.toLowerCase().includes(q) || (s.lyrics || '').toLowerCase().includes(q) || (s.tags || []).join(' ').toLowerCase().includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    $('#songList').innerHTML = list.map(s => {
      const u = usage(s.id);
      let hit = '';
      if (q && !s.title.toLowerCase().includes(q)) { const line = (s.lyrics || '').split('\n').find(l => l.toLowerCase().includes(q)); if (line) hit = `<div class="hit">…${esc(line.trim().slice(0, 40))}</div>`; }
      return `<li data-id="${s.id}" class="${s.id === S.curSongId ? 'active' : ''}"><div class="t">${esc(s.title)} ${s.key ? `<span class="key">${esc(s.key)}</span>` : ''}</div>
        <div class="meta">${(s.tags || []).map(t => `<span class="mini-tag">${esc(t)}</span>`).join('')} <span class="muted">${u.count ? `唱过 ${u.count} 次 · 最近 ${esc(u.last || '')}` : '未排入歌单'}</span></div>${hit}</li>`;
    }).join('') || '<li class="muted">没有找到</li>';
    $('#tagQuick').innerHTML = tags.map(t => `<span class="chip" data-t="${esc(t)}">${esc(t)}</span>`).join('');
    markQuickTags();
  }
  function markQuickTags() { const cur = parseTags($('#sTags').value); $$('#tagQuick .chip').forEach(c => c.classList.toggle('on', cur.includes(c.dataset.t))); }
  const parseTags = v => [...new Set(String(v).split(/[,，、;；\s]+/).map(x => x.trim()).filter(Boolean))];
  $('#tagFilter').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; S.tagFilter = c.dataset.t; renderSongs(); };
  $('#tagQuick').onclick = e => {
    const c = e.target.closest('.chip'); if (!c) return; let cur = parseTags($('#sTags').value);
    cur = cur.includes(c.dataset.t) ? cur.filter(x => x !== c.dataset.t) : cur.concat(c.dataset.t);
    $('#sTags').value = cur.join(', '); markQuickTags(); dirty = true;
  };
  $('#songSearch').oninput = renderSongs;
  $('#songList').onclick = e => { const li = e.target.closest('li[data-id]'); if (li) editSong(li.dataset.id); };
  let dirty = false;
  ['#sTitle', '#sKey', '#sTempo', '#sLang', '#sTags', '#sArr', '#sLyrics'].forEach(id => $(id).addEventListener('input', () => { dirty = true; if (id === '#sTags') markQuickTags(); songPreviewSoon(); }));
  function editSong(id) {
    const s = songById(id) || { id: null, title: '', tags: [], key: '', tempo: '', lang: '中文', arrangement: '', lyrics: '' };
    S.curSongId = s.id;
    $('#sTitle').value = s.title; $('#sKey').value = s.key || ''; $('#sTempo').value = s.tempo || ''; $('#sLang').value = s.lang || '中文';
    $('#sTags').value = (s.tags || []).join(', '); $('#sArr').value = s.arrangement || ''; $('#sLyrics').value = s.lyrics || '';
    const u = s.id ? usage(s.id) : null;
    $('#songUsage').textContent = u ? (u.count ? `📅 已排入 ${u.count} 个歌单，最近一次：${u.last}` : '📅 还没有排入任何歌单') : '新歌：填好后点「保存」';
    dirty = false; renderSongs(); songPreview();
  }
  function formSong() {
    return { title: $('#sTitle').value.trim(), key: $('#sKey').value.trim(), tempo: $('#sTempo').value.trim(), lang: $('#sLang').value, tags: parseTags($('#sTags').value), arrangement: $('#sArr').value.trim(), lyrics: $('#sLyrics').value };
  }
  let pvT; function songPreviewSoon() { clearTimeout(pvT); pvT = setTimeout(songPreview, 250); }
  function songPreview() {
    const f = formSong(); const slides = LP.songSlides(f, slideOpts());
    const secs = LP.parseSections(f.lyrics).map(s => s.label).filter(Boolean);
    let w = '';
    if (slides.warnings && slides.warnings.length) w = `⚠ 唱法顺序里的「${slides.warnings.join('、')}」在歌词中找不到。已有段落：${secs.join('、') || '（没有标段落）'}`;
    else if (f.arrangement && !secs.length) w = '⚠ 歌词里没有标段落（如 [主歌]），唱法顺序暂时不起作用';
    $('#songWarn').textContent = w;
    const g = $('#songPreview'); g.innerHTML = `<div class="grid-head">预览：共 ${slides.length} 页</div>`;
    slides.forEach((sl, i) => {
      const card = document.createElement('div'); card.className = 'thumb';
      const st = document.createElement('div'); st.className = 'lp-stage thumb-stage'; card.appendChild(st);
      const cap = document.createElement('div'); cap.className = 'thumb-cap'; cap.textContent = (i + 1) + (sl.label ? ' · ' + sl.label : ''); card.appendChild(cap);
      g.appendChild(card); requestAnimationFrame(() => LP.renderStage(st, { mode: 'slide', slide: sl }, S.theme, S.logo));
    });
  }
  async function saveSong() {
    const f = formSong();
    if (!f.title) { toast('请先填写歌名'); $('#sTitle').focus(); return null; }
    let s = songById(S.curSongId);
    if (!s) { s = { id: uid('s'), created: Date.now() }; S.songs.push(s); S.curSongId = s.id; }
    Object.assign(s, f, { updated: Date.now() });
    await saveSongs(); dirty = false; renderSongs(); toast('已保存「' + s.title + '」');
    if (S.live.items.some(it => it.songId === s.id)) setLive(S.live.setId, S.live.items);
    return s;
  }
  $('#btnSaveSong').onclick = saveSong;
  $('#btnNewSong').onclick = () => { editSong(null); $('#sTitle').focus(); };
  $('#btnDelSong').onclick = async () => {
    const s = songById(S.curSongId); if (!s) return;
    if (!confirm(`确定删除「${s.title}」？`)) return;
    S.songs = S.songs.filter(x => x.id !== s.id); await saveSongs(); editSong(null); toast('已删除');
  };
  $('#btnProjectSong').onclick = async () => {
    const s = await saveSong(); if (!s) return;
    S.live.idx = 0; setLive('__temp', [{ type: 'song', songId: s.id }]);
    $('#tabs button[data-tab="live"]').click();
    if (!projWin || projWin.closed) toast('点右上角「打开投影窗口」投到大屏幕', 3000);
  };
  $('#btnAddToSet').onclick = async () => {
    const s = await saveSong(); if (!s) return;
    const sets = [...S.setlists].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#pickSet').innerHTML = '<option value="__new">＋ 新建歌单</option>' + sets.map(x => `<option value="${x.id}">${esc(x.date)} ${esc(x.name)}</option>`).join('');
    if (S.curSetId) $('#pickSet').value = S.curSetId;
    const dlg = $('#pickSetDlg'); dlg.showModal();
    dlg.onclose = async () => {
      if (dlg.returnValue !== 'ok') return;
      let set = setById($('#pickSet').value);
      if (!set) set = newSetObj();
      set.items.push({ type: 'song', songId: s.id }); set.updated = Date.now(); await saveSets();
      toast(`已加入「${set.name}」`); S.curSetId = set.id;
    };
  };
  const songSlidesFromForm = () => LP.songSlides(Object.assign(formSong(), { title: $('#sTitle').value || '歌词' }), slideOpts());
  $('#btnExportSongPptx').onclick = () => LP.exportPPTX(songSlidesFromForm(), S.theme, S.logo, $('#sTitle').value || '歌词').then(() => toast('PPT 已导出'));
  $('#btnExportSongPng').onclick = () => LP.exportPNG(songSlidesFromForm(), S.theme, S.logo, $('#sTitle').value || '歌词').then(() => toast('图片已导出'));

  /* ---------- 歌单 ---------- */
  function nextSunday() { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return d; }
  function newSetObj() {
    const d = nextSunday(); const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const set = { id: uid('set'), name: `${d.getMonth() + 1}月${d.getDate()}日主日`, date: ds, items: [], updated: Date.now() };
    S.setlists.push(set); return set;
  }
  function renderSets() {
    const sets = [...S.setlists].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updated - a.updated);
    $('#setList').innerHTML = sets.map(s => `<li data-id="${s.id}" class="${s.id === S.curSetId ? 'active' : ''}"><div class="t">${esc(s.name)}</div><div class="meta muted">${esc(s.date || '')} · ${s.items.length} 项 · ${s.items.filter(i => i.type === 'song').length} 首歌</div></li>`).join('') || '<li class="muted">还没有歌单</li>';
    $('#songDatalist').innerHTML = S.songs.map(s => `<option value="${esc(s.title)}">`).join('');
    const set = setById(S.curSetId);
    $('#tab-sets .editor').classList.toggle('disabled', !set);
    if (!set) { $('#setItems').innerHTML = '<li class="muted">左边选一个歌单，或点「新歌单」</li>'; $('#setName').value = ''; $('#setDate').value = ''; return; }
    $('#setName').value = set.name; $('#setDate').value = set.date || '';
    $('#setItems').innerHTML = set.items.map((it, i) => {
      let extra = '';
      if (it.type === 'song') { const s = songById(it.songId); const u = usage(it.songId); extra = s ? `<span class="muted small">${s.key ? '调 ' + esc(s.key) + ' · ' : ''}${itemSlides(it).length} 页 · 唱过 ${u.count} 次${u.last ? '，最近 ' + esc(u.last) : ''}</span>` : ''; }
      else if (it.type === 'text') extra = `<span class="muted small">${esc((it.text || '').slice(0, 30))}…</span>`;
      return `<li data-i="${i}"><span class="drag">${i + 1}</span><span class="nm">${esc(itemName(it))}</span> ${extra}
        <span class="btns"><button data-a="up" title="上移">↑</button><button data-a="down" title="下移">↓</button>${it.type === 'text' ? '<button data-a="edit">编辑</button>' : ''}${it.type === 'song' ? '<button data-a="open">打开</button>' : ''}<button data-a="del" title="移除">✕</button></span></li>`;
    }).join('') || '<li class="muted">空歌单：在下面加歌或经文</li>';
  }
  $('#setList').onclick = e => { const li = e.target.closest('li[data-id]'); if (li) { S.curSetId = li.dataset.id; renderSets(); } };
  $('#btnNewSet').onclick = async () => { const s = newSetObj(); S.curSetId = s.id; await saveSets(); renderSets(); $('#setName').focus(); };
  $('#btnDupSet').onclick = async () => {
    const src = setById(S.curSetId); if (!src) return toast('先在左边选一个歌单');
    const n = newSetObj(); n.items = JSON.parse(JSON.stringify(src.items)); 
    S.curSetId = n.id; await saveSets(); renderSets(); toast('已从「' + src.name + '」复制，日期设为下个主日，可以修改');
  };
  let setSaveT;
  const autoSaveSet = () => { clearTimeout(setSaveT); setSaveT = setTimeout(async () => { await saveSets(); renderSets(); }, 600); };
  $('#setName').oninput = () => { const s = setById(S.curSetId); if (s) { s.name = $('#setName').value; s.updated = Date.now(); autoSaveSet(); } };
  $('#setDate').oninput = () => { const s = setById(S.curSetId); if (s) { s.date = $('#setDate').value; s.updated = Date.now(); autoSaveSet(); } };
  $('#btnSaveSet').onclick = async () => { const s = setById(S.curSetId); if (!s) return; s.updated = Date.now(); await saveSets(); renderSets(); toast('歌单已保存'); if (S.live.setId === s.id) setLive(s.id); };
  $('#setItems').onclick = async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return; const set = setById(S.curSetId); const i = +b.closest('li').dataset.i; const it = set.items[i];
    if (b.dataset.a === 'up' && i > 0) [set.items[i - 1], set.items[i]] = [set.items[i], set.items[i - 1]];
    if (b.dataset.a === 'down' && i < set.items.length - 1) [set.items[i + 1], set.items[i]] = [set.items[i], set.items[i + 1]];
    if (b.dataset.a === 'del') set.items.splice(i, 1);
    if (b.dataset.a === 'open') { $('#tabs button[data-tab="songs"]').click(); editSong(it.songId); return; }
    if (b.dataset.a === 'edit') { const r = await textDialog(it); if (r) Object.assign(it, r); }
    await saveSets(); renderSets();
  };
  $('#btnAddSongItem').onclick = async () => {
    const set = setById(S.curSetId); if (!set) return toast('先选一个歌单');
    const q = $('#addSongSearch').value.trim(); if (!q) return toast('输入歌名');
    const s = S.songs.find(x => x.title === q) || S.songs.find(x => x.title.includes(q)) || S.songs.find(x => (x.lyrics || '').includes(q));
    if (!s) return toast('歌曲库里没有找到「' + q + '」');
    set.items.push({ type: 'song', songId: s.id }); $('#addSongSearch').value = ''; await saveSets(); renderSets(); toast('已加入：' + s.title);
  };
  $('#addSongSearch').onkeydown = e => { if (e.key === 'Enter') $('#btnAddSongItem').click(); };
  function textDialog(it) {
    return new Promise(res => {
      const d = $('#textDlg'); $('#txtTitle').value = it ? it.title || '' : ''; $('#txtBody').value = it ? it.text || '' : '';
      d.showModal(); d.onclose = () => res(d.returnValue === 'ok' ? { title: $('#txtTitle').value.trim(), text: $('#txtBody').value } : null);
    });
  }
  $('#btnAddTextItem').onclick = async () => { const set = setById(S.curSetId); if (!set) return toast('先选一个歌单'); const r = await textDialog(); if (r && (r.text || r.title)) { set.items.push(Object.assign({ type: 'text' }, r)); await saveSets(); renderSets(); } };
  $('#btnAddLogoItem').onclick = async () => { const set = setById(S.curSetId); if (!set) return toast('先选一个歌单'); set.items.push({ type: 'logo' }); await saveSets(); renderSets(); };
  $('#btnDelSet').onclick = async () => { const s = setById(S.curSetId); if (!s || !confirm(`删除歌单「${s.name}」？`)) return; S.setlists = S.setlists.filter(x => x !== s); S.curSetId = null; await saveSets(); renderSets(); };
  $('#btnStartSet').onclick = async () => { const s = setById(S.curSetId); if (!s) return; await saveSets(); S.live.idx = 0; setLive(s.id); $('#tabs button[data-tab="live"]').click(); if (!projWin || projWin.closed) toast('点右上角「打开投影窗口」投到大屏幕', 3000); };
  const prog = m => { $('#exportProgress').textContent = m; };
  async function doExport(fn, label) {
    const s = setById(S.curSetId); if (!s) return toast('先选一个歌单');
    const slides = flatten(s.items); if (!slides.length) return toast('歌单是空的');
    try { await fn(slides, S.theme, S.logo, (s.date ? s.date + '_' : '') + s.name, prog); prog(`✅ ${label}已导出（${slides.length} 页）`); }
    catch (err) { console.warn(err); prog('导出失败：' + err.message); }
  }
  $('#btnExpPng').onclick = () => doExport(LP.exportPNG, '图片 ZIP ');
  $('#btnExpPptx').onclick = () => doExport(LP.exportPPTX, 'PPT ');
  $('#btnExpPdf').onclick = () => doExport(LP.exportPDF, 'PDF ');
  $('#btnExpTxt').onclick = () => {
    const s = setById(S.curSetId); if (!s) return;
    let txt = `${s.name}  ${s.date || ''}\n\n`;
    s.items.forEach((it, i) => {
      if (it.type === 'song') { const so = songById(it.songId); txt += `${i + 1}. ${so ? so.title : '?'}${so && so.key ? '（' + so.key + '调）' : ''}\n` + (so ? LP.songSlides(so, {}).map(x => x.lines.join('\n')).join('\n\n') : '') + '\n\n'; }
      else if (it.type === 'text') txt += `${i + 1}. ${it.title || '经文'}\n${it.text}\n\n`;
      else txt += `${i + 1}. 标志页\n\n`;
    });
    LP.download(new Blob([txt], { type: 'text/plain;charset=utf-8' }), LP.safeName((s.date || '') + '_' + s.name) + '.txt');
  };
  $('#btnExpSetJson').onclick = () => {
    const s = setById(S.curSetId); if (!s) return;
    const songs = s.items.filter(i => i.type === 'song').map(i => songById(i.songId)).filter(Boolean);
    LP.download(new Blob([JSON.stringify({ app: 'lyrics-projector', version: 1, setlists: [s], songs }, null, 2)], { type: 'application/json' }), LP.safeName((s.date || '') + '_' + s.name) + '.json');
  };

  /* ---------- 提词器 ---------- */
  const pmStage = $('#pmStage'); let pmEl = null, pmLast = 0, pmRaf = 0, pmSentAt = 0;
  function pmState() { return { text: $('#pmText').value, fontSize: +$('#pmSize').value, mirror: $('#pmMirror').checked, pos: S.pm.pos, bg: '#000', color: '#fff' }; }
  function pmRender() {
    pmStage.innerHTML = ''; pmEl = document.createElement('div'); pmEl.className = 'lp-prompter' + ($('#pmMirror').checked ? ' mirror' : '');
    const inner = document.createElement('div'); inner.className = 'lp-prompter-inner'; inner.textContent = $('#pmText').value || '（在左边输入文字）';
    Object.assign(inner.style, { fontSize: $('#pmSize').value + 'cqh', color: '#fff', fontFamily: LP.FONTS[S.theme.font] });
    pmEl.appendChild(inner); pmStage.appendChild(pmEl);
    const mk = document.createElement('div'); mk.className = 'lp-prompter-mark'; pmStage.appendChild(mk);
    $('#pmSpeedV').textContent = $('#pmSpeed').value; $('#pmSizeV').textContent = $('#pmSize').value;
    pmApplyPos();
  }
  function pmApplyPos() { if (!pmEl) return; const max = pmEl.scrollHeight - pmEl.clientHeight; pmEl.scrollTop = S.pm.pos * max; }
  function pmTick(ts) {
    if (!S.pm.playing) return;
    const dt = pmLast ? (ts - pmLast) / 1000 : 0; pmLast = ts;
    const max = pmEl.scrollHeight - pmEl.clientHeight;
    if (max > 0) {
      // 速度：每秒滚动的像素按预览高度换算，投影窗口按比例同步
      const px = (+$('#pmSpeed').value) * pmEl.clientHeight / 400 * dt;
      S.pm.pos = Math.min(1, S.pm.pos + px / max); pmApplyPos();
      if (S.pm.pos >= 1) pmToggle(false);
    }
    if (S.pm.toProj && ts - pmSentAt > 33) { pmSentAt = ts; ch.send('prompter-pos', { pos: S.pm.pos }, projWin); }
    pmRaf = requestAnimationFrame(pmTick);
  }
  function pmToggle(force) {
    S.pm.playing = typeof force === 'boolean' ? force : !S.pm.playing; pmLast = 0;
    $('#pmPlay').textContent = S.pm.playing ? '⏸ 暂停（空格）' : '▶ 开始滚动（空格）';
    cancelAnimationFrame(pmRaf); if (S.pm.playing) pmRaf = requestAnimationFrame(pmTick);
    if (S.pm.toProj) ch.send('prompter-pos', { pos: S.pm.pos }, projWin);
  }
  function pmSpeed(d) { const r = $('#pmSpeed'); r.value = Math.max(+r.min, Math.min(+r.max, +r.value + d)); $('#pmSpeedV').textContent = r.value; }
  function pmResetPos() { S.pm.pos = 0; pmApplyPos(); if (S.pm.toProj) ch.send('prompter-pos', { pos: 0 }, projWin); }
  $('#pmPlay').onclick = () => pmToggle();
  $('#pmSlower').onclick = () => pmSpeed(-5); $('#pmFaster').onclick = () => pmSpeed(5);
  $('#pmReset').onclick = pmResetPos;
  $('#pmSpeed').oninput = () => $('#pmSpeedV').textContent = $('#pmSpeed').value;
  ['#pmSize', '#pmMirror', '#pmText'].forEach(id => $(id).addEventListener('input', () => { pmRender(); broadcast(); LP.db.set('prompterText', $('#pmText').value); }));
  $('#pmToProj').onchange = () => { S.pm.toProj = $('#pmToProj').checked; if (S.pm.toProj && (!projWin || projWin.closed)) toast('先点右上角「打开投影窗口」'); broadcast(); };
  pmStage.addEventListener('wheel', e => { if (!pmEl) return; const max = pmEl.scrollHeight - pmEl.clientHeight; if (max > 0) { S.pm.pos = Math.max(0, Math.min(1, S.pm.pos + e.deltaY / max)); pmApplyPos(); if (S.pm.toProj) ch.send('prompter-pos', { pos: S.pm.pos }, projWin); } e.preventDefault(); }, { passive: false });
  function pmFillSources() {
    $('#pmSource').innerHTML = '<option value="">从歌曲/歌单载入…</option><optgroup label="歌曲">' + S.songs.map(s => `<option value="song:${s.id}">${esc(s.title)}</option>`).join('') + '</optgroup><optgroup label="歌单">' + S.setlists.map(s => `<option value="set:${s.id}">${esc(s.date || '')} ${esc(s.name)}</option>`).join('') + '</optgroup>';
  }
  $('#pmSource').onfocus = pmFillSources;
  $('#pmSource').onchange = e => {
    const [k, id] = e.target.value.split(':'); let txt = '';
    if (k === 'song') { const s = songById(id); txt = s.title + '\n\n' + LP.songSlides(s, {}).map(x => x.lines.join('\n')).join('\n\n'); }
    if (k === 'set') { const s = setById(id); txt = s.items.map(it => it.type === 'song' ? (songById(it.songId) ? '【' + songById(it.songId).title + '】\n' + LP.songSlides(songById(it.songId), {}).map(x => x.lines.join('\n')).join('\n\n') : '') : it.type === 'text' ? '【' + (it.title || '经文') + '】\n' + it.text : '').filter(Boolean).join('\n\n\n'); }
    if (txt) { $('#pmText').value = txt; S.pm.pos = 0; pmRender(); broadcast(); }
    e.target.value = '';
  };

  /* ---------- 外观 ---------- */
  const TF = ['font', 'bold', 'fontSize', 'lineHeight', 'color', 'align', 'valign', 'shadow', 'outline', 'outlineColor', 'autoFit', 'showRef', 'bilingual', 'subColor', 'subScale', 'bgType', 'bgColor', 'bgColor2', 'bgDim'];
  const elT = k => $('#t' + k[0].toUpperCase() + k.slice(1));
  $('#tFont').innerHTML = Object.keys(LP.FONT_NAMES).map(k => `<option value="${k}">${LP.FONT_NAMES[k]}</option>`).join('');
  $('#presets').innerHTML = Object.keys(LP.PRESETS).map(k => `<span class="chip" data-p="${k}">${k}</span>`).join('');
  function renderLook() {
    TF.forEach(k => { const el = elT(k); if (el.type === 'checkbox') el.checked = !!S.theme[k]; else el.value = S.theme[k]; });
    $$('[data-v]').forEach(sp => sp.textContent = S.theme[sp.dataset.v.slice(1, 2).toLowerCase() + sp.dataset.v.slice(2)]);
    $('#logoText').value = S.logo.text || '';
    const sample = S.live.slides.find(s => s.kind !== 'logo' && s.lines.some(l => LP.isSubLine(l, s.lines))) || S.live.slides.find(s => s.kind !== 'logo') || { lines: ['耶和华是我的牧者，我必不致缺乏。', 'The LORD is my shepherd; I shall not want.'] };
    LP.renderStage($('#lookStage'), { mode: 'slide', slide: sample }, S.theme, S.logo);
    LP.renderStage($('#lookLogoStage'), { mode: 'logo' }, S.theme, S.logo);
  }
  function themeChanged() { saveTheme(); renderLook(); broadcast(); }
  TF.forEach(k => elT(k).addEventListener('input', e => {
    const el = e.target; S.theme[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? +el.value : el.value; themeChanged();
  }));
  $('#presets').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; Object.assign(S.theme, LP.DEFAULT_THEME, { bgImage: '' }, LP.PRESETS[c.dataset.p]); themeChanged(); toast('已套用：' + c.dataset.p); };
  function readImage(file, maxW) {
    return new Promise(res => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => { const sc = Math.min(1, maxW / im.width); const c = document.createElement('canvas'); c.width = im.width * sc; c.height = im.height * sc; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88)); };
      im.src = url;
    });
  }
  $('#tBgImageFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; S.theme.bgImage = await readImage(f, 1920); S.theme.bgType = 'image'; themeChanged(); };
  $('#logoFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; S.logo.image = await readImage(f, 1200); await saveLogo(); renderLook(); broadcast(); };
  $('#logoText').oninput = () => { S.logo.text = $('#logoText').value; saveLogo(); renderLook(); broadcast(); };
  $('#logoClear').onclick = () => { S.logo.image = ''; saveLogo(); renderLook(); broadcast(); };

  /* ---------- 设置 / 备份 ---------- */
  function renderSettings() {
    $('#optMaxLines').value = S.settings.maxLines; $('#optTitleSlide').checked = S.settings.titleSlide;
    $('#optAi').checked = S.settings.ai; $('#optAiUrl').value = S.settings.aiUrl; $('#optAiModel').value = S.settings.aiModel; $('#optAiKey').value = S.settings.aiKey;
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => $('#storageInfo').textContent = `已用存储约 ${(e.usage / 1048576).toFixed(1)} MB · 歌曲 ${S.songs.length} 首 · 歌单 ${S.setlists.length} 个`);
  }
  [['#optMaxLines', 'maxLines', v => +v || 0], ['#optTitleSlide', 'titleSlide'], ['#optAi', 'ai'], ['#optAiUrl', 'aiUrl'], ['#optAiModel', 'aiModel'], ['#optAiKey', 'aiKey']].forEach(([id, k, f]) => {
    $(id).addEventListener('input', e => { const el = e.target; S.settings[k] = el.type === 'checkbox' ? el.checked : f ? f(el.value) : el.value; saveSettings(); if (k === 'maxLines' || k === 'titleSlide') { setLive(S.live.setId, S.live.items); } });
  });
  $('#btnBackup').onclick = () => {
    const data = { app: 'lyrics-projector', version: 1, exported: new Date().toISOString(), songs: S.songs, setlists: S.setlists, theme: S.theme, logo: S.logo, settings: Object.assign({}, S.settings, { aiKey: '' }) };
    LP.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), '歌词投影备份_' + todayStr() + '.json');
  };
  $('#restoreFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text()); if (!d.songs && !d.setlists) throw new Error('不是本工具的备份文件');
      const full = !!d.theme;
      const mode = full ? confirm('导入完整备份：\n「确定」= 合并到现有数据（同名 ID 覆盖）\n「取消」= 不导入') : true;
      if (!mode) return;
      const merge = (arr, inc) => { (inc || []).forEach(x => { const i = arr.findIndex(y => y.id === x.id); if (i >= 0) arr[i] = x; else arr.push(x); }); };
      merge(S.songs, d.songs); merge(S.setlists, d.setlists);
      if (d.theme) S.theme = LP.theme(d.theme); if (d.logo) S.logo = d.logo;
      await saveSongs(); await saveSets(); await saveTheme(); await saveLogo();
      toast(`已导入 ${(d.songs || []).length} 首歌、${(d.setlists || []).length} 个歌单`); renderSongs(); renderSets(); renderSettings();
    } catch (err) { alert('导入失败：' + err.message); }
    e.target.value = '';
  };
  $('#btnImportSongs').onclick = () => $('#importTxt').click();
  $('#importTxt').onchange = async e => {
    let n = 0;
    for (const f of e.target.files) { const txt = await f.text(); S.songs.push({ id: uid('s'), title: f.name.replace(/\.txt$/i, ''), tags: [], key: '', tempo: '', lang: '中文', arrangement: '', lyrics: txt.trim(), created: Date.now() }); n++; }
    await saveSongs(); toast(`已导入 ${n} 首歌`); renderSettings(); e.target.value = '';
  };
  $('#btnReset').onclick = async () => {
    if (!confirm('确定清空所有歌曲、歌单和外观设置？（建议先导出备份）')) return;
    await LP.db.set('songs', []); await LP.db.set('setlists', []); await LP.db.set('theme', {}); await LP.db.set('logo', {}); await LP.db.set('inited', true);
    location.reload();
  };

  /* ---------- OCR ---------- */
  let ocrFile = null;
  $('#btnOcr').onclick = () => {
    $('#ocrMode').value = S.settings.ai && S.settings.aiKey ? 'ai' : 'local';
    $('#ocrOut').value = ''; $('#ocrProgress').textContent = ''; $('#ocrImg').removeAttribute('src');
    $('#ocrDlg').showModal();
  };
  const drop = $('#ocrDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) runOcr(f); });
  $('#ocrFile').onchange = e => { const f = e.target.files[0]; if (f) runOcr(f); e.target.value = ''; };
  document.addEventListener('paste', e => {
    if (!$('#ocrDlg').open) return; const it = [...(e.clipboardData || {}).items || []].find(i => i.type.startsWith('image/'));
    if (it) { e.preventDefault(); runOcr(it.getAsFile()); }
  });
  let ocrRaw = '';
  async function runOcr(file) {
    ocrFile = file; $('#ocrImg').src = URL.createObjectURL(file);
    const P = $('#ocrProgress'); P.textContent = '准备识别…'; $('#ocrOut').value = '';
    const t0 = performance.now();
    try {
      if ($('#ocrMode').value === 'ai') { P.textContent = 'AI 识别中…'; ocrRaw = await LP.ocrAI(file, S.settings); }
      else ocrRaw = await LP.ocrLocal(file, m => {
        const st = { 'loading tesseract core': '加载识别引擎', 'initializing tesseract': '初始化', 'loading language traineddata': '加载中文/英文字库', 'initializing api': '初始化', 'recognizing text': '正在识别文字' }[m.status] || m.status;
        P.textContent = `${st} ${m.progress ? Math.round(m.progress * 100) + '%' : ''}`;
      });
      ocrPost();
      P.textContent = `✅ 识别完成（${((performance.now() - t0) / 1000).toFixed(1)} 秒）。请检查修改，再点「替换歌词框」或「追加到歌词」。`;
    } catch (err) { console.warn(err); P.textContent = '❌ ' + err.message; }
  }
  function ocrPost() {
    let txt = LP.cleanOcr(ocrRaw, $('#ocrStrip').checked);
    if ($('#ocrMode').value !== 'ai' || !/\n\n/.test(txt)) txt = LP.paginate(txt.replace(/\n{2,}/g, '\n'), +$('#ocrLines').value);
    $('#ocrOut').value = txt;
  }
  $('#ocrLines').onchange = () => ocrRaw && ocrPost();
  $('#ocrStrip').onchange = () => ocrRaw && ocrPost();
  $('#ocrDlg').addEventListener('close', () => {
    const v = $('#ocrDlg').returnValue, txt = $('#ocrOut').value.trim();
    if (!txt) return;
    if (v === 'fill') $('#sLyrics').value = txt;
    else if (v === 'append') $('#sLyrics').value = ($('#sLyrics').value.trim() + '\n\n' + txt).trim();
    else return;
    dirty = true; songPreview(); toast('已填入歌词，记得点「保存」');
  });
  LP.app = { runOcr, go, setLive, S, saveSong, editSong };

  /* ---------- 启动 ---------- */
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  (async function init() {
    await load();
    $('#pmText').value = await LP.db.get('prompterText', '各位弟兄姊妹，平安！欢迎来到今天的主日崇拜。\n\n请大家把手机调成静音，我们一同安静预备心，来敬拜我们的神。\n\n（这里是提词器示例文字：把讲稿或主持词贴进来，按空格开始自动滚动。）');
    renderSettings();
    const ls = S.live.setId && setById(S.live.setId) ? S.live.setId : (S.setlists[0] && S.setlists[0].id);
    setLive(ls || null);
    S.curSetId = ls || null;
    editSong(S.songs[0] && S.songs[0].id);
    window.addEventListener('resize', () => { if ($('#tab-live').classList.contains('active')) renderLiveCur(); });
    document.body.classList.add('ready');
  })();
})();
