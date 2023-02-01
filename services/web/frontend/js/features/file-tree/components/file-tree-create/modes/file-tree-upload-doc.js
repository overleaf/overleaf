import { Trans, useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import Uppy from '@uppy/core'
import XHRUpload from '@uppy/xhr-upload'
import { Dashboard, useUppy } from '@uppy/react'
import { useFileTreeActionable } from '../../../contexts/file-tree-actionable'
import { useProjectContext } from '../../../../../shared/context/project-context'

import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'
import { refreshProjectMetadata } from '../../../util/api'
import ErrorMessage from '../error-message'

export default function FileTreeUploadDoc() {
  const { parentFolderId, cancel, isDuplicate, droppedFiles, setDroppedFiles } =
    useFileTreeActionable()
  const { _id: projectId } = useProjectContext(projectContextPropTypes)

  const [error, setError] = useState()

  const [conflicts, setConflicts] = useState([])
  const [overwrite, setOverwrite] = useState(false)

  const maxNumberOfFiles = 40
  const maxFileSize = window.ExposedSettings.maxUploadSize

  // calculate conflicts
  const buildConflicts = files =>
    Object.values(files).filter(file =>
      isDuplicate(file.meta.targetFolderId ?? parentFolderId, file.meta.name)
    )

  const buildEndpoint = (projectId, targetFolderId) => {
    let endpoint = `/project/${projectId}/upload`

    if (targetFolderId) {
      endpoint += `?folder_id=${targetFolderId}`
    }

    return endpoint
  }

  // initialise the Uppy object
  const uppy = useUppy(() => {
    const endpoint = buildEndpoint(projectId, parentFolderId)

    return (
      new Uppy({
        // logger: Uppy.debugLogger,
        allowMultipleUploads: false,
        restrictions: {
          maxNumberOfFiles,
          maxFileSize: maxFileSize || null,
        },
        onBeforeUpload: files => {
          let result = true

          setOverwrite(overwrite => {
            if (!overwrite) {
              setConflicts(() => {
                const conflicts = buildConflicts(files)

                result = conflicts.length === 0

                return conflicts
              })
            }

            return overwrite
          })

          return result
        },
        autoProceed: true,
      })
        // use the basic XHR uploader
        .use(XHRUpload, {
          endpoint,
          headers: {
            'X-CSRF-TOKEN': window.csrfToken,
          },
          // limit: maxConnections || 1,
          limit: 1,
          fieldName: 'qqfile', // "qqfile" field inherited from FineUploader
        })
        // close the modal when all the uploads completed successfully
        .on('complete', result => {
          if (!result.failed.length) {
            // $scope.$emit('done', { name: name })
            cancel()
          }
        })
        // broadcast doc metadata after each successful upload
        .on('upload-success', (file, response) => {
          if (response.body.entity_type === 'doc') {
            window.setTimeout(() => {
              refreshProjectMetadata(projectId, response.body.entity_id)
            }, 250)
          }
        })
        // handle upload errors
        .on('upload-error', (file, error, response) => {
          switch (response?.status) {
            case 429:
              setError('rate-limit-hit')
              break

            case 403:
              setError('not-logged-in')
              break

            default:
              console.error(error)
              setError(response?.body?.error || 'generic_something_went_wrong')
              break
          }
        })
    )
  })

  useEffect(() => {
    if (uppy && droppedFiles) {
      uppy.setOptions({
        autoProceed: false,
      })
      for (const file of droppedFiles.files) {
        const fileId = uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
          source: 'Local',
          isRemote: false,
          meta: {
            targetFolderId: droppedFiles.targetFolderId,
          },
        })
        const uppyFile = uppy.getFile(fileId)
        uppy.setFileState(fileId, {
          xhrUpload: {
            ...uppyFile.xhrUpload,
            endpoint: buildEndpoint(projectId, droppedFiles.targetFolderId),
          },
        })
      }
    }

    return () => {
      setDroppedFiles(null)
    }
  }, [uppy, droppedFiles, setDroppedFiles, projectId])

  // handle forced overwriting of conflicting files
  const handleOverwrite = useCallback(() => {
    setOverwrite(true)
    window.setTimeout(() => {
      uppy.upload()
    }, 10)
  }, [uppy])

  // whether to show a message about conflicting files
  const showConflicts = !overwrite && conflicts.length > 0

  return (
    <>
      {error && (
        <UploadErrorMessage error={error} maxNumberOfFiles={maxNumberOfFiles} />
      )}

      {showConflicts ? (
        <UploadConflicts
          cancel={cancel}
          conflicts={conflicts}
          handleOverwrite={handleOverwrite}
        />
      ) : (
        <Dashboard
          uppy={uppy}
          showProgressDetails
          // note={`Up to ${maxNumberOfFiles} files, up to ${maxFileSize / (1024 * 1024)}MB`}
          height={400}
          width="100%"
          showLinkToFileUploadResult={false}
          proudlyDisplayPoweredByUppy={false}
          locale={{
            strings: {
              // Text to show on the droppable area.
              // `%{browse}` is replaced with a link that opens the system file selection dialog.
              // TODO: 'drag_here' or 'drop_files_here_to_upload'?
              // dropHereOr: `${t('drag_here')} ${t('or')} %{browse}`,
              dropPasteFiles: `Drag here, paste an image or file, or %{browseFiles}`,
              // Used as the label for the link that opens the system file selection dialog.
              // browseFiles: t('select_from_your_computer')
              browseFiles: 'select from your computer',
            },
          }}
        />
      )}
    </>
  )
}

const projectContextPropTypes = {
  _id: PropTypes.string.isRequired,
}

function UploadErrorMessage({ error, maxNumberOfFiles }) {
  switch (error) {
    case 'too-many-files':
      return (
        <Trans
          i18nKey="maximum_files_uploaded_together"
          values={{ max: maxNumberOfFiles }}
        />
      )

    default:
      return <ErrorMessage error={error} />
  }
}
UploadErrorMessage.propTypes = {
  error: PropTypes.string.isRequired,
  maxNumberOfFiles: PropTypes.number.isRequired,
}

function UploadConflicts({ cancel, conflicts, handleOverwrite }) {
  const { t } = useTranslation()

  return (
    <div className="small modal-new-file--body-conflict">
      <p className="text-center mb-0">
        {t('the_following_files_already_exist_in_this_project')}
      </p>

      <ul className="text-center list-unstyled row-spaced-small mt-1">
        {conflicts.map((conflict, index) => (
          <li key={index}>
            <strong>{conflict.meta.name}</strong>
          </li>
        ))}
      </ul>

      <p className="text-center row-spaced-small">
        {t('do_you_want_to_overwrite_them')}
      </p>

      <p className="text-center">
        <Button bsStyle={null} className="btn-secondary" onClick={cancel}>
          {t('cancel')}
        </Button>
        &nbsp;
        <Button bsStyle="danger" onClick={handleOverwrite}>
          {t('overwrite')}
        </Button>
      </p>
    </div>
  )
}
UploadConflicts.propTypes = {
  cancel: PropTypes.func.isRequired,
  conflicts: PropTypes.array.isRequired,
  handleOverwrite: PropTypes.func.isRequired,
}
