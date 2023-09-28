import { useState, useEffect, useRef, memo } from 'react'
import PropTypes from 'prop-types'
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import OutlineList from './outline-list'
import Icon from '../../../shared/components/icon'

const OutlineItem = memo(function OutlineItem({
  outlineItem,
  jumpToLine,
  highlightedLine,
  matchesHighlightedLine,
  containsHighlightedLine,
}) {
  const { t } = useTranslation()

  const [expanded, setExpanded] = useState(true)
  const titleElementRef = useRef()
  const isHighlightedRef = useRef(false)

  const mainItemClasses = classNames('outline-item', {
    'outline-item-no-children': !outlineItem.children,
  })

  const hasHighlightedChild = !expanded && containsHighlightedLine
  const isHighlighted = matchesHighlightedLine || hasHighlightedChild

  const itemLinkClasses = classNames('outline-item-link', {
    'outline-item-link-highlight': isHighlighted,
  })

  function handleExpandCollapseClick() {
    setExpanded(!expanded)
  }

  function handleOutlineItemLinkClick(event) {
    const syncToPdf = event.detail === 2 // double-click = sync to PDF
    jumpToLine(outlineItem.line, syncToPdf)
  }

  useEffect(() => {
    const wasHighlighted = isHighlightedRef.current
    isHighlightedRef.current = isHighlighted

    if (!wasHighlighted && isHighlighted) {
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
        {outlineItem.children ? (
          <button
            className="outline-item-expand-collapse-btn"
            onClick={handleExpandCollapseClick}
            aria-label={expanded ? t('collapse') : t('expand')}
          >
            <Icon
              type={expanded ? 'angle-down' : 'angle-right'}
              className="outline-caret-icon"
            />
          </button>
        ) : null}
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

OutlineItem.propTypes = {
  outlineItem: PropTypes.exact({
    line: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    level: PropTypes.number,
    children: PropTypes.array,
    // Used for caching in CM6
    from: PropTypes.number,
    to: PropTypes.number,
  }).isRequired,
  jumpToLine: PropTypes.func.isRequired,
  highlightedLine: PropTypes.number,
  matchesHighlightedLine: PropTypes.bool,
  containsHighlightedLine: PropTypes.bool,
}

export default OutlineItem
