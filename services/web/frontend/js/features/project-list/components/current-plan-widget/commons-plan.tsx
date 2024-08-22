import { useTranslation, Trans } from 'react-i18next'
import { CommonsPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

type CommonsPlanProps = Pick<
  CommonsPlanSubscription,
  'subscription' | 'plan' | 'featuresPageURL'
>

function CommonsPlan({
  featuresPageURL,
  subscription,
  plan,
}: CommonsPlanProps) {
  const { t } = useTranslation()
  const currentPlanLabel = (
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
        description={t('commons_plan_tooltip', {
          plan: plan.name,
          institution: subscription.name,
        })}
        id="commons-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={featuresPageURL}
          className={classnames(
            'current-plan-label',
            bsVersion({
              bs5: 'd-none d-md-inline-block',
              bs3: 'hidden-xs',
            })
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

export default CommonsPlan
