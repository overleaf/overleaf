import TosAgreementNoticeComponent from '../../../../js/features/subscription/components/new/checkout/tos-agreement-notice'

export const TosAgreementNotice = () => <TosAgreementNoticeComponent />

export default {
  title: 'Subscription / New / Checkout',
  decorators: [
    (Story: React.ComponentType) => (
      <div
        className="card card-highlighted card-border"
        style={{ maxWidth: '500px' }}
      >
        <Story />
      </div>
    ),
  ],
}
