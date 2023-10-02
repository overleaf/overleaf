import SSOEnableModal, {
  type SSOEnableModalProps,
} from '../../../../modules/managed-users/frontend/js/components/modals/sso-enable-modal'
import useFetchMock from '../../hooks/use-fetch-mock'
import { useMeta } from '../../hooks/use-meta'

export const EnableSSOModalDefault = (args: SSOEnableModalProps) => {
  useMeta({ 'ol-groupId': '123' })
  useFetchMock(fetchMock => {
    fetchMock.post('express:/manage/groups/:id/settings/enableSSO', 200, {
      delay: 500,
    })
  })
  return <SSOEnableModal {...args} />
}

export const EnableSSOModalError = (args: SSOEnableModalProps) => {
  useMeta({ 'ol-groupId': '123' })
  useFetchMock(fetchMock => {
    fetchMock.post('express:/manage/groups/:id/settings/enableSSO', 500, {
      delay: 500,
    })
  })
  return <SSOEnableModal {...args} />
}

export default {
  title: 'Subscription / SSO / Enable Modal',
  component: SSOEnableModal,
  args: {
    show: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
    onEnableSSO: { action: 'callback' },
  },
}
