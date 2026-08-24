import { type JSXElementConstructor, useCallback, useState } from 'react'
import classnames from 'classnames'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import NewProjectButtonModal, {
  NewProjectButtonModalVariant,
} from './new-project-button/new-project-button-modal'
import AddAffiliation, { useAddAffiliation } from './add-affiliation'
import { Nullable } from '../../../../../types/utils'
import { sendMB } from '../../../infrastructure/event-tracking'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import {
  OLDropdown,
  OLDropdownDivider,
  OLDropdownHeader,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import type { OLDropdownProps } from '@/shared/components/types/dropdown-menu-props'
import { useSendProjectListMB } from '@/features/project-list/components/project-list-events'
import type { PortalTemplate } from '../../../../../types/portal-template'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useProjectListContext } from '@/features/project-list/context/project-list-context'
import { NestableDropdownContextProvider } from '@/shared/context/nestable-dropdown-context'
import { NestedMenuBarDropdown } from '@/shared/components/menu-bar/menu-bar-dropdown'

type SendTrackingEvent = {
  dropdownMenu: string
  dropdownOpen: boolean
  institutionTemplateName?: string
}

type Segmentation = SendTrackingEvent & {
  'welcome-page-redesign': 'default'
}

type ModalMenuClickOptions = {
  modalVariant: NewProjectButtonModalVariant
  dropdownMenuEvent: string
}

type NewProjectButtonProps = {
  id: string
  buttonText?: string
  className?: string
  trackingKey?: string
  showAddAffiliationWidget?: boolean
  align?: OLDropdownProps['align']
}

function NewProjectButton({
  id,
  buttonText,
  className,
  trackingKey,
  showAddAffiliationWidget,
  align = 'start',
}: NewProjectButtonProps) {
  const { t } = useTranslation()
  const { templateLinks } = getMeta('ol-ExposedSettings')
  const [modal, setModal] =
    useState<Nullable<NewProjectButtonModalVariant>>(null)
  const portalTemplates = getMeta('ol-portalTemplates') || []
  const { show: enableAddAffiliationWidget } = useAddAffiliation()
  const sendProjectListMB = useSendProjectListMB()
  const docxImportEnabled =
    useFeatureFlag('import-docx') &&
    getMeta('ol-ExposedSettings').enablePandocConversions
  const markdownImportEnabled =
    useFeatureFlag('import-markdown') &&
    getMeta('ol-ExposedSettings').enablePandocConversions
  const { selectedTagId, tags } = useProjectListContext()
  const initialTags = selectedTagId
    ? tags.filter(tag => tag._id === selectedTagId)
    : []
  const sendTrackingEvent = useCallback(
    ({
      dropdownMenu,
      dropdownOpen,
      institutionTemplateName,
    }: SendTrackingEvent) => {
      if (trackingKey) {
        let segmentation: Segmentation = {
          'welcome-page-redesign': 'default',
          dropdownMenu,
          dropdownOpen,
        }

        if (institutionTemplateName) {
          segmentation = {
            ...segmentation,
            institutionTemplateName,
          }
        }

        sendMB(trackingKey, segmentation)
      }
    },
    [trackingKey]
  )

  const handleMainButtonClick = useCallback(
    (dropdownOpen: boolean) => {
      sendTrackingEvent({
        dropdownMenu: 'main-button',
        dropdownOpen,
      })
    },
    [sendTrackingEvent]
  )

  const handleModalMenuClick = useCallback(
    (
      e: React.MouseEvent,
      { modalVariant, dropdownMenuEvent }: ModalMenuClickOptions
    ) => {
      // avoid invoking the "onClick" callback on the main dropdown button
      e.stopPropagation()

      sendTrackingEvent({
        dropdownMenu: dropdownMenuEvent,
        dropdownOpen: true,
      })
      sendProjectListMB('new-project-click', { item: dropdownMenuEvent })

      setModal(modalVariant)
    },
    [sendProjectListMB, sendTrackingEvent]
  )

  const handlePortalTemplateClick = useCallback(
    (e: React.MouseEvent, template: PortalTemplate) => {
      // avoid invoking the "onClick" callback on the main dropdown button
      e.stopPropagation()

      sendTrackingEvent({
        dropdownMenu: 'institution-template',
        dropdownOpen: true,
        institutionTemplateName: template.name,
      })
      sendProjectListMB('new-project-click', {
        item: template.name,
        destinationURL: template.url,
      })
    },
    [sendProjectListMB, sendTrackingEvent]
  )

  const handleStaticTemplateClick = useCallback(
    (e: React.MouseEvent, template: { trackingKey: string; url: string }) => {
      // avoid invoking the "onClick" callback on the main dropdown button
      e.stopPropagation()

      sendTrackingEvent({
        dropdownMenu: template.trackingKey,
        dropdownOpen: true,
      })
      sendProjectListMB('new-project-click', {
        item: template.trackingKey,
        destinationURL: template.url,
      })
    },
    [sendProjectListMB, sendTrackingEvent]
  )

  const [importProjectFromGithubMenu] = importOverleafModules(
    'importProjectFromGithubMenu'
  )

  const ImportProjectFromGithubMenu: JSXElementConstructor<{
    onClick: (e: React.MouseEvent) => void
  }> = importProjectFromGithubMenu?.import.default

  return (
    <>
      <OLDropdown
        align={align}
        className={classnames('new-project-dropdown', className)}
        onSelect={handleMainButtonClick}
        onToggle={nextShow => {
          if (nextShow) sendProjectListMB('new-project-expand', undefined)
        }}
      >
        <OLDropdownToggle
          id={id}
          className="new-project-button"
          variant="primary"
        >
          {buttonText || t('new_project')}
        </OLDropdownToggle>
        <OLDropdownMenu>
          <NestableDropdownContextProvider id={id}>
            <li role="none">
              <OLDropdownItem
                onClick={e =>
                  handleModalMenuClick(e, {
                    modalVariant: 'blank_project',
                    dropdownMenuEvent: 'blank-project',
                  })
                }
              >
                {t('blank_project')}
              </OLDropdownItem>
            </li>
            <OLDropdownDivider />
            <OLDropdownHeader aria-hidden="true">
              {t('import')}
            </OLDropdownHeader>
            <li role="none">
              <OLDropdownItem
                onClick={e =>
                  handleModalMenuClick(e, {
                    modalVariant: 'upload_project',
                    dropdownMenuEvent: 'upload-project',
                  })
                }
              >
                {t('existing_project_zip')}
              </OLDropdownItem>
            </li>
            {docxImportEnabled && (
              <li role="none">
                <OLDropdownItem
                  onClick={e =>
                    handleModalMenuClick(e, {
                      modalVariant: 'import_docx',
                      dropdownMenuEvent: 'import-docx',
                    })
                  }
                >
                  {t('word_document')}
                </OLDropdownItem>
              </li>
            )}
            {markdownImportEnabled && (
              <li role="none">
                <OLDropdownItem
                  onClick={e =>
                    handleModalMenuClick(e, {
                      modalVariant: 'import_markdown',
                      dropdownMenuEvent: 'import-markdown',
                    })
                  }
                >
                  {t('markdown_document')}
                </OLDropdownItem>
              </li>
            )}
            {ImportProjectFromGithubMenu && (
              <li role="none">
                <ImportProjectFromGithubMenu
                  onClick={e =>
                    handleModalMenuClick(e, {
                      modalVariant: 'import_from_github',
                      dropdownMenuEvent: 'import-from-github',
                    })
                  }
                />
              </li>
            )}
            <OLDropdownDivider />
            <OLDropdownHeader aria-hidden="true">
              {t('templates')}
            </OLDropdownHeader>
            <li role="none">
              <OLDropdownItem
                onClick={e =>
                  handleModalMenuClick(e, {
                    modalVariant: 'example_project',
                    dropdownMenuEvent: 'example-project',
                  })
                }
              >
                {t('example_project')}
              </OLDropdownItem>
            </li>
            {portalTemplates.map((portalTemplate, index) => (
              <li role="none" key={`portal-template-${index}`}>
                <OLDropdownItem
                  href={`${portalTemplate.url}#templates`}
                  onClick={e => handlePortalTemplateClick(e, portalTemplate)}
                  aria-label={`${portalTemplate.name} ${t('template')}`}
                >
                  {portalTemplate.name}
                </OLDropdownItem>
              </li>
            ))}
            {templateLinks && templateLinks.length > 0 && (
              <NestedMenuBarDropdown
                id="more-templates"
                title={t('more_templates')}
                drop={align === 'end' ? 'start' : 'end'}
              >
                {templateLinks.map((template, i) => (
                  <li role="none" key={`more-template-${i}`}>
                    <OLDropdownItem
                      href={template.url}
                      onClick={e => handleStaticTemplateClick(e, template)}
                      aria-label={`${template.name === 'view_all' ? t('view_all') : template.name} ${t('template')}`}
                    >
                      {template.name === 'view_all'
                        ? t('view_all')
                        : template.name}
                    </OLDropdownItem>
                  </li>
                ))}
              </NestedMenuBarDropdown>
            )}
            {showAddAffiliationWidget && enableAddAffiliationWidget ? (
              <>
                <OLDropdownDivider />
                <li className="add-affiliation-mobile-wrapper">
                  <AddAffiliation className="is-mobile" />
                </li>
              </>
            ) : null}
          </NestableDropdownContextProvider>
        </OLDropdownMenu>
      </OLDropdown>
      <NewProjectButtonModal
        modal={modal}
        onHide={() => setModal(null)}
        initialTags={initialTags}
      />
    </>
  )
}

export default NewProjectButton
