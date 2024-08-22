import { useTranslation, Trans } from 'react-i18next'
import { IndividualPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

type IndividualPlanProps = Pick<
  IndividualPlanSubscription,
  'plan' | 'remainingTrialDays' | 'featuresPageURL'
>

function IndividualPlan({
  featuresPageURL,
  plan,
  remainingTrialDays,
}: IndividualPlanProps) {
  const { t } = useTranslation()
  const currentPlanLabel =
    remainingTrialDays >= 0 ? (
      remainingTrialDays === 1 ? (
        <Trans i18nKey="trial_last_day" components={{ b: <strong /> }} />
      ) : (
        <Trans
          i18nKey="trial_remaining_days"
          components={{ b: <strong /> }}
          values={{ days: remainingTrialDays }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      )
    ) : (
      <Trans i18nKey="premium_plan_label" components={{ b: <strong /> }} />
    )

  return (
    <>
      <span
        className={classnames(
          'current-plan-label',
          bsVersion({ bs5: 'd-md-none', bs3: 'visible-xs' })
        )}
      >
        {currentPlanLabel}
      </span>
      <OLTooltip
        description={t('plan_tooltip', { plan: plan.name })}
        id="individual-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={featuresPageURL}
          className={classnames(
            'current-plan-label',
            bsVersion({ bs5: 'd-none d-md-inline-block', bs3: 'hidden-xs' })
          )}
        >
          {currentPlanLabel}&nbsp;
          <BootstrapVersionSwitcher
            bs3={<span className="info-badge" />}
            bs5={
              <MaterialIcon type="info" className="current-plan-label-icon" />
            }
          />
        </a>
      </OLTooltip>
    </>
  )
}

export default IndividualPlan
