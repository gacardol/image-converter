import { useState, useEffect, useCallback, useRef } from 'react'

function App() {
  const [status, setStatus] = useState('idle') // idle | uploaded | processing | done | error
  const [jobId, setJobId] = useState(null)
  const [columns, setColumns] = useState([])
  const [imageColumns, setImageColumns] = useState([])
  const [selectedColumns, setSelectedColumns] = useState([])
  const [preview, setPreview] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  // Poll status during processing
  const poll = useCallback(async () => {
    if (!jobId || status !== 'processing') return
    try {
      const res = await fetch(`/api/status/${jobId}`)
      const data = await res.json()
      setProgress(data.progress)
      if (data.status === 'done') {
        setStatus('done')
        setResults(data.results || [])
      } else if (data.status === 'error') {
        setStatus('error')
        setError(data.error)
      }
    } catch (e) { /* ignore */ }
  }, [jobId, status])

  useEffect(() => {
    if (status === 'processing') {
      const id = setInterval(poll, 2000)
      return () => clearInterval(id)
    }
  }, [status, poll])

  // Upload file
  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setJobId(data.jobId)
      setColumns(data.columns)
      setImageColumns(data.imageColumns)
      // Only pre-select the primary column
      setSelectedColumns(data.primaryColumn ? [data.primaryColumn] : [])
      setPreview(data.preview)
      setTotalRows(data.totalRows)
      setStatus('uploaded')
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  // Start processing
  const handleProcess = async () => {
    if (selectedColumns.length === 0) {
      setError('Selecione pelo menos uma coluna de imagem')
      return
    }
    setError(null)
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, selectedColumns }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProgress({ current: 0, total: data.totalImages })
      setStatus('processing')
    } catch (e) {
      setError(e.message)
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setJobId(null)
    setColumns([])
    setImageColumns([])
    setSelectedColumns([])
    setPreview([])
    setResults([])
    setProgress({ current: 0, total: 0 })
    setError(null)
  }

  const toggleColumn = (col) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <header className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Conversor de Imagens Amazon</h1>
        <p className="text-gray-500 mt-2">
          Arrume as imagens dos seus produtos no padrão Amazon em segundos
        </p>
      </header>

      {/* Step 1: Upload */}
      {status === 'idle' && (
        <div
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner />
              <p className="text-gray-600">Lendo planilha...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <svg className="w-14 h-14 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="text-gray-700 font-medium text-lg">Arraste sua planilha aqui</p>
                <p className="text-gray-400 text-sm mt-1">.xlsx, .xls ou .csv com links de imagem</p>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => handleFile(e.target.files[0])} className="hidden" />
        </div>
      )}

      {/* Step 2: Column selection */}
      {status === 'uploaded' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{totalRows} produtos encontrados</h2>
                <p className="text-sm text-gray-500">Selecione as colunas que contêm links de imagem:</p>
              </div>
              <button onClick={handleReset} className="text-sm text-gray-400 hover:text-gray-600">← Voltar</button>
            </div>

            {/* Column checkboxes */}
            <div className="space-y-2 mb-6">
              {/* Select all */}
              {imageColumns.length > 1 && (
                <label className="flex items-center gap-2 text-sm text-gray-600 pb-2 border-b mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedColumns.length === imageColumns.length}
                    onChange={(e) => {
                      setSelectedColumns(e.target.checked ? [...imageColumns] : [])
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">Selecionar todas ({imageColumns.length} colunas de imagem)</span>
                </label>
              )}

              {/* Individual columns */}
              {imageColumns.map(col => (
                <label key={col} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-800">{col}</span>
                  {selectedColumns.includes(col) && selectedColumns[0] === col && selectedColumns.length === 1 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">principal</span>
                  )}
                </label>
              ))}

              {imageColumns.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                  Nenhuma coluna de imagem detectada automaticamente. Selecione manualmente abaixo:
                </p>
              )}
            </div>

            {/* Show all columns as fallback if no image columns detected */}
            {imageColumns.length === 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {columns.map(col => (
                  <button
                    key={col}
                    onClick={() => toggleColumn(col)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      selectedColumns.includes(col)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={selectedColumns.length === 0}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Converter Imagens ({selectedColumns.length} coluna{selectedColumns.length !== 1 ? 's' : ''})
            </button>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map(col => (
                      <th key={col} className={`px-3 py-2 text-left font-medium ${
                        selectedColumns.includes(col) ? 'text-blue-700 bg-blue-50' : 'text-gray-500'
                      }`}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {columns.map(col => (
                        <td key={col} className="px-3 py-2 text-gray-700 max-w-[150px] truncate">
                          {row[col] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Processing */}
      {status === 'processing' && (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <Spinner />
          <p className="text-gray-900 font-medium mt-4 text-lg">
            Processando imagem {progress.current} de {progress.total}...
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-700"
              style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-3">
            Baixando, removendo fundo, redimensionando e fazendo upload...
          </p>
        </div>
      )}

      {/* Step 4: Done */}
      {status === 'done' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Conversão concluída!</h2>
                <p className="text-sm text-gray-500">
                  {results.filter(r => r.success).length} de {results.length} imagens convertidas
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href={`/api/download/${jobId}/excel`}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium text-center hover:bg-green-700 transition-colors"
              >
                ⬇ Baixar Planilha
              </a>
              <a
                href={`/api/download/${jobId}/images`}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium text-center hover:bg-blue-700 transition-colors"
              >
                ⬇ Baixar Imagens (.zip)
              </a>
            </div>

            <button onClick={handleReset} className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 py-2">
              Converter outra planilha
            </button>
          </div>

          {/* Before/After previews */}
          {results.filter(r => r.success).length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold mb-4">Antes / Depois</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.filter(r => r.success).slice(0, 9).map((r, i) => (
                  <div key={i} className="border rounded-lg p-2">
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <p className="text-[10px] text-gray-400 text-center mb-1">Original</p>
                        <img src={r.originalUrl} alt="antes" className="w-full aspect-square object-contain bg-gray-100 rounded" loading="lazy" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 text-center mb-1">Amazon</p>
                        <img src={r.newUrl.startsWith('http') ? r.newUrl : `/images/${r.finalPath?.split('/').pop()}`} alt="depois" className="w-full aspect-square object-contain bg-white rounded border" loading="lazy" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed images */}
          {results.filter(r => !r.success).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">
                ⚠️ {results.filter(r => !r.success).length} imagem(ns) não puderam ser convertidas
              </p>
              <p className="text-xs text-amber-700">
                As URLs originais foram mantidas na planilha de saída.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default App
