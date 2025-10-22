import { callbackify } from 'node:util'
import OError from '@overleaf/o-error'
import { fetchJson } from '@overleaf/fetch-utils'
import settings from '@overleaf/settings'

async function getContactIds(userId, options) {
  options = options ?? { limit: 50 }

  const url = new URL(`${settings.apis.contacts.url}/user/${userId}/contacts`)

  for (const [key, val] of Object.entries(options)) {
    url.searchParams.set(key, val)
  }

  let body
  try {
    body = await fetchJson(url)
  } catch (err) {
    throw OError.tag(err, 'failed request to contacts API', { userId })
  }

  return body?.contact_ids || []
}

async function addContact(userId, contactId) {
  const url = new URL(`${settings.apis.contacts.url}/user/${userId}/contacts`)

  let body
  try {
    body = await fetchJson(url, {
      method: 'POST',
      json: { contact_id: contactId },
    })
  } catch (err) {
    throw OError.tag(err, 'failed request to contacts API', {
      userId,
      contactId,
    })
  }

  return body?.contact_ids || []
}

export default {
  getContactIds: callbackify(getContactIds),
  addContact: callbackify(addContact),
  promises: {
    getContactIds,
    addContact,
  },
}
