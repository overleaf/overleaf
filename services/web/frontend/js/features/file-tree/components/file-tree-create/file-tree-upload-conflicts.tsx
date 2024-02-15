import { FileTreeEntity } from '../../../../../../types/file-tree-entity'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import { useCallback } from 'react'
import { syncDelete } from '@/features/file-tree/util/sync-mutation'
import { Button } from 'react-bootstrap'

export function UploadConflicts({
  cancel,
  conflicts,
  folderConflicts,
  handleOverwrite,
  setError,
}: {
  cancel: () => void
  conflicts: FileTreeEntity[]
  folderConflicts: FileTreeEntity[]
  handleOverwrite: () => void
  setError: (error: string) => void
}) {
  const { t } = useTranslation()

  // ensure that no uploads happen while there are folder conflicts
  if (folderConflicts.length > 0) {
    return (
      <FolderUploadConflicts
        cancel={cancel}
        folderConflicts={folderConflicts}
        handleOverwrite={handleOverwrite}
        setError={setError}
      />
    )
  }

  return (
    <div className="small modal-new-file--body-conflict">
      {conflicts.length > 0 && (
        <>
          <p className="text-center mb-0">
            {t('the_following_files_already_exist_in_this_project')}
          </p>

          <ul className="text-center list-unstyled row-spaced-small mt-1">
            {conflicts.map((conflict, index) => (
              <li key={index}>
                <strong>{conflict.name}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

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

function FolderUploadConflicts({
  cancel,
  handleOverwrite,
  folderConflicts,
  setError,
}: {
  cancel: () => void
  handleOverwrite: () => void
  folderConflicts: FileTreeEntity[]
  setError: (error: string) => void
}) {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()

  const deleteAndRetry = useCallback(async () => {
    // TODO: confirm deletion?

    try {
      await Promise.all(
        folderConflicts.map(
          entity => syncDelete(projectId, 'folder', entity._id) // TODO: might be a file!
        )
      )

      handleOverwrite()
    } catch (error: any) {
      setError(error.message)
    }
  }, [setError, folderConflicts, handleOverwrite, projectId])

  return (
    <div className="small modal-new-file--body-conflict">
      <p className="text-center mb-0">
        {t('the_following_folder_already_exists_in_this_project', {
          count: folderConflicts.length,
        })}
      </p>

      <ul className="text-center list-unstyled row-spaced-small mt-1">
        {folderConflicts.map((entity, index) => (
          <li key={index}>
            <strong>{entity.name}</strong>
          </li>
        ))}
      </ul>

      <p className="text-center row-spaced-small">
        {t('overwriting_the_original_folder')}
        <br />
        {t('do_you_want_to_overwrite_it', {
          count: folderConflicts.length,
        })}
      </p>

      <p className="text-center">
        <Button bsStyle={null} className="btn-secondary" onClick={cancel}>
          {t('cancel')}
        </Button>
        &nbsp;
        <Button bsStyle="danger" onClick={deleteAndRetry}>
          {t('overwrite')}
        </Button>
      </p>
    </div>
  )
}
