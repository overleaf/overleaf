export function sanitizeSessionUserForFrontEnd(sessionUser) {
  if (sessionUser != null) {
    return {
      email: sessionUser.email,
      first_name: sessionUser.first_name,
      last_name: sessionUser.last_name,
    }
  }

  return null
}
