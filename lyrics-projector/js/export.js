/* 导出：PNG 图片 ZIP / PPTX / PDF —— 全部在浏览器本地完成 */
(function (g) {
  const LP = g.LP = g.LP || {};
  const W = 1920, H = 1080;
  const PPT_FONT = { sans: 'Microsoft YaHei', 'hei-bold': 'Microsoft YaHei', serif: 'SimSun', kai: 'KaiTi' };
  const safe = s => String(s || '歌词').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);
  LP.safeName = safe;

  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  LP.download = download;

  async function renderCanvas(sl, theme, logo) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    await LP.drawSlide(c, sl.kind === 'logo' ? null : sl, theme, logo, sl.kind === 'logo' ? 'logo' : 'slide');
    return c;
  }
  const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));

  LP.exportPNG = async function (slides, theme, logo, name, onP) {
    const zip = new JSZip(); const pad = String(slides.length).length;
    for (let i = 0; i < slides.length; i++) {
      onP && onP(`正在生成图片 ${i + 1}/${slides.length}…`);
      const c = await renderCanvas(slides[i], theme, logo);
      zip.file(String(i + 1).padStart(Math.max(2, pad), '0') + (slides[i].title ? '_' + safe(slides[i].title) : '') + '.png', await toBlob(c, 'image/png'));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    download(blob, safe(name) + '_图片.zip'); return blob;
  };

  LP.exportPDF = async function (slides, theme, logo, name, onP) {
    const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H], hotfixes: ['px_scaling'] });
    for (let i = 0; i < slides.length; i++) {
      onP && onP(`正在生成 PDF ${i + 1}/${slides.length}…`);
      if (i) pdf.addPage([W, H], 'landscape');
      const c = await renderCanvas(slides[i], theme, logo);
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H);
    }
    const blob = pdf.output('blob'); download(blob, safe(name) + '.pdf'); return blob;
  };

  // PPTX：文字保持可编辑；背景为纯色或图片（渐变/图片背景先画成图）
  LP.exportPPTX = async function (slides, theme, logo, name, onP) {
    const t = LP.theme(theme);
    const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_16x9'; pptx.title = name;
    const SW = 10, SH = 5.625, PT = SH * 72; // 405pt 高
    let bgData = null;
    if (t.bgType !== 'color') {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      await LP.drawSlide(c, null, t, null, 'slide'); bgData = c.toDataURL('image/jpeg', 0.9);
    }
    const measure = document.createElement('canvas'); measure.width = W; measure.height = H;
    // 注意：PptxGenJS 会改写传入的 shadow 对象，所以每页新建
    const mkShadow = () => t.shadow ? { type: 'outer', color: '000000', blur: 4, offset: 1.5, angle: 90, opacity: 0.8 } : undefined;
    const hex = c => c.replace('#', '').toUpperCase();
    for (let i = 0; i < slides.length; i++) {
      onP && onP(`正在生成 PPT ${i + 1}/${slides.length}…`);
      const sl = slides[i]; const s = pptx.addSlide();
      if (bgData) s.background = { data: bgData }; else s.background = { color: hex(t.bgColor) };
      if (sl.kind === 'logo') {
        if (logo && logo.image) {
          const im = await LP.loadImg(logo.image);
          if (im) { const sc = Math.min(SW * 0.5 / im.width, SH * 0.5 / im.height); const w = im.width * sc, h = im.height * sc; s.addImage({ data: logo.image, x: (SW - w) / 2, y: (SH - h) / 2 - (logo.text ? 0.35 : 0), w, h }); }
        }
        if (logo && logo.text) s.addText(logo.text, { x: 0.3, y: SH * 0.72, w: SW - 0.6, h: 0.8, align: 'center', fontSize: 0.06 * PT, bold: true, color: hex(t.color), fontFace: PPT_FONT[t.font] });
        continue;
      }
      // 用 canvas 计算自动缩小后的字号，保证和投影一致
      await LP.drawSlide(measure, sl, Object.assign({}, t, { bgType: 'color' }), null, 'slide');
      const base = (measure._fit || t.fontSize / 100) * PT;
      const runs = [];
      sl.lines.forEach((line, k) => {
        const sub = t.bilingual && LP.isSubLine(line, sl.lines);
        runs.push({ text: line, options: { fontSize: +(sub ? base * t.subScale : base).toFixed(1), color: hex(sub ? t.subColor : t.color), breakLine: true } });
      });
      if (t.showRef && sl.ref) runs.push({ text: sl.ref, options: { fontSize: +(base * 0.5).toFixed(1), color: hex(t.color), breakLine: true } });
      const padY = SH * t.padding / 100, padX = SH * t.padding * 1.2 / 100;
      s.addText(runs, {
        x: padX, y: padY, w: SW - padX * 2, h: SH - padY * 2, align: t.align, valign: t.valign,
        fontFace: PPT_FONT[t.font] || 'Microsoft YaHei', bold: t.bold, lineSpacingMultiple: t.lineHeight * 0.85,
        shadow: mkShadow(), lang: 'zh-CN', outline: t.outline ? { size: 0.75, color: hex(t.outlineColor) } : undefined, margin: 0, fit: 'shrink'
      });
      if (sl.label) s.addNotes((sl.title || '') + ' · ' + sl.label);
    }
    const blob = await pptx.write({ outputType: 'blob' });
    download(blob, safe(name) + '.pptx'); return blob;
  };
})(window);
