import { expect } from 'chai'
import { ssoAvailableForDomain } from '../../../../../frontend/js/features/settings/utils/sso'
import { DomainInfo } from '../../../../../frontend/js/features/settings/components/emails/add-email/input'

const baseDomain: DomainInfo = {
  hostname: 'example.edu',
  confirmed: true,
  university: {
    id: 1,
    name: 'Example University',
    ssoEnabled: false,
    ssoBeta: false,
  },
  group: {
    domainCaptureEnabled: false,
    ssoConfig: {
      enabled: false,
    },
  },
}

describe('ssoAvailableForDomain', function () {
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
    expect(ssoAvailableForDomain(baseDomain, false)).to.be.false
  })

  it('returns false when domain is null', function () {
    expect(ssoAvailableForDomain(null, false)).to.be.false
  })

  it('returns false when domain is not confirmed', function () {
    const domain = { ...baseDomain, confirmed: false }
    expect(ssoAvailableForDomain(domain, false)).to.be.false
  })

  it('returns true when university.ssoEnabled is true, regardless of isDomainCapturedByGroup', function () {
    const domain: DomainInfo = {
      ...baseDomain,
      university: { ...baseDomain.university, ssoEnabled: true },
    }
    expect(ssoAvailableForDomain(domain, false)).to.be.true
    expect(ssoAvailableForDomain(domain, true)).to.be.true
  })

  describe('group SSO via ssoConfig', function () {
    const domainWithGroupSso: DomainInfo = {
      ...baseDomain,
      group: {
        domainCaptureEnabled: true,
        ssoConfig: { enabled: true },
      },
    }

    it('returns true when isDomainCapturedByGroup is true and group ssoConfig is enabled', function () {
      expect(ssoAvailableForDomain(domainWithGroupSso, true)).to.be.true
    })

    it('returns false when isDomainCapturedByGroup is false even if group ssoConfig is enabled', function () {
      expect(ssoAvailableForDomain(domainWithGroupSso, false)).to.be.false
    })
  })

  it('returns true when hasSamlBeta and university.ssoBeta are both true', function () {
    window.metaAttributesCache.set('ol-ExposedSettings', {
      hasSamlFeature: true,
      hasSamlBeta: true,
    })
    const domain: DomainInfo = {
      ...baseDomain,
      university: { ...baseDomain.university, ssoBeta: true },
    }
    expect(ssoAvailableForDomain(domain, false)).to.be.true
  })

  it('returns false when hasSamlBeta is false and university.ssoBeta is true', function () {
    const domain: DomainInfo = {
      ...baseDomain,
      university: { ...baseDomain.university, ssoBeta: true },
    }
    expect(ssoAvailableForDomain(domain, false)).to.be.false
  })
})
