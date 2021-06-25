import { useEffect, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import Icon from '../../../shared/components/icon'

function ProjectNameEditableLabel({
  projectName,
  hasRenamePermissions,
  onChange,
  className,
}) {
  const { t } = useTranslation()

  const [isRenaming, setIsRenaming] = useState(false)

  const canRename = hasRenamePermissions && !isRenaming

  const [inputContent, setInputContent] = useState(projectName)

  const inputRef = useRef(null)

  useEffect(() => {
    if (isRenaming) {
      inputRef.current.select()
    }
  }, [isRenaming])

  function startRenaming() {
    if (canRename) {
      setInputContent(projectName)
      setIsRenaming(true)
    }
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
        <OverlayTrigger
          placement="bottom"
          trigger={['hover', 'focus']}
          overlay={<Tooltip id="tooltip-online-user">{t('rename')}</Tooltip>}
        >
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid, jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus */}
          <a className="rename" role="button" onClick={startRenaming}>
            <Icon type="pencil" modifier="fw" />
          </a>
        </OverlayTrigger>
      )}
    </div>
  )
}

ProjectNameEditableLabel.propTypes = {
  projectName: PropTypes.string.isRequired,
  hasRenamePermissions: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
}

export default ProjectNameEditableLabel
