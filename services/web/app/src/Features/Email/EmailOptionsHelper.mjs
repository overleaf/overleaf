function _getIndefiniteArticle(providerName) {
  const vowels = ['a', 'e', 'i', 'o', 'u']

  return vowels.includes(providerName.charAt(0).toLowerCase()) ? 'an' : 'a'
}

function _actionBuilder(providerName, action, accountLinked) {
  if (providerName.toLowerCase() !== 'google') {
    return `${providerName} account ${action}`
  }

  return accountLinked ? `New account ${action}` : `Account ${action}`
}

function linkOrUnlink(accountLinked, providerName, email) {
  const action = accountLinked ? 'linked' : 'no longer linked'
  const actionDescribed = accountLinked ? 'was linked to' : 'was unlinked from'
  const indefiniteArticle = _getIndefiniteArticle(providerName)

  return {
    to: email,
    action: _actionBuilder(providerName, action, accountLinked),
    actionDescribed: `${indefiniteArticle} ${providerName} account ${actionDescribed} your account ${email}`,
  }
}

export default {
  linkOrUnlink,
}
