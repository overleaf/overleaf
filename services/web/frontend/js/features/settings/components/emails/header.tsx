import { useTranslation } from 'react-i18next'
import EmailCell from './cell'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLRow from '@/features/ui/components/ol/ol-row'
import classnames from 'classnames'
import { bsVersion } from '@/features/utils/bootstrap-5'

function Header() {
  const { t } = useTranslation()

  return (
    <>
      <OLRow>
        <OLCol
          lg={4}
          className={bsVersion({
            bs5: 'd-none d-sm-block',
            bs3: 'hidden-xs',
          })}
        >
          <EmailCell>
            <strong>{t('email')}</strong>
          </EmailCell>
        </OLCol>
        <OLCol
          lg={8}
          className={bsVersion({
            bs5: 'd-none d-sm-block',
            bs3: 'hidden-xs',
          })}
        >
          <EmailCell>
            <strong>{t('institution_and_role')}</strong>
          </EmailCell>
        </OLCol>
      </OLRow>
      <div
        className={classnames(
          bsVersion({ bs5: 'd-none d-sm-block', bs3: 'hidden-xs' }),
          'horizontal-divider'
        )}
      />
      <div
        className={classnames(
          bsVersion({ bs5: 'd-none d-sm-block', bs3: 'hidden-xs' }),
          'horizontal-divider'
        )}
      />
    </>
  )
}

export default Header
