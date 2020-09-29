import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import Icon from '../../../shared/components/icon'

function PreviewLogEntry({ file, line, message, content, raw, level }) {
  const logEntryClasses = classNames('alert', {
    'alert-danger': level === 'error',
    'alert-warning': level === 'warning',
    'alert-info': level === 'typesetting'
  })
  return (
    <div className={logEntryClasses}>
      <span className="line-no">
        <Icon type="link" />
        {file ? <span>{file}</span> : null}
        {line ? <span>, {line}</span> : null}
      </span>
      {message ? (
        <p className="entry-message">
          {level} {message}
        </p>
      ) : null}
      {content ? <p className="entry-content">{content.trim()}</p> : null}
    </div>
  )
}

PreviewLogEntry.propTypes = {
  file: PropTypes.string,
  // `line should be either a number or null (i.e. not required), but currently sometimes we get
  // an empty string (from BibTeX errors), which is why we're using `any` here. We should revert
  // to PropTypes.number (not required) once we fix that.
  line: PropTypes.any,
  message: PropTypes.string,
  content: PropTypes.string,
  raw: PropTypes.string,
  level: PropTypes.string.isRequired
}

export default PreviewLogEntry
