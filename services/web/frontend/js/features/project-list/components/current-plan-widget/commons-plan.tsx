import { useTranslation, Trans } from 'react-i18next'
import { CommonsPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import Tooltip from '../../../../shared/components/tooltip'

type CommonsPlanProps = Pick<CommonsPlanSubscription, 'subscription' | 'plan'>

function CommonsPlan({ subscription, plan }: CommonsPlanProps) {
  const { t } = useTranslation()

  return (
    <Tooltip
      description={t('commons_plan_tooltip', {
        plan: plan.name,
        institution: subscription.name,
      })}
      id="commons-plan"
      overlayProps={{ placement: 'bottom' }}
    >
      <a
        href="/learn/how-to/Overleaf_premium_features"
        className="current-plan-label"
      >
        <Trans i18nKey="premium_plan_label" components={{ b: <strong /> }} />{' '}
        <span className="info-badge" />
      </a>
    </Tooltip>
  )
}

export default CommonsPlan
