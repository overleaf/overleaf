import { FC } from 'react'
import { ConnectionError } from '@/features/ide-react/connection/types/connection-state'
import getMeta from '@/utils/meta'

const errorMessages = {
  'io-not-loaded': 'ol-translationIoNotLoaded',
  'unable-to-join': 'ol-translationUnableToJoin',
  'i18n-error': 'ol-translationLoadErrorMessage',
} as const

const isHandledCode = (key: string): key is keyof typeof errorMessages =>
  key in errorMessages

export type LoadingErrorProps = {
  errorCode: ConnectionError | 'i18n-error' | ''
}

// NOTE: i18n translations might not be loaded in the client at this point,
// so these translations have to be loaded from meta tags
export const LoadingError: FC<LoadingErrorProps> = ({ errorCode }) => {
  return isHandledCode(errorCode) ? (
    <p className="loading-screen-error">{getMeta(errorMessages[errorCode])}</p>
  ) : null
}
