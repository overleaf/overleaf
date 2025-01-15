import fs from 'node:fs'
import path from 'node:path'
import { SignedXml } from 'xml-crypto'
import { SamlLog } from '../../../../app/src/models/SamlLog.js'
import { expect } from 'chai'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import xml2js from 'xml2js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const samlDataDefaults = {
  firstName: 'first-name',
  hasEntitlement: 'Y',
  issuer: 'Overleaf',
  lastName: 'last-name',
  requestId: 'dummy-request-id',
}

function samlValue(val) {
  if (!Array.isArray(val)) {
    val = [val]
  }
  return val
    .map(
      v =>
        `<saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${v}</saml:AttributeValue>`
    )
    .join('')
}

function makeAttribute(attribute, value) {
  if (!value) {
    return ''
  }

  return `<saml:AttributeStatement>
  <saml:Attribute Name="${attribute}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">
    ${samlValue(value)}
  </saml:Attribute>
</saml:AttributeStatement>`
}

function createMockSamlAssertion(samlData = {}, opts = {}) {
  const {
    email,
    firstName,
    hasEntitlement,
    issuer,
    lastName,
    uniqueId,
    requestId,
  } = {
    ...samlDataDefaults,
    ...samlData,
  }
  const { signedAssertion = true } = opts

  const userIdAttributeName = samlData.userIdAttribute || 'uniqueId'
  const userIdAttribute =
    uniqueId &&
    `<saml:AttributeStatement>
    <saml:Attribute Name="${userIdAttributeName}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">
      <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${uniqueId}</saml:AttributeValue>
    </saml:Attribute>
  </saml:AttributeStatement>`

  const userIdAttributeLegacy =
    samlData.userIdAttributeLegacy && samlData.uniqueIdLegacy
      ? `<saml:AttributeStatement><saml:Attribute Name="${samlData.userIdAttributeLegacy}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified"><saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${samlData.uniqueIdLegacy}</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>`
      : ''

  const nameId =
    userIdAttributeName && userIdAttributeName !== 'nameID'
      ? `<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">mock@email.com</saml:NameID>`
      : ''

  const samlAssertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="t835VaiI1fph1yk8yhdD4OtyBQ4" IssueInstant="2018-08-09T08:56:30.126Z" Version="2.0">
    <saml:Issuer>${issuer}</saml:Issuer>
    <saml:Subject>
      ${nameId}
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData Recipient="*******" NotOnOrAfter="2028-08-09T09:01:30.126Z" InResponseTo="${requestId}" />
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="2008-08-09T08:51:30.126Z" NotOnOrAfter="2028-08-09T09:01:30.126Z">
      <saml:AudienceRestriction>
        <saml:Audience>${issuer}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement SessionIndex="t835VaiI1fph1yk8yhdD4OtyBQ4" AuthnInstant="2018-08-09T08:56:30.118Z">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:unspecified</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    ${makeAttribute('email', email)}
    ${makeAttribute('firstName', firstName)}
    <saml:AttributeStatement>
      <saml:Attribute Name="hasEntitlement" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">
        <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${hasEntitlement}</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="issuer" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">
        <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${issuer}</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
    ${makeAttribute('lastName', lastName)}
    ${userIdAttribute}
    ${userIdAttributeLegacy}
  </saml:Assertion>`

  if (!signedAssertion) {
    return samlAssertion
  }

  const sig = new SignedXml()
  sig.addReference(
    "//*[local-name(.)='Assertion']",
    [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    'http://www.w3.org/2000/09/xmldsig#sha1'
  )

  sig.signingKey = fs.readFileSync(
    path.resolve(__dirname, '../../files/saml-key.pem'),
    'utf8'
  )
  sig.computeSignature(samlAssertion)
  return sig.getSignedXml()
}

function createMockSamlResponse(samlData = {}, opts = {}) {
  const { issuer, requestId } = {
    ...samlDataDefaults,
    ...samlData,
  }
  const { signedResponse = true } = opts

  const samlAssertion = createMockSamlAssertion(samlData, opts)

  let samlResponse = `
<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" Version="2.0" ID="WQMXUw8BBp4_XWzcuKgaN5tmxpT" IssueInstant="2018-08-09T08:56:30.106Z" InResponseTo="${requestId}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${issuer}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" />
  </samlp:Status>
  ${samlAssertion}
</samlp:Response>
  `

  if (signedResponse) {
    const sig = new SignedXml()
    sig.addReference(
      "//*[local-name(.)='Response']",
      [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#',
      ],
      'http://www.w3.org/2000/09/xmldsig#sha1'
    )

    sig.signingKey = fs.readFileSync(
      path.resolve(__dirname, '../../files/saml-key.pem'),
      'utf8'
    )
    sig.computeSignature(samlResponse)
    samlResponse = sig.getSignedXml()
  }

  return Buffer.from(samlResponse).toString('base64')
}

function samlUniversity(config = {}) {
  return {
    hostname: 'example-sso.com',
    sso_cert: fs
      .readFileSync(
        path.resolve(__dirname, '../../files/saml-cert.crt'),
        'utf8'
      )
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\n/g, ''),
    sso_enabled: true,
    sso_entry_point: 'http://example-sso.com/saml',
    sso_entity_id: 'http://example-sso.com/saml/idp',
    university_id: 9999,
    university_name: 'Example University',
    sso_user_email_attribute: 'email',
    sso_user_first_name_attribute: 'firstName',
    sso_user_id_attribute: 'uniqueId',
    sso_user_last_name_attribute: 'lastName',
    sso_license_entitlement_attribute: 'hasEntitlement',
    sso_license_entitlement_matcher: 'Y',
    sso_signature_algorithm: 'sha256',
    ...config,
  }
}

async function getParseAndDoChecksForSamlLogs(numberOfLog) {
  const logs = await SamlLog.find({}, {})
    .sort({ $natural: -1 })
    .limit(numberOfLog || 1)
    .exec()
  logs.forEach(log => {
    expect(log.sessionId).to.exist
    expect(log.sessionId.length).to.equal(8) // not full session ID
    expect(log.createdAt).to.exist
    expect(log.jsonData).to.exist
    log.parsedJsonData = JSON.parse(log.jsonData)
    if (log.samlAssertion) {
      log.parsedSamlAssertion = JSON.parse(log.samlAssertion)
    }
  })

  return logs
}

/**
 * Parses a SAML request from a redirect URI.
 *
 * @param {URL} redirectUri - The redirect URI containing the SAML request.
 * @returns {Promise<Object>} - A promise that resolves to the parsed SAML request object.
 */
async function parseSamlRequest(redirectUri) {
  const decoded = redirectUri.searchParams.get('SAMLRequest')
  const base64Decoded = Buffer.from(decoded, 'base64')
  const inflated = zlib.inflateRawSync(base64Decoded)
  return xml2js.parseStringPromise(inflated.toString('utf8'))
}

/**
 * Parses the SAML request from the given redirect URI and returns the request ID.
 * @param {URL} redirectUri - The redirect URI containing the SAML request.
 * @returns {Promise<string>} - A Promise that resolves to the request ID.
 */
async function getRequestId(redirectUri) {
  const samlRequest = await parseSamlRequest(redirectUri)
  return samlRequest['samlp:AuthnRequest'].$.ID
}

const SAMLHelper = {
  createMockSamlResponse,
  samlUniversity,
  getParseAndDoChecksForSamlLogs,
  parseSamlRequest,
  getRequestId,
}

export default SAMLHelper
