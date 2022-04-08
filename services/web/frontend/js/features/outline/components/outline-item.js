import { useState, useEffect, createRef, useRef } from 'react'
import PropTypes from 'prop-types'
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import OutlineList from './outline-list'
import Icon from '../../../shared/components/icon'

function getChildrenLines(children) {
  return (children || [])
    .map(child => {
      return getChildrenLines(child.children).concat(child.line)
    })
    .flat()
}

function OutlineItem({ outlineItem, jumpToLine, highlightedLine }) {
  const { t } = useTranslation()

  const [expanded, setExpanded] = useState(true)
  const titleElementRef = createRef()
  const isHighlightedRef = useRef(false)

  const mainItemClasses = classNames('outline-item', {
    'outline-item-no-children': !outlineItem.children,
  })

  const hasHighlightedChild =
    !expanded &&
    getChildrenLines(outlineItem.children).includes(highlightedLine)

  const isHighlighted =
    highlightedLine === outlineItem.line || hasHighlightedChild

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
        <OutlineList
          outline={outlineItem.children}
          jumpToLine={jumpToLine}
          isRoot={false}
          highlightedLine={highlightedLine}
        />
      ) : null}
    </li>
  )
}

OutlineItem.propTypes = {
  outlineItem: PropTypes.exact({
    line: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    level: PropTypes.number,
    children: PropTypes.array,
  }).isRequired,
  jumpToLine: PropTypes.func.isRequired,
  highlightedLine: PropTypes.number,
}

export default OutlineItem
