import { useState, useEffect, useCallback, useRef } from 'react'

function App() {
  const [status, setStatus] = useState('idle')
  const [jobId, setJobId] = useState(null)
  const [columns, setColumns] = useState([])
  const [imageColumns, setImageColumns] = useState([])
  const [selectedColumns, setSelectedColumns] = useState([])
  const [preview, setPreview] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [summary, setSummary] = useState({ ok: 0, errors: 0, skipped: 0 })
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const poll = useCallback(async () => {
    if (!jobId || status !== 'processing') return
    try {
      const res = await fetch(`/api/status/${jobId}`)
      const data = await res.json()
      setProgress(data.progress)
      setSummary(data.summary || { ok: 0, errors: 0, skipped: 0 })
      if (data.status === 'done') { setStatus('done'); setResults(data.results || []); setSummary(data.summary) }
      else if (data.status === 'error') { setStatus('error'); setError(data.error) }
    } catch (e) { /* ignore */ }
  }, [jobId, status])

  useEffect(() => {
    if (status === 'processing') {
      const id = setInterval(poll, 2000)
      return () => clearInterval(id)
    }
  }, [status, poll])

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true); setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setJobId(data.jobId); setColumns(data.columns)
      setImageColumns(data.imageColumns)
      setSelectedColumns(data.primaryColumn ? [data.primaryColumn] : [])
      setPreview(data.preview); setTotalRows(data.totalRows)
      setStatus('uploaded')
    } catch (e) { setError(e.message) }
    finally { setUploading(false) }
  }

  const handleProcess = async () => {
    if (selectedColumns.length === 0) { setError('Selecione pelo menos uma coluna de imagem'); return }
    setError(null)
    try {
      const res = await fetch('/api/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, selectedColumns }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProgress({ current: 0, total: data.totalImages })
      setStatus('processing')
    } catch (e) { setError(e.message) }
  }

  const handleReset = () => {
    setStatus('idle'); setJobId(null); setColumns([]); setImageColumns([])
    setSelectedColumns([]); setPreview([]); setResults([])
    setProgress({ current: 0, total: 0 }); setSummary({ ok: 0, errors: 0, skipped: 0 }); setError(null)
  }

  const toggleColumn = (col) => {
    setSelectedColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])
  }

  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#232F3E' }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span style={{ color: '#FF9900' }} className="text-2xl">⚡</span>
            <h1 className="text-white text-xl font-bold tracking-tight">Acelerador de Listagem</h1>
          </div>
          {status !== 'idle' && (
            <button onClick={handleReset} className="text-sm text-gray-300 hover:text-white transition-colors">← Nova conversão</button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">

        {/* === IDLE: Upload === */}
        {status === 'idle' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold" style={{ color: '#0F1111' }}>
                Converta suas imagens para o padrão Amazon em segundos
              </h2>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200/60 p-8">
              <div
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all"
                style={{ borderColor: dragging ? '#FF9900' : 'rgba(255,153,0,0.4)', background: dragging ? '#FFF8F0' : 'transparent' }}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Spinner />
                    <p className="font-medium" style={{ color: '#0F1111' }}>Lendo planilha...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,153,0,0.1)' }}>
                      <svg className="w-8 h-8" style={{ color: '#FF9900' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-lg" style={{ color: '#0F1111' }}>Arraste sua planilha aqui</p>
                      <p className="text-gray-500 text-sm mt-1">ou clique para selecionar • .xlsx, .xls, .csv</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => handleFile(e.target.files[0])} className="hidden" />
              <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Seus dados estão seguros
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <Badge text="Processamento automático" />
              <Badge text="Padrão Amazon garantido" />
              <Badge text="Links prontos para Seller Central" />
            </div>
          </div>
        )}

        {/* === UPLOADED: Column selection === */}
        {status === 'uploaded' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200/60 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#0F1111' }}>{totalRows} produtos encontrados</h2>
                  <p className="text-sm text-gray-500">Selecione as colunas com links de imagem:</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {imageColumns.length > 1 && (
                  <label className="flex items-center gap-2.5 text-sm text-gray-600 pb-2 border-b border-gray-200 mb-2 cursor-pointer">
                    <input type="checkbox" checked={selectedColumns.length === imageColumns.length}
                      onChange={(e) => setSelectedColumns(e.target.checked ? [...imageColumns] : [])}
                      className="rounded w-4 h-4" style={{ accentColor: '#FF9900' }} />
                    <span className="font-medium">Selecionar todas ({imageColumns.length} colunas)</span>
                  </label>
                )}
                {imageColumns.map(col => (
                  <label key={col} className="flex items-center gap-2.5 text-sm cursor-pointer py-1">
                    <input type="checkbox" checked={selectedColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                      className="rounded w-4 h-4" style={{ accentColor: '#FF9900' }} />
                    <span style={{ color: '#0F1111' }}>{col}</span>
                    {selectedColumns.length === 1 && selectedColumns[0] === col && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(255,153,0,0.1)', color: '#FF9900' }}>principal</span>
                    )}
                  </label>
                ))}
                {imageColumns.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">Nenhuma coluna de imagem detectada. Selecione manualmente:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {columns.map(col => (
                        <button key={col} onClick={() => toggleColumn(col)}
                          className="px-3 py-1 rounded-full text-xs border transition-colors"
                          style={selectedColumns.includes(col) ? { background: '#FF9900', color: '#fff', borderColor: '#FF9900' } : { borderColor: '#D5D9D9' }}
                        >{col}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleProcess} disabled={selectedColumns.length === 0}
                className="w-full py-3 rounded-full font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#FF9900', color: '#0F1111' }}>
                Converter Imagens
              </button>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200/60 overflow-hidden">
              <div className="px-5 py-3 border-b" style={{ background: '#F7F8F8' }}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead style={{ background: '#F7F8F8' }}>
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="px-3 py-2.5 text-left font-medium whitespace-nowrap"
                          style={{ color: selectedColumns.includes(col) ? '#FF9900' : '#6b7280' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map(col => (
                          <td key={col} className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{row[col] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* === PROCESSING === */}
        {status === 'processing' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-xl shadow-md border border-gray-200/60 p-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5 animate-pulse" style={{ background: 'rgba(255,153,0,0.1)' }}>
                <svg className="w-8 h-8" style={{ color: '#FF9900' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-bold text-lg" style={{ color: '#0F1111' }}>
                Processando imagem {progress.current} de {progress.total}...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-5 overflow-hidden">
                <div className="h-2.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: '#FF9900' }} />
              </div>
              <p className="text-xs text-gray-400 mt-4">Removendo fundo • Redimensionando 2000×2000 • Upload ImgBB</p>
            </div>
          </div>
        )}

        {/* === DONE === */}
        {status === 'done' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200/60 p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(6,125,98,0.1)' }}>
                  <svg className="w-6 h-6" style={{ color: '#067D62' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#0F1111' }}>Conversão concluída!</h2>
                  <p className="text-sm text-gray-500">
                    {summary.ok} OK, {summary.errors} erros, {summary.skipped} sem URL
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a href={`/api/download/${jobId}/excel`}
                  className="py-3 rounded-full font-semibold text-center shadow-sm flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ background: '#FF9900', color: '#0F1111' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Baixar Planilha
                </a>
                <a href={`/api/download/${jobId}/images`}
                  className="py-3 rounded-full font-medium text-center text-white flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ background: '#232F3E' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Baixar Imagens (.zip)
                </a>
              </div>
              <button onClick={handleReset} className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 py-2">Converter outra planilha</button>
            </div>

            {/* Before/After */}
            {results.filter(r => r.success).length > 0 && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200/60 p-6">
                <h3 className="font-bold mb-4" style={{ color: '#0F1111' }}>Antes / Depois</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {results.filter(r => r.success).slice(0, 12).map((r, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="grid grid-cols-2 divide-x divide-gray-200">
                        <div className="p-1.5">
                          <p className="text-[9px] text-gray-400 text-center mb-0.5">ANTES</p>
                          <img src={r.originalUrl} alt="" className="w-full aspect-square object-contain bg-gray-100 rounded" loading="lazy" />
                        </div>
                        <div className="p-1.5">
                          <p className="text-[9px] text-center mb-0.5 font-medium" style={{ color: '#067D62' }}>DEPOIS</p>
                          <img src={r.newUrl.startsWith('http') ? r.newUrl : `/images/${r.finalPath?.split(/[/\\]/).pop()}`} alt="" className="w-full aspect-square object-contain bg-white rounded border border-gray-100" loading="lazy" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.errors > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800">⚠️ {summary.errors} imagem(ns) com erro — URLs originais mantidas na planilha</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </main>

      <footer className="py-6 text-center">
        <p className="text-xs text-gray-400">Ferramenta interna Amazon © 2026</p>
      </footer>
    </div>
  )
}

function Badge({ text }) {
  return (
    <div className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(15,17,17,0.7)' }}>
      <svg className="w-4 h-4" style={{ color: '#067D62' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      {text}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-8 w-8 mx-auto" style={{ color: '#FF9900' }} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default App
