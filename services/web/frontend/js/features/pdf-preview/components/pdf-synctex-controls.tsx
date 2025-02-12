import classNames from 'classnames'
import { memo, useCallback, useEffect, useState, useRef } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import { getJSON } from '../../../infrastructure/fetch-json'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import Icon from '../../../shared/components/icon'
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
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { Spinner } from 'react-bootstrap-5'
import { bsVersion } from '@/features/utils/bootstrap-5'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import useEventListener from '@/shared/hooks/use-event-listener'
import { PdfScrollPosition } from '@/shared/hooks/use-pdf-scroll-position'
import { CursorPosition } from '@/features/ide-react/types/cursor-position'

function GoToCodeButton({
  position,
  syncToCode,
  syncToCodeInFlight,
  isDetachLayout,
}: {
  position: PdfScrollPosition
  syncToCode: (position: PdfScrollPosition, visualOffset?: number) => void
  syncToCodeInFlight: boolean
  isDetachLayout?: boolean
}) {
  const { t } = useTranslation()
  const tooltipPlacement = isDetachLayout ? 'bottom' : 'right'
  const buttonClasses = classNames('synctex-control', {
    'detach-synctex-control': !!isDetachLayout,
  })

  let buttonIcon = null
  if (syncToCodeInFlight) {
    buttonIcon = (
      <BootstrapVersionSwitcher
        bs3={<Icon type="refresh" spin className="synctex-spin-icon" />}
        bs5={
          <Spinner
            animation="border"
            aria-hidden="true"
            size="sm"
            role="status"
          />
        }
      />
    )
  } else if (!isDetachLayout) {
    buttonIcon = (
      <BootstrapVersionSwitcher
        bs3={<Icon type="arrow-left" className="synctex-control-icon" />}
        bs5={
          <MaterialIcon
            type="arrow_left_alt"
            className="synctex-control-icon"
          />
        }
      />
    )
  }

  const syncToCodeWithButton = () => {
    eventTracking.sendMB('jump-to-location', {
      direction: 'pdf-location-in-code',
      method: 'arrow',
    })
    syncToCode(position, 72)
  }

  return (
    <OLTooltip
      id="sync-to-code"
      description={t('go_to_pdf_location_in_code')}
      overlayProps={{ placement: tooltipPlacement }}
    >
      <OLButton
        variant="secondary"
        size="sm"
        onClick={syncToCodeWithButton}
        disabled={syncToCodeInFlight}
        className={buttonClasses}
        aria-label={t('go_to_pdf_location_in_code')}
        bs3Props={{
          bsSize: 'xsmall',
        }}
      >
        {buttonIcon}
        {isDetachLayout ? <span>&nbsp;{t('show_in_code')}</span> : ''}
      </OLButton>
    </OLTooltip>
  )
}

function GoToPdfButton({
  cursorPosition,
  syncToPdf,
  syncToPdfInFlight,
  isDetachLayout,
  hasSingleSelectedDoc,
}: {
  cursorPosition: CursorPosition | null
  syncToPdf: (cursorPosition: CursorPosition | null) => void
  syncToPdfInFlight: boolean
  hasSingleSelectedDoc: boolean
  isDetachLayout?: boolean
}) {
  const { t } = useTranslation()
  const tooltipPlacement = isDetachLayout ? 'bottom' : 'right'
  const buttonClasses = classNames(
    'synctex-control',
    bsVersion({ bs3: 'toolbar-btn-secondary' }),
    {
      'detach-synctex-control': !!isDetachLayout,
    }
  )

  let buttonIcon = null
  if (syncToPdfInFlight) {
    buttonIcon = (
      <BootstrapVersionSwitcher
        bs3={<Icon type="refresh" spin className="synctex-spin-icon" />}
        bs5={
          <Spinner
            animation="border"
            aria-hidden="true"
            size="sm"
            role="status"
          />
        }
      />
    )
  } else if (!isDetachLayout) {
    buttonIcon = (
      <BootstrapVersionSwitcher
        bs3={<Icon type="arrow-right" className="synctex-control-icon" />}
        bs5={
          <MaterialIcon
            type="arrow_right_alt"
            className="synctex-control-icon"
          />
        }
      />
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
        onClick={() => syncToPdf(cursorPosition)}
        disabled={syncToPdfInFlight || !cursorPosition || !hasSingleSelectedDoc}
        className={buttonClasses}
        aria-label={t('go_to_code_location_in_pdf')}
        bs3Props={{
          bsSize: 'xsmall',
        }}
      >
        {buttonIcon}
        {isDetachLayout ? <span>&nbsp;{t('show_in_pdf')}</span> : ''}
      </OLButton>
    </OLTooltip>
  )
}

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

  const editorUpdateListener = useCallback(
    event => setCursorPosition(event.detail),
    []
  )
  useEventListener('cursor:editor:update', editorUpdateListener)

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

  const syncToPdf = useCallback(
    cursorPosition => {
      const file = getCurrentFilePath()

      const params = new URLSearchParams({
        file: file ?? '',
        line: cursorPosition.row + 1,
        column: cursorPosition.column,
      }).toString()

      eventTracking.sendMB('jump-to-location', {
        direction: 'code-location-in-pdf',
        method: 'arrow',
      })

      goToPdfLocation(params)
    },
    [getCurrentFilePath, goToPdfLocation]
  )

  const cursorPositionRef = useRef(cursorPosition)

  useEffect(() => {
    cursorPositionRef.current = cursorPosition
  }, [cursorPosition])

  useScopeEventListener(
    'cursor:editor:syncToPdf',
    useCallback(() => {
      syncToPdf(cursorPositionRef.current)
    }, [syncToPdf])
  )

  const _syncToCode = useCallback(
    (position, visualOffset = 0) => {
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

  const syncToPositionListener = useCallback(
    event => syncToCode(event.detail),
    [syncToCode]
  )
  useEventListener('synctex:sync-to-position', syncToPositionListener)

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

  if (detachRole === 'detacher') {
    return (
      <>
        <GoToPdfButton
          cursorPosition={cursorPosition}
          syncToPdf={syncToPdf}
          syncToPdfInFlight={syncToPdfInFlight}
          isDetachLayout
          hasSingleSelectedDoc={hasSingleSelectedDoc}
        />
      </>
    )
  } else if (detachRole === 'detached') {
    return (
      <>
        <GoToCodeButton
          position={position}
          syncToCode={syncToCode}
          syncToCodeInFlight={syncToCodeInFlight}
          isDetachLayout
        />
      </>
    )
  } else {
    return (
      <>
        <GoToPdfButton
          cursorPosition={cursorPosition}
          syncToPdf={syncToPdf}
          syncToPdfInFlight={syncToPdfInFlight}
          hasSingleSelectedDoc={hasSingleSelectedDoc}
        />

        <GoToCodeButton
          position={position}
          syncToCode={syncToCode}
          syncToCodeInFlight={syncToCodeInFlight}
        />
      </>
    )
  }
}

export default memo(PdfSynctexControls)
