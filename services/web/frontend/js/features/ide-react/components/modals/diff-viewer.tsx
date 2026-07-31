import { memo, useCallback, useMemo } from 'react'
import { diffWordsWithSpace } from 'diff'

type DiffViewerProps = {
  baseContent: string
  targetContent: string
}

// Renders an inline diff between two document versions using <ins> and <del>
// tags. This mirrors the DOM-based rendering approach used by the workbench
// CodeDiff component (modules/workbench/frontend/js/components/code-diff.tsx).
// TODO: refactor both to share a common diff renderer from a shared location.
function DiffViewer({ baseContent, targetContent }: DiffViewerProps) {
  const changes = useMemo(
    () => diffWordsWithSpace(baseContent, targetContent),
    [baseContent, targetContent]
  )

  const createDiff = useCallback(
    (element: HTMLDivElement) => {
      if (!element) return
      element.replaceChildren()

      for (const change of changes) {
        if (change.added) {
          const ins = document.createElement('ins')
          ins.textContent = change.value
          element.append(ins)
        } else if (change.removed) {
          const del = document.createElement('del')
          del.textContent = change.value
          element.append(del)
        } else {
          const text = document.createTextNode(change.value)
          element.append(text)
        }
      }
    },
    [changes]
  )

  return <div className="diff-container" ref={createDiff} />
}

export default memo(DiffViewer)
