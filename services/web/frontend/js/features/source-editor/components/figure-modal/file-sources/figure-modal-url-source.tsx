import { FC, useState } from 'react'
import { useFigureModalContext } from '../figure-modal-context'
import { postJSON } from '../../../../../infrastructure/fetch-json'
import { useProjectContext } from '../../../../../shared/context/project-context'
import { File } from '../../../utils/file'
import { useCurrentProjectFolders } from '../../../hooks/use-current-project-folders'
import { FileRelocator } from '../file-relocator'
import { useTranslation } from 'react-i18next'
import { useCodeMirrorViewContext } from '../../codemirror-context'
import { EditorView } from '@codemirror/view'
import { waitForFileTreeUpdate } from '../../../extensions/figure-modal'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'

function generateLinkedFileFetcher(
  projectId: string,
  url: string,
  name: string,
  folder: File,
  view: EditorView
) {
  return async () => {
    const fileTreeUpdate = waitForFileTreeUpdate(view)
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
    await fileTreeUpdate.withTimeout(500)

    return folder.path === '' && folder.name === 'rootFolder'
      ? `${name}`
      : `${folder.path ? folder.path + '/' : ''}${folder.name}/${name}`
  }
}

export const FigureModalUrlSource: FC = () => {
  const view = useCodeMirrorViewContext()
  const { t } = useTranslation()
  const [url, setUrl] = useState<string>('')
  const [nameDirty, setNameDirty] = useState<boolean>(false)
  const [name, setName] = useState<string>('')
  const { projectId } = useProjectContext()
  const { rootFile } = useCurrentProjectFolders()
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
          folder ?? rootFile,
          view
        ),
      })
    } else if (getPath) {
      dispatch({ getPath: undefined })
    }
  }

  return (
    <>
      <OLFormGroup controlId="figure-modal-url-url">
        <OLFormLabel>{t('image_url')}</OLFormLabel>
        <OLFormControl
          type="text"
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
      </OLFormGroup>
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
