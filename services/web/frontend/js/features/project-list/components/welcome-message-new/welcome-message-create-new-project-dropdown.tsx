import { useCallback, useState, forwardRef } from 'react'
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
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
        src="/img/welcome-page/create-a-new-project.svg"
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
  const [showDropdown, setShowDropdown] = useState(false)
  const { t } = useTranslation()
  const portalTemplates = getMeta('ol-portalTemplates') || []

  const { isOverleaf } = getMeta('ol-ExposedSettings')

  const handleClick = useCallback(() => {
    sendMB('welcome-page-create-first-project-click', {
      dropdownMenu: 'main-button',
      dropdownOpen: showDropdown,
    })

    // toggle the dropdown
    setShowDropdown(!showDropdown)
  }, [setShowDropdown, showDropdown])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.code === 'Enter') {
        handleClick()
      } else if (e.code === 'Space') {
        handleClick()

        // prevent page down when pressing space
        e.preventDefault()
      }
    },
    [handleClick]
  )

  const handleDropdownItemClick = useCallback(
    (
      e: React.MouseEvent,
      modalVariant: NewProjectButtonModalVariant,
      dropdownMenuEvent: string
    ) => {
      // prevent firing the main dropdown onClick event
      e.stopPropagation()

      setShowDropdown(false)

      sendMB('welcome-page-create-first-project-click', {
        dropdownOpen: true,
        dropdownMenu: dropdownMenuEvent,
      })
      setActiveModal(modalVariant)
    },
    [setActiveModal, setShowDropdown]
  )

  const handlePortalTemplateClick = useCallback(
    (e: React.MouseEvent, institutionTemplateName: string) => {
      // prevent firing the main dropdown onClick event
      e.stopPropagation()

      setShowDropdown(false)

      sendMB('welcome-page-create-first-project-click', {
        dropdownMenu: 'institution-template',
        dropdownOpen: true,
        institutionTemplateName,
      })
    },
    [setShowDropdown]
  )

  return (
    <BootstrapVersionSwitcher
      bs3={
        <div
          role="button"
          tabIndex={0}
          className="card welcome-message-card"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          <p>{t('create_a_new_project')}</p>
          <img
            className="welcome-message-card-img"
            src="/img/welcome-page/create-a-new-project.svg"
            aria-hidden="true"
            alt=""
          />
          {showDropdown && (
            <div className="card create-new-project-dropdown">
              <button
                onClick={e =>
                  handleDropdownItemClick(e, 'blank_project', 'blank-project')
                }
              >
                {t('blank_project')}
              </button>
              <button
                onClick={e =>
                  handleDropdownItemClick(
                    e,
                    'example_project',
                    'example-project'
                  )
                }
              >
                {t('example_project')}
              </button>
              <button
                onClick={e =>
                  handleDropdownItemClick(e, 'upload_project', 'upload-project')
                }
              >
                {t('upload_project')}
              </button>
              {isOverleaf && (
                <button
                  onClick={e =>
                    handleDropdownItemClick(
                      e,
                      'import_from_github',
                      'import-from-github'
                    )
                  }
                >
                  {t('import_from_github')}
                </button>
              )}
              {portalTemplates.length > 0 ? (
                <>
                  <hr />
                  <div className="dropdown-header">
                    {t('institution_templates')}
                  </div>
                  {portalTemplates?.map((portalTemplate, index) => (
                    <a
                      key={`portal-template-${index}`}
                      href={`${portalTemplate.url}#templates`}
                      onClick={e =>
                        handlePortalTemplateClick(e, portalTemplate.name)
                      }
                    >
                      {portalTemplate.name}
                    </a>
                  ))}
                </>
              ) : null}
            </div>
          )}
        </div>
      }
      bs5={
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
                  handleDropdownItemClick(
                    e,
                    'example_project',
                    'example-project'
                  )
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
                    onClick={e =>
                      handlePortalTemplateClick(e, portalTemplate.name)
                    }
                    href={`${portalTemplate.url}#templates`}
                  >
                    {portalTemplate.name}
                  </DropdownItem>
                ))}
              </>
            ) : null}
          </DropdownMenu>
        </Dropdown>
      }
    />
  )
}

export default WelcomeMessageCreateNewProjectDropdown
