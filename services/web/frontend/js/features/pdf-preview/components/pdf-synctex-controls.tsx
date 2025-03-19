import classNames from 'classnames'
import { memo, useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import { getJSON } from '../../../infrastructure/fetch-json'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { useTranslation } from 'react-i18next'
import useIsMounted from '../../../shared/hooks/use-is-mounted'
import useAbortController from '../../../shared/hooks/use-abort-controller'
import useDetachState from '../../../shared/hooks/use-detach-state'
import useDetachAction from '../../../shared/hooks/use-detach-action'
import localStorage from '../../../infrastructure/local-storage'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import useScopeEventListener from '../../../shared/hooks/use-scope-event-listener'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { debugConsole } from '@/utils/debugging'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { Spinner } from 'react-bootstrap-5'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import useEventListener from '@/shared/hooks/use-event-listener'
import { CursorPosition } from '@/features/ide-react/types/cursor-position'
import { isValidTeXFile } from '@/main/is-valid-tex-file'
import { PdfScrollPosition } from '@/shared/hooks/use-pdf-scroll-position'
import { Placement } from 'react-bootstrap-5/types'

const GoToCodeButton = memo(function GoToCodeButton({
  syncToCode,
  syncToCodeInFlight,
  isDetachLayout,
}: {
  syncToCode: ({ visualOffset }: { visualOffset: number }) => void
  syncToCodeInFlight: boolean
  isDetachLayout?: boolean
}) {
  const { t } = useTranslation()
  const buttonClasses = classNames('synctex-control', {
    'detach-synctex-control': !!isDetachLayout,
  })

  let buttonIcon = null
  if (syncToCodeInFlight) {
    buttonIcon = (
      <Spinner animation="border" aria-hidden="true" size="sm" role="status" />
    )
  } else if (!isDetachLayout) {
    buttonIcon = (
      <MaterialIcon type="arrow_left_alt" className="synctex-control-icon" />
    )
  }

  const syncToCodeWithButton = useCallback(() => {
    eventTracking.sendMB('jump-to-location', {
      direction: 'pdf-location-in-code',
      method: 'arrow',
    })
    syncToCode({ visualOffset: 72 })
  }, [syncToCode])

  const overlayProps = useMemo(
    () => ({
      placement: (isDetachLayout ? 'bottom' : 'right') as Placement,
    }),
    [isDetachLayout]
  )

  return (
    <OLTooltip
      id="sync-to-code"
      description={t('go_to_pdf_location_in_code')}
      overlayProps={overlayProps}
    >
      <OLButton
        variant="secondary"
        size="sm"
        onClick={syncToCodeWithButton}
        disabled={syncToCodeInFlight}
        className={buttonClasses}
        aria-label={t('go_to_pdf_location_in_code')}
      >
        {buttonIcon}
        {isDetachLayout ? <span>&nbsp;{t('show_in_code')}</span> : ''}
      </OLButton>
    </OLTooltip>
  )
})

const GoToPdfButton = memo(function GoToPdfButton({
  syncToPdf,
  syncToPdfInFlight,
  isDetachLayout,
  canSyncToPdf,
}: {
  syncToPdf: () => void
  syncToPdfInFlight: boolean
  canSyncToPdf: boolean
  isDetachLayout?: boolean
}) {
  const { t } = useTranslation()
  const tooltipPlacement = isDetachLayout ? 'bottom' : 'right'
  const buttonClasses = classNames('synctex-control', {
    'detach-synctex-control': !!isDetachLayout,
  })

  let buttonIcon = null
  if (syncToPdfInFlight) {
    buttonIcon = (
      <Spinner animation="border" aria-hidden="true" size="sm" role="status" />
    )
  } else if (!isDetachLayout) {
    buttonIcon = (
      <MaterialIcon type="arrow_right_alt" className="synctex-control-icon" />
    )
  }

  return (
    <OLTooltip
      id="sync-to-pdf"
      description={t('go_to_code_location_in_pdf')}
      overlayProps={{ placement: tooltipPlacement }}
    >
      <OLButton
        variant="secondary"
        size="sm"
        onClick={syncToPdf}
        disabled={syncToPdfInFlight || !canSyncToPdf}
        className={buttonClasses}
        aria-label={t('go_to_code_location_in_pdf')}
      >
        {buttonIcon}
        {isDetachLayout ? <span>&nbsp;{t('show_in_pdf')}</span> : ''}
      </OLButton>
    </OLTooltip>
  )
})

function PdfSynctexControls() {
  const { _id: projectId, rootDocId } = useProjectContext()

  const { detachRole } = useLayoutContext()

  const {
    clsiServerId,
    pdfUrl,
    pdfViewer,
    position,
    setShowLogs,
    setHighlights,
  } = useCompileContext()

  const { selectedEntities } = useFileTreeData()
  const { findEntityByPath, dirname, pathInFolder } = useFileTreePathContext()
  const { getCurrentDocumentId, openDocWithId, openDocName } =
    useEditorManagerContext()

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
    useCallback(event => setCursorPosition(event.detail), [])
  )

  const [syncToPdfInFlight, setSyncToPdfInFlight] = useState(false)
  const [syncToCodeInFlight, setSyncToCodeInFlight] = useDetachState(
    'sync-to-code-inflight',
    false,
    'detacher',
    'detached'
  )

  const [, setSynctexError] = useScopeValue('sync_tex_error')

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
    (file, line) => {
      if (file) {
        const doc = findEntityByPath(file)?.entity
        if (!doc) {
          debugConsole.warn(`Document with path ${file} not found`)
          return
        }

        openDocWithId(doc._id, {
          gotoLine: line,
        })
      } else {
        setSynctexError(true)

        window.setTimeout(() => {
          if (isMounted.current) {
            setSynctexError(false)
          }
        }, 4000)
      }
    },
    [findEntityByPath, openDocWithId, isMounted, setSynctexError]
  )

  const goToPdfLocation = useCallback(
    params => {
      setSyncToPdfInFlight(true)

      if (clsiServerId) {
        params += `&clsiserverid=${clsiServerId}`
      }

      getJSON(`/project/${projectId}/sync/code?${params}`, { signal })
        .then(data => {
          setShowLogs(false)
          setHighlights(data.pdf)
        })
        .catch(debugConsole.error)
        .finally(() => {
          if (isMounted.current) {
            setSyncToPdfInFlight(false)
          }
        })
    },
    [
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

      eventTracking.sendMB('jump-to-location', {
        direction: 'code-location-in-pdf',
        method: 'arrow',
      })

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
      visualOffset = 0,
    }: {
      position?: PdfScrollPosition
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

      getJSON(`/project/${projectId}/sync/pdf?${params}`, { signal })
        .then(data => {
          const [{ file, line }] = data.code
          goToCodeLine(file, line)
        })
        .catch(debugConsole.error)
        .finally(() => {
          if (isMounted.current) {
            setSyncToCodeInFlight(false)
          }
        })
    },
    [
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
    useCallback(event => syncToCode({ position: event.detail }), [syncToCode])
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

  if (!position) {
    return null
  }

  if (!pdfUrl || pdfViewer === 'native') {
    return null
  }

  const canSyncToPdf: boolean =
    hasSingleSelectedDoc &&
    cursorPosition &&
    openDocName &&
    isValidTeXFile(openDocName)

  if (detachRole === 'detacher') {
    return (
      <GoToPdfButton
        syncToPdf={syncToPdf}
        syncToPdfInFlight={syncToPdfInFlight}
        isDetachLayout
        canSyncToPdf={canSyncToPdf}
      />
    )
  } else if (detachRole === 'detached') {
    return (
      <GoToCodeButton
        syncToCode={syncToCode}
        syncToCodeInFlight={syncToCodeInFlight}
        isDetachLayout
      />
    )
  } else {
    return (
      <>
        <GoToPdfButton
          syncToPdf={syncToPdf}
          syncToPdfInFlight={syncToPdfInFlight}
          canSyncToPdf={canSyncToPdf}
        />

        <GoToCodeButton
          syncToCode={syncToCode}
          syncToCodeInFlight={syncToCodeInFlight}
        />
      </>
    )
  }
}

export default memo(PdfSynctexControls)
