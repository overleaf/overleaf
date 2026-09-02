import Path from 'node:path'
import { fileURLToPath } from 'node:url'
import UserGetter from '../../../../app/src/Features/User/UserGetter.mjs'
import UserRegistrationHandler from '../../../../app/src/Features/User/UserRegistrationHandler.mjs'
import ErrorController from '../../../../app/src/Features/Errors/ErrorController.mjs'
import { expressify } from '@overleaf/promise-utils'
import { z, parseReq } from '../../../../app/src/infrastructure/Validation.mjs'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))

const registerSchema = z.object({
  body: z.strictObject({
    email: z.string().optional(),
  }),
})

function registerNewUser(req, res, next) {
  res.render(Path.resolve(__dirname, '../views/user/register'))
}

async function register(req, res, next) {
  const { body } = parseReq(req, registerSchema, { logOnly: true })
  const { email } = body
  if (email == null || email === '') {
    return res.sendStatus(422) // Unprocessable Entity
  }
  const { user, setNewPasswordUrl } =
    await UserRegistrationHandler.promises.registerNewUserAndSendActivationEmail(
      email
    )
  res.json({
    email: user.email,
    setNewPasswordUrl,
  })
}

const activateAccountPageSchema = z.object({
  // Non-strict: this link is emailed out and may get sent back through an
  // email gateway/link-rewriter that appends its own tracking query params
  // (e.g. utm_* or a click-tracking id) -- rejecting the whole request over
  // an unrecognized key would turn a legitimate activation click into a 400
  // for the user, so extra params are tolerated rather than named/rejected.
  query: z.object({
    // A legitimate activation link only ever carries a bare user_id string,
    // but a tampered URL can turn it into a nested object via qs bracket
    // notation (`?user_id[x]=y`), which the handler below explicitly
    // detects (the `typeof` check) and turns into its own rendered 403
    // page -- not the generic JSON 400 that handleValidationError would
    // produce for a value rejected by the schema itself. So this stays a
    // loose union rather than zz.objectId(), leaving the type check (and
    // its response) to the handler.
    user_id: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .optional(),
    token: z.string().optional(),
  }),
})

async function activateAccountPage(req, res, next) {
  const { query } = parseReq(req, activateAccountPageSchema, {
    logOnly: true,
  })
  // An 'activation' is actually just a password reset on an account that
  // was set with a random password originally.
  if (query.user_id == null || query.token == null) {
    return ErrorController.notFound(req, res)
  }

  if (typeof query.user_id !== 'string') {
    return ErrorController.forbidden(req, res)
  }

  const user = await UserGetter.promises.getUser(query.user_id, {
    email: 1,
    loginCount: 1,
  })

  if (!user) {
    return ErrorController.notFound(req, res)
  }

  if (user.loginCount > 0) {
    // Already seen this user, so account must be activated.
    // This lets users keep clicking the 'activate' link in their email
    // as a way to log in which, if I know our users, they will.
    return res.redirect(`/login`)
  }

  req.session.doLoginAfterPasswordReset = true

  res.render(Path.resolve(__dirname, '../views/user/activate'), {
    title: 'activate_account',
    email: user.email,
    token: query.token,
  })
}

export default {
  registerNewUser,
  register: expressify(register),
  activateAccountPage: expressify(activateAccountPage),
}
