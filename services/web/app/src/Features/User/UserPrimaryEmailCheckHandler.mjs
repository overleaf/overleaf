import Settings from '@overleaf/settings'

function requiresPrimaryEmailCheck({
  email,
  emails,
  lastPrimaryEmailCheck,
  signUpDate,
}) {
  const hasExpired = date => {
    if (!date) {
      return true
    }
    return Date.now() - date.getTime() > Settings.primary_email_check_expiration
  }

  const primaryEmailConfirmedAt = emails.find(
    emailEntry => emailEntry.email === email
  ).confirmedAt

  if (primaryEmailConfirmedAt && !hasExpired(primaryEmailConfirmedAt)) {
    return false
  }

  if (lastPrimaryEmailCheck) {
    return hasExpired(lastPrimaryEmailCheck)
  } else {
    return hasExpired(signUpDate)
  }
}

export default {
  requiresPrimaryEmailCheck,
}
