import { FC, useEffect, useMemo, useState } from 'react'
import { Select } from '../../../../../shared/components/select'
import { useFigureModalContext } from '../figure-modal-context'
import {
  Project,
  useUserProjects,
} from '../../../../file-tree/hooks/use-user-projects'
import {
  Entity,
  useProjectEntities,
} from '../../../../file-tree/hooks/use-project-entities'
import {
  OutputEntity,
  useProjectOutputFiles,
} from '../../../../file-tree/hooks/use-project-output-files'
import { useCurrentProjectFolders } from '../../../hooks/use-current-project-folders'
import { File, isImageEntity } from '../../../utils/file'
import { postJSON } from '../../../../../infrastructure/fetch-json'
import { useProjectContext } from '../../../../../shared/context/project-context'
import { FileRelocator } from '../file-relocator'
import { useTranslation } from 'react-i18next'
import { waitForFileTreeUpdate } from '../../../extensions/figure-modal'
import { useCodeMirrorViewContext } from '../../codemirror-context'
import getMeta from '@/utils/meta'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'

function suggestName(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

export const FigureModalOtherProjectSource: FC = () => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const { dispatch } = useFigureModalContext()
  const { projectId } = useProjectContext()
  const { loading: projectsLoading, data: projects, error } = useUserProjects()
  const [selectedProject, setSelectedProject] = useState<null | Project>(null)
  const { hasLinkedProjectFileFeature, hasLinkedProjectOutputFileFeature } =
    getMeta('ol-ExposedSettings')
  const [usingOutputFiles, setUsingOutputFiles] = useState<boolean>(
    !hasLinkedProjectFileFeature
  )
  const [nameDirty, setNameDirty] = useState<boolean>(false)
  const [name, setName] = useState<string>('')
  const [folder, setFolder] = useState<File | null>(null)
  const { rootFile } = useCurrentProjectFolders()
  const [file, setFile] = useState<OutputEntity | Entity | null>(null)
  const FileSelector = usingOutputFiles
    ? SelectFromProjectOutputFiles
    : SelectFromProject

  useEffect(() => {
    if (error) {
      dispatch({ error })
    }
  }, [error, dispatch])

  const updateDispatch: (args: {
    newFolder?: File | null
    newName?: string
    newSelectedProject?: Project | null
    newFile?: OutputEntity | Entity | null
  }) => void = ({
    newFolder = folder,
    newName = name,
    newSelectedProject = selectedProject,
    newFile = file,
  }) => {
    const targetFolder = newFolder ?? rootFile

    if (!newName || !newSelectedProject || !newFile) {
      dispatch({ getPath: undefined })
      return
    }

    let body:
      | {
          parent_folder_id: string
          provider: 'project_file'
          name: string
          data: { source_project_id: string; source_entity_path: string }
        }
      | {
          parent_folder_id: string
          provider: 'project_output_file'
          name: string
          data: {
            source_project_id: string
            source_output_file_path: string
            build_id?: string
            clsiServerId?: string
          }
        } = {
      provider: 'project_file',
      parent_folder_id: targetFolder.id,
      name: newName,
      data: {
        source_project_id: newSelectedProject._id,
        source_entity_path: newFile.path,
      },
    }

    if (usingOutputFiles) {
      body = {
        ...body,
        provider: 'project_output_file',
        data: {
          source_project_id: newSelectedProject._id,
          source_output_file_path: newFile.path,
          clsiServerId: (newFile as OutputEntity).clsiServerId,
          build_id: (newFile as OutputEntity).build,
        },
      }
    }

    dispatch({
      getPath: async () => {
        const fileTreeUpdate = waitForFileTreeUpdate(view)
        await postJSON(`/project/${projectId}/linked_file`, {
          body,
        })
        await fileTreeUpdate.withTimeout(500)
        return targetFolder.path === '' && targetFolder.name === 'rootFolder'
          ? `${newName}`
          : `${targetFolder.path ? targetFolder.path + '/' : ''}${
              targetFolder.name
            }/${name}`
      },
    })
  }

  return (
    <>
      <OLFormGroup>
        <Select
          items={projects ?? []}
          itemToString={project => (project ? project.name : '')}
          itemToKey={item => item._id}
          defaultText={t('select_a_project_figure_modal')}
          label={t('project_figure_modal')}
          disabled={projectsLoading}
          onSelectedItemChanged={item => {
            const suggestion = nameDirty ? name : ''
            setName(suggestion)
            setSelectedProject(item ?? null)
            setFile(null)
            updateDispatch({
              newSelectedProject: item ?? null,
              newFile: null,
              newName: suggestion,
            })
          }}
        />
      </OLFormGroup>
      <OLFormGroup>
        <FileSelector
          projectId={selectedProject?._id}
          onSelectedItemChange={item => {
            const suggestion = nameDirty ? name : suggestName(item?.path ?? '')
            setName(suggestion)
            setFile(item ?? null)
            updateDispatch({
              newFile: item ?? null,
              newName: suggestion,
            })
          }}
        />
        {hasLinkedProjectFileFeature && hasLinkedProjectOutputFileFeature && (
          <div>
            or{' '}
            <OLButton
              variant="link"
              onClick={() => setUsingOutputFiles(value => !value)}
              className="p-0 select-from-files-btn"
            >
              {usingOutputFiles
                ? t('select_from_project_files')
                : t('select_from_output_files')}
            </OLButton>
          </div>
        )}
      </OLFormGroup>
      <FileRelocator
        folder={folder}
        name={name}
        nameDisabled={!file && !nameDirty}
        onFolderChanged={item => {
          const newFolder = item ?? rootFile
          updateDispatch({ newFolder })
        }}
        onNameChanged={name => updateDispatch({ newName: name })}
        setFolder={setFolder}
        setName={setName}
        setNameDirty={setNameDirty}
      />
    </>
  )
}

const SelectFile = <T extends { path: string }>({
  disabled,
  files,
  onSelectedItemChange,
  defaultText,
  label,
  loading = false,
}: {
  disabled: boolean
  files?: T[] | null
  defaultText?: string
  label?: string
  loading?: boolean
  onSelectedItemChange?: (item: T | null | undefined) => any
}) => {
  const { t } = useTranslation()
  defaultText = defaultText ?? t('select_a_file_figure_modal')
  label = label ?? t('image_file')
  const imageFiles = useMemo(() => files?.filter(isImageEntity), [files])
  const empty = loading || !imageFiles || imageFiles.length === 0
  return (
    <Select
      loading={loading}
      items={imageFiles ?? []}
      itemToString={file => (file ? file.path.replace(/^\//, '') : '')}
      itemToKey={file => file.path}
      defaultText={
        imageFiles?.length === 0 ? t('no_image_files_found') : defaultText
      }
      label={label}
      disabled={disabled || empty}
      onSelectedItemChanged={onSelectedItemChange}
    />
  )
}

const SelectFromProject: FC<{
  projectId?: string
  onSelectedItemChange?: (item: Entity | null | undefined) => any
}> = ({ projectId, onSelectedItemChange }) => {
  const { loading, data: entities, error } = useProjectEntities(projectId)
  const { dispatch } = useFigureModalContext()
  useEffect(() => {
    if (error) {
      dispatch({ error })
    }
  }, [error, dispatch])
  return (
    <SelectFile
      key={projectId}
      files={entities}
      loading={loading}
      disabled={!projectId}
      onSelectedItemChange={onSelectedItemChange}
    />
  )
}

const SelectFromProjectOutputFiles: FC<{
  projectId?: string
  onSelectedItemChange?: (item: OutputEntity | null | undefined) => any
}> = ({ projectId, onSelectedItemChange }) => {
  const { t } = useTranslation()
  const { loading, data: entities, error } = useProjectOutputFiles(projectId)
  const { dispatch } = useFigureModalContext()
  useEffect(() => {
    if (error) {
      dispatch({ error })
    }
  }, [error, dispatch])
  return (
    <SelectFile
      label={t('output_file')}
      defaultText={t('select_an_output_file_figure_modal')}
      loading={loading}
      files={entities}
      disabled={!projectId}
      onSelectedItemChange={onSelectedItemChange}
    />
  )
}
