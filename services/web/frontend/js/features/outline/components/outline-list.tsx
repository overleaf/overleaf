import classNames from 'classnames'
import OutlineItem from './outline-item'
import { memo } from 'react'
import { OutlineItemData } from '@/features/ide-react/types/outline'

function getChildrenLines(children?: OutlineItemData[]): number[] {
  return (children || [])
    .map(child => {
      return getChildrenLines(child.children).concat(child.line)
    })
    .flat()
}

const OutlineList = memo(function OutlineList({
  outline,
  jumpToLine,
  isRoot,
  highlightedLine,
  containsHighlightedLine,
}: {
  outline: OutlineItemData[]
  jumpToLine: (line: number, syncToPdf: boolean) => void
  isRoot?: boolean
  highlightedLine?: number | null
  containsHighlightedLine?: boolean
}) {
  const listClasses = classNames('outline-item-list', {
    'outline-item-list-root': isRoot,
  })
  return (
    <ul className={listClasses} role={isRoot ? 'tree' : 'group'}>
      {outline.map((outlineItem, idx) => {
        const matchesHighlightedLine =
          containsHighlightedLine && highlightedLine === outlineItem.line
        const itemContainsHighlightedLine =
          highlightedLine !== undefined &&
          highlightedLine !== null &&
          containsHighlightedLine &&
          getChildrenLines(outlineItem.children).includes(highlightedLine)

        // highlightedLine is only provided to the item if the item matches or
        // contains the highlighted line. This means that whenever the item does
        // not contain the highlighted line, the props provided to it are the
        // same and the component can be memoized.
        return (
          <OutlineItem
            key={`${outlineItem.level}-${idx}`}
            outlineItem={outlineItem}
            jumpToLine={jumpToLine}
            highlightedLine={
              matchesHighlightedLine || itemContainsHighlightedLine
                ? highlightedLine
                : null
            }
            matchesHighlightedLine={matchesHighlightedLine}
            containsHighlightedLine={itemContainsHighlightedLine}
          />
        )
      })}
    </ul>
  )
})

export default OutlineList
