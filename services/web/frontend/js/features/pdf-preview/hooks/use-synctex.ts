import { useCallback, useEffect, useState, useRef } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import { getJSON } from '../../../infrastructure/fetch-json'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import useIsMounted from '../../../shared/hooks/use-is-mounted'
import useAbortController from '../../../shared/hooks/use-abort-controller'
import useDetachState from '../../../shared/hooks/use-detach-state'
import useDetachAction from '../../../shared/hooks/use-detach-action'
import localStorage from '../../../infrastructure/local-storage'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import useScopeEventListener from '../../../shared/hooks/use-scope-event-listener'
import { debugConsole } from '@/utils/debugging'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import useEventListener from '@/shared/hooks/use-event-listener'
import { CursorPosition } from '@/features/ide-react/types/cursor-position'
import { isValidTeXFile } from '@/main/is-valid-tex-file'
import { PdfScrollPosition } from '@/shared/hooks/use-pdf-scroll-position'
import {
  showFileErrorToast,
  showSynctexRequestErrorToast,
} from '@/features/pdf-preview/components/synctex-toasts'

export default function useSynctex(): {
  syncToPdf: () => void
  syncToCode: ({ visualOffset }: { visualOffset?: number }) => void
  syncToPdfInFlight: boolean
  syncToCodeInFlight: boolean
  canSyncToPdf: boolean
} {
  const { projectId, project } = useProjectContext()
  const rootDocId = project?.rootDocId

  const { clsiServerId, pdfFile, position, setShowLogs, setHighlights } =
    useCompileContext()

  const { selectedEntities } = useFileTreeData()
  const { findEntityByPath, dirname, pathInFolder } = useFileTreePathContext()
  const { openDocName } = useEditorOpenDocContext()
  const { getCurrentDocumentId, openDocWithId } = useEditorManagerContext()

  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(
    () => {
      const position = localStorage.getItem(
        `doc.position.${getCurrentDocumentId()}`
      )
      return position ? position.cursorPosition : null
    }
  )

  const isMounted = useIsMounted()

  const { signal } = useAbortController()

  useEventListener(
    'cursor:editor:update',
    useCallback((event: CustomEvent) => setCursorPosition(event.detail), [])
  )

  const [syncToPdfInFlight, setSyncToPdfInFlight] = useState(false)
  const [syncToCodeInFlight, setSyncToCodeInFlight] = useDetachState(
    'sync-to-code-inflight',
    false,
    'detacher',
    'detached'
  )

  const getCurrentFilePath = useCallback(() => {
    const docId = getCurrentDocumentId()

    if (!docId || !rootDocId) {
      return null
    }

    let path = pathInFolder(docId)

    if (!path) {
      return null
    }

    // If the root file is folder/main.tex, then synctex sees the path as folder/./main.tex
    const rootDocDirname = dirname(rootDocId)

    if (rootDocDirname) {
      path = path.replace(RegExp(`^${rootDocDirname}`), `${rootDocDirname}/.`)
    }

    return path
  }, [dirname, getCurrentDocumentId, pathInFolder, rootDocId])

  const goToCodeLine = useCallback(
    (file?: string, line?: number, selectText?: string) => {
      if (file) {
        const doc = findEntityByPath(file)?.entity
        if (doc) {
          openDocWithId(doc._id, {
            gotoLine: line,
            selectText,
          })
          return
        }
      }
      showFileErrorToast()
    },
    [findEntityByPath, openDocWithId]
  )

  const goToPdfLocation = useCallback(
    (params: string) => {
      setSyncToPdfInFlight(true)

      if (clsiServerId) {
        params += `&clsiserverid=${clsiServerId}`
      }
      if (pdfFile?.editorId) params += `&editorId=${pdfFile.editorId}`
      if (pdfFile?.build) params += `&buildId=${pdfFile.build}`

      getJSON(`/project/${projectId}/sync/code?${params}`, { signal })
        .then(data => {
          setShowLogs(false)
          setHighlights(data.pdf)
        })
        .catch(error => {
          showSynctexRequestErrorToast()
          debugConsole.error(error)
        })
        .finally(() => {
          if (isMounted.current) {
            setSyncToPdfInFlight(false)
          }
        })
    },
    [
      pdfFile,
      clsiServerId,
      isMounted,
      projectId,
      setShowLogs,
      setHighlights,
      setSyncToPdfInFlight,
      signal,
    ]
  )

  const cursorPositionRef = useRef(cursorPosition)

  useEffect(() => {
    cursorPositionRef.current = cursorPosition
  }, [cursorPosition])

  const syncToPdf = useCallback(() => {
    const file = getCurrentFilePath()

    if (cursorPositionRef.current) {
      const { row, column } = cursorPositionRef.current

      const params = new URLSearchParams({
        file: file ?? '',
        line: String(row + 1),
        column: String(column),
      }).toString()

      goToPdfLocation(params)
    }
  }, [getCurrentFilePath, goToPdfLocation])

  useScopeEventListener(
    'cursor:editor:syncToPdf',
    useCallback(() => {
      syncToPdf()
    }, [syncToPdf])
  )

  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])

  const _syncToCode = useCallback(
    ({
      position = positionRef.current,
      selectText,
      visualOffset = 0,
    }: {
      position?: PdfScrollPosition
      selectText?: string
      visualOffset?: number
    }) => {
      if (!position) {
        return
      }

      setSyncToCodeInFlight(true)
      // FIXME: this actually works better if it's halfway across the
      // page (or the visible part of the page). Synctex doesn't
      // always find the right place in the file when the point is at
      // the edge of the page, it sometimes returns the start of the
      // next paragraph instead.
      const h = position.offset.left

      // Compute the vertical position to pass to synctex, which
      // works with coordinates increasing from the top of the page
      // down.  This matches the browser's DOM coordinate of the
      // click point, but the pdf position is measured from the
      // bottom of the page so we need to invert it.
      let v = 0
      if (position.pageSize?.height) {
        v += position.pageSize.height - position.offset.top // measure from pdf point (inverted)
      } else {
        v += position.offset.top // measure from html click position
      }
      v += visualOffset

      const params = new URLSearchParams({
        page: position.page + 1,
        h: h.toFixed(2),
        v: v.toFixed(2),
      })

      if (clsiServerId) {
        params.set('clsiserverid', clsiServerId)
      }
      if (pdfFile?.editorId) params.set('editorId', pdfFile.editorId)
      if (pdfFile?.build) params.set('buildId', pdfFile.build)

      getJSON(`/project/${projectId}/sync/pdf?${params}`, { signal })
        .then(data => {
          const [{ file, line }] = data.code
          goToCodeLine(file, line, selectText)
        })
        .catch(error => {
          debugConsole.error(error)
          showSynctexRequestErrorToast()
        })
        .finally(() => {
          if (isMounted.current) {
            setSyncToCodeInFlight(false)
          }
        })
    },
    [
      pdfFile,
      clsiServerId,
      projectId,
      signal,
      isMounted,
      setSyncToCodeInFlight,
      goToCodeLine,
    ]
  )

  const syncToCode = useDetachAction(
    'sync-to-code',
    _syncToCode,
    'detached',
    'detacher'
  )

  useEventListener(
    'synctex:sync-to-position',
    useCallback((event: CustomEvent) => syncToCode(event.detail), [syncToCode])
  )

  const [hasSingleSelectedDoc, setHasSingleSelectedDoc] = useDetachState(
    'has-single-selected-doc',
    false,
    'detacher',
    'detached'
  )

  useEffect(() => {
    if (selectedEntities.length !== 1) {
      setHasSingleSelectedDoc(false)
      return
    }

    if (selectedEntities[0].type !== 'doc') {
      setHasSingleSelectedDoc(false)
      return
    }

    setHasSingleSelectedDoc(true)
  }, [selectedEntities, setHasSingleSelectedDoc])

  const canSyncToPdf: boolean =
    hasSingleSelectedDoc &&
    cursorPosition &&
    openDocName &&
    isValidTeXFile(openDocName)

  return {
    syncToCode,
    syncToPdf,
    syncToPdfInFlight,
    syncToCodeInFlight,
    canSyncToPdf,
  }
}
