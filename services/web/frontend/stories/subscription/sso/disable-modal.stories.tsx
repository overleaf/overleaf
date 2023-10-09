import SSODisableModal, {
  type SSODisableModalProps,
} from '../../../../modules/managed-users/frontend/js/components/modals/sso-disable-modal'
import useFetchMock from '../../hooks/use-fetch-mock'
import { useMeta } from '../../hooks/use-meta'

export const DisableSSOModalDefault = (args: SSODisableModalProps) => {
  useMeta({ 'ol-groupId': '123' })
  useFetchMock(fetchMock => {
    fetchMock.post('express:/manage/groups/:id/settings/disableSSO', 200, {
      delay: 500,
    })
  })
  return <SSODisableModal {...args} />
}

export const DisableSSOModalError = (args: SSODisableModalProps) => {
  useMeta({ 'ol-groupId': '123' })
  useFetchMock(fetchMock => {
    fetchMock.post('express:/manage/groups/:id/settings/enableSSO', 500, {
      delay: 500,
    })
  })
  return <SSODisableModal {...args} />
}

export default {
  title: 'Subscription / SSO / Disable Modal',
  component: SSODisableModal,
  args: {
    show: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
    onDisableSSO: { action: 'callback' },
  },
}
