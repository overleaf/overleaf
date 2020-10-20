function _getIndefiniteArticle(providerName) {
  const vowels = ['a', 'e', 'i', 'o', 'u']
  if (vowels.includes(providerName.charAt(0).toLowerCase())) return 'an'
  return 'a'
}

function linkOrUnlink(accountLinked, providerName, email) {
  const action = accountLinked ? 'linked' : 'no longer linked'
  const actionDescribed = accountLinked ? 'was linked to' : 'was unlinked from'
  const indefiniteArticle = _getIndefiniteArticle(providerName)
  return {
    to: email,
    action: `${providerName} account ${action}`,
    actionDescribed: `${indefiniteArticle} ${providerName} account ${actionDescribed} your account ${email}`
  }
}

module.exports = {
  linkOrUnlink
}
