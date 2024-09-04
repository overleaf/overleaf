import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import Icon from '../../../shared/components/icon'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
        <OLFormControl
          ref={inputRef}
          type="text"
          onKeyDown={handleKeyDown}
          onChange={handleOnChange}
          onBlur={handleBlur}
          value={inputContent}
        />
      )}
      {canRename && (
        <OLTooltip
          id="online-user"
          description={t('rename')}
          overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
        >
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid, jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus */}
          <a className="rename" role="button" onClick={startRenaming}>
            <BootstrapVersionSwitcher
              bs3={<Icon type="pencil" fw />}
              bs5={<MaterialIcon type="edit" className="align-text-bottom" />}
            />
          </a>
        </OLTooltip>
      )}
    </div>
  )
}

export default ProjectNameEditableLabel
