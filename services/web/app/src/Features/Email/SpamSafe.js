const XRegExp = require('xregexp')

// A note about SAFE_REGEX:
// We have to escape the escape characters because XRegExp compiles it first.
// So it's equivalent to `^[\p{L}\p{N}\s\-_!&\(\)]+$]
// \p{L} = any letter in any language
// \p{N} = any kind of numeric character
// https://www.regular-expressions.info/unicode.html#prop is a good resource for
// more obscure regex features. standard RegExp does not support these

const HAN_REGEX = XRegExp('\\p{Han}')
const SAFE_REGEX = XRegExp("^[\\p{L}\\p{N}\\s\\-_!'&\\(\\)]+$")
const EMAIL_REGEX = XRegExp('^[\\p{L}\\p{N}.+_-]+@[\\w.-]+$')

const SpamSafe = {
  isSafeUserName(name) {
    return SAFE_REGEX.test(name) && name.length <= 30
  },

  isSafeProjectName(name) {
    if (HAN_REGEX.test(name)) {
      return SAFE_REGEX.test(name) && name.length <= 10
    }
    return SAFE_REGEX.test(name) && name.length <= 100
  },

  isSafeEmail(email) {
    return EMAIL_REGEX.test(email) && email.length <= 40
  },

  safeUserName(name, alternative, project) {
    if (project == null) {
      project = false
    }
    if (SpamSafe.isSafeUserName(name)) {
      return name
    }
    return alternative
  },

  safeProjectName(name, alternative) {
    if (SpamSafe.isSafeProjectName(name)) {
      return name
    }
    return alternative
  },

  safeEmail(email, alternative) {
    if (SpamSafe.isSafeEmail(email)) {
      return email
    }
    return alternative
  },
}

module.exports = SpamSafe
