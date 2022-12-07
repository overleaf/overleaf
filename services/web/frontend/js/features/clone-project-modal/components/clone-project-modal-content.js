/* eslint-disable jsx-a11y/no-autofocus */
import PropTypes from 'prop-types'
import { useMemo, useState } from 'react'
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

export default function CloneProjectModalContent({
  handleHide,
  inFlight,
  setInFlight,
  handleAfterCloned,
  projectId,
  projectName,
}) {
  const { t } = useTranslation()

  const [error, setError] = useState()
  const [clonedProjectName, setClonedProjectName] = useState(
    `${projectName} (Copy)`
  )

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
      body: { projectName: clonedProjectName },
    })
      .then(data => {
        // open the cloned project
        handleAfterCloned(data)
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
}
