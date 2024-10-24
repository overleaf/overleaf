import _ from 'lodash'

class UKAMFEntity {
  constructor(data) {
    this.data = data
  }

  getSamlConfig() {
    let hiddenIdP = false
    const idp = this.data.IDPSSODescriptor[0]
    const idpMetaData =
      _.get(this.data, [
        'Extensions',
        0,
        'mdattr:EntityAttributes',
        0,
        'saml:Attribute',
      ]) || []
    idpMetaData.forEach(data => {
      const value = _.get(data, ['saml:AttributeValue', 0])
      if (
        value === 'http://refeds.org/category/hide-from-discovery' ||
        value === 'https://refeds.org/category/hide-from-discovery'
      ) {
        hiddenIdP = true
      }
    })

    const keys = idp.KeyDescriptor

    const signingKey =
      keys.length === 1
        ? keys[0]
        : keys.find(key => _.get(key, ['$', 'use']) === 'signing')
    const entityId = this.data.$.entityID

    let cert = _.get(signingKey, [
      'ds:KeyInfo',
      0,
      'ds:X509Data',
      0,
      'ds:X509Certificate',
      0,
    ])
    if (!cert) {
      throw new Error('no cert')
    }
    cert = cert.replace(/\s/g, '')

    let entryPoint = idp.SingleSignOnService.find(
      sso =>
        _.get(sso, ['$', 'Binding']) ===
        'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
    )
    entryPoint = _.get(entryPoint, ['$', 'Location'])
    if (!entryPoint) {
      throw new Error('no entryPoint')
    }

    return {
      cert,
      entityId,
      entryPoint,
      hiddenIdP,
    }
  }
}

export default UKAMFEntity
