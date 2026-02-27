import { useCallback, useEffect, useRef, useState } from 'react'
import path from 'path-browserify'
import OLButton from '@/shared/components/ol/ol-button'
import OLButtonToolbar from '@/shared/components/ol/ol-button-toolbar'
import MaterialIcon from '@/shared/components/material-icon'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'
import { PyodideWorkerClient } from './pyodide-worker-client'

export default function PythonOutputPane() {
  const { currentDocument, currentDocumentId } = useEditorOpenDocContext()
  const { pathInFolder } = useFileTreePathContext()
  const clientRef = useRef<PyodideWorkerClient | null>(null)
  const currentRequestIdRef = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isLoadingPyodide, setIsLoadingPyodide] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const appendOutput = useCallback((line: string) => {
    setOutput(previousOutput => [...previousOutput, line])
  }, [])

  useEffect(() => {
    const baseAssetPath = new URL(
      getMeta('ol-baseAssetPath'),
      window.location.href
    ).toString()
    const client = new PyodideWorkerClient({ baseAssetPath })
    clientRef.current = client
    let cancelled = false

    client.setLifecycleCallback(event => {
      if (cancelled) {
        return
      }

      switch (event.type) {
        case 'loaded':
          setIsReady(true)
          setIsLoadingPyodide(false)
          return

        case 'loading-failed':
          debugConsole.error('Failed to load Python runtime', event.error)
          setError(formatError(event.error))
          setIsLoadingPyodide(false)
          setIsRunning(false)
          return

        case 'run-finished':
          if (event.requestId !== currentRequestIdRef.current) {
            return
          }
          currentRequestIdRef.current = null
          setIsRunning(false)
          break
      }
    })

    client.setOutputCallback((_stream, line, requestId) => {
      if (!requestId || requestId !== currentRequestIdRef.current) {
        return
      }
      appendOutput(line)
    })

    return () => {
      cancelled = true
      currentRequestIdRef.current = null
      client.destroy()
      clientRef.current = null
    }
  }, [appendOutput])

  useEffect(() => {
    currentRequestIdRef.current = null
    setIsRunning(false)
    setOutput([])
    setError(null)
  }, [currentDocumentId])

  const buildCurrentDocumentSyncFile = useCallback(() => {
    if (!currentDocument || !currentDocumentId) {
      return null
    }

    const content = currentDocument.getSnapshot()
    if (typeof content !== 'string') {
      return null
    }

    const currentPath = pathInFolder(currentDocumentId)
    if (!currentPath) {
      throw new Error(
        'Unable to resolve current document path for Python sync.'
      )
    }

    return {
      relativePath: path.posix.normalize(currentPath),
      content,
    }
  }, [currentDocument, currentDocumentId, pathInFolder])

  const handleRun = useCallback(() => {
    const client = clientRef.current
    if (!client || !isReady) {
      return
    }

    const syncFile = buildCurrentDocumentSyncFile()
    if (!syncFile) {
      return
    }

    setOutput([])
    setError(null)

    const requestId = syncFile.relativePath
    currentRequestIdRef.current = requestId
    setIsRunning(true)

    try {
      client.runCode(syncFile.content, { requestId, files: [syncFile] })
    } catch (runError) {
      if (currentRequestIdRef.current !== requestId) {
        return
      }
      currentRequestIdRef.current = null
      setIsRunning(false)
      setError(formatError(runError))
    }
  }, [buildCurrentDocumentSyncFile, isReady])

  return (
    <div className="ide-redesign-python-output-pane">
      <OLButtonToolbar className="toolbar toolbar-pdf toolbar-pdf-hybrid">
        <div className="toolbar-pdf-left">
          <div className="compile-button-group">
            <OLButton
              onClick={handleRun}
              variant="primary"
              className="compile-button align-items-center py-0 px-3"
              disabled={!isReady || isLoadingPyodide || isRunning}
              aria-label="Run Python Code"
              style={{ borderRadius: '12px' }}
            >
              {isRunning ? 'Running...' : 'Run'}
              <MaterialIcon type="play_arrow" className="ml-2" />
            </OLButton>
          </div>
        </div>
      </OLButtonToolbar>

      <div className="ide-redesign-python-output-pane-body">
        {isLoadingPyodide && (
          <div className="ide-redesign-python-output-pane-placeholder">
            Loading Python runtime...
          </div>
        )}
        {!isLoadingPyodide && !error && output.length === 0 && (
          <div className="ide-redesign-python-output-pane-placeholder">
            Run the current script to see output.
          </div>
        )}
        {error && (
          <div className="ide-redesign-python-output-pane-error">{error}</div>
        )}
        {output.map((line, index) => (
          <div className="ide-redesign-python-output-pane-line" key={index}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
