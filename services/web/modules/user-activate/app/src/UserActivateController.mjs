import Path from 'node:path'
import { fileURLToPath } from 'node:url'
import UserGetter from '../../../../app/src/Features/User/UserGetter.js'
import UserRegistrationHandler from '../../../../app/src/Features/User/UserRegistrationHandler.js'
import ErrorController from '../../../../app/src/Features/Errors/ErrorController.js'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))

export default {
  registerNewUser(req, res, next) {
    res.render(Path.resolve(__dirname, '../views/user/register'))
  },

  register(req, res, next) {
    const { email } = req.body
    if (email == null || email === '') {
      return res.sendStatus(422) // Unprocessable Entity
    }
    UserRegistrationHandler.registerNewUserAndSendActivationEmail(
      email,
      (error, user, setNewPasswordUrl) => {
        if (error != null) {
          return next(error)
        }
        res.json({
          email: user.email,
          setNewPasswordUrl,
        })
      }
    )
  },

  activateAccountPage(req, res, next) {
    // An 'activation' is actually just a password reset on an account that
    // was set with a random password originally.
    if (req.query.user_id == null || req.query.token == null) {
      return ErrorController.notFound(req, res)
    }

    if (typeof req.query.user_id !== 'string') {
      return ErrorController.forbidden(req, res)
    }

    UserGetter.getUser(
      req.query.user_id,
      { email: 1, loginCount: 1 },
      (error, user) => {
        if (error != null) {
          return next(error)
        }
        if (!user) {
          return ErrorController.notFound(req, res)
        }
        if (user.loginCount > 0) {
          // Already seen this user, so account must be activate
          // This lets users keep clicking the 'activate' link in their email
          // as a way to log in which, if I know our users, they will.
          res.redirect(`/login`)
        } else {
          req.session.doLoginAfterPasswordReset = true
          res.render(Path.resolve(__dirname, '../views/user/activate'), {
            title: 'activate_account',
            email: user.email,
            token: req.query.token,
          })
        }
      }
    )
  },
}
