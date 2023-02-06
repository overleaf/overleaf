import _ from 'lodash'

export function parseEmails(emailsString: string) {
  const regexBySpaceOrComma = /[\s,]+/
  let emails = emailsString.split(regexBySpaceOrComma)
  emails = _.map(emails, email => email.trim())
  emails = _.filter(emails, email => email.indexOf('@') !== -1)
  return emails
}
