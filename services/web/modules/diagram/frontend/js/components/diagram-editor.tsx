import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useLayoutContext } from '@/shared/context/layout-context'

import { blankDiagram, svgDimensions, toSvgDocument } from '../util/diagram-model'
import {
  companionFileName,
  findParentFolderId,
  type TreeNode,
} from '../util/diagram-utils'
import { svgToPdfBlob, svgToPngBlob } from '../util/diagram-export'
import './diagram-editor.css'

const STARTUP_TIMEOUT_MS = 30_000
const STATUS_TTL_MS = 4_000

/** Contract of the embedded app's bridge (public/static/svgedit/embed.js). */
type EmbedApi = {
  ready: boolean
  load: (svg: string) => Promise<void>
  getSvg: () => string
  onChanged: (cb: (svg: string) => void) => void
}

function embedUrl (baseName: string): string {
  // `storagePrompt=false` is a second layer of defence for the case the
  // storage extension is ever re-enabled — the prompt must stay closed.
  return (
    '/static/svgedit/embed.html?name=' +
    encodeURIComponent(baseName) +
    '&storagePrompt=false'
  )
}

/**
 * Diagram editor for `.svg` documents (registered through Overleaf's
 * `visualEditorProviders` hook — it replaces the code editor in the editor
 * pane; "Code | Visual" switches to the raw SVG source).
 *
 * Implementation: the full SVG-Edit 7.4.2 app (MIT/permissive OR-license,
 * vendored under `public/static/svgedit/` — license + provenance in
 * modules/diagram/README.md) runs in a SAME-ORIGIN IFRAME and talks to us
 * through a tiny bridge (`window.__olSvgEmbed`):
 *
 *   - we push the document's SVG in on boot (`load`),
 *   - it pushes debounced canvas content back out (`onChanged`), which we
 *     write into the CodeMirror-backed document (Overleaf's sync/version
 *     history then tracks it as usual),
 *   - "Save" additionally re-creates the companion `name.png` bitmap and
 *     `name.pdf` VECTOR file for `\includegraphics`.
 *
 * The iframe isolates the third-party app (its document-level keyboard
 * handlers, cookie usage, focus behaviour, CSS) from the rest of Overleaf,
 * while the document itself stays Overleaf-owned.
 */
export default function DiagramEditorWrapper () {
  const { openDocName } = useEditorOpenDocContext()
  if (!openDocName || !openDocName.endsWith('.svg')) {
    return null
  }
  return <DiagramEditor />
}

function DiagramEditor () {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const apiRef = useRef<EmbedApi | null>(null)
  // Suppress canvas->document echoes caused by our own `load()` while the
  // app bootstraps (otherwise opening the file marks it dirty).
  const suppressRef = useRef(true)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSerialisedRef = useRef('')

  const { getCurrentDocValue } = useEditorManagerContext()
  const { currentDocumentId, openDocName } = useEditorOpenDocContext()
  const cmView = useCodeMirrorViewContext()
  const { projectId } = useProjectContext()
  const { fileTreeData } = useFileTreeData()
  const { focusMode, setFocusMode } = useLayoutContext()

  const [startupFailed, setStartupFailed] = useState(false)
  const [importFailed, setImportFailed] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState<{
    text: string
    kind: 'success' | 'error'
  } | null>(null)

  const baseName = (openDocName || 'diagram.svg').split('/').pop() || 'diagram.svg'

  // ---- status pill ---------------------------------------------------------
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusSeqRef = useRef(0)
  const showStatus = useCallback((text: string, kind: 'success' | 'error') => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    const seq = ++statusSeqRef.current
    setStatus({ text, kind })
    statusTimerRef.current = setTimeout(() => {
      if (statusSeqRef.current === seq) setStatus(null)
    }, STATUS_TTL_MS)
  }, [])
  useEffect(
    () => () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    },
    []
  )

  // ---- focus mode: the editor pane must have real width ---------------------
  const hadFocusModeRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (hadFocusModeRef.current === null) {
      hadFocusModeRef.current = focusMode
      setFocusMode(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(
    () => () => {
      if (hadFocusModeRef.current === false) {
        setFocusMode(false)
        hadFocusModeRef.current = null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setFocusMode]
  )

  // ---- document write (CodeMirror is the document; keep it in sync) --------
  const dispatchRef = useRef<(xml: string) => void>(() => {})
  useEffect(() => {
    dispatchRef.current = (xml: string) => {
      if (!cmView) return
      try {
        if (cmView.state.doc.toString() === xml) return // no-op, never dirties
        cmView.dispatch({
          changes: { from: 0, to: cmView.state.doc.length, insert: xml },
        })
      } catch (e) {
        // The document may already be closed; ignore.
      }
    }
  }, [cmView])

  const getDocValueRef = useRef<() => string | null | undefined>(() => null)
  useEffect(() => {
    getDocValueRef.current = () => getCurrentDocValue()
  }, [getCurrentDocValue])

  const treeRef = useRef<{
    currentDocumentId: string | null
    openDocName: string | null
    fileTreeData: TreeNode | null
  }>({ currentDocumentId: null, openDocName: null, fileTreeData: null })
  useEffect(() => {
    treeRef.current = {
      currentDocumentId,
      openDocName,
      fileTreeData: (fileTreeData as unknown as TreeNode) ?? null,
    }
  }, [currentDocumentId, openDocName, fileTreeData])

  // ---- boot: wait for the embedded app's bridge, then load the document ----
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    let disposed = false
    let poll: ReturnType<typeof setInterval> | null = null

    const wire = (api: EmbedApi) => {
      if (apiRef.current || disposed) return
      apiRef.current = api
      api.onChanged((svg) => {
        if (disposed || suppressRef.current) return
        if (svg === lastSerialisedRef.current) return
        lastSerialisedRef.current = svg
        dispatchRef.current(svg)
      })
      const raw = getDocValueRef.current()
      const wasBlank = toSvgDocument(raw) === null
      const source = toSvgDocument(raw) ?? blankDiagram()
      void (async () => {
        try {
          await api.load(source)
          // Remember the app's own serialisation so the next canvas
          // echo (attribute reordering etc.) is a no-op.
          lastSerialisedRef.current = api.getSvg() || source
          if (wasBlank) {
            // New file with no content: give the document a canonical blank
            // SVG immediately (the canvas already shows exactly that state).
            dispatchRef.current(source)
          }
          setImportFailed(false)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('diagram: could not load document content into the canvas', err)
          setImportFailed(true)
        } finally {
          if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
          suppressTimerRef.current = setTimeout(() => {
            suppressRef.current = false
          }, 400)
        }
      })()
    }

    const started = Date.now()
    const tick = () => {
      if (disposed) return
      try {
        const win = iframe.contentWindow as
          | (Window & { __olSvgEmbed?: EmbedApi })
          | null
        const api = win ? win.__olSvgEmbed : null
        if (
          api &&
          typeof api.load === 'function' &&
          typeof api.onChanged === 'function'
        ) {
          wire(api)
          return
        }
      } catch (e) {
        // Cross-frame access not possible yet (frame still loading).
      }
      if (Date.now() - started > STARTUP_TIMEOUT_MS) {
        if (poll) clearInterval(poll)
        setStartupFailed(true)
      }
    }
    tick()
    poll = setInterval(tick, 100)

    return () => {
      disposed = true
      if (poll) clearInterval(poll)
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    }
  }, [])

  // ---- uploads (companions) -------------------------------------------------
  const uploadBlob = useCallback(
    async (
      blob: Blob,
      fileName: string,
      folderId: string | null,
      contentType?: string
    ) => {
      const formData = new FormData()
      const uploadBlobTarget =
        contentType && blob.type !== contentType
          ? new Blob([blob], { type: contentType })
          : blob
      formData.append('qqfile', uploadBlobTarget, fileName)
      formData.append('name', fileName)
      const csrfToken = (getMeta('ol-csrfToken') as string) || ''
      const res = await fetch(
        `/project/${projectId}/upload?folder_id=${encodeURIComponent(
          folderId || ''
        )}`,
        {
          method: 'POST',
          headers: { 'X-CSRF-TOKEN': csrfToken },
          body: formData,
        }
      )
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`)
      }
    },
    [projectId]
  )

  const folderIdForDoc = useCallback(() => {
    const { currentDocumentId, fileTreeData: tree } = treeRef.current
    if (currentDocumentId && tree) {
      return findParentFolderId(tree, currentDocumentId) || tree._id || ''
    }
    return tree?._id || ''
  }, [])

  // ---- save (SVG source) + companions (PNG + vector PDF) -------------------
  const saveAndExport = useCallback(async () => {
    const api = apiRef.current
    const canvasSvg = api ? api.getSvg() : ''
    const svg =
      canvasSvg && canvasSvg.trim().length > 0
        ? canvasSvg
        : toSvgDocument(getDocValueRef.current()) ?? blankDiagram()

    // Write the current canvas state back into the document first — with
    // this bridge the document IS the canvas, kept in sync continuously,
    // this is the same content (no-op unless the echo pipeline lags).
    lastSerialisedRef.current = svg
    dispatchRef.current(svg)

    const { w, h } = svgDimensions(svg)
    const pngW = Math.min(4096, Math.max(200, Math.ceil((w || 842) * 2)))
    const pngH = Math.min(4096, Math.max(200, Math.ceil((h || 595) * 2)))

    if (!/<(rect|circle|ellipse|line|path|polygon|polyline|text|image)\b/i.test(svg)) {
      // Nothing drawn yet — don't upload blank companions over existing ones.
      showStatus(t('diagram_canvas_empty_skip'), 'success')
      return
    }

    try {
      setExporting(true)
      const docName = treeRef.current.openDocName || 'diagram.svg'
      const folderId = folderIdForDoc()

      const png = await svgToPngBlob(svg, pngW, pngH)
      await uploadBlob(png, companionFileName(docName, 'png'), folderId)

      try {
        const pdf = await svgToPdfBlob(svg)
        await uploadBlob(
          pdf,
          companionFileName(docName, 'pdf'),
          folderId,
          'application/pdf'
        )
      } catch (err) {
        // Keep a usable companion so nothing is lost.
        // eslint-disable-next-line no-console
        console.warn('diagram: SVG → PDF conversion failed; uploading SVG', err)
        await uploadBlob(
          new Blob([svg], { type: 'image/svg+xml' }),
          companionFileName(docName, 'svg'),
          folderId,
          'image/svg+xml'
        )
      }
      showStatus(t('diagram_exports_complete'), 'success')
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('diagram: save/export failed', err)
      showStatus(t('diagram_export_failed'), 'error')
    } finally {
      setExporting(false)
    }
  }, [folderIdForDoc, showStatus, t, uploadBlob])

  // ---- render ----------------------------------------------------------------
  return (
    <div className="dg-root">
      <div className="dg-frame">
        {startupFailed ? (
          <div className="dg-fail">
            <p>{t('diagram_open_failed')}</p>
            <span className="dg-hint">{t('diagram_source_hint')}</span>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title={t('diagram_canvas')}
            src={embedUrl(baseName)}
          />
        )}
      </div>

      <div className="dg-footer">
        <span className="dg-hint">{t('diagram_source_hint')}</span>
        {importFailed && (
          <span className="dg-status error">{t('diagram_import_failed')}</span>
        )}
        {status && (
          <span className={`dg-status ${status.kind}`}>{status.text}</span>
        )}
        <button
          type="button"
          className="dg-save"
          disabled={exporting || startupFailed}
          onClick={saveAndExport}
        >
          {exporting ? t('diagram_exporting') : t('save')}
        </button>
      </div>
    </div>
  )
}
