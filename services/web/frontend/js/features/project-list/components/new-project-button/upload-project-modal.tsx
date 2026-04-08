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

function UploadProjectModal({
  onHide,
  openProject,
}: {
  onHide: () => void
  openProject: (id: string) => void
}) {
  const { t } = useTranslation()

  const uppy = useProjectUploader({
    endpoint: '/project/new/upload',
    allowedFileTypes: ['.zip'],
    onSuccess: openProject,
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
        <OLModalTitle as="h3">{t('upload_zipped_project')}</OLModalTitle>
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
              browseFiles: 'Select a .zip file',
              dropPasteFiles: '%{browseFiles} or \n\n drag a .zip file',
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

export default UploadProjectModal
