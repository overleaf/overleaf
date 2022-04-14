import EmailsSection from '../js/features/settings/components/emails-section'
import useFetchMock from './hooks/use-fetch-mock'

const MOCK_DELAY = 1000
window.metaAttributesCache = window.metaAttributesCache || new Map()

function defaultSetupMocks(fetchMock) {
  fetchMock.post(
    /\/user\/emails\/resend_confirmation/,
    (path, req) => {
      return 200
    },
    {
      delay: MOCK_DELAY,
    }
  )
}

const fakeUsersData = [
  {
    affiliation: {
      institution: {
        confirmed: true,
        name: 'Overleaf',
      },
      licence: 'pro_plus',
    },
    confirmedAt: '2022-03-09T10:59:44.139Z',
    email: 'foo@overleaf.com',
    default: true,
  },
  {
    confirmedAt: '2022-03-10T10:59:44.139Z',
    email: 'bar@overleaf.com',
    default: false,
  },
  {
    affiliation: {
      institution: {
        confirmed: true,
        name: 'Overleaf',
      },
      licence: 'pro_plus',
      department: 'Art & Art History',
      role: 'Reader',
    },
    email: 'baz@overleaf.com',
    default: false,
  },
  {
    email: 'qux@overleaf.com',
    default: false,
  },
]

export const EmailsList = args => {
  useFetchMock(defaultSetupMocks)
  window.metaAttributesCache.set('ol-userEmails', fakeUsersData)

  return <EmailsSection {...args} />
}

export const NetworkErrors = args => {
  useFetchMock(defaultSetupMocks)
  window.metaAttributesCache.set('ol-userEmails', fakeUsersData)

  useFetchMock(fetchMock => {
    fetchMock.post(
      /\/user\/emails\/resend_confirmation/,
      () => {
        return 503
      },
      {
        delay: MOCK_DELAY,
      }
    )
  })

  return <EmailsSection {...args} />
}

export default {
  title: 'Emails and Affiliations',
  component: EmailsSection,
}
