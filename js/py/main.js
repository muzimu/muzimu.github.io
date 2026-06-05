(function() {
  // 使用 pinyin-pro 库（CDN 引入）
  // 汉字拼音映射表（精简版，覆盖常用汉字）
  // 直接用 pinyinPro 库处理

  function processLine(line, uppercase, keepNonHan) {
    let result = '';
    for (const ch of line) {
      const code = ch.codePointAt(0);
      // 判断是否为 CJK 汉字范围
      if (code >= 0x4E00 && code <= 0x9FFF ||
          code >= 0x3400 && code <= 0x4DBF ||
          code >= 0x20000 && code <= 0x2A6DF) {
        // 获取拼音首字母
        let py = '';
        if (window.pinyinPro) {
          py = window.pinyinPro.pinyin(ch, { toneType: 'none', type: 'string' });
        }
        if (py) {
          const first = py.charAt(0);
          result += uppercase ? first.toUpperCase() : first.toLowerCase();
        } else {
          // fallback: 保留原字符
          if (keepNonHan) result += ch;
        }
      } else {
        if (keepNonHan) result += ch;
      }
    }
    return result;
  }

  function run() {
    const input = document.getElementById('input').value;
    const uppercase = document.getElementById('chk-upper').checked;
    const keepNonHan = document.getElementById('chk-keep').checked;
    const lines = input.split('\n');
    const results = lines.map(l => processLine(l, uppercase, keepNonHan));
    document.getElementById('output').value = results.join('\n');
    setStatus('完成', 'success');
  }

  function setStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + (type || '');
  }

  function copyOutput() {
    const output = document.getElementById('output').value;
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => setStatus('已复制到剪贴板', 'success'));
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('btn-run').addEventListener('click', run);
    document.getElementById('btn-copy').addEventListener('click', copyOutput);
    document.getElementById('btn-clear').addEventListener('click', function() {
      document.getElementById('input').value = '';
      document.getElementById('output').value = '';
      setStatus('');
    });

    // Ctrl+Enter 执行
    document.getElementById('input').addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'Enter') run();
    });

    // 检查 pinyin-pro 加载状态
    if (!window.pinyinPro) {
      setStatus('正在加载拼音库...', '');
      const check = setInterval(() => {
        if (window.pinyinPro) {
          clearInterval(check);
          setStatus('拼音库已就绪', 'success');
          setTimeout(() => setStatus(''), 1500);
        }
      }, 200);
    }
  });
})();
