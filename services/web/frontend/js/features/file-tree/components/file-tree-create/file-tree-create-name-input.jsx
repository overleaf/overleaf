import ControlLabel from 'react-bootstrap/lib/ControlLabel'
import { Alert, FormControl } from 'react-bootstrap'
import FormGroup from 'react-bootstrap/lib/FormGroup'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useFileTreeCreateName } from '../../contexts/file-tree-create-name'
import PropTypes from 'prop-types'
import {
  BlockedFilenameError,
  DuplicateFilenameError,
  InvalidFilenameError,
} from '../../errors'

/**
 * A form component that renders a text input with label,
 * plus a validation warning and/or an error message when needed
 */
export default function FileTreeCreateNameInput({
  label,
  focusName = false,
  classes = {},
  placeholder,
  error,
  inFlight,
}) {
  const { t } = useTranslation()

  // the value is stored in a context provider, so it's available elsewhere in the form
  const { name, setName, touchedName, validName } = useFileTreeCreateName()

  // focus the first part of the filename if needed
  const inputRef = useCallback(
    element => {
      if (element && focusName) {
        window.requestAnimationFrame(() => {
          element.focus()
          element.setSelectionRange(0, element.value.lastIndexOf('.'))
        })
      }
    },
    [focusName]
  )

  return (
    <FormGroup controlId="new-doc-name" className={classes.formGroup}>
      <ControlLabel>{label || t('file_name')}</ControlLabel>

      <FormControl
        type="text"
        placeholder={placeholder || t('file_name')}
        required
        value={name}
        onChange={event => setName(event.target.value)}
        inputRef={inputRef}
        disabled={inFlight}
      />

      <FormControl.Feedback />

      {touchedName && !validName && (
        <Alert bsStyle="danger" className="row-spaced-small">
          {t('files_cannot_include_invalid_characters')}
        </Alert>
      )}

      {error && <ErrorMessage error={error} />}
    </FormGroup>
  )
}

FileTreeCreateNameInput.propTypes = {
  focusName: PropTypes.bool,
  label: PropTypes.string,
  classes: PropTypes.shape({
    formGroup: PropTypes.string,
  }),
  placeholder: PropTypes.string,
  error: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  inFlight: PropTypes.bool.isRequired,
}

function ErrorMessage({ error }) {
  const { t } = useTranslation()

  // if (typeof error === 'string') {
  //   return error
  // }

  switch (error.constructor) {
    case DuplicateFilenameError:
      return (
        <Alert bsStyle="danger" className="row-spaced-small">
          {t('file_already_exists')}
        </Alert>
      )

    case InvalidFilenameError:
      return (
        <Alert bsStyle="danger" className="row-spaced-small">
          {t('files_cannot_include_invalid_characters')}
        </Alert>
      )

    case BlockedFilenameError:
      return (
        <Alert bsStyle="danger" className="row-spaced-small">
          {t('blocked_filename')}
        </Alert>
      )

    default:
      // return <Trans i18nKey="generic_something_went_wrong" />
      return null // other errors are displayed elsewhere
  }
}
ErrorMessage.propTypes = {
  error: PropTypes.oneOfType([PropTypes.object, PropTypes.string]).isRequired,
}
