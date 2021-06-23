import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap'
import Icon from '../../../../../shared/components/icon'
import FileTreeCreateNameInput from '../file-tree-create-name-input'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { useUserProjects } from '../../../hooks/use-user-projects'
import { useProjectEntities } from '../../../hooks/use-project-entities'
import { useProjectOutputFiles } from '../../../hooks/use-project-output-files'
import { useFileTreeActionable } from '../../../contexts/file-tree-actionable'
import { useFileTreeCreateName } from '../../../contexts/file-tree-create-name'
import { useFileTreeCreateForm } from '../../../contexts/file-tree-create-form'
import { useFileTreeMainContext } from '../../../contexts/file-tree-main'
import ErrorMessage from '../error-message'

export default function FileTreeImportFromProject() {
  const { t } = useTranslation()

  const { name, setName, validName } = useFileTreeCreateName()
  const { setValid } = useFileTreeCreateForm()
  const { projectId } = useFileTreeMainContext()
  const { error, finishCreatingLinkedFile } = useFileTreeActionable()

  const [selectedProject, setSelectedProject] = useState()
  const [selectedProjectEntity, setSelectedProjectEntity] = useState()
  const [selectedProjectOutputFile, setSelectedProjectOutputFile] = useState()
  const [isOutputFilesMode, setOutputFilesMode] = useState(false)

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
        selectedProject.name
      ) {
        // if the output PDF is selected, use the project's name as the filename
        setName(`${selectedProject.name}.pdf`)
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
  const handleSubmit = event => {
    event.preventDefault()

    if (isOutputFilesMode) {
      finishCreatingLinkedFile({
        name,
        provider: 'project_output_file',
        data: {
          source_project_id: selectedProject._id,
          source_output_file_path: selectedProjectOutputFile.path,
          build_id: selectedProjectOutputFile.build,
        },
      })
    } else {
      finishCreatingLinkedFile({
        name,
        provider: 'project_file',
        data: {
          source_project_id: selectedProject._id,
          source_entity_path: selectedProjectEntity.path,
        },
      })
    }
  }

  return (
    <form className="form-controls" id="create-file" onSubmit={handleSubmit}>
      <SelectProject
        projectId={projectId}
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

      <div className="toggle-file-type-button">
        or&nbsp;
        <Button
          bsStyle="link"
          type="button"
          onClick={() => setOutputFilesMode(value => !value)}
        >
          <span>
            {isOutputFilesMode
              ? t('select_from_source_files')
              : t('select_from_output_files')}
          </span>
        </Button>
      </div>

      <FileTreeCreateNameInput
        label={t('file_name_in_this_project')}
        classes={{
          formGroup: 'form-controls row-spaced-small',
        }}
        placeholder="example.tex"
        error={error}
      />

      {error && <ErrorMessage error={error} />}
    </form>
  )
}

function SelectProject({ projectId, selectedProject, setSelectedProject }) {
  const { t } = useTranslation()

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
    <FormGroup className="form-controls" controlId="project-select">
      <ControlLabel>{t('select_a_project')}</ControlLabel>

      {loading && (
        <span>
          &nbsp;
          <Icon type="spinner" spin />
        </span>
      )}

      <FormControl
        componentClass="select"
        disabled={!data}
        value={selectedProject ? selectedProject._id : ''}
        onChange={event => {
          const projectId = event.target.value
          const project = data.find(item => item._id === projectId)
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
      </FormControl>

      {filteredData && !filteredData.length && (
        <small>{t('no_other_projects_found')}</small>
      )}
    </FormGroup>
  )
}
SelectProject.propTypes = {
  projectId: PropTypes.string.isRequired,
  selectedProject: PropTypes.object,
  setSelectedProject: PropTypes.func.isRequired,
}

function SelectProjectOutputFile({
  selectedProjectId,
  selectedProjectOutputFile,
  setSelectedProjectOutputFile,
}) {
  const { t } = useTranslation()

  const { data, error, loading } = useProjectOutputFiles(selectedProjectId)

  if (error) {
    return <ErrorMessage error={error} />
  }

  return (
    <FormGroup
      className="form-controls row-spaced-small"
      controlId="project-output-file-select"
    >
      <ControlLabel>{t('select_an_output_file')}</ControlLabel>

      {loading && (
        <span>
          &nbsp;
          <Icon type="spinner" spin />
        </span>
      )}

      <FormControl
        componentClass="select"
        disabled={!data}
        value={selectedProjectOutputFile?.path || ''}
        onChange={event => {
          const path = event.target.value
          const file = data.find(item => item.path === path)
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
      </FormControl>
    </FormGroup>
  )
}
SelectProjectOutputFile.propTypes = {
  selectedProjectId: PropTypes.string,
  selectedProjectOutputFile: PropTypes.object,
  setSelectedProjectOutputFile: PropTypes.func.isRequired,
}

function SelectProjectEntity({
  selectedProjectId,
  selectedProjectEntity,
  setSelectedProjectEntity,
}) {
  const { t } = useTranslation()

  const { data, error, loading } = useProjectEntities(selectedProjectId)

  if (error) {
    return <ErrorMessage error={error} />
  }

  return (
    <FormGroup
      className="form-controls row-spaced-small"
      controlId="project-entity-select"
    >
      <ControlLabel>{t('select_a_file')}</ControlLabel>

      {loading && (
        <span>
          &nbsp;
          <Icon type="spinner" spin />
        </span>
      )}

      <FormControl
        componentClass="select"
        disabled={!data}
        value={selectedProjectEntity?.path || ''}
        onChange={event => {
          const path = event.target.value
          const entity = data.find(item => item.path === path)
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
      </FormControl>
    </FormGroup>
  )
}
SelectProjectEntity.propTypes = {
  selectedProjectId: PropTypes.string,
  selectedProjectEntity: PropTypes.object,
  setSelectedProjectEntity: PropTypes.func.isRequired,
}
