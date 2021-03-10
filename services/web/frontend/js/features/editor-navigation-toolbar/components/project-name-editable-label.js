import React, { useEffect, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import Icon from '../../../shared/components/icon'

function ProjectNameEditableLabel({
  projectName,
  userIsAdmin,
  onChange,
  className
}) {
  const [isRenaming, setIsRenaming] = useState(false)

  const canRename = userIsAdmin && !isRenaming

  const [inputContent, setInputContent] = useState(projectName)

  const inputRef = useRef(null)

  useEffect(() => {
    if (isRenaming) {
      inputRef.current.select()
    }
  }, [isRenaming])

  function startRenaming() {
    setInputContent(projectName)
    setIsRenaming(true)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      setIsRenaming(false)
      onChange(event.target.value)
    }
  }

  function handleOnChange(event) {
    setInputContent(event.target.value)
  }

  function handleBlur() {
    setIsRenaming(false)
  }

  return (
    <div className={classNames('project-name', className)}>
      {!isRenaming && (
        <span className="name" onDoubleClick={startRenaming}>
          {projectName}
        </span>
      )}
      {isRenaming && (
        <input
          ref={inputRef}
          type="text"
          className="form-control"
          onKeyDown={handleKeyDown}
          onChange={handleOnChange}
          onBlur={handleBlur}
          value={inputContent}
        />
      )}
      {canRename && (
        // eslint-disable-next-line jsx-a11y/anchor-is-valid, jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
        <a className="rename" role="button" onClick={startRenaming}>
          <Icon type="pencil" modifier="fw" />
        </a>
      )}
    </div>
  )
}

ProjectNameEditableLabel.propTypes = {
  projectName: PropTypes.string.isRequired,
  userIsAdmin: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string
}

export default ProjectNameEditableLabel
