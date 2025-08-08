import { useCallback, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { sendMB } from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import { NewProjectButtonModalVariant } from '../new-project-button/new-project-button-modal'
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import createNewProjectImage from '../../images/create-a-new-project.svg'

const CustomDropdownToggle = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'>
>(({ onClick, 'aria-expanded': ariaExpanded }, ref) => {
  const { t } = useTranslation()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onClick?.(e)

    sendMB('welcome-page-create-first-project-click', {
      dropdownMenu: 'main-button',
      dropdownOpen: ariaExpanded,
    })
  }

  return (
    <button
      ref={ref}
      className="card welcome-message-card"
      onClick={handleClick}
      id="create-new-project-dropdown-button"
      aria-expanded={ariaExpanded}
      aria-haspopup="true"
    >
      <span>{t('create_a_new_project')}</span>
      <img
        className="welcome-message-card-img"
        src={createNewProjectImage}
        aria-hidden="true"
        alt=""
      />
    </button>
  )
})
CustomDropdownToggle.displayName = 'CustomDropdownToggle'

type WelcomeMessageCreateNewProjectDropdownProps = {
  setActiveModal: (modal: NewProjectButtonModalVariant) => void
}

function WelcomeMessageCreateNewProjectDropdown({
  setActiveModal,
}: WelcomeMessageCreateNewProjectDropdownProps) {
  const { t } = useTranslation()
  const portalTemplates = getMeta('ol-portalTemplates') || []

  const { isOverleaf } = getMeta('ol-ExposedSettings')

  const handleDropdownItemClick = useCallback(
    (
      e: React.MouseEvent,
      modalVariant: NewProjectButtonModalVariant,
      dropdownMenuEvent: string
    ) => {
      // prevent firing the main dropdown onClick event
      e.stopPropagation()

      sendMB('welcome-page-create-first-project-click', {
        dropdownOpen: true,
        dropdownMenu: dropdownMenuEvent,
      })
      setActiveModal(modalVariant)
    },
    [setActiveModal]
  )

  const handlePortalTemplateClick = useCallback(
    (e: React.MouseEvent, institutionTemplateName: string) => {
      // prevent firing the main dropdown onClick event
      e.stopPropagation()

      sendMB('welcome-page-create-first-project-click', {
        dropdownMenu: 'institution-template',
        dropdownOpen: true,
        institutionTemplateName,
      })
    },
    []
  )

  return (
    <Dropdown>
      <DropdownToggle
        as={CustomDropdownToggle}
        id="create-new-project-dropdown-toggle-btn"
      />
      <DropdownMenu flip={false} className="create-new-project-dropdown">
        <li role="none">
          <DropdownItem
            as="button"
            onClick={e =>
              handleDropdownItemClick(e, 'blank_project', 'blank-project')
            }
            tabIndex={-1}
          >
            {t('blank_project')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={e =>
              handleDropdownItemClick(e, 'example_project', 'example-project')
            }
            tabIndex={-1}
          >
            {t('example_project')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={e =>
              handleDropdownItemClick(e, 'upload_project', 'upload-project')
            }
            tabIndex={-1}
          >
            {t('upload_project')}
          </DropdownItem>
        </li>
        {isOverleaf && (
          <li role="none">
            <DropdownItem
              as="button"
              onClick={e =>
                handleDropdownItemClick(
                  e,
                  'import_from_github',
                  'import-from-github'
                )
              }
              tabIndex={-1}
            >
              {t('import_from_github')}
            </DropdownItem>
          </li>
        )}
        {(portalTemplates?.length ?? 0) > 0 ? (
          <>
            <DropdownDivider />
            <DropdownHeader aria-hidden="true">
              {t('institution_templates')}
            </DropdownHeader>
            {portalTemplates?.map((portalTemplate, index) => (
              <DropdownItem
                key={`portal-template-${index}`}
                onClick={e => handlePortalTemplateClick(e, portalTemplate.name)}
                href={`${portalTemplate.url}#templates`}
              >
                {portalTemplate.name}
              </DropdownItem>
            ))}
          </>
        ) : null}
      </DropdownMenu>
    </Dropdown>
  )
}

export default WelcomeMessageCreateNewProjectDropdown
