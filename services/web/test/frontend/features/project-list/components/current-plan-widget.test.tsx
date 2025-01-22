import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  CommonsPlanSubscription,
  GroupPlanSubscription,
  IndividualPlanSubscription,
} from '../../../../../types/project/dashboard/subscription'
import { DeepReadonly } from '../../../../../types/utils'
import * as eventTracking from '@/infrastructure/event-tracking'
import CurrentPlanWidget from '../../../../../frontend/js/features/project-list/components/current-plan-widget/current-plan-widget'

describe('<CurrentPlanWidget />', function () {
  const freePlanTooltipMessage =
    /click to find out how you could benefit from overleaf premium features/i
  const paidPlanTooltipMessage =
    /click to find out how to make the most of your overleaf premium features/i
  const pausedTooltipMessage =
    /click to unpause and reactivate your overleaf premium features/i

  let sendMBSpy: sinon.SinonSpy

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })
  afterEach(function () {
    sendMBSpy.restore()
  })

  describe('paused', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-usersBestSubscription', {
        type: 'individual',
        subscription: {
          recurlyStatus: {
            state: 'paused',
          },
        },
      })

      render(<CurrentPlanWidget />)
    })

    it('shows text and tooltip on mouseover', function () {
      const link = screen.getByRole('link', {
        name: /plan is paused/i,
      })
      fireEvent.mouseOver(link)

      screen.getByRole('tooltip', { name: pausedTooltipMessage })
    })
  })

  describe('free plan', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-usersBestSubscription', {
        type: 'free',
      })

      render(<CurrentPlanWidget />)
    })

    it('shows text and tooltip on mouseover', function () {
      const link = screen.getByRole('link', {
        name: /you’re on the free plan/i,
      })
      fireEvent.mouseOver(link)

      screen.getByRole('tooltip', { name: freePlanTooltipMessage })
    })

    it('clicks on upgrade button', function () {
      const upgradeLink = screen.getByRole('link', { name: /upgrade/i })
      fireEvent.click(upgradeLink)
      expect(sendMBSpy).to.be.calledOnce
      expect(sendMBSpy).calledWith('upgrade-button-click', {
        source: 'dashboard-top',
        page: '/',
        'project-dashboard-react': 'enabled',
        'is-dashboard-sidebar-hidden': false,
        'is-screen-width-less-than-768px': false,
      })
    })
  })

  describe('paid plan', function () {
    describe('trial', function () {
      const subscription = {
        type: 'individual',
        plan: {
          name: 'Abc',
        },
        subscription: {
          name: 'Example Name',
        },
        remainingTrialDays: -1,
      } as DeepReadonly<IndividualPlanSubscription>

      beforeEach(function () {
        window.metaAttributesCache.set('ol-usersBestSubscription', {
          ...subscription,
        })
      })

      it('shows remaining days', function () {
        const newSubscription: IndividualPlanSubscription = {
          ...subscription,
          remainingTrialDays: 5,
        }

        window.metaAttributesCache.set(
          'ol-usersBestSubscription',
          newSubscription
        )

        render(<CurrentPlanWidget />)

        screen.getByRole('link', {
          name: new RegExp(
            `${newSubscription.remainingTrialDays} more days on your overleaf premium trial`,
            'i'
          ),
        })
      })

      it('shows last day message', function () {
        window.metaAttributesCache.set('ol-usersBestSubscription', {
          ...subscription,
          remainingTrialDays: 1,
        })

        render(<CurrentPlanWidget />)

        screen.getByRole('link', {
          name: /this is the last day of your overleaf premium trial/i,
        })
      })
    })

    describe('individual', function () {
      const subscription = {
        type: 'individual',
        plan: {
          name: 'Abc',
        },
        subscription: {
          teamName: 'Example Team',
          name: 'Example Name',
        },
        remainingTrialDays: -1,
      } as DeepReadonly<IndividualPlanSubscription>

      beforeEach(function () {
        window.metaAttributesCache.set('ol-usersBestSubscription', {
          ...subscription,
        })
      })

      it('shows text and tooltip on mouseover', function () {
        render(<CurrentPlanWidget />)

        const link = screen.getByRole('link', {
          name: /you’re using overleaf premium/i,
        })
        fireEvent.mouseOver(link)

        screen.getByRole('tooltip', {
          name: new RegExp(`on the ${subscription.plan.name}`, 'i'),
        })
        screen.getByRole('tooltip', { name: paidPlanTooltipMessage })
      })
    })

    describe('group', function () {
      const subscription = {
        type: 'group',
        plan: {
          name: 'Abc',
        },
        subscription: {
          name: 'Example Name',
        },
        remainingTrialDays: -1,
      } as DeepReadonly<GroupPlanSubscription>

      beforeEach(function () {
        window.metaAttributesCache.set('ol-usersBestSubscription', {
          ...subscription,
        })
      })

      it('shows text and tooltip on mouseover (without subscription team name)', function () {
        render(<CurrentPlanWidget />)

        const link = screen.getByRole('link', {
          name: /you’re using overleaf premium/i,
        })
        fireEvent.mouseOver(link)

        expect(subscription.subscription.teamName).to.be.undefined
        screen.getByRole('tooltip', {
          name: new RegExp(
            `on the ${subscription.plan.name} plan as a member of a group subscription`,
            'i'
          ),
        })
        screen.getByRole('tooltip', { name: paidPlanTooltipMessage })
      })

      it('shows text and tooltip on mouseover (with subscription team name)', function () {
        const newSubscription = {
          ...subscription,
          subscription: {
            teamName: 'Example Team',
          },
        }

        window.metaAttributesCache.set(
          'ol-usersBestSubscription',
          newSubscription
        )

        render(<CurrentPlanWidget />)

        const link = screen.getByRole('link', {
          name: /you’re using overleaf premium/i,
        })
        fireEvent.mouseOver(link)

        screen.getByRole('tooltip', {
          name: new RegExp(
            `on the ${newSubscription.plan.name} plan as a member of a group subscription, ${newSubscription.subscription.teamName}`,
            'i'
          ),
        })
        screen.getByRole('tooltip', { name: paidPlanTooltipMessage })
      })
    })

    describe('commons', function () {
      it('shows text and tooltip on mouseover', function () {
        const subscription = {
          type: 'commons',
          plan: {
            name: 'Abc',
          },
          subscription: {
            name: 'Example Name',
          },
        } as DeepReadonly<CommonsPlanSubscription>

        window.metaAttributesCache.set('ol-usersBestSubscription', {
          ...subscription,
        })

        render(<CurrentPlanWidget />)

        const link = screen.getByRole('link', {
          name: /you’re using overleaf premium/i,
        })
        fireEvent.mouseOver(link)

        screen.getByRole('tooltip', {
          name: new RegExp(
            `on the ${subscription.plan.name} plan because of your affiliation with ${subscription.subscription.name}`,
            'i'
          ),
        })
        screen.getByRole('tooltip', { name: paidPlanTooltipMessage })
      })
    })
  })

  describe('features page', function () {
    const plans = [
      { type: 'free' },
      {
        type: 'individual',
        plan: {
          name: 'Abc',
        },
      },
      {
        type: 'group',
        plan: {
          name: 'Abc',
        },
        subscription: {
          teamName: 'Example Team',
          name: 'Example Name',
        },
      },
      {
        type: 'commons',
        plan: {
          name: 'Abc',
        },
        subscription: {
          name: 'Example Name',
        },
      },
    ]

    for (const plan of plans) {
      it(`links to features page on ${plan.type} plan`, function () {
        window.metaAttributesCache.set('ol-usersBestSubscription', {
          ...plan,
        })
        render(<CurrentPlanWidget />)

        const links = screen.getAllByRole('link')
        expect(links[0].getAttribute('href')).to.equal(
          '/learn/how-to/Overleaf_premium_features'
        )

        fireEvent.click(links[0])

        window.metaAttributesCache.delete('ol-usersBestSubscription')
      })
    }
  })
})
