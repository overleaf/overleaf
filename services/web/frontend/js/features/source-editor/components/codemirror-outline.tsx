import { createPortal } from 'react-dom'
import { useCodeMirrorStateContext } from './codemirror-editor'
import React, { useCallback, useMemo, useState } from 'react'
import OutlinePane from '../../outline/components/outline-pane'
import { documentOutline } from '../languages/latex/document-outline'
import isValidTeXFile from '../../../main/is-valid-tex-file'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import useScopeEventEmitter from '../../../shared/hooks/use-scope-event-emitter'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { nestOutline } from '../utils/tree-query'
import { ProjectionStatus } from '../utils/tree-operations/projection'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useDeepCompareMemo from '../../../shared/hooks/use-deep-compare-memo'
import useDebounce from '../../../shared/hooks/use-debounce'

const closestSectionLineNumber = (
  outline: { line: number }[] | undefined,
  lineNumber: number
): number => {
  if (!outline) {
    return -1
  }
  let highestLine = -1
  for (const section of outline) {
    if (section.line > lineNumber) {
      return highestLine
    }
    highestLine = section.line
  }
  return highestLine
}

export const CodemirrorOutline = React.memo(function CodemirrorOutline() {
  const state = useCodeMirrorStateContext()
  const debouncedState = useDebounce(state, 100)
  const [docName] = useScopeValue<string>('editor.open_doc_name')
  const goToLineEmitter = useScopeEventEmitter('editor:gotoLine', true)
  const outlineToggledEmitter = useScopeEventEmitter('outline-toggled')
  const [currentlyHighlightedLine, setCurrentlyHighlightedLine] =
    useState<number>(-1)
  const isTexFile = useMemo(() => isValidTeXFile(docName), [docName])
  const [ignoreNextCursorUpdate, setIgnoreNextCursorUpdate] =
    useState<boolean>(false)
  const [ignoreNextScroll, setIgnoreNextScroll] = useState<boolean>(false)
  const [binaryFileOpened, setBinaryFileOpened] = useState<boolean>(false)

  useEventListener(
    'file-view:file-opened',
    useCallback(_ => {
      setBinaryFileOpened(true)
    }, [])
  )

  useEventListener(
    'scroll:editor:update',
    useCallback(
      evt => {
        if (ignoreNextScroll) {
          setIgnoreNextScroll(false)
          return
        }
        setCurrentlyHighlightedLine(evt.detail + 1)
      },
      [ignoreNextScroll]
    )
  )

  useEventListener(
    'cursor:editor:update',
    useCallback(
      evt => {
        if (ignoreNextCursorUpdate) {
          setIgnoreNextCursorUpdate(false)
          return
        }
        setCurrentlyHighlightedLine(evt.detail.row + 1)
      },
      [ignoreNextCursorUpdate]
    )
  )

  useEventListener(
    'doc:after-opened',
    useCallback(evt => {
      if (evt.detail) {
        setIgnoreNextCursorUpdate(true)
      }
      setBinaryFileOpened(false)
      setIgnoreNextScroll(true)
    }, [])
  )

  const outlineStatus = useMemo(
    () =>
      debouncedState.field(documentOutline, false)?.status ||
      ProjectionStatus.Pending,
    [debouncedState]
  )

  const flatOutline = useMemo(() => {
    const outlineResult = debouncedState.field(documentOutline, false)
    if (outlineResult?.status !== ProjectionStatus.Pending) {
      // We have a (potentially partial) outline.
      return outlineResult?.items!.map(element => {
        // Remove {from, to} to not trip up deep comparison
        const { level, title, line } = element
        return { level, title, line }
      })
    }
    return undefined
  }, [debouncedState])

  const outline = useDeepCompareMemo(() => {
    return flatOutline ? nestOutline(flatOutline) : []
  }, [flatOutline])

  const jumpToLine = useCallback(
    (lineNumber, syncToPdf) => {
      setIgnoreNextScroll(true)
      goToLineEmitter(lineNumber, 0, syncToPdf)
      eventTracking.sendMB('outline-jump-to-line')
    },
    [goToLineEmitter]
  )

  const onToggle = useCallback(
    isOpen => {
      outlineToggledEmitter(isOpen)
    },
    [outlineToggledEmitter]
  )

  const highlightedLine = useMemo(
    () => closestSectionLineNumber(flatOutline, currentlyHighlightedLine),
    [flatOutline, currentlyHighlightedLine]
  )

  const outlineDomElement = document.querySelector('.outline-container')
  if (!outlineDomElement) {
    return null
  }

  return createPortal(
    <OutlinePane
      outline={outline}
      onToggle={onToggle}
      eventTracking={eventTracking}
      isTexFile={isTexFile && !binaryFileOpened}
      jumpToLine={jumpToLine}
      highlightedLine={highlightedLine}
      show
      isPartial={outlineStatus === ProjectionStatus.Partial}
    />,
    outlineDomElement
  )
})
