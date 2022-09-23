import { useState } from 'react'
import { Dropdown, MenuItem } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { ExposedSettings } from '../../../../../types/exposed-settings'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import getMeta from '../../../utils/meta'
import NewProjectButtonModal, {
  NewProjectButtonModalVariant,
} from './new-project-button/new-project-button-modal'
import { Nullable } from '../../../../../types/utils'

type NewProjectButtonProps = {
  id: string
  buttonText?: string
  className?: string
}

function NewProjectButton({
  id,
  buttonText,
  className,
}: NewProjectButtonProps) {
  const { t } = useTranslation()
  const { templateLinks } = getMeta('ol-ExposedSettings') as ExposedSettings
  const [modal, setModal] =
    useState<Nullable<NewProjectButtonModalVariant>>(null)

  return (
    <>
      <ControlledDropdown id={id} className={className}>
        <Dropdown.Toggle
          noCaret
          className="new-project-button"
          bsStyle="primary"
        >
          {buttonText || t('new_project')}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <MenuItem onClick={() => setModal('blank_project')}>
            {t('blank_project')}
          </MenuItem>
          <MenuItem onClick={() => setModal('example_project')}>
            {t('example_project')}
          </MenuItem>
          <MenuItem onClick={() => setModal('upload_project')}>
            {t('upload_project')}
          </MenuItem>
          <MenuItem onClick={() => setModal('import_from_github')}>
            {t('import_from_github')}
          </MenuItem>
          <MenuItem divider />
          <MenuItem header>{t('templates')}</MenuItem>
          {templateLinks.map((templateLink, index) => (
            <MenuItem
              key={`new-project-button-template-${index}`}
              href={templateLink.url}
            >
              {templateLink.name === 'view_all'
                ? t('view_all')
                : templateLink.name}
            </MenuItem>
          ))}
        </Dropdown.Menu>
      </ControlledDropdown>
      <NewProjectButtonModal modal={modal} onHide={() => setModal(null)} />
    </>
  )
}

export default NewProjectButton
