import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { FetchError } from '../../../../infrastructure/fetch-json'
import RedirectToLogin from './redirect-to-login'
import {
  BlockedFilenameError,
  DuplicateFilenameError,
  InvalidFilenameError,
} from '../../errors'
import DangerMessage from './danger-message'

export default function ErrorMessage({ error }) {
  const { t } = useTranslation()

  // the error is a string
  // TODO: translate? always? is this a key or a message?
  if (typeof error === 'string') {
    switch (error) {
      case 'name-exists':
        return <DangerMessage>{t('file_already_exists')}</DangerMessage>

      case 'too-many-files':
        return <DangerMessage>{t('project_has_too_many_files')}</DangerMessage>

      case 'remote-service-error':
        return <DangerMessage>{t('remote_service_error')}</DangerMessage>

      case 'rate-limit-hit':
        return (
          <DangerMessage>
            {t('too_many_files_uploaded_throttled_short_period')}
          </DangerMessage>
        )

      case 'not-logged-in':
        return (
          <DangerMessage>
            <RedirectToLogin />
          </DangerMessage>
        )

      default:
        // TODO: convert error.response.data to an error key and try again?
        // return error
        return (
          <DangerMessage>{t('generic_something_went_wrong')}</DangerMessage>
        )
    }
  }

  // the error is an object
  // TODO: error.name?
  switch (error.constructor) {
    case FetchError: {
      const message = error.data?.message

      if (message) {
        return <DangerMessage>{message.text || message}</DangerMessage>
      }

      // TODO: translations
      switch (error.response?.status) {
        case 400:
          return <DangerMessage>{t('invalid_request')}</DangerMessage>

        case 403:
          return <DangerMessage>{t('session_error')}</DangerMessage>

        case 429:
          return <DangerMessage>{t('too_many_attempts')}</DangerMessage>

        default:
          return (
            <DangerMessage>{t('something_went_wrong_server')}</DangerMessage>
          )
      }
    }

    // these are handled by the filename input component
    case DuplicateFilenameError:
    case InvalidFilenameError:
    case BlockedFilenameError:
      return null

    // a generic error message
    default:
      // return error.message
      return <DangerMessage>{t('generic_something_went_wrong')}</DangerMessage>
  }
}
ErrorMessage.propTypes = {
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
}
