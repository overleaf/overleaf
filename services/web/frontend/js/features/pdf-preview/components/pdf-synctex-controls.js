import { memo, useCallback, useEffect, useState } from 'react'
import { useIdeContext } from '../../../shared/context/ide-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { getJSON } from '../../../infrastructure/fetch-json'
import { useCompileContext } from '../../../shared/context/compile-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import useIsMounted from '../../../shared/hooks/use-is-mounted'
import useAbortController from '../../../shared/hooks/use-abort-controller'

function PdfSynctexControls() {
  const ide = useIdeContext()

  const { _id: projectId } = useProjectContext()

  const {
    clsiServerId,
    pdfUrl,
    pdfViewer,
    position,
    setHighlights,
  } = useCompileContext()

  const [cursorPosition, setCursorPosition] = useState(null)

  const isMounted = useIsMounted()

  const { signal } = useAbortController()

  useEffect(() => {
    const listener = event => setCursorPosition(event.detail)
    window.addEventListener('cursor:editor:update', listener)
    return () => window.removeEventListener('cursor:editor:update', listener)
  }, [ide])

  const [syncToPdfInFlight, setSyncToPdfInFlight] = useState(false)
  const [syncToCodeInFlight, setSyncToCodeInFlight] = useState(false)

  const [, setSynctexError] = useScopeValue('sync_tex_error')

  const { t } = useTranslation()

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

  const syncToPdf = useCallback(
    cursorPosition => {
      setSyncToPdfInFlight(true)

      const params = new URLSearchParams({
        file: getCurrentFilePath(),
        line: cursorPosition.row + 1,
        column: cursorPosition.column,
      })

      if (clsiServerId) {
        params.set('clsiserverid', clsiServerId)
      }

      getJSON(`/project/${projectId}/sync/code?${params}`, { signal })
        .then(data => {
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
      projectId,
      setHighlights,
      getCurrentFilePath,
      signal,
      isMounted,
    ]
  )

  const syncToCode = useCallback(
    (position, visualOffset = 0) => {
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

      setSyncToCodeInFlight(true)

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
    [clsiServerId, ide, projectId, setSynctexError, signal, isMounted]
  )

  useEffect(() => {
    const listener = event => syncToCode(event.detail)
    window.addEventListener('synctex:sync-to-position', listener)
    return () => {
      window.removeEventListener('synctex:sync-to-position', listener)
    }
  }, [syncToCode])

  if (!pdfUrl || pdfViewer === 'native') {
    return null
  }

  return (
    <>
      <OverlayTrigger
        placement="right"
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
          disabled={syncToPdfInFlight}
          className="synctex-control"
          aria-label={t('go_to_code_location_in_pdf')}
        >
          {syncToPdfInFlight ? (
            <Icon type="refresh" spin classes={{ icon: 'synctex-spin-icon' }} />
          ) : (
            <Icon
              type="arrow-right"
              classes={{ icon: 'synctex-control-icon' }}
            />
          )}
        </Button>
      </OverlayTrigger>

      <OverlayTrigger
        placement="right"
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
          disabled={syncToCodeInFlight}
          className="synctex-control"
          aria-label={t('go_to_pdf_location_in_code')}
        >
          {syncToCodeInFlight ? (
            <Icon type="refresh" spin classes={{ icon: 'synctex-spin-icon' }} />
          ) : (
            <Icon
              type="arrow-left"
              classes={{ icon: 'synctex-control-icon' }}
            />
          )}
        </Button>
      </OverlayTrigger>
    </>
  )
}

export default memo(PdfSynctexControls)
