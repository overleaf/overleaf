import { useCallback, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { sendMB } from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import { NewProjectButtonModalVariant } from '../new-project-button/new-project-button-modal'
import {
  OLDropdown,
  OLDropdownDivider,
  OLDropdownHeader,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import createNewProjectImage from '../../images/create-a-new-project.svg'
import { useFeatureFlag } from '@/shared/context/split-test-context'

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
  const docxImportEnabled =
    useFeatureFlag('import-docx') &&
    getMeta('ol-ExposedSettings').enablePandocConversions
  const markdownImportEnabled =
    useFeatureFlag('import-markdown') &&
    getMeta('ol-ExposedSettings').enablePandocConversions

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
    <OLDropdown className="welcome-message-card-item">
      <OLDropdownToggle
        as={CustomDropdownToggle}
        id="create-new-project-dropdown-toggle-btn"
      />
      <OLDropdownMenu flip={false} className="create-new-project-dropdown">
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={e =>
              handleDropdownItemClick(e, 'blank_project', 'blank-project')
            }
            tabIndex={-1}
          >
            {t('blank_project')}
          </OLDropdownItem>
        </li>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={e =>
              handleDropdownItemClick(e, 'example_project', 'example-project')
            }
            tabIndex={-1}
          >
            {t('example_project')}
          </OLDropdownItem>
        </li>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={e =>
              handleDropdownItemClick(e, 'upload_project', 'upload-project')
            }
            tabIndex={-1}
          >
            {t('existing_project_zip')}
          </OLDropdownItem>
        </li>
        {docxImportEnabled && (
          <li role="none">
            <OLDropdownItem
              as="button"
              onClick={e =>
                handleDropdownItemClick(e, 'import_docx', 'import-docx')
              }
              tabIndex={-1}
            >
              {t('import_word_document')}
            </OLDropdownItem>
          </li>
        )}
        {markdownImportEnabled && (
          <li role="none">
            <OLDropdownItem
              as="button"
              onClick={e =>
                handleDropdownItemClick(e, 'import_markdown', 'import-markdown')
              }
              tabIndex={-1}
            >
              {t('import_markdown_file')}
            </OLDropdownItem>
          </li>
        )}
        {isOverleaf && (
          <li role="none">
            <OLDropdownItem
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
            </OLDropdownItem>
          </li>
        )}
        {(portalTemplates?.length ?? 0) > 0 ? (
          <>
            <OLDropdownDivider />
            <OLDropdownHeader aria-hidden="true">
              {t('institution_templates')}
            </OLDropdownHeader>
            {portalTemplates?.map((portalTemplate, index) => (
              <OLDropdownItem
                key={`portal-template-${index}`}
                onClick={e => handlePortalTemplateClick(e, portalTemplate.name)}
                href={`${portalTemplate.url}#templates`}
              >
                {portalTemplate.name}
              </OLDropdownItem>
            ))}
          </>
        ) : null}
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default WelcomeMessageCreateNewProjectDropdown
