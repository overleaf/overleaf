// Copied from backend code: https://github.com/overleaf/internal/blob/6af8ae850bd8075e6bf0ebcafd2731177cdf49ad/services/web/app/src/Features/Helpers/EmailHelper.js#L5
const EMAIL_REGEXP =
  // eslint-disable-next-line no-useless-escape
  /^([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

export function isValidEmail(email: string | undefined | null) {
  if (!email) {
    return false
  } else {
    return EMAIL_REGEXP.test(email)
  }
}
