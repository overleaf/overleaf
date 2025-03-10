import { FC, memo } from 'react'
import OutlinePane from '@/features/outline/components/outline-pane'
import { useOutlineContext } from '@/features/ide-react/context/outline-context'
import useScopeEventEmitter from '@/shared/hooks/use-scope-event-emitter'
import useNestedOutline from '../hooks/use-nested-outline'

export const OutlineContainer: FC = memo(() => {
  const {
    highlightedLine,
    canShowOutline,
    jumpToLine,
    outlineExpanded,
    toggleOutlineExpanded,
  } = useOutlineContext()

  const outlineToggledEmitter = useScopeEventEmitter('outline-toggled')

  const outline = useNestedOutline()

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
