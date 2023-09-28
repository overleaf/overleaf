/* eslint-disable jsx-a11y/no-autofocus */
import PropTypes from 'prop-types'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  Alert,
  Button,
  ControlLabel,
  FormControl,
  FormGroup,
} from 'react-bootstrap'
import { postJSON } from '../../../infrastructure/fetch-json'
import { CloneProjectTag } from './clone-project-tag'

export default function CloneProjectModalContent({
  handleHide,
  inFlight,
  setInFlight,
  handleAfterCloned,
  projectId,
  projectName,
  projectTags,
}) {
  const { t } = useTranslation()

  const [error, setError] = useState()
  const [clonedProjectName, setClonedProjectName] = useState(
    `${projectName} (Copy)`
  )

  const [clonedProjectTags, setClonedProjectTags] = useState(projectTags)

  // valid if the cloned project has a name
  const valid = useMemo(
    () => clonedProjectName.trim().length > 0,
    [clonedProjectName]
  )

  // form submission: clone the project if the name is valid
  const handleSubmit = event => {
    event.preventDefault()

    if (!valid) {
      return
    }

    setError(false)
    setInFlight(true)

    // clone the project
    postJSON(`/project/${projectId}/clone`, {
      body: {
        projectName: clonedProjectName,
        tags: clonedProjectTags.map(tag => ({ id: tag._id })),
      },
    })
      .then(data => {
        // open the cloned project
        handleAfterCloned(data, clonedProjectTags)
      })
      .catch(({ response, data }) => {
        if (response?.status === 400) {
          setError(data.message)
        } else {
          setError(true)
        }
      })
      .finally(() => {
        setInFlight(false)
      })
  }

  const removeTag = useCallback(tag => {
    setClonedProjectTags(value => value.filter(item => item._id !== tag._id))
  }, [])

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{t('copy_project')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <form id="clone-project-form" onSubmit={handleSubmit}>
          <FormGroup>
            <ControlLabel htmlFor="clone-project-form-name">
              {t('new_name')}
            </ControlLabel>

            <FormControl
              id="clone-project-form-name"
              type="text"
              placeholder="New Project Name"
              required
              value={clonedProjectName}
              onChange={event => setClonedProjectName(event.target.value)}
              autoFocus
            />
          </FormGroup>

          {clonedProjectTags.length > 0 && (
            <FormGroup className="clone-project-tag">
              <ControlLabel htmlFor="clone-project-tags-list">
                {t('tags')}:{' '}
              </ControlLabel>
              <div role="listbox" id="clone-project-tags-list">
                {clonedProjectTags.map(tag => (
                  <CloneProjectTag
                    key={tag._id}
                    tag={tag}
                    removeTag={removeTag}
                  />
                ))}
              </div>
            </FormGroup>
          )}
        </form>

        {error && (
          <Alert bsStyle="danger">
            {error.length ? error : t('generic_something_went_wrong')}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button
          type="button"
          bsStyle={null}
          className="btn-secondary"
          disabled={inFlight}
          onClick={handleHide}
        >
          {t('cancel')}
        </Button>

        <Button
          form="clone-project-form"
          type="submit"
          bsStyle="primary"
          disabled={inFlight || !valid}
        >
          {inFlight ? <>{t('copying')}…</> : t('copy')}
        </Button>
      </Modal.Footer>
    </>
  )
}
CloneProjectModalContent.propTypes = {
  handleHide: PropTypes.func.isRequired,
  inFlight: PropTypes.bool,
  setInFlight: PropTypes.func.isRequired,
  handleAfterCloned: PropTypes.func.isRequired,
  projectId: PropTypes.string,
  projectName: PropTypes.string,
  projectTags: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string,
    })
  ),
}
