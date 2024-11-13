import { useTranslation, Trans } from 'react-i18next'

function FreePlan() {
  const { t } = useTranslation()

  return (
    <>
      <Trans
        i18nKey="on_free_plan_upgrade_to_access_features"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a href="/learn/how-to/Overleaf_premium_features" target="_blank" />,
        ]}
      />
      :
      <ul>
        <li>{t('invite_more_collabs')}</li>
        <li>{t('realtime_track_changes')}</li>
        <li>{t('full_doc_history')}</li>
        <li>{t('reference_search')}</li>
        <li>{t('reference_sync')}</li>
        <li>{t('dropbox_integration_lowercase')}</li>
        <li>{t('github_integration_lowercase')}</li>
        <li>{t('priority_support')}</li>
      </ul>
      <a className="btn btn-primary me-1" href="/user/subscription/plans">
        {t('upgrade_now')}
      </a>
    </>
  )
}

export default FreePlan
