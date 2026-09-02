import { memo, useCallback, useMemo } from 'react'
import { diffWordsWithSpace, structuredPatch } from 'diff'

type DiffViewerProps = {
  baseContent: string
  targetContent: string
}

// Renders an inline diff between two document versions using <ins> and <del>
// tags. Only affected lines are shown (plus one line of context above/below),
// with a separator between non-adjacent sections.
// TODO: refactor both to share a common diff renderer from a shared location.
function DiffViewer({ baseContent, targetContent }: DiffViewerProps) {
  const hunks = useMemo(() => {
    const patch = structuredPatch('', '', baseContent, targetContent, '', '', {
      context: 1,
    })

    if (patch.hunks.length === 0) {
      return [diffWordsWithSpace(baseContent, targetContent)]
    }

    return patch.hunks.map(hunk => {
      const baseLines: string[] = []
      const targetLines: string[] = []

      for (const line of hunk.lines) {
        const content = line.slice(1)
        if (line[0] === '-') {
          baseLines.push(content)
        } else if (line[0] === '+') {
          targetLines.push(content)
        } else if (line[0] === ' ') {
          baseLines.push(content)
          targetLines.push(content)
        }
      }

      return diffWordsWithSpace(baseLines.join('\n'), targetLines.join('\n'))
    })
  }, [baseContent, targetContent])

  const createDiff = useCallback(
    (element: HTMLDivElement) => {
      if (!element) return
      element.replaceChildren()

      for (let i = 0; i < hunks.length; i++) {
        if (i > 0) {
          const separator = document.createElement('div')
          separator.className = 'diff-separator'
          separator.setAttribute('aria-hidden', 'true')
          separator.textContent = '⋮'
          element.append(separator)
        }

        for (const change of hunks[i]) {
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
      }
    },
    [hunks]
  )

  return <div className="diff-container" ref={createDiff} />
}

export default memo(DiffViewer)
