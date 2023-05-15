import { FC, useState } from 'react'
import { useFigureModalContext } from '../figure-modal-context'
import { postJSON } from '../../../../../infrastructure/fetch-json'
import { useProjectContext } from '../../../../../shared/context/project-context'
import { File } from '../../../utils/file'
import { useCurrentProjectFolders } from '../../../hooks/useCurrentProjectFolders'
import { FileRelocator } from '../file-relocator'

function generateLinkedFileFetcher(
  projectId: string,
  url: string,
  name: string,
  folder: File
) {
  return async () => {
    await postJSON(`/project/${projectId}/linked_file`, {
      body: {
        parent_folder_id: folder.id,
        provider: 'url',
        name,
        data: {
          url,
        },
      },
    })
    return folder.path === '' && folder.name === 'rootFolder'
      ? `${name}`
      : `${folder.path ? folder.path + '/' : ''}${folder.name}/${name}`
  }
}

export const FigureModalUrlSource: FC = () => {
  const [url, setUrl] = useState<string>('')
  const [nameDirty, setNameDirty] = useState<boolean>(false)
  const [name, setName] = useState<string>('')
  const { _id: projectId } = useProjectContext()
  const [, rootFile] = useCurrentProjectFolders()
  const [folder, setFolder] = useState<File>(rootFile)

  const { dispatch, getPath } = useFigureModalContext()

  // TODO: Find another way to do this
  const ensureButtonActivation = (
    newUrl: string,
    newName: string,
    folder: File | null | undefined
  ) => {
    if (newUrl && newName) {
      dispatch({
        getPath: generateLinkedFileFetcher(
          projectId,
          newUrl,
          newName,
          folder ?? rootFile
        ),
      })
    } else if (getPath) {
      dispatch({ getPath: undefined })
    }
  }

  return (
    <>
      <label htmlFor="figure-modal-url-url">Image URL</label>
      <input
        id="figure-modal-url-url"
        type="text"
        className="form-control figure-modal-input-field"
        placeholder="Enter image URL"
        value={url}
        onChange={e => {
          setUrl(e.target.value)
          let newName = name
          if (!nameDirty) {
            // TODO: Improve this
            const parts = e.target.value.split('/')
            newName = parts[parts.length - 1] ?? ''
            setName(newName)
          }
          ensureButtonActivation(e.target.value, newName, folder)
        }}
      />
      <FileRelocator
        folder={folder}
        name={name}
        nameDisabled={url.length === 0}
        onFolderChanged={folder => ensureButtonActivation(url, name, folder)}
        onNameChanged={name => ensureButtonActivation(url, name, folder)}
        setFolder={setFolder}
        setName={setName}
        setNameDirty={setNameDirty}
      />
    </>
  )
}
