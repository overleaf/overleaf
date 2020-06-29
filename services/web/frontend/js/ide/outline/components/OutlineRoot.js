import React from 'react'
import PropTypes from 'prop-types'
import OutlineList from './OutlineList'

function OutlineRoot({ outline, jumpToLine }) {
  return (
    <div>
      {outline.length ? (
        <OutlineList outline={outline} jumpToLine={jumpToLine} isRoot />
      ) : (
        <div className="outline-body-no-elements">
          We can’t find any sections or subsections in this file.{' '}
          <a
            href="/learn/how-to/Using_the_File_Outline_feature"
            className="outline-body-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Know more about the file outline
          </a>
        </div>
      )}
    </div>
  )
}

OutlineRoot.propTypes = {
  outline: PropTypes.array.isRequired,
  jumpToLine: PropTypes.func.isRequired
}

export default OutlineRoot
