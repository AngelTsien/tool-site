/* 照片/简谱截图 → 歌词文字 */
(function (g) {
  const LP = g.LP = g.LP || {};
  const abs = p => new URL(p, location.href).href;
  let workerP = null;

  async function prep(file) {
    // 放大小图、转灰度、提高对比度，提升识别率
    const url = URL.createObjectURL(file);
    const img = await LP.loadImg(url);
    const sc = Math.min(3, Math.max(1, 2000 / img.width));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      let y = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
      y = Math.max(0, Math.min(255, (y - 128) * 1.35 + 128));
      a[i] = a[i + 1] = a[i + 2] = y;
    }
    ctx.putImageData(d, 0, 0);
    return { canvas: c, url };
  }

  function getWorker(onProgress) {
    if (!workerP) {
      workerP = Tesseract.createWorker(['chi_sim', 'eng'], 1, {
        workerPath: abs('vendor/tesseract/worker.min.js'),
        corePath: abs('vendor/tesseract-core/'),
        langPath: abs('vendor/lang'),
        gzip: true,
        logger: m => onProgress && LP._ocrProgress && LP._ocrProgress(m)
      }).then(async w => { await w.setParameters({ preserve_interword_spaces: '1' }); return w; });
      workerP.catch(() => { workerP = null; });
    }
    return workerP;
  }

  LP.ocrLocal = async function (file, onProgress) {
    LP._ocrProgress = onProgress;
    if (location.protocol === 'file:') throw new Error('离线识别需要通过网页地址打开（GitHub Pages 或本地服务器），直接双击 index.html 打开时浏览器不允许运行识别程序。');
    const { canvas } = await prep(file);
    const w = await getWorker(true);
    const r = await w.recognize(canvas);
    return r.data.text;
  };

  LP.ocrAI = async function (file, cfg) {
    if (!cfg.aiKey) throw new Error('请先在「设置」里填写 API Key');
    const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
    const body = {
      model: cfg.aiModel || 'gpt-4o-mini', temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: '这是一张歌词照片或简谱歌谱截图。请只输出歌词文字，不要输出简谱数字、和弦、页码或其他说明。按演唱分行，每个段落之间空一行，段落前用 [主歌] [副歌] [桥段] 标注（能判断时）。如有多段歌词（1. 2.），按顺序分别输出。' },
        { type: 'image_url', image_url: { url: dataUrl } }] }]
    };
    const r = await fetch(cfg.aiUrl || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.aiKey }, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('AI 接口错误 ' + r.status + '：' + (await r.text()).slice(0, 200));
    const j = await r.json();
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').replace(/^```\w*\n?|```$/g, '').trim();
  };

  /* 清理：去掉简谱数字、小节线、和弦、页码等，只保留歌词 */
  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/g;
  const CHORD = /^[A-G](#|b)?(m|maj|min|dim|aug|sus)?\d*(\/[A-G](#|b)?)?$/;
  LP.cleanOcr = function (text, strip) {
    const out = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach(raw => {
      let line = raw.trim();
      if (!line) { out.push(''); return; }
      if (LP.labelOf(line)) { out.push(line); return; }
      if (!strip) { out.push(line.replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '')); return; }
      const cjk = (line.match(CJK) || []).length;
      const nonSpace = line.replace(/\s/g, '').length || 1;
      if (cjk >= 2 && cjk / nonSpace >= 0.4) {
        // 中文歌词行：去掉数字、拉丁杂字、简谱符号
        line = line.replace(/^\s*\d+[.、．)]\s*/, '')           // 段落编号 1. 2.
          .replace(/[0-9０-９#♯♭b|｜·•\-—_=+~^*'"`<>\[\]{}()（）\/\\:;]/g, ' ')
          .replace(/[A-Za-z]+/g, ' ')
          .replace(/(?<=[\u3400-\u9fff，。！？、；：])\s+(?=[\u3400-\u9fff，。！？、；：])/g, '')
          .replace(/\s{2,}/g, ' ').trim()
          .replace(/^[，。！？、；：\s]+/, '');
        // 只由「一 丨 人 十」等横线误识组成的行（简谱的延长线）丢弃
        const real = (line.match(CJK) || []).filter(ch => !'一丨人十乙'.includes(ch));
        if (real.length >= 2) out.push(line);
        return;
      }
      // 英文歌词行：至少 3 个英文单词且字母占多数，且不是和弦行
      const words = line.split(/\s+/);
      const letters = (line.match(/[A-Za-z]/g) || []).length;
      const chordish = words.filter(w => CHORD.test(w) || /^[A-G][#b]?m?[A-G]?$/.test(w) || /\//.test(w)).length;
      if (words.filter(w => /^[A-Za-z',.!?;:-]{2,}$/.test(w)).length >= 3 && letters / nonSpace > 0.7 && chordish < words.length / 3) {
        out.push(line.replace(/[0-9|_=+~^*<>\[\]{}\\]/g, '').replace(/\s{2,}/g, ' ').trim());
      }
      // 其余（简谱数字行、和弦行、页码、符号）丢弃
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  /* 没有空行时按每页 n 行自动分页 */
  LP.paginate = function (text, n) {
    n = +n || 0;
    const lines = text.split('\n');
    if (!n) return text;
    const res = []; let cnt = 0;
    lines.forEach(l => {
      if (!l.trim() || LP.labelOf(l)) { if (res.length && res[res.length - 1] !== '') res.push(''); res.push(...(l.trim() ? [l] : [])); cnt = 0; return; }
      if (cnt >= n) { res.push(''); cnt = 0; }
      res.push(l); cnt++;
    });
    return res.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };
})(window);
