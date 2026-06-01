import { useMemo } from 'react'
import { Dashboard } from '@uppy/react'
import { useTranslation } from 'react-i18next'
import { useProjectUploader } from '../../hooks/use-project-uploader'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'

function ImportDocumentModal({
  type,
  onHide,
  openProject,
}: {
  type: 'docx' | 'markdown'
  onHide: () => void
  openProject: (id: string, convertedFrom?: string) => void
}) {
  const { t } = useTranslation()
  const IMPORT_CONFIGS = useMemo(
    () => ({
      docx: {
        allowedFileTypes: ['.docx'],
        title: t('choose_word_document'),
        browseLabel: 'Select .docx file',
        dragLabel: '%{browseFiles} or \n\n Drag .docx file',
      },
      markdown: {
        allowedFileTypes: ['.md'],
        title: t('choose_markdown_file'),
        browseLabel: 'Select .md file',
        dragLabel: '%{browseFiles} or \n\n Drag .md file',
      },
    }),
    [t]
  )
  const config = IMPORT_CONFIGS[type]

  const uppy = useProjectUploader({
    endpoint: `/project/new/import-document?type=${type}`,
    allowedFileTypes: config.allowedFileTypes,
    onSuccess: (projectId: string) => openProject(projectId, type),
  })

  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="upload-project-modal"
      backdrop="static"
    >
      {/* TODO: make necessary changes here for import document modal */}
      <OLModalHeader>
        <OLModalTitle as="h3">{config.title}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>{t('import_document_description')}</p>
        <Dashboard
          uppy={uppy}
          proudlyDisplayPoweredByUppy={false}
          showLinkToFileUploadResult={false}
          hideUploadButton
          showSelectedFiles={false}
          height={300}
          locale={{
            strings: {
              browseFiles: config.browseLabel,
              dropPasteFiles: config.dragLabel,
            },
          }}
          className="project-list-upload-project-modal-uppy-dashboard"
        />
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onHide}>
          {t('cancel')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default ImportDocumentModal
