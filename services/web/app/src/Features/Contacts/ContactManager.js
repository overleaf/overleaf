const { callbackify } = require('util')
const OError = require('@overleaf/o-error')
const fetch = require('node-fetch')
const settings = require('@overleaf/settings')

async function getContactIds(userId, options) {
  options = options ?? { limit: 50 }

  const url = new URL(`${settings.apis.contacts.url}/user/${userId}/contacts`)

  for (const [key, val] of Object.entries(options)) {
    url.searchParams.set(key, val)
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  const body = await response.json()

  if (!response.ok) {
    throw new OError(
      `contacts api responded with non-success code: ${response.statusCode}`,
      { user_id: userId }
    )
  }

  return body?.contact_ids || []
}

async function addContact(userId, contactId) {
  const url = new URL(`${settings.apis.contacts.url}/user/${userId}/contacts`)
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ contact_id: contactId }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new OError(
      `contacts api responded with non-success code: ${response.statusCode}`,
      {
        user_id: userId,
        contact_id: contactId,
      }
    )
  }

  return body?.contact_ids || []
}

module.exports = {
  getContactIds: callbackify(getContactIds),
  addContact: callbackify(addContact),
  promises: {
    getContactIds,
    addContact,
  },
}
