import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from './icon'
import { useLocation } from '../hooks/use-location'
import { DefaultMessage } from './default-message'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from './material-icon'
import OLButton from '@/features/ui/components/ol/ol-button'

export const GenericErrorBoundaryFallback: FC = ({ children }) => {
  const { t } = useTranslation()
  const { reload: handleClick } = useLocation()

  return (
    <div className="error-boundary-container">
      <BootstrapVersionSwitcher
        bs3={
          <Icon
            accessibilityLabel={`${t('generic_something_went_wrong')} ${t(
              'please_refresh'
            )}`}
            type="exclamation-triangle fa-2x"
            fw
          />
        }
        bs5={
          <MaterialIcon
            accessibilityLabel={`${t('generic_something_went_wrong')} ${t(
              'please_refresh'
            )}`}
            type="warning"
            size="2x"
          />
        }
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
