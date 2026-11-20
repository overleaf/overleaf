import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import '../../../../app/src/infrastructure/mongodb.mjs'
import { User } from '../../../../app/src/models/User.mjs'
import AuthenticationManager from '../../../../app/src/Features/Authentication/AuthenticationManager.mjs'
import UserRegistrationHandler from '../../../../app/src/Features/User/UserRegistrationHandler.mjs'
import { sanitizeControlCharacters } from '../../../../app/src/infrastructure/Sanitize.mjs'
import { splitFullName } from './LaunchpadController.mjs'

async function main() {
  const email = (process.env.OVERLEAF_ADMIN_EMAIL || '').trim()
  const password = process.env.OVERLEAF_ADMIN_PASSWORD || ''

  if (!email || !password) {
    return 0
  }

  const existingAdmin = await User.findOne(
    { isAdmin: true },
    { _id: 1, email: 1 }
  ).lean()
  if (existingAdmin) {
    console.log('Admin user already exists; skipping bootstrap')
    return 0
  }

  const invalidEmail = AuthenticationManager.validateEmail(email)
  if (invalidEmail) {
    console.error(
      `Admin bootstrap skipped: invalid OVERLEAF_ADMIN_EMAIL (${invalidEmail.message})`
    )
    return 1
  }

  const invalidPassword = AuthenticationManager.validatePassword(
    password,
    email
  )
  if (invalidPassword) {
    console.error(
      `Admin bootstrap skipped: weak OVERLEAF_ADMIN_PASSWORD (${invalidPassword.message})`
    )
    return 1
  }

  const parsedName = splitFullName(process.env.OVERLEAF_ADMIN_NAME || '')
  const role = sanitizeControlCharacters(process.env.OVERLEAF_ADMIN_ROLE || '')
    .trim()
    .slice(0, 120)
  const institution = sanitizeControlCharacters(
    process.env.OVERLEAF_ADMIN_INSTITUTION || ''
  )
    .trim()
    .slice(0, 160)

  const user = await UserRegistrationHandler.promises.registerNewUser({
    email,
    password,
    ...(parsedName.first_name ? { first_name: parsedName.first_name } : {}),
    ...(parsedName.last_name ? { last_name: parsedName.last_name } : {}),
    analyticsId: crypto.randomUUID(),
  })

  const reversedHostname = user.email
    .split('@')[1]
    .split('')
    .reverse()
    .join('')

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        isAdmin: true,
        first_name: parsedName.first_name || user.first_name,
        last_name: parsedName.last_name || '',
        role,
        institution,
        emails: [{ email: user.email, reversedHostname }],
      },
    }
  ).exec()

  console.log(`Bootstrapped initial admin user: ${user.email}`)
  return 0
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const code = await main()
    process.exit(code)
  } catch (err) {
    console.error('Admin bootstrap failed:', err?.message || err)
    process.exit(1)
  }
}
