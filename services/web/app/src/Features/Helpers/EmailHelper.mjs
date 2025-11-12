import emailAddresses from 'email-addresses'

const { parseOneAddress } = emailAddresses

// available for frontend in https://github.com/overleaf/internal/blob/19d432c70b173752ee7c6d8978dd6be16b042921/services/web/frontend/js/shared/utils/email.tsx#L4
const EMAIL_REGEXP =
  // eslint-disable-next-line no-useless-escape
  /^([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

function getDomain(email) {
  email = parseEmail(email)
  return email ? email.split('@').pop() : null
}

function parseEmail(email, parseRfcAddress = false) {
  if (typeof email !== 'string' || !email) {
    return null
  }

  if (parseRfcAddress) {
    const result = parseOneAddress(email)
    if (!result?.address) {
      return null
    }
    email = result.address
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

export default {
  getDomain,
  parseEmail,
}
