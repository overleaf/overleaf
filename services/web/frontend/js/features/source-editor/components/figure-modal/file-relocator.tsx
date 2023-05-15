import { useCallback } from 'react'
import { FileNameInput } from './file-name-input'
import { File } from '../../utils/file'
import { Select } from '../../../../shared/components/select'
import { useCurrentProjectFolders } from '../../hooks/useCurrentProjectFolders'

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
      <label htmlFor="figure-modal-relocated-file-name">
        File name in this project
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
            return 'No folder'
          }
          if (item) {
            return `${item.path}${item.name}`
          }
          return 'No folder'
        }}
        itemToSubtitle={item => item?.path ?? ''}
        itemToKey={item => item.id}
        defaultText="Select folder from project"
        label="Folder location"
        optionalLabel
        onSelectedItemChanged={selectedFolderChanged}
      />
    </>
  )
}
