import { useMeta } from '../../hooks/use-meta'
import SSOLinkConfirm from '../../../../modules/managed-users/frontend/js/components/sso-link-confirm'

export const LinkConfirmInterstitial = () => {
  return <SSOLinkConfirm />
}

export const LinkConfirmInterstitialWithError = () => {
  useMeta({ 'ol-error': 'SAMLInvalidSignatureError' })
  return <SSOLinkConfirm />
}

export default {
  title: 'Subscription / SSO / Link',
  component: SSOLinkConfirm,
  decorators: [
    (Story: any) => {
      useMeta({ 'ol-groupId': '123' })
      useMeta({ 'ol-email': 'user@example.com' })
      return (
        <div className="container">
          <Story />
        </div>
      )
    },
  ],
}
