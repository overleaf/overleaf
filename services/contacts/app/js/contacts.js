export function buildContactIds(contacts, limit) {
  return Object.entries(contacts || {})
    .map(([id, { n, ts }]) => ({ id, n, ts }))
    .sort(sortContacts)
    .slice(0, limit)
    .map(contact => contact.id)
}

// sort by decreasing count, decreasing timestamp.
// i.e. highest count, most recent first.
function sortContacts(a, b) {
  return a.n === b.n ? b.ts - a.ts : b.n - a.n
}
