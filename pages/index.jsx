import { useState, useRef } from 'react';

const COLS = [
  { key: 'unit_number', label: 'Unit #' },
  { key: 'plate', label: 'Plate' },
  { key: 'year', label: 'Year' },
  { key: 'make', label: 'Make' },
  { key: 'vin', label: 'VIN' },
  { key: 'gross_vehicle_weight', label: 'GVW' },
  { key: 'gross_combined_weight', label: 'GCW' },
  { key: 'title_number', label: 'Title #' },
  { key: 'expiration_date', label: 'Expiration' },
  { key: 'state', label: 'State' },
];

export default function Home() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const addFiles = (newFiles) => {
    const accepted = Array.from(newFiles).filter(f =>
      /\.(pdf|jpg|jpeg|png|gif|webp|tiff?|bmp)$/i.test(f.name)
    );
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...accepted.filter(f => !existing.has(f.name + f.size))];
    });
    setSaved(false);
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const clear = () => { setFiles([]); setResults([]); setStatus(''); setSaved(false); };

  const processFiles = async () => {
    setProcessing(true);
    setResults([]);
    setSaved(false);
    const out = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(`Processing ${i + 1} of ${files.length}: ${file.name}`);
      try {
        const base64 = await toBase64(file);
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64, mimeType: file.type }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Extraction failed');
        out.push({ filename: file.name, ...data });
      } catch (err) {
        out.push({ filename: file.name, _error: err.message });
      }
      setResults([...out]);
    }

    setProcessing(false);
    const ok = out.filter(r => !r._error).length;
    setStatus(`Done — ${ok} of ${files.length} extracted successfully.`);
  };

  const saveToSheets = async () => {
    setSaving(true);
    setStatus('Saving to Google Sheets…');
    const records = results.filter(r => !r._error);
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setStatus(`✓ ${data.count} record(s) added to Google Sheets!`);
      setSaved(true);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
    setSaving(false);
  };

  const hasResults = results.some(r => !r._error);

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.h1}>Vehicle Registration Extractor</h1>
        <p style={s.sub}>Upload scanned registrations — Claude AI reads the fields and sends them to your Google Sheet.</p>

        <div
          style={{ ...s.dropzone, ...(dragging ? s.dropzoneActive : {}) }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current.click()}
        >
          <div style={s.dropIcon}>📄</div>
          <p style={s.dropText}>Drop files here or click to browse</p>
          <p style={s.dropHint}>PDF, JPG, PNG, TIFF and more</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.tiff,.tif,.bmp"
            style={{ display: 'none' }}
            onChange={e => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div style={s.fileList}>
            {files.map((f, i) => (
              <div key={i} style={s.fileItem}>
                <span style={s.fileName}>{f.name}</span>
                <span style={s.fileSize}>{(f.size / 1024).toFixed(0)} KB</span>
                <button style={s.removeBtn} onClick={() => removeFile(i)}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={s.btnRow}>
          <button
            style={{ ...s.btn, ...s.btnBlue, ...((!files.length || processing) ? s.btnDisabled : {}) }}
            disabled={!files.length || processing}
            onClick={processFiles}
          >
            {processing ? 'Extracting…' : `Extract Data (${files.length} file${files.length !== 1 ? 's' : ''})`}
          </button>

          {hasResults && (
            <button
              style={{ ...s.btn, ...s.btnGreen, ...(saving || saved ? s.btnDisabled : {}) }}
              disabled={saving || saved}
              onClick={saveToSheets}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save to Google Sheets'}
            </button>
          )}

          {files.length > 0 && (
            <button style={{ ...s.btn, ...s.btnGray }} onClick={clear}>
              Clear All
            </button>
          )}
        </div>

        {status && (
          <div style={{ ...s.statusBox, ...(status.startsWith('Error') ? s.statusError : s.statusOk) }}>
            {status}
          </div>
        )}

        {results.length > 0 && (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>File</th>
                  {COLS.map(c => <th key={c.key} style={s.th}>{c.label}</th>)}
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={r._error ? s.rowError : {}}>
                    <td style={s.td}>{r.filename}</td>
                    {COLS.map(c => (
                      <td key={c.key} style={{ ...s.td, ...(c.key === 'vin' ? s.mono : {}) }}>
                        {r._error ? '' : (r[c.key] || <span style={s.empty}>—</span>)}
                      </td>
                    ))}
                    <td style={{ ...s.td, color: r._error ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
                      {r._error ? `✗ ${r._error}` : '✓ OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  card: { maxWidth: 1100, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '2rem' },
  h1: { margin: '0 0 0.25rem', fontSize: '1.6rem', fontWeight: 700, color: '#0f172a' },
  sub: { margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.95rem' },
  dropzone: { border: '2px dashed #cbd5e1', borderRadius: 10, padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', marginBottom: '1rem', background: '#f8fafc' },
  dropzoneActive: { borderColor: '#3b82f6', background: '#eff6ff' },
  dropIcon: { fontSize: '2.5rem', marginBottom: '0.5rem' },
  dropText: { margin: '0 0 0.25rem', fontWeight: 600, color: '#334155' },
  dropHint: { margin: 0, color: '#94a3b8', fontSize: '0.85rem' },
  fileList: { marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: 6 },
  fileItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.6rem', background: '#f1f5f9', borderRadius: 6 },
  fileName: { flex: 1, fontSize: '0.875rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileSize: { fontSize: '0.8rem', color: '#94a3b8', flexShrink: 0 },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.85rem', padding: '0 2px', lineHeight: 1 },
  btnRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1rem' },
  btn: { padding: '0.55rem 1.25rem', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'opacity 0.15s' },
  btnBlue: { background: '#2563eb', color: '#fff' },
  btnGreen: { background: '#16a34a', color: '#fff' },
  btnGray: { background: '#e2e8f0', color: '#475569' },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  statusBox: { padding: '0.7rem 1rem', borderRadius: 7, marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 },
  statusOk: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
  statusError: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
  tableWrap: { overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' },
  th: { padding: '0.6rem 0.75rem', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' },
  td: { padding: '0.55rem 0.75rem', borderBottom: '1px solid #f1f5f9', color: '#0f172a', verticalAlign: 'top' },
  rowError: { background: '#fff5f5' },
  mono: { fontFamily: 'monospace', fontSize: '0.8rem' },
  empty: { color: '#cbd5e1' },
};