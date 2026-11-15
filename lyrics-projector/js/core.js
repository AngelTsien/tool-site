/* 共享核心：歌词解析、主题、幻灯片渲染、窗口通信 */
(function (g) {
  'use strict';
  const LP = g.LP = g.LP || {};

  /* ---------- 段落标签 ---------- */
  const LABEL_MAP = [
    [/^(主歌|verse|v)$/i, '主歌'],
    [/^(副歌|chorus|c|ch)$/i, '副歌'],
    [/^(桥段|bridge|b|br)$/i, '桥段'],
    [/^(导歌|预副歌|pre-?chorus|pc)$/i, '导歌'],
    [/^(前奏|intro|i)$/i, '前奏'],
    [/^(间奏|interlude)$/i, '间奏'],
    [/^(尾声|结尾|ending|outro|tag|e)$/i, '尾声']
  ];
  function normLabel(raw) {
    let s = String(raw || '').trim().replace(/[\[\]【】()（）:：]/g, '').trim();
    const m = s.match(/^(.*?)[\s-]*(\d*)$/);
    let base = m ? m[1].trim() : s, num = m ? m[2] : '';
    if (!base && num) { base = s; num = ''; }
    for (const [re, name] of LABEL_MAP) if (re.test(base)) return name + num;
    return s;
  }
  LP.normLabel = normLabel;
  // 识别单独一行的段落标签
  const BRACKET_RE = /^\s*[\[【]\s*([^\]】]{1,20})\s*[\]】]\s*$/;
  const BARE_RE = /^\s*(主歌|副歌|桥段|导歌|预副歌|前奏|间奏|尾声|结尾|verse|chorus|bridge|pre-?chorus|tag|ending|intro|outro)\s*(\d*)\s*[:：]?\s*$/i;
  const SHORT_RE = /^\s*(V|C|B|PC)\s*(\d*)\s*[:：]\s*$/i; // V1:  C:
  function labelOf(line) {
    let m = line.match(BRACKET_RE);
    if (m) return normLabel(m[1]);
    m = line.match(BARE_RE) || line.match(SHORT_RE);
    if (m) return normLabel(m[1] + (m[2] || ''));
    return null;
  }
  LP.labelOf = labelOf;

  /* 解析歌词 -> 段落列表 [{label, slides:[[lines]]}] */
  function parseSections(text, maxLines) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const sections = [];
    let cur = null, buf = [];
    const flush = () => { if (buf.length) { cur.slides.push(buf); buf = []; } };
    const ensure = () => { if (!cur) { cur = { label: '', slides: [] }; sections.push(cur); } };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const lab = labelOf(line);
      if (lab) { if (cur) flush(); cur = { label: lab, slides: [] }; sections.push(cur); continue; }
      if (!line.trim()) { if (cur) flush(); continue; }
      ensure(); buf.push(line.trim());
      if (maxLines > 0 && buf.length >= maxLines) flush();
    }
    if (cur) flush();
    return sections.filter(s => s.slides.length);
  }
  LP.parseSections = parseSections;

  /* 唱法顺序，例如 "主歌 副歌 主歌 副歌x2 桥段" 或 "V1 C V2 C C" */
  function parseArrangement(str) {
    const out = [];
    String(str || '').split(/[\s,，、;；→>\-|]+/).filter(Boolean).forEach(tok => {
      let rep = 1; const m = tok.match(/^(.*?)[x×*](\d+)$/i);
      if (m && m[1]) { tok = m[1]; rep = +m[2]; }
      const n = normLabel(tok);
      for (let i = 0; i < rep; i++) out.push(n);
    });
    return out;
  }
  LP.parseArrangement = parseArrangement;

  function findSection(sections, label) {
    let s = sections.find(x => x.label === label);
    if (s) return s;
    // "主歌" 匹配 "主歌1"；"主歌1" 匹配 "主歌"
    const base = label.replace(/\d+$/, '');
    return sections.find(x => x.label.replace(/\d+$/, '') === base && (x.label === base || label === base))
        || sections.find(x => x.label.replace(/\d+$/, '') === base);
  }

  /* 歌曲 -> 幻灯片 [{lines, label, title}] */
  function songSlides(song, opts) {
    opts = opts || {};
    const sections = parseSections(song.lyrics, opts.maxLines || 0);
    let order = sections;
    const arr = parseArrangement(song.arrangement);
    const warnings = [];
    if (arr.length && sections.some(s => s.label)) {
      order = [];
      arr.forEach(l => { const s = findSection(sections, l); if (s) order.push(s); else warnings.push(l); });
      if (!order.length) order = sections;
    }
    const slides = [];
    if (opts.titleSlide && song.title) slides.push({ lines: [song.title], label: '歌名', title: song.title, isTitle: true });
    order.forEach(sec => sec.slides.forEach((ls, i) => slides.push({
      lines: ls, label: sec.label ? sec.label + (sec.slides.length > 1 ? ' ' + (i + 1) : '') : '', title: song.title
    })));
    slides.warnings = warnings;
    return slides;
  }
  LP.songSlides = songSlides;

  function textSlides(item, opts) {
    // 经文/文字：空行分页；第一页可带标题（出处）
    const secs = parseSections(item.text, (opts && opts.maxLines) || 0);
    const slides = [];
    secs.forEach(sec => sec.slides.forEach(ls => slides.push({ lines: ls, label: sec.label || '', title: item.title || '', ref: item.title || '' })));
    if (!slides.length && item.title) slides.push({ lines: [item.title], label: '', title: item.title });
    return slides;
  }
  LP.textSlides = textSlides;

  /* ---------- 主题 ---------- */
  const FONTS = {
    'sans': '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",system-ui,sans-serif',
    'serif': '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif',
    'kai': '"Kaiti SC","STKaiti","KaiTi","AR PL UKai CN",serif',
    'hei-bold': '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif'
  };
  LP.FONTS = FONTS;
  LP.FONT_NAMES = { sans: '黑体（无衬线）', serif: '宋体（衬线）', kai: '楷体', 'hei-bold': '粗黑体' };
  const DEFAULT_THEME = {
    font: 'sans', bold: true, fontSize: 8, lineHeight: 1.45, color: '#ffffff', subColor: '#ffd666', subScale: 0.72,
    align: 'center', valign: 'middle', bgType: 'color', bgColor: '#000000', bgColor2: '#1d3557', bgImage: '', bgDim: 0.35,
    outline: false, outlineColor: '#000000', shadow: true, bilingual: true, autoFit: true, padding: 6, showRef: true
  };
  LP.DEFAULT_THEME = DEFAULT_THEME;
  LP.PRESETS = {
    '经典黑底': { bgType: 'color', bgColor: '#000000', color: '#ffffff', subColor: '#ffd666', shadow: true, outline: false, font: 'sans' },
    '深蓝渐变': { bgType: 'gradient', bgColor: '#0b1d3a', bgColor2: '#25507f', color: '#ffffff', subColor: '#a8dadc', shadow: true, outline: false, font: 'sans' },
    '白底黑字': { bgType: 'color', bgColor: '#ffffff', color: '#111111', subColor: '#8a4b08', shadow: false, outline: false, font: 'serif' },
    '暖色晨光': { bgType: 'gradient', bgColor: '#3d1f0f', bgColor2: '#b5651d', color: '#fff8e7', subColor: '#ffe08a', shadow: true, outline: false, font: 'serif' },
    '绿幕字幕(直播)': { bgType: 'color', bgColor: '#00b140', color: '#ffffff', subColor: '#ffffff', shadow: false, outline: true, outlineColor: '#000000', font: 'sans', valign: 'bottom', fontSize: 6.5 }
  };
  LP.theme = t => Object.assign({}, DEFAULT_THEME, t || {});

  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
  LP.isSubLine = function (line, lines) {
    return !CJK.test(line) && /[A-Za-z]/.test(line) && lines.some(l => CJK.test(l));
  };

  function bgCss(t) {
    if (t.bgType === 'gradient') return `linear-gradient(160deg, ${t.bgColor}, ${t.bgColor2})`;
    if (t.bgType === 'image' && t.bgImage) return `linear-gradient(rgba(0,0,0,${t.bgDim}),rgba(0,0,0,${t.bgDim})), url("${t.bgImage}") center/cover no-repeat, ${t.bgColor}`;
    return t.bgColor;
  }
  LP.bgCss = bgCss;

  /* HTML 渲染：stage 必须设置 container-type:size（字号按画面高度百分比） */
  LP.renderStage = function (stage, state, theme, logo) {
    const t = LP.theme(theme);
    stage.style.background = bgCss(t);
    stage.innerHTML = '';
    const mode = state && state.mode || 'blank';
    if (mode === 'black') { stage.style.background = '#000'; return; }
    if (mode === 'logo') {
      const box = document.createElement('div'); box.className = 'lp-logo';
      if (logo && logo.image) { const im = document.createElement('img'); im.src = logo.image; box.appendChild(im); }
      if (logo && logo.text) { const d = document.createElement('div'); d.className = 'lp-logo-text'; d.textContent = logo.text; d.style.color = t.color; d.style.fontFamily = FONTS[t.font]; box.appendChild(d); }
      stage.appendChild(box); return;
    }
    if (mode !== 'slide' || !state.slide) return;
    const s = state.slide;
    const wrap = document.createElement('div');
    wrap.className = 'lp-text';
    Object.assign(wrap.style, {
      fontFamily: FONTS[t.font] || FONTS.sans, fontWeight: t.bold ? '700' : '400', color: t.color,
      lineHeight: t.lineHeight, textAlign: t.align, padding: `${t.padding}cqh ${t.padding * 1.2}cqh`,
      justifyContent: t.valign === 'top' ? 'flex-start' : t.valign === 'bottom' ? 'flex-end' : 'center',
      alignItems: t.align === 'left' ? 'flex-start' : t.align === 'right' ? 'flex-end' : 'center'
    });
    const shadows = [];
    if (t.shadow) shadows.push('0 0.25cqh 0.8cqh rgba(0,0,0,.85)');
    wrap.style.textShadow = shadows.join(',');
    if (t.outline) { wrap.style.webkitTextStroke = `0.12cqh ${t.outlineColor}`; wrap.style.paintOrder = 'stroke fill'; }
    let size = s.isTitle ? t.fontSize * 1.25 : t.fontSize;
    const inner = document.createElement('div'); inner.className = 'lp-lines';
    s.lines.forEach(line => {
      const d = document.createElement('div'); d.className = 'lp-line'; d.textContent = line;
      if (t.bilingual && LP.isSubLine(line, s.lines)) { d.classList.add('sub'); d.style.color = t.subColor; d.style.fontSize = (t.subScale) + 'em'; }
      inner.appendChild(d);
    });
    wrap.appendChild(inner);
    if (t.showRef && s.ref) { const r = document.createElement('div'); r.className = 'lp-ref'; r.textContent = s.ref; r.style.fontSize = '0.5em'; r.style.opacity = .8; wrap.appendChild(r); }
    stage.appendChild(wrap);
    wrap.style.fontSize = size + 'cqh';
    if (t.autoFit) {
      // 文字太多时自动缩小
      let guard = 0;
      while ((wrap.scrollHeight > stage.clientHeight + 1 || inner.scrollWidth > wrap.clientWidth + 1) && size > 2 && guard++ < 40) {
        size *= 0.93; wrap.style.fontSize = size + 'cqh';
      }
    }
  };

  /* ---------- Canvas 渲染（导出 PNG / PDF 用） ---------- */
  function loadImg(src) { return new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  LP.loadImg = loadImg;
  function wrapLine(ctx, text, maxW) {
    // 中文按字、英文按词断行
    const tokens = text.match(/[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]|[^\s\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]+|\s+/g) || [''];
    const out = []; let cur = '';
    tokens.forEach(tk => {
      const test = cur + tk;
      if (ctx.measureText(test).width > maxW && cur.trim()) { out.push(cur.trim()); cur = tk.trim() ? tk : ''; }
      else cur = test;
    });
    if (cur.trim() || !out.length) out.push(cur.trim());
    return out;
  }
  LP.drawSlide = async function (canvas, slide, theme, logo, kind) {
    const t = LP.theme(theme); const W = canvas.width, H = canvas.height; const ctx = canvas.getContext('2d');
    // 背景
    if (t.bgType === 'gradient') {
      const a = 160 * Math.PI / 180; const dx = Math.sin(a) * W / 2, dy = -Math.cos(a) * H / 2;
      const gr = ctx.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
      gr.addColorStop(0, t.bgColor); gr.addColorStop(1, t.bgColor2); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    } else { ctx.fillStyle = t.bgColor; ctx.fillRect(0, 0, W, H); }
    if (t.bgType === 'image' && t.bgImage) {
      const im = await loadImg(t.bgImage);
      if (im) { const sc = Math.max(W / im.width, H / im.height); const w = im.width * sc, h = im.height * sc; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); ctx.fillStyle = `rgba(0,0,0,${t.bgDim})`; ctx.fillRect(0, 0, W, H); }
    }
    if (kind === 'logo') {
      const im = logo && await loadImg(logo.image);
      let y = H / 2;
      if (im) { const sc = Math.min(W * 0.5 / im.width, H * 0.5 / im.height); const w = im.width * sc, h = im.height * sc; ctx.drawImage(im, (W - w) / 2, (H - h) / 2 - (logo.text ? H * 0.06 : 0), w, h); y = (H + h) / 2 + H * 0.04; }
      if (logo && logo.text) { ctx.fillStyle = t.color; ctx.font = `700 ${H * 0.06}px ${FONTS[t.font]}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(logo.text, W / 2, y); }
      return canvas;
    }
    if (!slide) return canvas;
    const padY = H * t.padding / 100, padX = H * t.padding * 1.2 / 100; const maxW = W - padX * 2, maxH = H - padY * 2;
    let size = H * (slide.isTitle ? t.fontSize * 1.25 : t.fontSize) / 100;
    let layout;
    const build = (sz) => {
      const rows = []; let total = 0;
      slide.lines.forEach(line => {
        const sub = t.bilingual && LP.isSubLine(line, slide.lines); const fs = sub ? sz * t.subScale : sz;
        ctx.font = `${t.bold ? 700 : 400} ${fs}px ${FONTS[t.font]}`;
        wrapLine(ctx, line, maxW).forEach(seg => { rows.push({ seg, fs, sub }); total += fs * t.lineHeight; });
      });
      if (t.showRef && slide.ref) { rows.push({ seg: slide.ref, fs: sz * 0.5, ref: true }); total += sz * 0.5 * t.lineHeight; }
      return { rows, total };
    };
    layout = build(size);
    let guard = 0;
    while (t.autoFit && layout.total > maxH && guard++ < 40) { size *= 0.93; layout = build(size); }
    canvas._fit = size / H;
    let y = t.valign === 'top' ? padY : t.valign === 'bottom' ? H - padY - layout.total : (H - layout.total) / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = t.align === 'left' ? 'left' : t.align === 'right' ? 'right' : 'center';
    const x = t.align === 'left' ? padX : t.align === 'right' ? W - padX : W / 2;
    layout.rows.forEach(r => {
      const lh = r.fs * t.lineHeight; const cy = y + lh / 2;
      ctx.font = `${t.bold ? 700 : 400} ${r.fs}px ${FONTS[t.font]}`;
      ctx.save();
      if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = H * 0.008; ctx.shadowOffsetY = H * 0.0025; }
      if (t.outline) { ctx.lineWidth = H * 0.0024; ctx.strokeStyle = t.outlineColor; ctx.lineJoin = 'round'; ctx.strokeText(r.seg, x, cy); }
      ctx.fillStyle = r.sub ? t.subColor : t.color; if (r.ref) ctx.globalAlpha = 0.8;
      ctx.fillText(r.seg, x, cy); ctx.restore();
      y += lh;
    });
    return canvas;
  };

  /* ---------- 窗口通信：BroadcastChannel + postMessage 双通道 ---------- */
  LP.channel = function (onMsg) {
    const seen = new Set(); let bc = null;
    try { bc = new BroadcastChannel('lyrics-projector'); bc.onmessage = e => handle(e.data); } catch (e) { }
    function handle(m) { if (!m || !m.__lp || seen.has(m.id)) return; seen.add(m.id); if (seen.size > 500) seen.clear(); onMsg(m); }
    window.addEventListener('message', e => handle(e.data));
    return {
      send(type, data, targetWin) {
        const m = { __lp: 1, id: Math.random().toString(36).slice(2) + Date.now(), type, data };
        seen.add(m.id);
        if (bc) try { bc.postMessage(m); } catch (e) { }
        [targetWin, window.opener].forEach(w => { try { if (w && !w.closed) w.postMessage(m, '*'); } catch (e) { } });
      }
    };
  };
})(window);
