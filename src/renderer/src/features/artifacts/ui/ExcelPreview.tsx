import { useEffect, useState } from 'react'

import { fs } from '@/lib/electron-api'
import { cn } from '@/lib/utils'
import JSZip from 'jszip'
import { ExternalLink, FileSpreadsheet, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'

import { FileTooLarge } from './FileTooLarge'
import type { ExcelSheet, PreviewComponentProps } from '../model/types'
import { isRemoteUrl, MAX_PREVIEW_SIZE, openFileExternal } from '../model/utils'

export function ExcelPreview({ artifact }: PreviewComponentProps) {
  const [sheets, setSheets] = useState<ExcelSheet[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileTooLarge, setFileTooLarge] = useState<number | null>(null)

  const handleOpenExternal = () => {
    if (artifact.path) {
      openFileExternal(artifact.path)
    }
  }

  useEffect(() => {
    async function loadExcel() {
      if (!artifact.path) {
        setError('No Excel file path available')
        setLoading(false)
        return
      }

      console.log('[Excel Preview] Loading Excel from path:', artifact.path)

      try {
        if (!isRemoteUrl(artifact.path)) {
          const fileInfo = await fs.stat(artifact.path)
          if (fileInfo.size > MAX_PREVIEW_SIZE) {
            console.log('[Excel Preview] File too large:', fileInfo.size)
            setFileTooLarge(fileInfo.size)
            setLoading(false)
            return
          }
        }

        let arrayBuffer: ArrayBuffer

        if (isRemoteUrl(artifact.path)) {
          console.log('[Excel Preview] Fetching remote Excel...')
          const url = artifact.path.startsWith('//') ? `https:${artifact.path}` : artifact.path
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch Excel: ${response.status} ${response.statusText}`)
          }
          arrayBuffer = await response.arrayBuffer()
        } else {
          console.log('[Excel Preview] Reading local Excel file...')
          const data = await fs.readFile(artifact.path)
          arrayBuffer = data.slice().buffer
        }

        console.log('[Excel Preview] Loaded', arrayBuffer.byteLength, 'bytes')

        let workbook: XLSX.WorkBook | null = null

        try {
          workbook = XLSX.read(arrayBuffer, { type: 'array' })
        } catch (xlsxError) {
          console.log('[Excel Preview] Direct parsing failed, trying JSZip decompress:', xlsxError)

          try {
            const zip = await JSZip.loadAsync(arrayBuffer)
            const newZip = new JSZip()

            const files = Object.keys(zip.files)
            for (const fileName of files) {
              const file = zip.files[fileName]
              if (!file.dir) {
                const content = await file.async('uint8array')
                newZip.file(fileName, content, { compression: 'DEFLATE' })
              }
            }

            const recompressedData = await newZip.generateAsync({
              type: 'uint8array',
              compression: 'DEFLATE',
              compressionOptions: { level: 6 }
            })

            workbook = XLSX.read(recompressedData, { type: 'array' })
          } catch (jsZipError) {
            console.error('[Excel Preview] JSZip fallback also failed:', jsZipError)
            throw xlsxError
          }
        }

        if (!workbook) {
          throw new Error('Failed to parse Excel file')
        }

        const parsedSheets: ExcelSheet[] = []

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
            header: 1,
            defval: ''
          })
          parsedSheets.push({
            name: sheetName,
            data: jsonData
          })
        }

        console.log('[Excel Preview] Parsed', parsedSheets.length, 'sheets')
        setSheets(parsedSheets)
        setError(null)
      } catch (err) {
        console.error('[Excel Preview] Failed to load Excel:', err)
        const errorMsg = err instanceof Error ? err.message : String(err)
        setError(errorMsg)
      } finally {
        setLoading(false)
      }
    }

    void loadExcel()
  }, [artifact.path])

  if (loading) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
        <p className="text-muted-foreground mt-4 text-sm">Loading Excel...</p>
      </div>
    )
  }

  if (fileTooLarge !== null) {
    return (
      <FileTooLarge
        artifact={artifact}
        fileSize={fileTooLarge}
        icon={FileSpreadsheet}
        onOpenExternal={handleOpenExternal}
      />
    )
  }

  if (error || sheets.length === 0) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <FileSpreadsheet className="size-10 text-green-600" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">{artifact.name}</h3>
          <p className="text-muted-foreground mb-4 text-sm break-all whitespace-pre-wrap">
            {error || 'No data available'}
          </p>
          <button
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <ExternalLink className="size-4" />
            Open in Excel
          </button>
        </div>
      </div>
    )
  }

  const currentSheet = sheets[activeSheet]

  return (
    <div className="flex h-full flex-col">
      {sheets.length > 1 && (
        <div className="border-border bg-muted/30 flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={cn(
                'shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                index === activeSheet
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-background flex-1 overflow-auto">
        {currentSheet && currentSheet.data.length > 0 ? (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted sticky top-0 z-10">
              {currentSheet.data.length > 0 && (
                <tr>
                  <th className="border-border bg-muted text-muted-foreground sticky left-0 z-20 w-10 border px-2 py-2 text-center text-xs font-medium">
                    #
                  </th>
                  {currentSheet.data[0].map((cell, i) => (
                    <th
                      key={i}
                      className="border-border text-foreground min-w-[100px] border px-3 py-2 text-left font-medium"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {currentSheet.data.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/50">
                  <td className="border-border bg-muted/50 text-muted-foreground sticky left-0 border px-2 py-2 text-center text-xs">
                    {rowIndex + 2}
                  </td>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border-border text-foreground border px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Empty sheet
          </div>
        )}
      </div>

      <div className="border-border bg-muted/30 text-muted-foreground shrink-0 border-t px-3 py-1.5 text-xs">
        {currentSheet && (
          <span>
            {currentSheet.data.length} rows × {currentSheet.data[0]?.length || 0} columns
          </span>
        )}
      </div>
    </div>
  )
}
