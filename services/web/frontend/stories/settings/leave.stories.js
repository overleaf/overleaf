import useFetchMock from '../hooks/use-fetch-mock'
import LeaveModal from '../../js/features/settings/components/leave/modal'
import LeaveSection from '../../js/features/settings/components/leave-section'

const MOCK_DELAY = 1000
window.metaAttributesCache = window.metaAttributesCache || new Map()

function defaultSetupMocks(fetchMock) {
  fetchMock.post(/\/user\/delete/, 200, {
    delay: MOCK_DELAY,
  })
}

export const Section = args => {
  window.metaAttributesCache.set('ol-userDefaultEmail', 'user@primary.com')
  useFetchMock(defaultSetupMocks)

  return <LeaveSection {...args} />
}
Section.component = LeaveSection
Section.parameters = { controls: { include: [], hideNoControlsWarning: true } }

export const ModalSuccess = args => {
  window.metaAttributesCache.set('ol-userDefaultEmail', 'user@primary.com')
  useFetchMock(defaultSetupMocks)

  return <LeaveModal {...args} />
}

export const ModalAuthError = args => {
  window.metaAttributesCache.set('ol-userDefaultEmail', 'user@primary.com')
  useFetchMock(fetchMock => {
    fetchMock.post(/\/user\/delete/, 403)
  })

  return <LeaveModal {...args} />
}

export const ModalServerError = args => {
  window.metaAttributesCache.set('ol-userDefaultEmail', 'user@primary.com')
  useFetchMock(fetchMock => {
    fetchMock.post(/\/user\/delete/, 500)
  })

  return <LeaveModal {...args} />
}

export const ModalSubscriptionError = args => {
  window.metaAttributesCache.set('ol-userDefaultEmail', 'user@primary.com')
  useFetchMock(fetchMock => {
    fetchMock.post(/\/user\/delete/, {
      status: 422,
      body: {
        error: 'SubscriptionAdminDeletionError',
      },
    })
  })

  return <LeaveModal {...args} />
}

export default {
  title: 'Account Settings / Leave',
  component: LeaveModal,
  args: {
    isOpen: true,
  },
  argTypes: {
    handleClose: { action: 'handleClose' },
  },
}
