import { useCallback } from 'react'
import { FileNameInput } from './file-name-input'
import { File } from '../../utils/file'
import { Select } from '../../../../shared/components/select'
import { useCurrentProjectFolders } from '../../hooks/useCurrentProjectFolders'
import { useTranslation } from 'react-i18next'

export const FileRelocator = ({
  name,
  setName,
  onNameChanged,
  onFolderChanged,
  setNameDirty,
  folder,
  setFolder,
  nameDisabled,
}: {
  nameDisabled: boolean
  name: string
  setName: (name: string) => void
  onNameChanged: (name: string) => void
  folder: File | null
  onFolderChanged: (folder: File | null | undefined) => void
  setFolder: (folder: File) => void
  setNameDirty: (nameDirty: boolean) => void
}) => {
  const { t } = useTranslation()
  const [folders, rootFile] = useCurrentProjectFolders()

  const nameChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNameDirty(true)
      setName(e.target.value)
      onNameChanged(e.target.value)
    },
    [setName, setNameDirty, onNameChanged]
  )
  const selectedFolderChanged = useCallback(
    (item: File | null | undefined) => {
      if (item) {
        setFolder(item)
      } else {
        setFolder(rootFile)
      }
      onFolderChanged(item)
    },
    [setFolder, onFolderChanged, rootFile]
  )

  return (
    <>
      <label
        htmlFor="figure-modal-relocated-file-name"
        className="figure-modal-input-label"
      >
        {t('file_name_in_this_project_figure_modal')}
      </label>
      <FileNameInput
        id="figure-modal-relocated-file-name"
        type="text"
        className="form-control figure-modal-input-field"
        value={name}
        disabled={nameDisabled}
        placeholder="example.jpg"
        onChange={nameChanged}
        targetFolder={folder}
      />
      <Select
        items={folders || []}
        itemToString={item => {
          if (item?.path === '' && item?.name === 'rootFolder') {
            return t('no_folder')
          }
          if (item) {
            return `${item.path}${item.name}`
          }
          return t('no_folder')
        }}
        itemToSubtitle={item => item?.path ?? ''}
        itemToKey={item => item.id}
        defaultText={t('select_folder_from_project')}
        label={t('folder_location')}
        optionalLabel
        onSelectedItemChanged={selectedFolderChanged}
      />
    </>
  )
}
