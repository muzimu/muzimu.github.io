(function() {
  let workbook = null;
  let currentSheet = null;

  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const btnSelect = document.getElementById('btn-select');
  const sheetSelect = document.getElementById('sheet-select');
  const optionsDiv = document.getElementById('options');
  const noHeaderCb = document.getElementById('no-header');
  const prettyCb = document.getElementById('pretty');
  const btnConvert = document.getElementById('btn-convert');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownload = document.getElementById('btn-download');
  const btnReset = document.getElementById('btn-reset');
  const output = document.getElementById('output');
  const outputPane = document.getElementById('output-pane');
  const rowCount = document.getElementById('row-count');
  const status = document.getElementById('status');

  function setStatus(msg, type) {
    status.textContent = msg;
    status.className = 'status ' + (type || '');
  }

  // 点击选择文件按钮
  btnSelect.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // 点击上传区域也触发
  uploadArea.addEventListener('click', () => fileInput.click());

  // 拖拽支持
  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) loadFile(e.target.files[0]);
  });

  function loadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) {
      setStatus('不支持的文件格式，请上传 .xlsx / .xls 文件', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        workbook = XLSX.read(data, { type: 'array' });
        const sheets = workbook.SheetNames;
        sheetSelect.innerHTML = sheets.map(s => `<option value="${s}">${s}</option>`).join('');
        currentSheet = sheets[0];
        uploadArea.style.display = 'none';
        optionsDiv.style.display = 'block';
        setStatus(`成功读取文件「${file.name}」，共 ${sheets.length} 个工作表`, 'success');
      } catch(err) {
        setStatus('读取文件失败: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  sheetSelect.addEventListener('change', e => { currentSheet = e.target.value; });

  btnConvert.addEventListener('click', () => {
    if (!workbook || !currentSheet) { setStatus('请先上传文件', 'error'); return; }
    try {
      const ws = workbook.Sheets[currentSheet];
      const noHeader = noHeaderCb.checked;
      const rows = XLSX.utils.sheet_to_json(ws, {
        header: noHeader ? 1 : undefined,
        defval: ''
      });

      // noHeader 模式下重命名为 col0, col1...
      let finalRows = rows;
      if (noHeader) {
        finalRows = rows.map(row => {
          const obj = {};
          row.forEach((val, i) => { obj['col' + i] = val; });
          return obj;
        });
      }

      const pretty = prettyCb.checked;
      const result = pretty
        ? JSON.stringify(finalRows, null, 2)
        : finalRows.map(r => JSON.stringify(r)).join('\n');

      output.value = result;
      outputPane.style.display = 'block';
      rowCount.textContent = `（${finalRows.length} 行）`;
      btnCopy.style.display = 'inline-block';
      btnDownload.style.display = 'inline-block';
      setStatus(`转换成功，共 ${finalRows.length} 行数据`, 'success');
    } catch(err) {
      setStatus('转换失败: ' + err.message, 'error');
    }
  });

  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(output.value).then(() => setStatus('已复制到剪贴板', 'success'));
  });

  btnDownload.addEventListener('click', () => {
    const pretty = prettyCb.checked;
    const ext = pretty ? 'json' : 'ndjson';
    const blob = new Blob([output.value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (currentSheet || 'output') + '.' + ext;
    a.click();
  });

  btnReset.addEventListener('click', () => {
    workbook = null;
    currentSheet = null;
    fileInput.value = '';
    uploadArea.style.display = 'block';
    optionsDiv.style.display = 'none';
    outputPane.style.display = 'none';
    output.value = '';
    btnCopy.style.display = 'none';
    btnDownload.style.display = 'none';
    setStatus('');
  });
})();
