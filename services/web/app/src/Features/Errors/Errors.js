const OError = require('@overleaf/o-error')

// Error class for legacy errors so they inherit OError while staying
// backward-compatible (can be instantiated with string as argument instead
// of object)
class BackwardCompatibleError extends OError {
  constructor(messageOrOptions) {
    let options
    if (typeof messageOrOptions === 'string') {
      options = { message: messageOrOptions }
    } else if (!messageOrOptions) {
      options = {}
    } else {
      options = messageOrOptions
    }
    super(options)
  }
}

class NotFoundError extends BackwardCompatibleError {}

class ForbiddenError extends BackwardCompatibleError {}

class ServiceNotConfiguredError extends BackwardCompatibleError {}

class TooManyRequestsError extends BackwardCompatibleError {}

class InvalidNameError extends BackwardCompatibleError {}

class UnsupportedFileTypeError extends BackwardCompatibleError {}

class UnsupportedExportRecordsError extends BackwardCompatibleError {}

class V1HistoryNotSyncedError extends BackwardCompatibleError {}

class ProjectHistoryDisabledError extends BackwardCompatibleError {}

class V1ConnectionError extends BackwardCompatibleError {}

class UnconfirmedEmailError extends BackwardCompatibleError {}

class EmailExistsError extends OError {
  constructor(options) {
    super({
      message: 'Email already exists',
      ...options
    })
  }
}

class InvalidError extends BackwardCompatibleError {}

class NotInV2Error extends BackwardCompatibleError {}

class SLInV2Error extends BackwardCompatibleError {}

class SAMLIdentityExistsError extends BackwardCompatibleError {
  constructor(arg) {
    super(arg)
    if (!this.message) {
      this.message =
        'provider and external id already linked to another account'
    }
  }
}

class SAMLSessionDataMissing extends BackwardCompatibleError {
  constructor(arg) {
    super(arg)
    if (!this.message) {
      this.message =
        'Please resubmit your institutional email.<br/><a href="/institutional-login">institutional login</a>'
    }
  }
}

class SAMLUserNotFoundError extends BackwardCompatibleError {
  constructor(arg) {
    super(arg)
    if (!this.message) {
      this.message = 'user not found for SAML provider and external id'
    }
  }
}

class ThirdPartyIdentityExistsError extends BackwardCompatibleError {
  constructor(arg) {
    super(arg)
    if (!this.message) {
      this.message =
        'provider and external id already linked to another account'
    }
  }
}

class ThirdPartyUserNotFoundError extends BackwardCompatibleError {
  constructor(arg) {
    super(arg)
    if (!this.message) {
      this.message = 'user not found for provider and external id'
    }
  }
}

class SubscriptionAdminDeletionError extends OError {
  constructor(options) {
    super({
      message: 'subscription admins cannot be deleted',
      ...options
    })
  }
}

module.exports = {
  OError,
  BackwardCompatibleError,
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
  NotInV2Error,
  SAMLIdentityExistsError,
  SAMLSessionDataMissing,
  SAMLUserNotFoundError,
  SLInV2Error,
  ThirdPartyIdentityExistsError,
  ThirdPartyUserNotFoundError,
  SubscriptionAdminDeletionError
}
