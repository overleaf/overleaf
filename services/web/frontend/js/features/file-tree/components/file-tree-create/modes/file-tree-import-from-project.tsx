import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  FormEventHandler,
} from 'react'
import Icon from '../../../../../shared/components/icon'
import FileTreeCreateNameInput from '../file-tree-create-name-input'
import { useTranslation } from 'react-i18next'
import { useUserProjects } from '../../../hooks/use-user-projects'
import { Entity, useProjectEntities } from '../../../hooks/use-project-entities'
import { useProjectOutputFiles } from '../../../hooks/use-project-output-files'
import { useFileTreeActionable } from '../../../contexts/file-tree-actionable'
import { useFileTreeCreateName } from '../../../contexts/file-tree-create-name'
import { useFileTreeCreateForm } from '../../../contexts/file-tree-create-form'
import { useProjectContext } from '../../../../../shared/context/project-context'
import ErrorMessage from '../error-message'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import { File } from '@/features/source-editor/utils/file'
import { Project } from '../../../../../../../types/project'
import getMeta from '@/utils/meta'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLFormLabel from '@/features/ui/components/ol/ol-form-label'
import OLForm from '@/features/ui/components/ol/ol-form'
import OLFormSelect from '@/features/ui/components/ol/ol-form-select'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { Spinner } from 'react-bootstrap-5'

export default function FileTreeImportFromProject() {
  const { t } = useTranslation()

  const { hasLinkedProjectFileFeature, hasLinkedProjectOutputFileFeature } =
    getMeta('ol-ExposedSettings')
  const canSwitchOutputFilesMode =
    hasLinkedProjectFileFeature && hasLinkedProjectOutputFileFeature

  const { name, setName, validName } = useFileTreeCreateName()
  const { setValid } = useFileTreeCreateForm()
  const { error, finishCreatingLinkedFile, inFlight } = useFileTreeActionable()

  const [selectedProject, setSelectedProject] = useState<Project>()
  const [selectedProjectEntity, setSelectedProjectEntity] = useState<Entity>()
  const [selectedProjectOutputFile, setSelectedProjectOutputFile] = useState<
    File & { build: string; clsiServerId: string }
  >()
  const [isOutputFilesMode, setOutputFilesMode] = useState(
    // default to project file mode, unless the feature is not enabled
    !hasLinkedProjectFileFeature
  )

  // use the basename of a path as the file name
  const setNameFromPath = useCallback(
    path => {
      const filename = path.split('/').pop()

      if (filename) {
        setName(filename)
      }
    },
    [setName]
  )

  // update the name when an output file is selected
  useEffect(() => {
    if (selectedProjectOutputFile) {
      if (
        selectedProjectOutputFile.path === 'output.pdf' &&
        selectedProject!.name
      ) {
        // if the output PDF is selected, use the project's name as the filename
        setName(`${selectedProject!.name}.pdf`)
      } else {
        setNameFromPath(selectedProjectOutputFile.path)
      }
    }
  }, [selectedProject, selectedProjectOutputFile, setName, setNameFromPath])

  // update the name when an entity is selected
  useEffect(() => {
    if (selectedProjectEntity) {
      setNameFromPath(selectedProjectEntity.path)
    }
  }, [selectedProjectEntity, setNameFromPath])

  // form validation: name is valid and entity or output file is selected
  useEffect(() => {
    const hasSelectedEntity = Boolean(
      isOutputFilesMode ? selectedProjectOutputFile : selectedProjectEntity
    )

    setValid(validName && hasSelectedEntity)
  }, [
    setValid,
    validName,
    isOutputFilesMode,
    selectedProjectEntity,
    selectedProjectOutputFile,
  ])

  // form submission: create a linked file with this name, from this entity or output file
  const handleSubmit: FormEventHandler = event => {
    event.preventDefault()
    eventTracking.sendMB('new-file-created', {
      method: 'project',
      extension: name.split('.').length > 1 ? name.split('.').pop() : '',
    })

    if (isOutputFilesMode) {
      finishCreatingLinkedFile({
        name,
        provider: 'project_output_file',
        data: {
          source_project_id: selectedProject!._id,
          source_output_file_path: selectedProjectOutputFile!.path,
          build_id: selectedProjectOutputFile!.build,
          clsiServerId: selectedProjectOutputFile!.clsiServerId,
        },
      })
    } else {
      finishCreatingLinkedFile({
        name,
        provider: 'project_file',
        data: {
          source_project_id: selectedProject!._id,
          source_entity_path: selectedProjectEntity!.path,
        },
      })
    }
  }

  return (
    <OLForm id="create-file" onSubmit={handleSubmit}>
      <SelectProject
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
      />

      {isOutputFilesMode ? (
        <SelectProjectOutputFile
          selectedProjectId={selectedProject?._id}
          selectedProjectOutputFile={selectedProjectOutputFile}
          setSelectedProjectOutputFile={setSelectedProjectOutputFile}
        />
      ) : (
        <SelectProjectEntity
          selectedProjectId={selectedProject?._id}
          selectedProjectEntity={selectedProjectEntity}
          setSelectedProjectEntity={setSelectedProjectEntity}
        />
      )}

      {canSwitchOutputFilesMode && (
        <div className="toggle-file-type-button">
          or&nbsp;
          <OLButton
            variant="link"
            type="button"
            onClick={() => setOutputFilesMode(value => !value)}
          >
            <span>
              {isOutputFilesMode
                ? t('select_from_source_files')
                : t('select_from_output_files')}
            </span>
          </OLButton>
        </div>
      )}

      <FileTreeCreateNameInput
        label={t('file_name_in_this_project')}
        classes={{
          formGroup: 'form-controls row-spaced-small',
        }}
        placeholder="example.tex"
        error={error}
        inFlight={inFlight}
      />

      {error && <ErrorMessage error={error} />}
    </OLForm>
  )
}

type SelectProjectProps = {
  selectedProject?: any
  setSelectedProject(project: any): void
}

function SelectProject({
  selectedProject,
  setSelectedProject,
}: SelectProjectProps) {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()

  const { data, error, loading } = useUserProjects()

  const filteredData = useMemo(() => {
    if (!data) {
      return null
    }

    return data.filter(item => item._id !== projectId)
  }, [data, projectId])

  if (error) {
    return <ErrorMessage error={error} />
  }

  return (
    <OLFormGroup controlId="project-select">
      <OLFormLabel>{t('select_a_project')}</OLFormLabel>

      {loading && (
        <span>
          &nbsp;
          <BootstrapVersionSwitcher
            bs3={<Icon type="spinner" spin />}
            bs5={
              <Spinner
                animation="border"
                aria-hidden="true"
                size="sm"
                role="status"
              />
            }
          />
        </span>
      )}

      <OLFormSelect
        disabled={!data}
        value={selectedProject ? selectedProject._id : ''}
        onChange={event => {
          const projectId = (event.target as HTMLSelectElement).value
          const project = data!.find(item => item._id === projectId)
          setSelectedProject(project)
        }}
      >
        <option disabled value="">
          - {t('please_select_a_project')}
        </option>

        {filteredData &&
          filteredData.map(project => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
      </OLFormSelect>

      {filteredData && !filteredData.length && (
        <small>{t('no_other_projects_found')}</small>
      )}
    </OLFormGroup>
  )
}

type SelectProjectOutputFileProps = {
  selectedProjectId?: string
  selectedProjectOutputFile?: any
  setSelectedProjectOutputFile(file: any): void
}

function SelectProjectOutputFile({
  selectedProjectId,
  selectedProjectOutputFile,
  setSelectedProjectOutputFile,
}: SelectProjectOutputFileProps) {
  const { t } = useTranslation()

  const { data, error, loading } = useProjectOutputFiles(selectedProjectId)

  if (error) {
    return <ErrorMessage error={error} />
  }

  return (
    <OLFormGroup
      className="row-spaced-small"
      controlId="project-output-file-select"
    >
      <OLFormLabel>{t('select_an_output_file')}</OLFormLabel>

      {loading && (
        <span>
          &nbsp;
          <BootstrapVersionSwitcher
            bs3={<Icon type="spinner" spin />}
            bs5={
              <Spinner
                animation="border"
                aria-hidden="true"
                size="sm"
                role="status"
              />
            }
          />
        </span>
      )}

      <OLFormSelect
        disabled={!data}
        value={selectedProjectOutputFile?.path || ''}
        onChange={event => {
          const path = (event.target as unknown as HTMLSelectElement).value
          const file = data?.find(item => item.path === path)
          setSelectedProjectOutputFile(file)
        }}
      >
        <option disabled value="">
          - {t('please_select_an_output_file')}
        </option>

        {data &&
          data.map(file => (
            <option key={file.path} value={file.path}>
              {file.path}
            </option>
          ))}
      </OLFormSelect>
    </OLFormGroup>
  )
}

type SelectProjectEntityProps = {
  selectedProjectId?: string
  selectedProjectEntity?: any
  setSelectedProjectEntity(entity: any): void
}

function SelectProjectEntity({
  selectedProjectId,
  selectedProjectEntity,
  setSelectedProjectEntity,
}: SelectProjectEntityProps) {
  const { t } = useTranslation()

  const { data, error, loading } = useProjectEntities(selectedProjectId)

  if (error) {
    return <ErrorMessage error={error} />
  }

  return (
    <OLFormGroup className="row-spaced-small" controlId="project-entity-select">
      <OLFormLabel>{t('select_a_file')}</OLFormLabel>

      {loading && (
        <span>
          &nbsp;
          <BootstrapVersionSwitcher
            bs3={<Icon type="spinner" spin />}
            bs5={
              <Spinner
                animation="border"
                aria-hidden="true"
                size="sm"
                role="status"
              />
            }
          />
        </span>
      )}

      <OLFormSelect
        disabled={!data}
        value={selectedProjectEntity?.path || ''}
        onChange={event => {
          const path = (event.target as HTMLSelectElement).value
          const entity = data!.find(item => item.path === path)
          setSelectedProjectEntity(entity)
        }}
      >
        <option disabled value="">
          - {t('please_select_a_file')}
        </option>

        {data &&
          data.map(entity => (
            <option key={entity.path} value={entity.path}>
              {entity.path.slice(1)}
            </option>
          ))}
      </OLFormSelect>
    </OLFormGroup>
  )
}
