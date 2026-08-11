import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'

export type LossMessagingPlanType = 'student' | 'collaborator' | 'professional'

export function getLossMessagingPlanType(
  planCode: string
): LossMessagingPlanType | null {
  if (planCode.startsWith('professional')) return 'professional'
  if (planCode.startsWith('collaborator')) return 'collaborator'
  if (planCode.startsWith('student')) return 'student'
  return null
}

type LossRow = { lost: string; replacement: string }

function getAiLossRow(planType: LossMessagingPlanType, t: TFunction): LossRow {
  if (planType === 'student') {
    return { lost: t('ai_assistant'), replacement: t('no_ai_assistant') }
  }
  if (planType === 'collaborator') {
    return {
      lost: t('ai_assistant_and_higher_ai_allowance'),
      replacement: t('small_ai_allowance_no_assistant'),
    }
  }
  return {
    lost: t('ai_assistant_and_max_ai_allowance'),
    replacement: t('small_ai_allowance_no_assistant'),
  }
}

function getCollaboratorsLossRow(
  planType: LossMessagingPlanType,
  t: TFunction
): LossRow {
  return {
    lost:
      planType === 'professional'
        ? t('unlimited_collaborators_per_project')
        : t('ten_collaborators_per_project'),
    replacement: t('one_collaborator_per_project'),
  }
}

function getLossRows(planType: LossMessagingPlanType, t: TFunction): LossRow[] {
  return [
    {
      lost: t('plan_24x_longer_compile_timeout'),
      replacement: t('basic_compile_timeout_for_small_projects'),
    },
    getAiLossRow(planType, t),
    getCollaboratorsLossRow(planType, t),
    {
      lost: t('full_project_history'),
      replacement: t('history_24_hours_only'),
    },
  ]
}

export function CancelSubscriptionLossMessaging({
  planType,
  terminationDate,
  onCancelSubscription,
  isButtonDisabled,
  isCancelLoading,
}: {
  planType: LossMessagingPlanType
  terminationDate: string
  onCancelSubscription: () => void
  isButtonDisabled: boolean
  isCancelLoading: boolean
}) {
  const { t } = useTranslation()
  const { setShowCancellation } = useSubscriptionDashboardContext()

  return (
    <div className="cancel-loss-messaging">
      <h2>{t('are_you_sure_you_want_to_cancel')}</h2>
      <p>
        {t('cancelling_will_end_your_subscription_on', { terminationDate })}
      </p>
      <div className="cancel-loss-card">
        <h3 className="cancel-loss-card-heading">
          {t('youll_be_moved_to_the_free_plan')}
        </h3>
        <ul className="cancel-loss-list">
          {getLossRows(planType, t).map(row => (
            <li key={row.lost} className="cancel-loss-list-item">
              <MaterialIcon type="cancel" className="cancel-loss-icon" />
              <span>
                <del className="cancel-loss-lost">{row.lost}</del>{' '}
                {row.replacement}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="cancel-loss-actions">
        <OLButton
          variant="secondary"
          disabled={isButtonDisabled}
          onClick={() => setShowCancellation(false)}
        >
          {t('keep_subscription')}
        </OLButton>
        <OLButton
          variant="danger-ghost"
          disabled={isButtonDisabled}
          isLoading={isCancelLoading}
          loadingLabel={t('processing_uppercase') + '…'}
          onClick={onCancelSubscription}
        >
          {t('cancel_subscription')}
        </OLButton>
      </div>
    </div>
  )
}
