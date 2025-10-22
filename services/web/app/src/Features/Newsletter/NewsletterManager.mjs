import Settings from '@overleaf/settings'
import MailchimpProvider from './MailChimpProvider.mjs'

const provider = MailchimpProvider.make(
  'newsletter',
  Settings.mailchimp ? Settings.mailchimp.list_id : null
)

export default provider
