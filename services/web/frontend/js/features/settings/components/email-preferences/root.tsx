import { useTranslation } from 'react-i18next'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'
import EmailPreferencesForm from './email-preferences-form'

function EmailPreferencesRoot() {
  const { isReady } = useWaitForI18n()

  return (
    <div className="container">
      <OLRow>
        <OLCol xl={{ span: 10, offset: 1 }}>
          {isReady ? <EmailPreferencesContent /> : null}
        </OLCol>
      </OLRow>
    </div>
  )
}

function EmailPreferencesContent() {
  const { t } = useTranslation()

  return (
    <OLPageContentCard>
      <div className="page-header">
        <h1>{t('newsletter_info_title')}</h1>
      </div>
      <p>{t('newsletter_info_summary')}</p>
      <EmailPreferencesForm />
    </OLPageContentCard>
  )
}

export default EmailPreferencesRoot
