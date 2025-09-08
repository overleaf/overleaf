import 'express'
import OAuth2Server from '@node-oauth/oauth2-server'
import type SessionData from 'express-session'

// Add properties to Express's Request object that are defined in JS middleware
// or controllers and expected to be present in controllers.
declare module 'express' {
  // eslint-disable-next-line no-unused-vars
  interface Request {
    session: SessionData
    userRestrictions?: Set
    oauth_user?: OAuth2Server.User
  }
}
