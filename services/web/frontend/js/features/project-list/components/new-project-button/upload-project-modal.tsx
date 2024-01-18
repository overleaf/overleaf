import { useEffect, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Uppy from '@uppy/core'
import { Dashboard } from '@uppy/react'
import XHRUpload from '@uppy/xhr-upload'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import getMeta from '../../../../utils/meta'
import { ExposedSettings } from '../../../../../../types/exposed-settings'

import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'

type UploadResponse = {
  project_id: string
}

type UploadProjectModalProps = {
  onHide: () => void
  openProject: (projectId: string) => void
}

function UploadProjectModal({ onHide, openProject }: UploadProjectModalProps) {
  const { t } = useTranslation()
  const { maxUploadSize, projectUploadTimeout } = getMeta(
    'ol-ExposedSettings'
  ) as ExposedSettings
  const [ableToUpload, setAbleToUpload] = useState(false)

  const [uppy] = useState(() => {
    return new Uppy({
      allowMultipleUploadBatches: false,
      restrictions: {
        maxNumberOfFiles: 1,
        maxFileSize: maxUploadSize,
        allowedFileTypes: ['.zip'],
      },
    })
      .use(XHRUpload, {
        endpoint: '/project/new/upload',
        headers: {
          'X-CSRF-TOKEN': window.csrfToken,
        },
        limit: 1,
        fieldName: 'qqfile', // "qqfile" is needed for our express multer middleware
        timeout: projectUploadTimeout,
      })
      .on('file-added', () => {
        // this function can be invoked multiple times depending on maxNumberOfFiles
        // in this case, since have maxNumberOfFiles = 1, this function will be invoked
        // once if the correct file were added
        // if user dragged more files than the maxNumberOfFiles allow,
        // the rest of the files will appear on the 'restriction-failed' event callback
        setAbleToUpload(true)
      })
      .on('upload-error', () => {
        // refresh state so they can try uploading a new zip
        setAbleToUpload(false)
      })
      .on('upload-success', async (file, response) => {
        const { project_id: projectId }: UploadResponse = response.body

        if (projectId) {
          openProject(projectId)
        }
      })
      .on('restriction-failed', () => {
        // 'restriction-failed event will be invoked when one of the "restrictions" above
        // is not complied:
        // 1. maxNumberOfFiles: if the uploaded files is more than 1, the rest of the files will appear here
        // for example, user drop 5 files to the uploader, this function will be invoked 4 times and the `file-added` event
        // will be invoked once
        // 2. maxFileSize: if the uploaded file has size > maxFileSize, it will appear here
        // 3. allowedFileTypes: if the type is not .zip, it will also appear here

        // reset state so they can try uploading a different file, etc
        setAbleToUpload(false)
      })
  })

  useEffect(() => {
    if (ableToUpload) {
      uppy.upload()
    }
  }, [ableToUpload, uppy])

  return (
    <AccessibleModal
      show
      animation
      onHide={onHide}
      id="upload-project-modal"
      backdrop="static"
    >
      <Modal.Header closeButton>
        <Modal.Title componentClass="h3">
          {t('upload_zipped_project')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
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
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={onHide} bsStyle={null} className="btn-secondary">
          {t('cancel')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default UploadProjectModal
