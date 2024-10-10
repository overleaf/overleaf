import CurrentPlanWidget from '../../js/features/project-list/components/current-plan-widget/current-plan-widget'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const FreePlan = (args: any) => {
  window.metaAttributesCache.set('ol-usersBestSubscription', {
    type: 'free',
  })

  return <CurrentPlanWidget {...args} />
}

export const PaidPlanTrialLastDay = (args: any) => {
  window.metaAttributesCache.set('ol-usersBestSubscription', {
    type: 'individual',
    remainingTrialDays: 1,
    plan: {
      name: 'Individual',
    },
    subscription: {
      name: 'Example Name',
    },
  })

  return <CurrentPlanWidget {...args} />
}

export const PaidPlanRemainingDays = (args: any) => {
  window.metaAttributesCache.set('ol-usersBestSubscription', {
    type: 'individual',
    remainingTrialDays: 5,
    plan: {
      name: 'Individual',
    },
    subscription: {
      name: 'Example Name',
    },
  })

  return <CurrentPlanWidget {...args} />
}

export const PaidPlanActive = (args: any) => {
  window.metaAttributesCache.set('ol-usersBestSubscription', {
    type: 'individual',
    plan: {
      name: 'Individual',
    },
    subscription: {
      name: 'Example Name',
    },
  })

  return <CurrentPlanWidget {...args} />
}

export default {
  title: 'Project List / Current Plan Widget',
  component: CurrentPlanWidget,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
