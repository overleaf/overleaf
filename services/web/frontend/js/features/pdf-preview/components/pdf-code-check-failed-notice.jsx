import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import { bsVersion } from '@/features/utils/bootstrap-5'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function PdfCodeCheckFailedNotice() {
  const { t } = useTranslation()
  return (
    <OLNotification
      type="error"
      content={
        <>
          <BootstrapVersionSwitcher
            bs3={
              <>
                <Icon type="exclamation-triangle" fw />{' '}
              </>
            }
          />
          {t('code_check_failed_explanation')}
        </>
      }
      className={bsVersion({ bs5: 'm-0', bs3: 'mb-2' })}
    />
  )
}

export default memo(PdfCodeCheckFailedNotice)
