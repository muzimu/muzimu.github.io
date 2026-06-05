(function() {
  let mode = 'unescape';

  const btnUnescape = document.getElementById('btn-unescape');
  const btnEscape = document.getElementById('btn-escape');
  const btnRun = document.getElementById('btn-run');
  const btnCopy = document.getElementById('btn-copy');
  const btnClear = document.getElementById('btn-clear');
  const input = document.getElementById('input');
  const output = document.getElementById('output');
  const status = document.getElementById('status');

  function setStatus(msg, isError) {
    status.textContent = msg;
    status.className = 'status ' + (isError ? 'error' : 'success');
  }

  function escapeLine(line) {
    return JSON.stringify(line);
  }

  function unescapeLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try { return JSON.parse(trimmed); } catch(e) {}
    }
    return trimmed
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\\//g, '/')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }

  function run() {
    const lines = input.value.split('\n');
    try {
      const results = lines.map(line => mode === 'escape' ? escapeLine(line) : unescapeLine(line));
      output.value = results.join('\n');
      setStatus('✓ 处理完成', false);
    } catch(e) {
      setStatus('✗ 处理失败: ' + e.message, true);
    }
  }

  btnUnescape.addEventListener('click', () => {
    mode = 'unescape';
    btnUnescape.classList.add('active');
    btnEscape.classList.remove('active');
  });

  btnEscape.addEventListener('click', () => {
    mode = 'escape';
    btnEscape.classList.add('active');
    btnUnescape.classList.remove('active');
  });

  btnRun.addEventListener('click', run);

  btnCopy.addEventListener('click', () => {
    if (!output.value) return;
    navigator.clipboard.writeText(output.value).then(() => setStatus('✓ 已复制到剪贴板', false));
  });

  btnClear.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    status.textContent = '';
    status.className = 'status';
  });

  // Ctrl+Enter 快捷键
  input.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') run();
  });
})();
