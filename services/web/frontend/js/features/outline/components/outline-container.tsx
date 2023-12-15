import { FC, memo, useEffect, useRef, useState } from 'react'
import OutlinePane from '@/features/outline/components/outline-pane'
import {
  FlatOutlineState,
  PartialFlatOutline,
  useOutlineContext,
} from '@/features/ide-react/context/outline-context'
import {
  nestOutline,
  Outline,
} from '@/features/source-editor/utils/tree-operations/outline'
import useScopeEventEmitter from '@/shared/hooks/use-scope-event-emitter'
import { debugConsole } from '@/utils/debugging'

export const OutlineContainer: FC = memo(() => {
  const {
    flatOutline,
    highlightedLine,
    canShowOutline,
    jumpToLine,
    outlineExpanded,
    toggleOutlineExpanded,
  } = useOutlineContext()

  const outlineToggledEmitter = useScopeEventEmitter('outline-toggled')

  const [outline, setOutline] = useState<{
    items: Outline[]
    partial: boolean
  }>(() => ({ items: [], partial: false }))

  const prevFlatOutlineRef = useRef<FlatOutlineState>(undefined)

  // when the flat outline changes, calculate the nested outline
  // TODO: only calculate when outlineExpanded is true
  useEffect(() => {
    const prevFlatOutline = prevFlatOutlineRef.current
    prevFlatOutlineRef.current = flatOutline

    if (flatOutline) {
      if (outlineChanged(prevFlatOutline?.items, flatOutline.items)) {
        debugConsole.log('Rebuilding changed outline')
        setOutline({
          items: nestOutline(flatOutline.items),
          partial: flatOutline.partial,
        })
      }
    } else {
      setOutline({ items: [], partial: false })
    }
  }, [flatOutline])

  return (
    <div className="outline-container">
      <OutlinePane
        outline={outline.items}
        onToggle={outlineToggledEmitter}
        isTexFile={canShowOutline}
        jumpToLine={jumpToLine}
        highlightedLine={highlightedLine}
        isPartial={outline.partial}
        expanded={outlineExpanded}
        toggleExpanded={toggleOutlineExpanded}
      />
    </div>
  )
})
OutlineContainer.displayName = 'OutlineContainer'

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
