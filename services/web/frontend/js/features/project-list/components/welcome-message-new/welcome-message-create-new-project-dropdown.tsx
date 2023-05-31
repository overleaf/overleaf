import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PortalTemplate } from '../../../../../../types/portal-template'
import { sendMB } from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import { NewProjectButtonModalVariant } from '../new-project-button/new-project-button-modal'

type WelcomeMessageCreateNewProjectDropdownProps = {
  setActiveModal: (modal: NewProjectButtonModalVariant) => void
}

function WelcomeMessageCreateNewProjectDropdown({
  setActiveModal,
}: WelcomeMessageCreateNewProjectDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const { t } = useTranslation()
  const portalTemplates = getMeta('ol-portalTemplates') as
    | PortalTemplate[]
    | undefined

  const handleClick = useCallback(() => {
    sendMB('welcome-page-create-first-project-click', {
      'welcome-page-redesign': 'enabled',
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
      e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
      modalVariant: NewProjectButtonModalVariant,
      dropdownMenuEvent: string
    ) => {
      // prevent firing the main dropdown onClick event
      e.stopPropagation()

      setShowDropdown(false)

      sendMB('welcome-page-create-first-project-click', {
        'welcome-page-redesign': 'enabled',
        dropdownOpen: true,
        dropdownMenu: dropdownMenuEvent,
      })
      setActiveModal(modalVariant)
    },
    [setActiveModal, setShowDropdown]
  )

  const handlePortalTemplateClick = useCallback(
    (
      e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
      institutionTemplateName: string
    ) => {
      // prevent firing the main dropdown onClick event
      e.stopPropagation()

      setShowDropdown(false)

      sendMB('welcome-page-create-first-project-click', {
        'welcome-page-redesign': 'enabled',
        dropdownMenu: 'institution-template',
        dropdownOpen: true,
        institutionTemplateName,
      })
    },
    [setShowDropdown]
  )

  return (
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
      {showDropdown ? (
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
              handleDropdownItemClick(e, 'example_project', 'example-project')
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
          {(portalTemplates?.length ?? 0) > 0 ? (
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
      ) : null}
    </div>
  )
}

export default WelcomeMessageCreateNewProjectDropdown
