import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'

type ProjectNameEditableLabelProps = {
  projectName: string
  onChange: (value: string) => void
  hasRenamePermissions?: boolean
  className?: string
}

function ProjectNameEditableLabel({
  projectName,
  hasRenamePermissions,
  onChange,
  className,
}: ProjectNameEditableLabelProps) {
  const { t } = useTranslation()

  const [isRenaming, setIsRenaming] = useState(false)

  const canRename = hasRenamePermissions && !isRenaming

  const [inputContent, setInputContent] = useState(projectName)

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.select()
    }
  }, [isRenaming])

  function startRenaming() {
    if (canRename) {
      setInputContent(projectName)
      setIsRenaming(true)
    }
  }

  function finishRenaming() {
    setIsRenaming(false)
    onChange(inputContent)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      finishRenaming()
    }
  }

  function handleOnChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInputContent(event.target.value)
  }

  function handleBlur() {
    if (isRenaming) {
      finishRenaming()
    }
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
        <Tooltip
          id="online-user"
          description={t('rename')}
          overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
        >
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid, jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus */}
          <a className="rename" role="button" onClick={startRenaming}>
            <Icon type="pencil" fw />
          </a>
        </Tooltip>
      )}
    </div>
  )
}

export default ProjectNameEditableLabel
