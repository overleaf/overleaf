import { useCodeMirrorStateContext } from './codemirror-context'
import React, { useEffect } from 'react'
import { documentOutline } from '../languages/latex/document-outline'
import { ProjectionStatus } from '../utils/tree-operations/projection'
import useDebounce from '../../../shared/hooks/use-debounce'
import { useOutlineContext } from '@/features/ide-react/context/outline-context'

export const CodemirrorOutline = React.memo(function CodemirrorOutline() {
  const { setFlatOutline } = useOutlineContext()

  const state = useCodeMirrorStateContext()
  const debouncedState = useDebounce(state, 100)
  const outlineResult = debouncedState.field(documentOutline, false)

  // when the outline projection changes, calculate the flat outline
  useEffect(() => {
    if (outlineResult && outlineResult.status !== ProjectionStatus.Pending) {
      // We have a (potentially partial) outline.
      setFlatOutline({
        items: outlineResult.items.map(element => ({
          level: element.level,
          title: element.title,
          line: element.line,
        })),
        partial: outlineResult?.status === ProjectionStatus.Partial,
      })
    } else {
      setFlatOutline(undefined)
    }
  }, [outlineResult, setFlatOutline])

  return null
})
