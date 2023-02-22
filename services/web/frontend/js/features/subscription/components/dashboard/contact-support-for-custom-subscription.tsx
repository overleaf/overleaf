import { Trans } from 'react-i18next'

export default function ContactSupport() {
  return (
    <p>
      <Trans
        i18nKey="you_are_on_a_paid_plan_contact_support_to_find_out_more"
        components={[<a href="/contact" />]} // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content
      />
    </p>
  )
}
