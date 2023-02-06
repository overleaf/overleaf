import { Trans } from 'react-i18next'

function TosAgreementNotice() {
  return (
    <p className="tos-agreement-notice">
      <Trans
        i18nKey="by_subscribing_you_agree_to_our_terms_of_service"
        components={[
          // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
          <a href="/legal#Terms" target="_blank" rel="noopener noreferrer" />,
        ]}
      />
    </p>
  )
}

export default TosAgreementNotice
