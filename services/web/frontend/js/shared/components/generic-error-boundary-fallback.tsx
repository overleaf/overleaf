import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from './icon'
import { Button } from 'react-bootstrap'
import { useLocation } from '../hooks/use-location'
import { DefaultMessage } from './default-message'

export const GenericErrorBoundaryFallback: FC = ({ children }) => {
  const { t } = useTranslation()
  const { reload: handleClick } = useLocation()

  return (
    <div className="error-boundary-container">
      <div className="icon-error-boundary-container">
        <Icon
          accessibilityLabel={`${t('generic_something_went_wrong')} ${t(
            'please_refresh'
          )}`}
          type="exclamation-triangle fa-2x"
          fw
        />
      </div>
      {children || (
        <div className="error-message-container">
          <DefaultMessage className="small" style={{ fontWeight: 'bold' }} />
        </div>
      )}
      <Button bsStyle="primary" onClick={handleClick}>
        {t('refresh')}
      </Button>
    </div>
  )
}
