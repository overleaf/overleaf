import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import InstitutionMemberships from '../../../../../../frontend/js/features/subscription/components/dashboard/institution-memberships'

const memberships = [
  {
    id: 9258,
    name: 'Test University',
    commonsAccount: true,
    isUniversity: true,
    confirmed: true,
    ssoBeta: false,
    ssoEnabled: false,
    maxConfirmationMonths: 6,
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
  },
]

describe('<InstitutionMemberships />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('renders all insitutions with license', function () {
    render(<InstitutionMemberships memberships={memberships} />)

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
    render(<InstitutionMemberships memberships={undefined} />)
    screen.getByText(
      'Sorry, something went wrong. Subscription information related to institutional affiliations may not be displayed. Please try again later.'
    )
  })

  it('renders the "Get the most out of your" subscription text when a user has a subscription', function () {
    render(<InstitutionMemberships memberships={memberships} />)
    screen.getByText('Get the most out of your', {
      exact: false,
    })
  })
})
