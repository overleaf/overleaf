import { Trans } from 'react-i18next'

export function ContactSupportToChangeGroupPlan() {
  return (
    <p>
      <Trans
        i18nKey="contact_support_to_change_group_subscription"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a href="/contact" />,
        ]}
      />
    </p>
  )
}
