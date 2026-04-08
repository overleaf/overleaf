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

function ImportDocxModal({
  onHide,
  openProject,
}: {
  onHide: () => void
  openProject: (id: string, isConvertedFromDocx?: boolean) => void
}) {
  const { t } = useTranslation()

  const uppy = useProjectUploader({
    endpoint: '/project/new/import-docx',
    allowedFileTypes: ['.docx'],
    onSuccess: (projectId: string) => openProject(projectId, true),
  })

  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="upload-project-modal"
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle as="h3">{t('import_word_document')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <Dashboard
          uppy={uppy}
          proudlyDisplayPoweredByUppy={false}
          showLinkToFileUploadResult={false}
          hideUploadButton
          showSelectedFiles={false}
          height={300}
          locale={{
            strings: {
              browseFiles: 'Select a .docx file',
              dropPasteFiles: '%{browseFiles} or \n\n drag a .docx file',
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

export default ImportDocxModal
