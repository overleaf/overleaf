import { useRef, useEffect, useCallback } from 'react'
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
import Notification from '@/shared/components/notification'

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
  const nameFocusedOnce = useRef(false)

  // focus the first part of the filename if needed
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current && focusName) {
      window.requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      })
    }
  }, [focusName])

  const onFocus = useCallback(() => {
    if (nameFocusedOnce.current) return
    if (!focusName) return
    window.requestAnimationFrame(() => {
      if (!inputRef.current) return
      nameFocusedOnce.current = true
      inputRef.current.setSelectionRange(
        0,
        inputRef.current.value.lastIndexOf('.')
      )
    })
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
        onFocus={onFocus}
      />
      {touchedName && !validName && (
        <div className="notification-list">
          <Notification
            type="error"
            className="row-spaced-small"
            content={t('files_cannot_include_invalid_characters')}
          />
        </div>
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
        <div className="notification-list">
          <Notification
            type="error"
            className="row-spaced-small"
            content={t('file_already_exists')}
          />
        </div>
      )

    case InvalidFilenameError:
      return (
        <div className="notification-list">
          <Notification
            type="error"
            className="row-spaced-small"
            content={t('files_cannot_include_invalid_characters')}
          />
        </div>
      )

    case BlockedFilenameError:
      return (
        <div className="notification-list">
          <Notification
            type="error"
            className="row-spaced-small"
            content={t('blocked_filename')}
          />
        </div>
      )

    default:
      // return <Trans i18nKey="generic_something_went_wrong" />
      return null // other errors are displayed elsewhere
  }
}
