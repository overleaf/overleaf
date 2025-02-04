const OError = require('@overleaf/o-error')
const settings = require('@overleaf/settings')

// Error class for legacy errors so they inherit OError while staying
// backward-compatible (can be instantiated with string as argument instead
// of object)
class BackwardCompatibleError extends OError {
  /**
   * @param {string | { message: string, info?: Object }} messageOrOptions
   */
  constructor(messageOrOptions) {
    if (typeof messageOrOptions === 'string') {
      super(messageOrOptions)
    } else if (messageOrOptions) {
      const { message, info } = messageOrOptions
      super(message, info)
    } else {
      super()
    }
  }
}

// Error class that facilitates the migration to OError v3 by providing
// a signature in which the 2nd argument can be an object containing
// the `info` object.
class OErrorV2CompatibleError extends OError {
  constructor(message, options) {
    if (options) {
      super(message, options.info)
    } else {
      super(message)
    }
  }
}

class NotFoundError extends BackwardCompatibleError {}

class ForbiddenError extends BackwardCompatibleError {}

class ServiceNotConfiguredError extends BackwardCompatibleError {}

class TooManyRequestsError extends BackwardCompatibleError {}

class DuplicateNameError extends OError {}

class InvalidNameError extends BackwardCompatibleError {}

class UnsupportedFileTypeError extends BackwardCompatibleError {}

class FileTooLargeError extends BackwardCompatibleError {}

class UnsupportedExportRecordsError extends BackwardCompatibleError {}

class V1HistoryNotSyncedError extends BackwardCompatibleError {}

class ProjectHistoryDisabledError extends BackwardCompatibleError {}

class V1ConnectionError extends BackwardCompatibleError {}

class UnconfirmedEmailError extends BackwardCompatibleError {}

class EmailExistsError extends OErrorV2CompatibleError {
  constructor(options) {
    super('Email already exists', options)
  }
}

class InvalidError extends BackwardCompatibleError {}

class NotInV2Error extends BackwardCompatibleError {}

class SLInV2Error extends BackwardCompatibleError {}

class SAMLIdentityExistsError extends OError {
  get i18nKey() {
    return 'institution_account_tried_to_add_already_registered'
  }
}

class SAMLAlreadyLinkedError extends OError {
  get i18nKey() {
    return 'institution_account_tried_to_add_already_linked'
  }
}

class SAMLEmailNotAffiliatedError extends OError {
  get i18nKey() {
    return 'institution_account_tried_to_add_not_affiliated'
  }
}

class SAMLEmailAffiliatedWithAnotherInstitutionError extends OError {
  get i18nKey() {
    return 'institution_account_tried_to_add_affiliated_with_another_institution'
  }
}

class SAMLAuthenticationError extends OError {
  get i18nKey() {
    return 'saml_auth_error'
  }
}
class SAMLAssertionAudienceMismatch extends SAMLAuthenticationError {}

class SAMLAuthenticationRequiredError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_authentication_required_error'
  }
}

class SAMLGroupSSOLoginIdentityMismatchError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_login_identity_mismatch_error'
  }
}

class SAMLGroupSSOLoginIdentityNotFoundError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_login_identity_not_found_error'
  }
}

class SAMLGroupSSODisabledError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_login_disabled_error'
  }
}

class SAMLInvalidSignatureError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_invalid_signature_error'
  }
}

class SAMLMissingSignatureError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_missing_signature_error'
  }
}

class SAMLInvalidUserIdentifierError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_authentication_required_error'
  }
}

class SAMLInvalidUserAttributeError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_authentication_required_error'
  }
}

class SAMLMissingUserIdentifierError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_missing_user_attribute'
  }
}

class SAMLInvalidResponseError extends SAMLAuthenticationError {}

class SAMLResponseAlreadyProcessedError extends SAMLInvalidResponseError {
  constructor() {
    super('saml response already processed')
  }
}

class SAMLLoginFailureError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_login_failure'
  }
}

class SAMLEmailNotRecognizedError extends SAMLAuthenticationError {
  get i18nKey() {
    return 'saml_email_not_recognized'
  }
}

class SAMLSessionDataMissing extends BackwardCompatibleError {
  constructor(arg) {
    super(arg)

    const samlSession =
      typeof arg === 'object' && arg !== null && arg.samlSession
        ? arg.samlSession
        : {}
    this.tryAgain = true
    const { universityId, universityName, externalUserId, institutionEmail } =
      samlSession

    if (
      !universityId &&
      !universityName &&
      !externalUserId &&
      !institutionEmail
    ) {
      this.message = 'Missing session data.'
    } else if (
      !institutionEmail &&
      samlSession &&
      samlSession.userEmailAttributeUnreliable
    ) {
      this.tryAgain = false
      this.message = `Your account settings at your institution prevent us from accessing your email address. You will need to make your email address public at your institution in order to link with ${settings.appName}. Please contact your IT department if you have any questions.`
    } else if (!institutionEmail) {
      this.message =
        'Unable to confirm your institutional email address. The institutional identity provider did not provide an email address in the expected attribute. Please contact us if this keeps happening.'
    }
  }
}

class SAMLProviderRequesterError extends SAMLAuthenticationError {}

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

class OutputFileFetchFailedError extends OError {}

class SubscriptionAdminDeletionError extends OErrorV2CompatibleError {
  constructor(options) {
    super('subscription admins cannot be deleted', options)
  }
}

class SubscriptionNotFoundError extends OErrorV2CompatibleError {
  constructor(options) {
    super('subscription not found', options)
  }
}

class ProjectNotFoundError extends OErrorV2CompatibleError {
  constructor(options) {
    super('project not found', options)
  }
}

class UserNotFoundError extends OErrorV2CompatibleError {
  constructor(options) {
    super('user not found', options)
  }
}

class UserNotCollaboratorError extends OErrorV2CompatibleError {
  constructor(options) {
    super('user not a collaborator', options)
  }
}

class DocHasRangesError extends OErrorV2CompatibleError {
  constructor(options) {
    super('document has ranges', options)
  }
}

class InvalidQueryError extends OErrorV2CompatibleError {
  constructor(options) {
    super('invalid search query', options)
  }
}

class AffiliationError extends OError {}

class InvalidEmailError extends OError {
  get i18nKey() {
    return 'invalid_email'
  }
}

class InvalidInstitutionalEmailError extends OError {
  get i18nKey() {
    return 'invalid_institutional_email'
  }
}

class NonDeletableEntityError extends OError {
  get i18nKey() {
    return 'non_deletable_entity'
  }
}

module.exports = {
  OError,
  BackwardCompatibleError,
  NotFoundError,
  ForbiddenError,
  ServiceNotConfiguredError,
  TooManyRequestsError,
  DuplicateNameError,
  InvalidNameError,
  UnsupportedFileTypeError,
  FileTooLargeError,
  UnsupportedExportRecordsError,
  V1HistoryNotSyncedError,
  ProjectHistoryDisabledError,
  V1ConnectionError,
  UnconfirmedEmailError,
  EmailExistsError,
  InvalidError,
  NotInV2Error,
  OutputFileFetchFailedError,
  SAMLAssertionAudienceMismatch,
  SAMLAuthenticationRequiredError,
  SAMLIdentityExistsError,
  SAMLAlreadyLinkedError,
  SAMLEmailNotAffiliatedError,
  SAMLEmailAffiliatedWithAnotherInstitutionError,
  SAMLSessionDataMissing,
  SAMLAuthenticationError,
  SAMLGroupSSOLoginIdentityMismatchError,
  SAMLGroupSSOLoginIdentityNotFoundError,
  SAMLGroupSSODisabledError,
  SAMLInvalidUserAttributeError,
  SAMLInvalidUserIdentifierError,
  SAMLInvalidSignatureError,
  SAMLMissingUserIdentifierError,
  SAMLMissingSignatureError,
  SAMLProviderRequesterError,
  SAMLInvalidResponseError,
  SAMLLoginFailureError,
  SAMLEmailNotRecognizedError,
  SAMLResponseAlreadyProcessedError,
  SLInV2Error,
  ThirdPartyIdentityExistsError,
  ThirdPartyUserNotFoundError,
  SubscriptionAdminDeletionError,
  SubscriptionNotFoundError,
  ProjectNotFoundError,
  UserNotFoundError,
  UserNotCollaboratorError,
  DocHasRangesError,
  InvalidQueryError,
  AffiliationError,
  InvalidEmailError,
  InvalidInstitutionalEmailError,
  NonDeletableEntityError,
}
