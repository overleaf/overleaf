import classNames from 'classnames'
import { memo, useCallback, useEffect, useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useIdeContext } from '../../../shared/context/ide-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { getJSON } from '../../../infrastructure/fetch-json'
import { useCompileContext } from '../../../shared/context/compile-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import useIsMounted from '../../../shared/hooks/use-is-mounted'
import useAbortController from '../../../shared/hooks/use-abort-controller'
import useDetachState from '../../../shared/hooks/use-detach-state'
import useDetachAction from '../../../shared/hooks/use-detach-action'
import localStorage from '../../../infrastructure/local-storage'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'

function GoToCodeButton({
  position,
  syncToCode,
  syncToCodeInFlight,
  isDetachLayout,
  hasSingleSelectedDoc,
}) {
  const { t } = useTranslation()
  const tooltipPlacement = isDetachLayout ? 'bottom' : 'right'
  const buttonClasses = classNames('synctex-control', {
    'detach-synctex-control': !!isDetachLayout,
  })

  let buttonIcon = null
  if (syncToCodeInFlight) {
    buttonIcon = <Icon type="refresh" spin className="synctex-spin-icon" />
  } else if (!isDetachLayout) {
    buttonIcon = <Icon type="arrow-left" className="synctex-control-icon" />
  }

  return (
    <OverlayTrigger
      placement={tooltipPlacement}
      overlay={
        <Tooltip id="sync-to-code-tooltip">
          {t('go_to_pdf_location_in_code')}
        </Tooltip>
      }
    >
      <Button
        bsStyle="default"
        bsSize="xs"
        onClick={() => syncToCode(position, 72)}
        disabled={syncToCodeInFlight || !hasSingleSelectedDoc}
        className={buttonClasses}
        aria-label={t('go_to_pdf_location_in_code')}
      >
        {buttonIcon}
        {isDetachLayout ? <span>&nbsp;{t('show_in_code')}</span> : ''}
      </Button>
    </OverlayTrigger>
  )
}

function GoToPdfButton({
  cursorPosition,
  syncToPdf,
  syncToPdfInFlight,
  isDetachLayout,
  hasSingleSelectedDoc,
}) {
  const { t } = useTranslation()
  const tooltipPlacement = isDetachLayout ? 'bottom' : 'right'
  const buttonClasses = classNames('synctex-control', {
    'detach-synctex-control': !!isDetachLayout,
  })

  let buttonIcon = null
  if (syncToPdfInFlight) {
    buttonIcon = <Icon type="refresh" spin className="synctex-spin-icon" />
  } else if (!isDetachLayout) {
    buttonIcon = <Icon type="arrow-right" className="synctex-control-icon" />
  }

  return (
    <OverlayTrigger
      placement={tooltipPlacement}
      overlay={
        <Tooltip id="sync-to-pdf-tooltip">
          {t('go_to_code_location_in_pdf')}
        </Tooltip>
      }
    >
      <Button
        bsStyle="default"
        bsSize="xs"
        onClick={() => syncToPdf(cursorPosition)}
        disabled={syncToPdfInFlight || !cursorPosition || !hasSingleSelectedDoc}
        className={buttonClasses}
        aria-label={t('go_to_code_location_in_pdf')}
      >
        {buttonIcon}
        {isDetachLayout ? <span>&nbsp;{t('show_in_pdf')}</span> : ''}
      </Button>
    </OverlayTrigger>
  )
}

function PdfSynctexControls() {
  const ide = useIdeContext()

  const { _id: projectId } = useProjectContext()

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

  const [cursorPosition, setCursorPosition] = useState(() => {
    const position = localStorage.getItem(
      `doc.position.${ide.editorManager.getCurrentDocId()}`
    )
    return position ? position.cursorPosition : null
  })

  const isMounted = useIsMounted()

  const { signal } = useAbortController()

  // for detacher editor tab, which cannot access pdfUrl in a scope value in
  // detached state
  const [pdfExists, setPdfExists] = useDetachState(
    'pdf-exists',
    !!pdfUrl,
    'detached',
    'detacher'
  )

  useEffect(() => {
    setPdfExists(!!pdfUrl)
  }, [pdfUrl, setPdfExists])

  useEffect(() => {
    const listener = event => setCursorPosition(event.detail)
    window.addEventListener('cursor:editor:update', listener)
    return () => window.removeEventListener('cursor:editor:update', listener)
  }, [ide])

  const [syncToPdfInFlight, setSyncToPdfInFlight] = useDetachState(
    'sync-to-pdf-inflight',
    false,
    'detached',
    'detacher'
  )
  const [syncToCodeInFlight, setSyncToCodeInFlight] = useState(false)

  const [, setSynctexError] = useScopeValue('sync_tex_error')

  const getCurrentFilePath = useCallback(() => {
    const docId = ide.editorManager.getCurrentDocId()
    const doc = ide.fileTreeManager.findEntityById(docId)

    let path = ide.fileTreeManager.getEntityPath(doc)

    // If the root file is folder/main.tex, then synctex sees the path as folder/./main.tex
    const rootDocDirname = ide.fileTreeManager.getRootDocDirname()

    if (rootDocDirname) {
      path = path.replace(RegExp(`^${rootDocDirname}`), `${rootDocDirname}/.`)
    }

    return path
  }, [ide])

  const _goToCodeLine = useCallback(
    (file, line) => {
      if (file) {
        const doc = ide.fileTreeManager.findEntityByPath(file)

        ide.editorManager.openDoc(doc, {
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
    [ide, isMounted, setSynctexError]
  )

  const goToCodeLine = useDetachAction(
    'go-to-code-line',
    _goToCodeLine,
    'detached',
    'detacher'
  )

  const _goToPdfLocation = useCallback(
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
        .catch(error => {
          console.error(error)
        })
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

  const goToPdfLocation = useDetachAction(
    'go-to-pdf-location',
    _goToPdfLocation,
    'detacher',
    'detached'
  )

  const syncToPdf = useCallback(
    cursorPosition => {
      const params = new URLSearchParams({
        file: getCurrentFilePath(),
        line: cursorPosition.row + 1,
        column: cursorPosition.column,
      }).toString()

      goToPdfLocation(params)
    },
    [getCurrentFilePath, goToPdfLocation]
  )

  const syncToCode = useCallback(
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
        .catch(error => {
          console.error(error)
        })
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

  useEffect(() => {
    const listener = event => syncToCode(event.detail)
    window.addEventListener('synctex:sync-to-position', listener)
    return () => {
      window.removeEventListener('synctex:sync-to-position', listener)
    }
  }, [syncToCode])

  const hasSingleSelectedDoc = useMemo(() => {
    if (selectedEntities.length !== 1) {
      return false
    }

    if (selectedEntities[0].type !== 'doc') {
      return false
    }
    return true
  }, [selectedEntities])

  if (!position) {
    return null
  }

  if (!pdfExists || pdfViewer === 'native') {
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
          hasSingleSelectedDoc={hasSingleSelectedDoc}
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
          hasSingleSelectedDoc={hasSingleSelectedDoc}
        />
      </>
    )
  }
}

export default memo(PdfSynctexControls)

GoToCodeButton.propTypes = {
  isDetachLayout: PropTypes.bool,
  position: PropTypes.object.isRequired,
  syncToCode: PropTypes.func.isRequired,
  syncToCodeInFlight: PropTypes.bool.isRequired,
  hasSingleSelectedDoc: PropTypes.bool.isRequired,
}

GoToPdfButton.propTypes = {
  cursorPosition: PropTypes.object,
  isDetachLayout: PropTypes.bool,
  syncToPdf: PropTypes.func.isRequired,
  syncToPdfInFlight: PropTypes.bool.isRequired,
  hasSingleSelectedDoc: PropTypes.bool.isRequired,
}
