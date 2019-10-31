// eslint-disable-next-line no-useless-escape
const EMAIL_REGEXP = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\ ".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

function getDomain(email) {
  email = parseEmail(email)
  return email ? email.split('@').pop() : null
}

function parseEmail(email) {
  if (email == null) {
    return null
  }
  if (email.length > 254) {
    return null
  }
  email = email.trim().toLowerCase()

  const matched = email.match(EMAIL_REGEXP)
  if (matched == null || matched[0] == null) {
    return null
  }

  return matched[0]
}

module.exports = {
  getDomain,
  parseEmail
}
