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

function setDefaultMeta() {
  window.metaAttributesCache.set('ol-userDefaultEmail', 'user@primary.com')
  window.metaAttributesCache.set('ol-isSaas', true)
  window.metaAttributesCache.set('ol-hasPassword', true)
}

export const Section = args => {
  useFetchMock(defaultSetupMocks)
  setDefaultMeta()

  return <LeaveSection {...args} />
}
Section.component = LeaveSection
Section.parameters = { controls: { include: [], hideNoControlsWarning: true } }

export const ModalSuccess = args => {
  setDefaultMeta()
  useFetchMock(defaultSetupMocks)

  return <LeaveModal {...args} />
}

export const ModalWithoutPassword = args => {
  setDefaultMeta()
  window.metaAttributesCache.set('ol-hasPassword', false)
  useFetchMock(defaultSetupMocks)

  return <LeaveModal {...args} />
}

export const ModalAuthError = args => {
  setDefaultMeta()
  useFetchMock(fetchMock => {
    fetchMock.post(/\/user\/delete/, 403)
  })

  return <LeaveModal {...args} />
}

export const ModalServerError = args => {
  setDefaultMeta()
  useFetchMock(fetchMock => {
    fetchMock.post(/\/user\/delete/, 500)
  })

  return <LeaveModal {...args} />
}

export const ModalSubscriptionError = args => {
  setDefaultMeta()
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
