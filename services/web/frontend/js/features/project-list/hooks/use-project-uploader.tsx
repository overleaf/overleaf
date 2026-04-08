import { useEffect, useState } from 'react'
import Uppy from '@uppy/core'
import XHRUpload from '@uppy/xhr-upload'
import getMeta from '@/utils/meta'

type UploaderConfig = {
  endpoint: string
  allowedFileTypes: string[]
  onSuccess: (projectId: string) => void
}

type ImportResponse = {
  project_id?: string
}

export function useProjectUploader({
  endpoint,
  allowedFileTypes,
  onSuccess,
}: UploaderConfig) {
  const { maxUploadSize, projectUploadTimeout } = getMeta('ol-ExposedSettings')
  const [ableToUpload, setAbleToUpload] = useState(false)

  const [uppy] = useState(() => {
    return new Uppy({
      allowMultipleUploadBatches: false,
      restrictions: {
        maxNumberOfFiles: 1,
        maxFileSize: maxUploadSize,
        allowedFileTypes,
      },
    })
      .use(XHRUpload, {
        endpoint,
        headers: {
          'X-CSRF-TOKEN': getMeta('ol-csrfToken'),
        },
        limit: 1,
        fieldName: 'qqfile',
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
        // refresh state so they can try uploading a new file
        setAbleToUpload(false)
      })
      .on('upload-success', (_file, response) => {
        const { project_id: projectId }: ImportResponse = response.body

        if (projectId) {
          onSuccess(projectId)
        }
      })
      .on('restriction-failed', () => {
        // 'restriction-failed event will be invoked when one of the "restrictions" above
        // is not complied:
        // 1. maxNumberOfFiles: if the uploaded files is more than 1, the rest of the files will appear here
        // for example, user drop 5 files to the uploader, this function will be invoked 4 times and the `file-added` event
        // will be invoked once
        // 2. maxFileSize: if the uploaded file has size > maxFileSize, it will appear here
        // 3. allowedFileTypes: if the file type is not allowed by allowedFileTypes, it will also appear here

        // reset state so they can try uploading a different file, etc
        setAbleToUpload(false)
      })
  })

  useEffect(() => {
    if (ableToUpload) {
      uppy.upload()
    }
  }, [ableToUpload, uppy])

  return uppy
}
