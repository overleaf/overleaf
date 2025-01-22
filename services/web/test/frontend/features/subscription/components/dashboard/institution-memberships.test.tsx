import { expect } from 'chai'
import { screen } from '@testing-library/react'
import InstitutionMemberships from '../../../../../../frontend/js/features/subscription/components/dashboard/institution-memberships'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../helpers/render-with-subscription-dash-context'
import { Institution } from '../../../../../../types/institution'

const memberships: Institution[] = [
  {
    id: 9258,
    name: 'Test University',
    commonsAccount: true,
    isUniversity: true,
    confirmed: true,
    ssoBeta: false,
    ssoEnabled: false,
    maxConfirmationMonths: 6,
    writefullCommonsAccount: false,
  },
  {
    id: 9259,
    name: 'Example Institution',
    commonsAccount: true,
    isUniversity: true,
    confirmed: true,
    ssoBeta: false,
    ssoEnabled: true,
    maxConfirmationMonths: 12,
    writefullCommonsAccount: false,
  },
]

describe('<InstitutionMemberships />', function () {
  afterEach(function () {
    cleanUpContext()
  })

  it('renders all insitutions with license', function () {
    renderWithSubscriptionDashContext(<InstitutionMemberships />, {
      metaTags: [
        { name: 'ol-currentInstitutionsWithLicence', value: memberships },
      ],
    })

    const elements = screen.getAllByText('You are on our', {
      exact: false,
    })
    expect(elements.length).to.equal(2)
    expect(elements[0].textContent).to.equal(
      'You are on our Professional plan as a confirmed member of Test University'
    )
    expect(elements[1].textContent).to.equal(
      'You are on our Professional plan as a confirmed member of Example Institution'
    )
  })

  it('renders error message when failed to check commons licenses', function () {
    renderWithSubscriptionDashContext(<InstitutionMemberships />)
    screen.getByText(
      'Sorry, something went wrong. Subscription information related to institutional affiliations may not be displayed. Please try again later.'
    )
  })
})
