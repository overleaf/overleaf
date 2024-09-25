import { FileTreeEntity } from '../../../../../../types/file-tree-entity'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import { useCallback } from 'react'
import { syncDelete } from '@/features/file-tree/util/sync-mutation'
import { TFunction } from 'i18next'
import OLButton from '@/features/ui/components/ol/ol-button'

export type Conflict = {
  entity: FileTreeEntity
  type: 'file' | 'folder'
}

const getConflictText = (conflicts: Conflict[], t: TFunction) => {
  const hasFolderConflict = conflicts.some(
    conflict => conflict.type === 'folder'
  )

  const hasFileConflict = conflicts.some(conflict => conflict.type === 'file')

  if (hasFolderConflict && hasFileConflict) {
    return t('the_following_files_and_folders_already_exist_in_this_project')
  }

  if (hasFolderConflict) {
    return t('the_following_folder_already_exists_in_this_project', {
      count: conflicts.length,
    })
  }

  return t('the_following_files_already_exist_in_this_project')
}

export function FileUploadConflicts({
  cancel,
  conflicts,
  handleOverwrite,
}: {
  cancel: () => void
  conflicts: Conflict[]
  handleOverwrite: () => void
}) {
  const { t } = useTranslation()

  // Don't allow overwriting folders with files
  const hasFolderConflict = conflicts.some(
    conflict => conflict.type === 'folder'
  )

  return (
    <div className="small modal-new-file-body-conflict">
      {conflicts.length > 0 && (
        <>
          <p className="text-center mb-0">{getConflictText(conflicts, t)}</p>

          <ul className="text-center list-unstyled row-spaced-small mt-1">
            {conflicts.map((conflict, index) => (
              <li key={index}>
                <strong>{conflict.entity.name}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      {!hasFolderConflict && (
        <p className="text-center row-spaced-small">
          {t('do_you_want_to_overwrite_them')}
        </p>
      )}

      <p className="text-center">
        <OLButton variant="secondary" onClick={cancel}>
          {t('cancel')}
        </OLButton>
        &nbsp;
        {!hasFolderConflict && (
          <OLButton variant="danger" onClick={handleOverwrite}>
            {t('overwrite')}
          </OLButton>
        )}
      </p>
    </div>
  )
}

export function FolderUploadConflicts({
  cancel,
  handleOverwrite,
  conflicts,
  setError,
}: {
  cancel: () => void
  handleOverwrite: () => void
  conflicts: Conflict[]
  setError: (error: string) => void
}) {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()

  // Don't allow overwriting files with a folder
  const hasFileConflict = conflicts.some(conflict => conflict.type === 'file')

  const deleteAndRetry = useCallback(async () => {
    // TODO: confirm deletion?

    try {
      await Promise.all(
        conflicts.map(conflict =>
          syncDelete(projectId, 'folder', conflict.entity._id)
        )
      )

      handleOverwrite()
    } catch (error: any) {
      setError(error.message)
    }
  }, [setError, conflicts, handleOverwrite, projectId])

  return (
    <div className="small modal-new-file-body-conflict">
      <p className="text-center mb-0">{getConflictText(conflicts, t)}</p>

      <ul className="text-center list-unstyled row-spaced-small mt-1">
        {conflicts.map((conflict, index) => (
          <li key={index}>
            <strong>{conflict.entity.name}</strong>
          </li>
        ))}
      </ul>

      {!hasFileConflict && (
        <p className="text-center row-spaced-small">
          {t('overwriting_the_original_folder')}
          <br />
          {t('do_you_want_to_overwrite_it', {
            count: conflicts.length,
          })}
        </p>
      )}

      <p className="text-center">
        <OLButton variant="secondary" onClick={cancel}>
          {t('cancel')}
        </OLButton>
        &nbsp;
        {!hasFileConflict && (
          <OLButton variant="danger" onClick={deleteAndRetry}>
            {t('overwrite')}
          </OLButton>
        )}
      </p>
    </div>
  )
}
