import { createPortal } from 'react-dom'
import { useCodeMirrorStateContext } from './codemirror-editor'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OutlinePane from '../../outline/components/outline-pane'
import { documentOutline } from '../languages/latex/document-outline'
import isValidTeXFile from '../../../main/is-valid-tex-file'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import useScopeEventEmitter from '../../../shared/hooks/use-scope-event-emitter'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { nestOutline, Outline } from '../utils/tree-query'
import { ProjectionStatus } from '../utils/tree-operations/projection'
import useEventListener from '../../../shared/hooks/use-event-listener'
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

type PartialFlatOutline = {
  level: number
  title: string
  line: number
}[]

const outlineChanged = (
  a: PartialFlatOutline | undefined,
  b: PartialFlatOutline
): boolean => {
  if (!a) {
    return true
  }

  if (a.length !== b.length) {
    return true
  }

  for (let i = 0; i < a.length; i++) {
    const aItem = a[i]
    const bItem = b[i]
    if (
      aItem.level !== bItem.level ||
      aItem.line !== bItem.line ||
      aItem.title !== bItem.title
    ) {
      return true
    }
  }

  return false
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

  const outlineResult = debouncedState.field(documentOutline, false)

  // when the outline projection changes, calculate the flat outline
  const flatOutline = useMemo<PartialFlatOutline | undefined>(() => {
    if (!outlineResult || outlineResult.status === ProjectionStatus.Pending) {
      return undefined
    }

    // We have a (potentially partial) outline.
    return outlineResult.items.map(element => {
      const { level, title, line } = element
      return { level, title, line }
    })
  }, [outlineResult])

  const [outline, setOutline] = useState<Outline[]>([])

  const prevFlatOutlineRef = useRef<PartialFlatOutline | undefined>(undefined)

  // when the flat outline changes, calculate the nested outline
  useEffect(() => {
    const prevFlatOutline = prevFlatOutlineRef.current
    prevFlatOutlineRef.current = flatOutline

    if (flatOutline) {
      if (outlineChanged(prevFlatOutline, flatOutline)) {
        setOutline(nestOutline(flatOutline))
      }
    } else {
      setOutline([])
    }
  }, [flatOutline])

  const jumpToLine = useCallback(
    (lineNumber, syncToPdf) => {
      setIgnoreNextScroll(true)
      goToLineEmitter(lineNumber, 0, syncToPdf)
      eventTracking.sendMB('outline-jump-to-line')
    },
    [goToLineEmitter]
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
      onToggle={outlineToggledEmitter}
      eventTracking={eventTracking}
      isTexFile={isTexFile && !binaryFileOpened}
      jumpToLine={jumpToLine}
      highlightedLine={highlightedLine}
      show
      isPartial={outlineResult?.status === ProjectionStatus.Partial}
    />,
    outlineDomElement
  )
})
