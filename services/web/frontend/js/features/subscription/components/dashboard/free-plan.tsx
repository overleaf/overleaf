import { useTranslation } from 'react-i18next'
import WritefullManagedBundleAddOn from '@/features/subscription/components/dashboard/states/active/change-plan/modals/writefull-bundle-management-modal'
import getMeta from '@/utils/meta'

function FreePlan() {
  const { t } = useTranslation()
  const hasAiAssistViaWritefull = getMeta('ol-hasAiAssistViaWritefull')
  return (
    <>
      {t('you_are_using_our_free_plan')}:
      <ul>
        <li>{t('invite_more_collabs')}</li>
        <li>{t('higher_ai_allowance')}</li>
        <li>{t('full_doc_history')}</li>
        <li>{t('reference_search')}</li>
        <li>{t('reference_sync')}</li>
        <li>{t('dropbox_integration_lowercase')}</li>
        <li>{t('github_integration_lowercase')}</li>
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
