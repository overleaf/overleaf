import { useTranslation } from 'react-i18next'
import EmailCell from './cell'
import OLCol from '@/shared/components/ol/ol-col'
import OLRow from '@/shared/components/ol/ol-row'
import classnames from 'classnames'

function Header() {
  const { t } = useTranslation()

  return (
    <>
      <OLRow>
        <OLCol lg={4} className="d-none d-sm-block">
          <EmailCell>
            <strong>{t('email')}</strong>
          </EmailCell>
        </OLCol>
        <OLCol lg={8} className="d-none d-sm-block">
          <EmailCell>
            <strong>{t('institution_and_role')}</strong>
          </EmailCell>
        </OLCol>
      </OLRow>
      <div className={classnames('d-none d-sm-block', 'horizontal-divider')} />
      <div className={classnames('d-none d-sm-block', 'horizontal-divider')} />
    </>
  )
}

export default Header
