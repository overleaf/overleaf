import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useFileTreeCreateName } from '../../contexts/file-tree-create-name'
import {
  BlockedFilenameError,
  DuplicateFilenameError,
  InvalidFilenameError,
} from '../../errors'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLNotification from '@/shared/components/ol/ol-notification'

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
}: {
  label?: string
  focusName?: boolean
  classes?: {
    formGroup?: string
  }
  placeholder?: string
  error?: string | Record<string, any>
  inFlight: boolean
}) {
  const { t } = useTranslation()

  // the value is stored in a context provider, so it's available elsewhere in the form
  const { name, setName, touchedName, validName } = useFileTreeCreateName()

  // focus the first part of the filename if needed
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current && focusName) {
      window.requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(
            0,
            inputRef.current.value.lastIndexOf('.')
          )
        }
      })
    }
  }, [focusName])

  return (
    <OLFormGroup controlId="new-doc-name" className={classes.formGroup}>
      <OLFormLabel>{label || t('file_name')}</OLFormLabel>

      <OLFormControl
        type="text"
        placeholder={placeholder || t('file_name')}
        required
        value={name}
        onChange={event => setName(event.target.value)}
        ref={inputRef}
        disabled={inFlight}
      />

      {touchedName && !validName && (
        <OLNotification
          type="error"
          className="row-spaced-small"
          content={t('files_cannot_include_invalid_characters')}
        />
      )}

      {error && <ErrorMessage error={error} />}
    </OLFormGroup>
  )
}

function ErrorMessage({ error }: { error: string | Record<string, any> }) {
  const { t } = useTranslation()

  // if (typeof error === 'string') {
  //   return error
  // }

  switch (error.constructor) {
    case DuplicateFilenameError:
      return (
        <OLNotification
          type="error"
          className="row-spaced-small"
          content={t('file_already_exists')}
        />
      )

    case InvalidFilenameError:
      return (
        <OLNotification
          type="error"
          className="row-spaced-small"
          content={t('files_cannot_include_invalid_characters')}
        />
      )

    case BlockedFilenameError:
      return (
        <OLNotification
          type="error"
          className="row-spaced-small"
          content={t('blocked_filename')}
        />
      )

    default:
      // return <Trans i18nKey="generic_something_went_wrong" />
      return null // other errors are displayed elsewhere
  }
}
