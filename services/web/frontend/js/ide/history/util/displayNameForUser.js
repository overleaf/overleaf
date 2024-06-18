import getMeta from '@/utils/meta'

export default function displayNameForUser(user) {
  if (user == null) {
    return 'Anonymous'
  }
  if (user.id === getMeta('ol-user').id) {
    return 'you'
  }
  if (user.name != null) {
    return user.name
  }
  let name = [user.first_name, user.last_name]
    .filter(n => n != null)
    .join(' ')
    .trim()
  if (name === '') {
    name = user.email.split('@')[0]
  }
  if (name == null || name === '') {
    return '?'
  }
  return name
}
