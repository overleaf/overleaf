import React, { useState } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import OutlineList from './OutlineList'

function OutlineItem({ outlineItem, jumpToLine }) {
  const [expanded, setExpanded] = useState(true)

  const mainItemClasses = classNames('outline-item', {
    'outline-item-no-children': !outlineItem.children
  })

  const expandCollapseIconClasses = classNames('fa', 'outline-caret-icon', {
    'fa-angle-down': expanded,
    'fa-angle-right': !expanded
  })

  function handleExpandCollapseClick() {
    setExpanded(!expanded)
  }

  function handleOutlineItemLinkClick() {
    jumpToLine(outlineItem.line)
  }

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
          className="outline-item-link"
          onClick={handleOutlineItemLinkClick}
        >
          {outlineItem.title}
        </button>
      </div>
      {expanded && outlineItem.children ? (
        <OutlineList
          outline={outlineItem.children}
          jumpToLine={jumpToLine}
          isRoot={false}
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
  jumpToLine: PropTypes.func.isRequired
}

export default OutlineItem
