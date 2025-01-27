import { useState, useEffect, useRef, memo } from 'react'
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed'
import classNames from 'classnames'
import OutlineList from './outline-list'
import { OutlineItemToggleButton } from '@/features/outline/components/outline-item-toggle-button'
import { OutlineItemData } from '@/features/ide-react/types/outline'

const OutlineItem = memo(function OutlineItem({
  outlineItem,
  jumpToLine,
  highlightedLine,
  matchesHighlightedLine,
  containsHighlightedLine,
}: {
  outlineItem: OutlineItemData
  jumpToLine: (line: number, syncToPdf: boolean) => void
  highlightedLine?: number | null
  matchesHighlightedLine?: boolean
  containsHighlightedLine?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const titleElementRef = useRef<HTMLButtonElement>(null)
  const isHighlightedRef = useRef<boolean>(false)

  const mainItemClasses = classNames('outline-item', {
    'outline-item-no-children': !outlineItem.children,
  })

  const hasHighlightedChild = !expanded && containsHighlightedLine
  const isHighlighted = matchesHighlightedLine || hasHighlightedChild

  const itemLinkClasses = classNames('outline-item-link', {
    'outline-item-link-highlight': isHighlighted,
  })

  function handleOutlineItemLinkClick(event: React.MouseEvent) {
    const syncToPdf = event.detail === 2 // double-click = sync to PDF
    jumpToLine(outlineItem.line, syncToPdf)
  }

  useEffect(() => {
    const wasHighlighted = isHighlightedRef.current
    isHighlightedRef.current = !!isHighlighted

    if (!wasHighlighted && isHighlighted && titleElementRef.current) {
      scrollIntoViewIfNeeded(titleElementRef.current, {
        scrollMode: 'if-needed',
        block: 'center',
      })
    }
  }, [isHighlighted, titleElementRef, isHighlightedRef])

  // don't set the aria-expanded attribute when there are no children
  const ariaExpandedValue = outlineItem.children ? expanded : undefined

  return (
    <li
      className={mainItemClasses}
      aria-expanded={ariaExpandedValue}
      // FIXME
      // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
      role="treeitem"
      aria-current={isHighlighted}
      aria-label={outlineItem.title}
    >
      <div className="outline-item-row">
        {!!outlineItem.children && (
          <OutlineItemToggleButton
            expanded={expanded}
            setExpanded={setExpanded}
          />
        )}
        <button
          className={itemLinkClasses}
          onClick={handleOutlineItemLinkClick}
          ref={titleElementRef}
        >
          {outlineItem.title}
        </button>
      </div>
      {expanded && outlineItem.children ? (
        // highlightedLine is only provided to this list if the list contains
        // the highlighted line. This means that whenever the list does not
        // contain the highlighted line, the props provided to it are the same
        // and the component can be memoized.
        <OutlineList
          outline={outlineItem.children}
          jumpToLine={jumpToLine}
          isRoot={false}
          highlightedLine={containsHighlightedLine ? highlightedLine : null}
          containsHighlightedLine={containsHighlightedLine}
        />
      ) : null}
    </li>
  )
})

export default OutlineItem
