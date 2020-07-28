import React, { useState, useEffect, createRef } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import OutlineList from './OutlineList'

function OutlineItem({ outlineItem, jumpToLine, highlightedLine }) {
  const [expanded, setExpanded] = useState(true)
  const titleElementRef = createRef()

  const mainItemClasses = classNames('outline-item', {
    'outline-item-no-children': !outlineItem.children
  })

  const expandCollapseIconClasses = classNames('fa', 'outline-caret-icon', {
    'fa-angle-down': expanded,
    'fa-angle-right': !expanded
  })

  const itemLinkClasses = classNames('outline-item-link', {
    'outline-item-link-highlight': highlightedLine === outlineItem.line
  })

  function handleExpandCollapseClick() {
    setExpanded(!expanded)
  }

  function handleOutlineItemLinkClick() {
    jumpToLine(outlineItem.line)
  }

  useEffect(
    () => {
      if (highlightedLine !== outlineItem.line) return

      titleElementRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    },
    [highlightedLine, titleElementRef]
  )

  return (
    <li className={mainItemClasses}>
      <div className="outline-item-row">
        {outlineItem.children ? (
          <button
            className="outline-item-expand-collapse-btn"
            onClick={handleExpandCollapseClick}
          >
            <i className={expandCollapseIconClasses} />
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
    level: PropTypes.number.isRequired,
    children: PropTypes.array
  }).isRequired,
  jumpToLine: PropTypes.func.isRequired,
  highlightedLine: PropTypes.number
}

export default OutlineItem
