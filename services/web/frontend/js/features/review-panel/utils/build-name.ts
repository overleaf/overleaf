export const buildName = (user: {
  first_name?: string
  last_name?: string
  email?: string
}) => {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')

  if (name) {
    return name
  }

  if (user.email) {
    return user.email.split('@')[0]
  }

  return 'Unknown'
}
