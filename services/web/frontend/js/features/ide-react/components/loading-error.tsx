import { FC } from 'react'
import { ConnectionError } from '@/features/ide-react/connection/types/connection-state'
import getMeta from '@/utils/meta'

// NOTE: i18n translations might not be loaded in the client at this point,
// so these translations have to be loaded from meta tags
export const LoadingError: FC<{
  connectionStateError: ConnectionError | ''
  i18nError?: Error
}> = ({ connectionStateError, i18nError }) => {
  if (connectionStateError) {
    switch (connectionStateError) {
      case 'io-not-loaded':
        return <>{getMeta('ol-translationIoNotLoaded')}</>

      case 'unable-to-join':
        return <>{getMeta('ol-translationUnableToJoin')}</>
    }
  }

  if (i18nError) {
    return <>{getMeta('ol-translationLoadErrorMessage')}</>
  }

  return null
}
