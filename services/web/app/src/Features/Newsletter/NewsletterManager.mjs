const Settings = require('@overleaf/settings')
const MailchimpProvider = require('./MailChimpProvider')

const provider = MailchimpProvider.make(
  'newsletter',
  Settings.mailchimp ? Settings.mailchimp.list_id : null
)

module.exports = provider
