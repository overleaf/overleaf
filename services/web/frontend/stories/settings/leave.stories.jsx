import useFetchMock from '../hooks/use-fetch-mock'
import LeaveModal from '../../js/features/settings/components/leave/modal'
import LeaveSection from '../../js/features/settings/components/leave-section'
import { setDefaultMeta, defaultSetupMocks } from './helpers/leave'

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
