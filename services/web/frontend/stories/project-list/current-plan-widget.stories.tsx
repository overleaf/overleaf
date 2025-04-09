import CurrentPlanWidget from '../../js/features/project-list/components/current-plan-widget/current-plan-widget'

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

export const PausedPlan = (args: any) => {
  window.metaAttributesCache.set('ol-usersBestSubscription', {
    type: 'individual',
    plan: {
      name: 'Individual',
    },
    subscription: {
      name: 'Example Name',
      recurlyStatus: {
        state: 'paused',
      },
    },
  })

  return <CurrentPlanWidget {...args} />
}

export default {
  title: 'Project List / Current Plan Widget',
  component: CurrentPlanWidget,
}
