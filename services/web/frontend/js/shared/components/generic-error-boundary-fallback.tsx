import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from '../hooks/use-location'
import { DefaultMessage } from './default-message'
import MaterialIcon from './material-icon'
import OLButton from '@/shared/components/ol/ol-button'

export const GenericErrorBoundaryFallback: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { t } = useTranslation()
  const { reload: handleClick } = useLocation()

  return (
    <div className="error-boundary-container">
      <MaterialIcon
        accessibilityLabel={`${t('generic_something_went_wrong')} ${t(
          'please_refresh'
        )}`}
        type="warning"
        size="2x"
      />
      {children || (
        <div className="error-message">
          <DefaultMessage className="small" style={{ fontWeight: 'bold' }} />
        </div>
      )}
      <OLButton variant="primary" onClick={handleClick}>
        {t('refresh')}
      </OLButton>
    </div>
  )
}
