import { useEffect, useState } from 'react'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import Uppy from '@uppy/core'
import { Dashboard } from '@uppy/react'
import XHRUpload from '@uppy/xhr-upload'
import getMeta from '../../../../utils/meta'

import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'

type ImportResponse = {
  project_id: string
}

type ImportDocxModalProps = {
  onHide: () => void
  openProject: (projectId: string) => void
}

function ImportDocxModal({ onHide, openProject }: ImportDocxModalProps) {
  const { t } = useTranslation()
  const { maxUploadSize, projectUploadTimeout } = getMeta('ol-ExposedSettings')
  const [ableToUpload, setAbleToUpload] = useState(false)

  const [uppy] = useState(() => {
    return new Uppy({
      allowMultipleUploadBatches: false,
      restrictions: {
        maxNumberOfFiles: 1,
        maxFileSize: maxUploadSize,
        allowedFileTypes: ['.docx'],
      },
    })
      .use(XHRUpload, {
        endpoint: '/project/new/import-docx',
        headers: {
          'X-CSRF-TOKEN': getMeta('ol-csrfToken'),
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
        const { project_id: projectId }: ImportResponse = response.body

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
