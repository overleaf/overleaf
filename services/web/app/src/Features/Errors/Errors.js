/* eslint-disable
    max-len,
    no-proto,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Errors
var NotFoundError = function(message) {
  const error = new Error(message)
  error.name = 'NotFoundError'
  error.__proto__ = NotFoundError.prototype
  return error
}
NotFoundError.prototype.__proto__ = Error.prototype

var ForbiddenError = function(message) {
  const error = new Error(message)
  error.name = 'ForbiddenError'
  error.__proto__ = ForbiddenError.prototype
  return error
}
ForbiddenError.prototype.__proto__ = Error.prototype

var ServiceNotConfiguredError = function(message) {
  const error = new Error(message)
  error.name = 'ServiceNotConfiguredError'
  error.__proto__ = ServiceNotConfiguredError.prototype
  return error
}
ServiceNotConfiguredError.prototype.__proto__ = Error.prototype

var TooManyRequestsError = function(message) {
  const error = new Error(message)
  error.name = 'TooManyRequestsError'
  error.__proto__ = TooManyRequestsError.prototype
  return error
}
TooManyRequestsError.prototype.__proto__ = Error.prototype

var InvalidNameError = function(message) {
  const error = new Error(message)
  error.name = 'InvalidNameError'
  error.__proto__ = InvalidNameError.prototype
  return error
}
InvalidNameError.prototype.__proto__ = Error.prototype

var UnsupportedFileTypeError = function(message) {
  const error = new Error(message)
  error.name = 'UnsupportedFileTypeError'
  error.__proto__ = UnsupportedFileTypeError.prototype
  return error
}
UnsupportedFileTypeError.prototype.__proto__ = Error.prototype

var UnsupportedExportRecordsError = function(message) {
  const error = new Error(message)
  error.name = 'UnsupportedExportRecordsError'
  error.__proto__ = UnsupportedExportRecordsError.prototype
  return error
}
UnsupportedExportRecordsError.prototype.__proto__ = Error.prototype

var V1HistoryNotSyncedError = function(message) {
  const error = new Error(message)
  error.name = 'V1HistoryNotSyncedError'
  error.__proto__ = V1HistoryNotSyncedError.prototype
  return error
}
V1HistoryNotSyncedError.prototype.__proto__ = Error.prototype

var ProjectHistoryDisabledError = function(message) {
  const error = new Error(message)
  error.name = 'ProjectHistoryDisabledError'
  error.__proto__ = ProjectHistoryDisabledError.prototype
  return error
}
ProjectHistoryDisabledError.prototype.__proto__ = Error.prototype

var V1ConnectionError = function(message) {
  const error = new Error(message)
  error.name = 'V1ConnectionError'
  error.__proto__ = V1ConnectionError.prototype
  return error
}
V1ConnectionError.prototype.__proto__ = Error.prototype

var UnconfirmedEmailError = function(message) {
  const error = new Error(message)
  error.name = 'UnconfirmedEmailError'
  error.__proto__ = UnconfirmedEmailError.prototype
  return error
}
UnconfirmedEmailError.prototype.__proto__ = Error.prototype

var EmailExistsError = function(message) {
  const error = new Error(message)
  error.name = 'EmailExistsError'
  error.__proto__ = EmailExistsError.prototype
  return error
}
EmailExistsError.prototype.__proto__ = Error.prototype

var InvalidError = function(message) {
  const error = new Error(message)
  error.name = 'InvalidError'
  error.__proto__ = InvalidError.prototype
  return error
}
InvalidError.prototype.__proto__ = Error.prototype

var AccountMergeError = function(message) {
  const error = new Error(message)
  error.name = 'AccountMergeError'
  error.__proto__ = AccountMergeError.prototype
  return error
}
AccountMergeError.prototype.__proto__ = Error.prototype

var NotInV2Error = function(message) {
  const error = new Error(message)
  error.name = 'NotInV2Error'
  error.__proto__ = NotInV2Error.prototype
  return error
}
NotInV2Error.prototype.__proto__ = Error.prototype

var SLInV2Error = function(message) {
  const error = new Error(message)
  error.name = 'SLInV2Error'
  error.__proto__ = SLInV2Error.prototype
  return error
}
SLInV2Error.prototype.__proto__ = Error.prototype

const ThirdPartyIdentityExistsError = function(message) {
  if (message == null) {
    message = 'provider and external id already linked to another account'
  }
  const error = new Error(message)
  error.name = 'ThirdPartyIdentityExistsError'
  error.__proto__ = ThirdPartyIdentityExistsError.prototype
  return error
}
ThirdPartyIdentityExistsError.prototype.__proto__ = Error.prototype

const ThirdPartyUserNotFoundError = function(message) {
  if (message == null) {
    message = 'user not found for provider and external id'
  }
  const error = new Error(message)
  error.name = 'ThirdPartyUserNotFoundError'
  error.__proto__ = ThirdPartyUserNotFoundError.prototype
  return error
}
ThirdPartyUserNotFoundError.prototype.__proto__ = Error.prototype

var SubscriptionAdminDeletionError = function(message) {
  if (message == null) {
    message = 'subscription admins cannot be deleted'
  }
  const error = new Error(message)
  error.name = 'SubscriptionAdminDeletionError'
  error.__proto__ = SubscriptionAdminDeletionError.prototype
  return error
}
SubscriptionAdminDeletionError.prototype.__proto__ = Error.prototype

module.exports = Errors = {
  NotFoundError,
  ForbiddenError,
  ServiceNotConfiguredError,
  TooManyRequestsError,
  InvalidNameError,
  UnsupportedFileTypeError,
  UnsupportedExportRecordsError,
  V1HistoryNotSyncedError,
  ProjectHistoryDisabledError,
  V1ConnectionError,
  UnconfirmedEmailError,
  EmailExistsError,
  InvalidError,
  AccountMergeError,
  NotInV2Error,
  SLInV2Error,
  ThirdPartyIdentityExistsError,
  ThirdPartyUserNotFoundError,
  SubscriptionAdminDeletionError
}
