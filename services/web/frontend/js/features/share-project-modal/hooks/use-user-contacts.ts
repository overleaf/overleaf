import { useEffect, useState } from 'react'
import { getJSON } from '../../../infrastructure/fetch-json'
import useAbortController from '../../../shared/hooks/use-abort-controller'
import { Contact } from '../utils/types'

export function useUserContacts() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Contact[] | null>(null)
  const [error, setError] = useState(false)

  const { signal } = useAbortController()

  useEffect(() => {
    getJSON('/user/contacts', { signal })
      .then(data => {
        setData(data.contacts.map(buildContact))
      })
      .catch(error => setError(error))
      .finally(() => setLoading(false))
  }, [signal])

  return { loading, data, error }
}

function buildContact(contact: Omit<Contact, 'name' | 'display'>): Contact {
  const [emailPrefix] = contact.email.split('@')

  // the name is not just the default "email prefix as first name"
  const hasName = contact.last_name || contact.first_name !== emailPrefix

  const name = hasName
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : ''

  return {
    ...contact,
    name,
    display: name ? `${name} <${contact.email}>` : contact.email,
  }
}
