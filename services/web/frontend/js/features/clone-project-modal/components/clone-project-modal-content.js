import React, { useMemo, useState } from 'react'
import {
  Modal,
  Alert,
  Button,
  FormGroup,
  ControlLabel,
  FormControl
} from 'react-bootstrap'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

function CloneProjectModalContent({
  cloneProject,
  projectName = '',
  error,
  cancel,
  inFlight
}) {
  const { t } = useTranslation()

  const [clonedProjectName, setClonedProjectName] = useState(
    `${projectName} (Copy)`
  )

  const valid = useMemo(() => !!clonedProjectName, [clonedProjectName])

  function handleSubmit(event) {
    event.preventDefault()
    if (valid) {
      cloneProject(clonedProjectName)
    }
  }

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{t('copy_project')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <form id="clone-project-form" onSubmit={handleSubmit}>
          <FormGroup>
            <ControlLabel htmlFor="cloned-project-name">
              {t('new_name')}
            </ControlLabel>

            <FormControl
              id="cloned-project-name"
              type="text"
              placeholder="New Project Name"
              required
              value={clonedProjectName}
              onChange={event => setClonedProjectName(event.target.value)}
            />
          </FormGroup>
        </form>

        {error && (
          <Alert bsStyle="danger">
            {error.message || t('generic_something_went_wrong')}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button type="button" disabled={inFlight} onClick={cancel}>
          {t('cancel')}
        </Button>

        <Button
          form="clone-project-form"
          type="submit"
          bsStyle="primary"
          disabled={inFlight || !valid}
        >
          {inFlight ? <span>{t('copying')}…</span> : <span>{t('copy')}</span>}
        </Button>
      </Modal.Footer>
    </>
  )
}

CloneProjectModalContent.propTypes = {
  cloneProject: PropTypes.func.isRequired,
  error: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.shape({
      message: PropTypes.string
    })
  ]),
  cancel: PropTypes.func.isRequired,
  inFlight: PropTypes.bool.isRequired,
  projectName: PropTypes.string
}

export default CloneProjectModalContent
