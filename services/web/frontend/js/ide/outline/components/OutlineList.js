import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import OutlineItem from './OutlineItem'

function OutlineList({ outline, jumpToLine, isRoot }) {
  const listClasses = classNames('outline-item-list', {
    'outline-item-list-root': isRoot
  })
  return (
    <ul className={listClasses}>
      {outline.map((outlineItem, idx) => {
        return (
          <OutlineItem
            key={`${outlineItem.level}-${idx}`}
            outlineItem={outlineItem}
            jumpToLine={jumpToLine}
          />
        )
      })}
    </ul>
  )
}

OutlineList.propTypes = {
  outline: PropTypes.array.isRequired,
  jumpToLine: PropTypes.func.isRequired,
  isRoot: PropTypes.bool
}

export default OutlineList
