import { expect } from 'chai'
import { cloneDeep } from 'lodash'
import { professionalUserData } from '../fixtures/test-user-email-data'
import { Affiliation } from '../../../../../types/affiliation'
import { emailMustBeConfirmedViaSAML } from '../../../../../frontend/js/features/settings/utils/email-confirmation'

describe('emailMustBeConfirmedViaSAML', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-ExposedSettings', {
      hasSamlFeature: true,
      hasSamlBeta: false,
    })
  })

  it('returns false when hasSamlFeature is false', function () {
    window.metaAttributesCache.set('ol-ExposedSettings', {
      hasSamlFeature: false,
      hasSamlBeta: false,
    })

    const affiliation: Affiliation = cloneDeep(professionalUserData.affiliation)
    affiliation.domainCapturedByGroup = true
    affiliation.group = {
      _id: 'group123',
      domainCaptureEnabled: true,
      managedUsersEnabled: true,
    }

    expect(emailMustBeConfirmedViaSAML(affiliation)).to.be.false
  })

  it('returns false when affiliation is null', function () {
    expect(emailMustBeConfirmedViaSAML(null)).to.be.false
  })

  it('returns false when institution is not confirmed', function () {
    const affiliation: Affiliation = cloneDeep(professionalUserData.affiliation)
    affiliation.institution.confirmed = false
    affiliation.domainCapturedByGroup = true
    affiliation.group = {
      _id: 'group123',
      domainCaptureEnabled: true,
      managedUsersEnabled: true,
    }

    expect(emailMustBeConfirmedViaSAML(affiliation)).to.be.false
  })

  it('returns true when Commons SSO is available for the institution', function () {
    const affiliation: Affiliation = cloneDeep(professionalUserData.affiliation)
    affiliation.institution.ssoEnabled = true

    expect(emailMustBeConfirmedViaSAML(affiliation)).to.be.true
  })

  it('returns true when the email is captured by a managed domain-capture group', function () {
    const affiliation: Affiliation = cloneDeep(professionalUserData.affiliation)
    affiliation.domainCapturedByGroup = true
    affiliation.group = {
      _id: 'group123',
      domainCaptureEnabled: true,
      managedUsersEnabled: true,
    }

    expect(emailMustBeConfirmedViaSAML(affiliation)).to.be.true
  })

  it('returns false when the group is managed but the email domain is not captured by the group', function () {
    const affiliation: Affiliation = cloneDeep(professionalUserData.affiliation)
    affiliation.domainCapturedByGroup = false
    affiliation.group = {
      _id: 'group123',
      domainCaptureEnabled: true,
      managedUsersEnabled: true,
    }

    expect(emailMustBeConfirmedViaSAML(affiliation)).to.be.false
  })

  it('returns false when the email is captured but managed users are disabled', function () {
    const affiliation: Affiliation = cloneDeep(professionalUserData.affiliation)
    affiliation.domainCapturedByGroup = true
    affiliation.group = {
      _id: 'group123',
      domainCaptureEnabled: true,
      managedUsersEnabled: false,
    }

    expect(emailMustBeConfirmedViaSAML(affiliation)).to.be.false
  })
})
