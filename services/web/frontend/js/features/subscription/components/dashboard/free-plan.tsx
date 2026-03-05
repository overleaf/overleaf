import { useTranslation, Trans } from 'react-i18next'
import WritefullManagedBundleAddOn from '@/features/subscription/components/dashboard/states/active/change-plan/modals/writefull-bundle-management-modal'
import getMeta from '@/utils/meta'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function FreePlan() {
  const { t } = useTranslation()
  const hasAiAssistViaWritefull = getMeta('ol-hasAiAssistViaWritefull')
  const plans2026 = useFeatureFlag('plans-2026-phase-1')
  return (
    <>
      {plans2026 ? (
        t('you_are_using_our_free_plan')
      ) : (
        <Trans
          i18nKey="on_free_plan_upgrade_to_access_features"
          components={[
            // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
            <a
              href="/learn/how-to/Overleaf_premium_features"
              target="_blank"
            />,
          ]}
        />
      )}
      :
      <ul>
        <li>{t('invite_more_collabs')}</li>
        {plans2026 && <li>{t('get_unlimited_ai')}</li>}
        {!plans2026 && <li>{t('realtime_track_changes')}</li>}
        <li>{t('full_doc_history')}</li>
        <li>{t('reference_search')}</li>
        <li>{t('reference_sync')}</li>
        <li>{t('dropbox_integration_lowercase')}</li>
        <li>{t('github_integration_lowercase')}</li>
        {!plans2026 && <li>{t('priority_support')}</li>}
      </ul>
      <a className="btn btn-primary me-1" href="/user/subscription/plans">
        {t('upgrade_now')}
      </a>
      {hasAiAssistViaWritefull && (
        <>
          <h2 className="h3 fw-bold">{t('add_ons')}</h2>
          <WritefullManagedBundleAddOn />
        </>
      )}
    </>
  )
}

export default FreePlan
