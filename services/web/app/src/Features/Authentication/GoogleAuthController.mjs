import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import AuthenticationController from './AuthenticationController.mjs'
import SessionManager from './SessionManager.mjs'
import UserGetter from '../User/UserGetter.mjs'
import UserRegistrationHandler from '../User/UserRegistrationHandler.mjs'
import ThirdPartyIdentityManager from '../User/ThirdPartyIdentityManager.mjs'
import { User } from '../../models/User.mjs'

const PROVIDER_ID = 'google'

function _setupStrategy() {
  if (!Settings.googleOAuth) {
    logger.debug({}, 'Google OAuth not configured, skipping strategy setup')
    return
  }

  const strategy = new GoogleStrategy(
    {
      clientID: Settings.googleOAuth.clientId,
      clientSecret: Settings.googleOAuth.clientSecret,
      callbackURL: Settings.googleOAuth.callbackURL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const result = await _handleGoogleCallback(
          req,
          accessToken,
          refreshToken,
          profile
        )
        done(null, result)
      } catch (err) {
        done(err)
      }
    }
  )

  passport.use('google', strategy)
  logger.debug({}, 'Google OAuth strategy configured')
}

async function _handleGoogleCallback(req, accessToken, refreshToken, profile) {
  const googleId = profile.id
  const email =
    profile.emails && profile.emails[0] ? profile.emails[0].value : null
  const displayName = profile.displayName

  if (!email) {
    throw new Error('No email returned from Google')
  }

  logger.debug({ googleId, email }, 'Processing Google OAuth callback')

  // Check if user is linking their account (already logged in)
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (userId) {
    // User is logged in - link their Google account
    const auditLog = {
      initiatorId: userId,
      ipAddress: req.ip,
    }
    await ThirdPartyIdentityManager.promises.link(
      userId,
      PROVIDER_ID,
      googleId,
      { email, displayName },
      auditLog
    )
    const user = await UserGetter.promises.getUser(userId)
    return user
  }

  // Try to find existing user by Google ID
  try {
    const user = await ThirdPartyIdentityManager.promises.getUser(
      PROVIDER_ID,
      googleId
    )
    logger.debug({ userId: user._id }, 'Found existing user by Google ID')
    return user
  } catch (err) {
    if (err.name !== 'ThirdPartyUserNotFoundError') {
      throw err
    }
  }

  // Try to find existing user by email
  let user = await UserGetter.promises.getUserByAnyEmail(email)

  if (user) {
    // User exists but hasn't linked Google - link it now
    const auditLog = {
      initiatorId: user._id,
      ipAddress: req.ip,
    }
    await ThirdPartyIdentityManager.promises.link(
      user._id,
      PROVIDER_ID,
      googleId,
      { email, displayName },
      auditLog
    )
    logger.debug({ userId: user._id }, 'Linked Google to existing user')
    return user
  }

  // Create new user
  logger.debug({ email }, 'Creating new user from Google OAuth')

  // Generate a random password for the user (they can reset it later)
  const randomPassword =
    Math.random().toString(36).slice(-16) +
    Math.random().toString(36).slice(-16) +
    'A1!'

  user = await UserRegistrationHandler.promises.registerNewUser({
    email,
    password: randomPassword,
    first_name: profile.name?.givenName || displayName?.split(' ')[0] || '',
    last_name: profile.name?.familyName || displayName?.split(' ').slice(1).join(' ') || '',
  })

  // Link Google account to the new user
  const auditLog = {
    initiatorId: user._id,
    ipAddress: req.ip,
  }
  await ThirdPartyIdentityManager.promises.link(
    user._id,
    PROVIDER_ID,
    googleId,
    { email, displayName },
    auditLog
  )

  // Mark session as just registered for analytics
  req.session.justRegistered = true

  logger.debug({ userId: user._id }, 'Created new user from Google OAuth')
  return user
}

function initiateGoogleAuth(req, res, next) {
  if (!Settings.googleOAuth) {
    return res.status(404).send('Google OAuth not configured')
  }

  // Store redirect URL if provided
  const redirectTo = req.query.redirect || req.session.postLoginRedirect
  if (redirectTo) {
    req.session.postLoginRedirect = redirectTo
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })(req, res, next)
}

async function handleGoogleCallback(req, res, next) {
  if (!Settings.googleOAuth) {
    return res.status(404).send('Google OAuth not configured')
  }

  passport.authenticate('google', async (err, user, info) => {
    if (err) {
      logger.error({ err }, 'Error during Google OAuth callback')
      return res.redirect('/login?error=google_auth_failed')
    }

    if (!user) {
      logger.warn({ info }, 'No user returned from Google OAuth')
      return res.redirect('/login?error=google_auth_failed')
    }

    try {
      // Log the user in
      AuthenticationController.setAuditInfo(req, { method: 'Google' })
      await AuthenticationController.promises.finishLogin(user, req, res)
    } catch (loginErr) {
      logger.error({ err: loginErr }, 'Error finishing Google OAuth login')
      return res.redirect('/login?error=google_auth_failed')
    }
  })(req, res, next)
}

function isGoogleOAuthEnabled() {
  return !!Settings.googleOAuth
}

const GoogleAuthController = {
  initiateGoogleAuth,
  handleGoogleCallback,
  isGoogleOAuthEnabled,
  setupStrategy: _setupStrategy,
}

export default GoogleAuthController

