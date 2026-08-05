import AbstractMockApi from './AbstractMockApi.mjs'
import moment from 'moment'
import sinon from 'sinon'
import { parseReq, z, zz, getRawReqInput } from '@overleaf/validation-tools'

const v1UserIdParamsSchema = z.object({
  params: z.strictObject({ v1_user_id: z.string() }),
})

const exportByIdSchema = z.object({
  params: z.strictObject({ id: z.string() }),
  query: z.object({ token: z.string().optional() }),
})

// zip_url only reads req.query.token -- unlike exportByIdSchema above, the
// route's own :id param is never read by the handler, so it is left out.
const exportZipUrlSchema = z.object({
  query: z.object({ token: z.string().optional() }),
})

const userIdParamsSchema = z.object({
  params: z.strictObject({ userId: zz.objectId() }),
})

// Institution id sent from web varies by caller: UserEmailsController.mjs
// forwards a client-supplied number, while the SAML/group-domain-capture
// call sites always .toString() it first -- see
// app/src/Features/User/SAMLIdentityManager.mjs and
// modules/saas-authentication/app/src/SAML/SAMLController.mjs.
const affiliationUniversitySchema = z
  .strictObject({
    id: z.union([z.number(), z.string()]).optional(),
    name: z.string().optional(),
    country_code: z.string().optional(),
  })
  .optional()

// Mirrors every field InstitutionsAPI.mjs#addAffiliation actually puts on
// the wire (app/src/Features/Institutions/InstitutionsAPI.mjs) -- the mock
// handler itself only reads email/entitlement/confirmedAt, but the other
// fields are genuinely sent by real callers (UserEmailsController,
// SAMLIdentityManager, SAMLController, GroupDomainCaptureHandler) and must
// still be accepted by this strict schema.
const addAffiliationSchema = z.object({
  params: z.strictObject({ userId: zz.objectId() }),
  body: z.strictObject({
    email: z.string(),
    university: affiliationUniversitySchema,
    department: z.string().optional(),
    role: z.string().optional(),
    entitlement: z.boolean().optional(),
    confirmedAt: z.coerce.date().optional(),
    rejectIfBlocklisted: z.boolean().optional(),
  }),
})

const brandSlugSchema = z.object({
  params: z.strictObject({ slug: z.string() }),
})

const universitiesListSchema = z.object({
  query: z.object({
    country_code: z.string().optional(),
    search: z.string().optional(),
    max_results: z.string().optional(),
  }),
})

const universityByIdSchema = z.object({
  params: z.strictObject({ id: z.string() }),
})

const universityDomainsSchema = z.object({
  query: z.object({ hostname: z.string().optional() }),
})

const updateEmailSchema = z.object({
  params: z.strictObject({ id: z.string() }),
  body: z.strictObject({
    user: z.strictObject({ email: z.string() }),
  }),
})

const loginSchema = z.object({
  body: z.strictObject({
    email: z.string(),
    password: z.string(),
  }),
})

const partnerConversionSchema = z.object({
  params: z.strictObject({
    partner: z.string(),
    id: z.string(),
  }),
})

const brandVariationSchema = z.object({
  params: z.strictObject({ id: z.string() }),
})

const tokenParamsSchema = z.object({
  params: z.strictObject({
    user_id: z.string().optional(),
    token: z.string(),
  }),
})

const templateSchema = z.object({
  params: z.strictObject({ templateId: z.string() }),
})

const fakeRouteApiHandlerTestsSchema = z.object({
  query: z.object({
    expectedStatus: z.string(),
    expectedBody: z.string(),
  }),
})

class MockV1Api extends AbstractMockApi {
  reset() {
    this.affiliations = []
    this.allInstitutionDomains = new Set()
    this.blocklistedDomains = []
    this.brand_variations = {}
    this.brands = {}
    this.doc_exported = {}
    this.docInfo = {}
    this.existingEmails = []
    this.exportId = null
    this.exportParams = null
    this.exportToken = null
    this.institutionDomains = {}
    this.institutionId = 1000
    this.institutions = {}
    this.syncUserFeatures = sinon.stub()
    this.templates = {}
    this.updateEmail = sinon.stub()
    this.users = {}
    this.v1Id = 1000
    this.validation_clients = {}
  }

  nextInstitutionId() {
    return this.institutionId++
  }

  nextV1Id() {
    return this.v1Id++
  }

  setUser(id, user) {
    this.users[id] = user
  }

  getDocInfo(token) {
    return this.docInfo[token] || null
  }

  setDocInfo(token, info) {
    this.docInfo[token] = info
  }

  setExportId(id) {
    this.exportId = id
  }

  setExportToken(token) {
    this.exportToken = token
  }

  getLastExportParams() {
    return this.exportParams
  }

  clearExportParams() {
    this.exportParams = null
  }

  createInstitution(options = {}) {
    const id = options.university_id || this.nextInstitutionId()
    options.id = id // include ID so that it is included in APIs
    this.institutions[id] = { ...options }
    if (options && options.hostname) {
      this.addInstitutionDomain(id, options.hostname, {
        confirmed: options.confirmed,
        captured_by_group: options.captured_by_group,
      })
    }
    return id
  }

  addInstitutionDomain(institutionId, domain, options = {}) {
    if (this.allInstitutionDomains.has(domain)) return
    if (!this.institutionDomains[institutionId]) {
      this.institutionDomains[institutionId] = {}
    }
    this.institutionDomains[institutionId][domain] = options
    this.allInstitutionDomains.add(domain)
  }

  updateInstitution(id, options) {
    Object.assign(this.institutions[id], options)
  }

  updateInstitutionDomain(id, domain, options = {}) {
    if (!this.institutionDomains[id] || !this.institutionDomains[id][domain])
      return
    this.institutionDomains[id][domain] = Object.assign(
      {},
      this.institutionDomains[id][domain],
      options
    )
  }

  addAffiliation(userId, email, entitlement, confirmedAt) {
    let newAffiliation = true
    const institution = {}
    if (!email) return
    if (!this.affiliations[userId]) this.affiliations[userId] = []

    if (
      this.affiliations[userId].find(affiliationData => {
        return affiliationData.email === email
      })
    )
      newAffiliation = false

    if (newAffiliation) {
      const domain = email.split('@').pop()

      if (this.blocklistedDomains.indexOf(domain.replace('.com', '')) !== -1) {
        return
      }

      if (this.allInstitutionDomains.has(domain)) {
        for (const [institutionId, domainData] of Object.entries(
          this.institutionDomains
        )) {
          if (domainData[domain]) {
            institution.id = institutionId
          }
        }
      }

      if (institution.id) {
        this.affiliations[userId].push({ email, institution })
      }
    }

    if (entitlement !== undefined) {
      this.affiliations[userId].forEach(affiliation => {
        if (affiliation.email === email) {
          affiliation.cached_entitlement = entitlement
        }
      })
    }

    if (confirmedAt) {
      this.affiliations[userId].forEach(affiliation => {
        if (affiliation.email === email) {
          if (!affiliation.cached_confirmed_at) {
            affiliation.cached_confirmed_at = confirmedAt
          }
          affiliation.cached_reconfirmed_at = confirmedAt
        }
      })
    }
  }

  setDocExported(token, info) {
    this.doc_exported[token] = info
  }

  setTemplates(templates) {
    this.templates = templates
  }

  applyRoutes() {
    this.app.get('/api/v1/overleaf/users/:v1_user_id/plan_code', (req, res) => {
      const { params } = parseReq(req, v1UserIdParamsSchema)
      const user = this.users[params.v1_user_id]
      if (user) {
        res.json(user)
      } else {
        res.sendStatus(404)
      }
    })

    this.app.get(
      '/api/v1/overleaf/users/:v1_user_id/subscriptions',
      (req, res) => {
        const { params } = parseReq(req, v1UserIdParamsSchema)
        const user = this.users[params.v1_user_id]
        if (user && user.subscription) {
          res.json(user.subscription)
        } else {
          res.sendStatus(404)
        }
      }
    )

    this.app.get(
      '/api/v1/overleaf/users/:v1_user_id/subscription_status',
      (req, res) => {
        const { params } = parseReq(req, v1UserIdParamsSchema)
        const user = this.users[params.v1_user_id]
        if (user && user.subscription_status) {
          res.json(user.subscription_status)
        } else {
          res.sendStatus(404)
        }
      }
    )

    this.app.delete(
      '/api/v1/overleaf/users/:v1_user_id/subscription',
      (req, res) => {
        const { params } = parseReq(req, v1UserIdParamsSchema)
        const user = this.users[params.v1_user_id]
        if (user) {
          user.canceled = true
          res.sendStatus(200)
        } else {
          res.sendStatus(404)
        }
      }
    )

    this.app.post('/api/v1/overleaf/users/:v1_user_id/sync', (req, res) => {
      const { params } = parseReq(req, v1UserIdParamsSchema)
      this.syncUserFeatures(params.v1_user_id)
      res.sendStatus(200)
    })

    this.app.post('/api/v1/overleaf/exports', (req, res) => {
      // case 3: acceptance tests assert on the exact raw body sent to v1's
      // export endpoint via getLastExportParams() (see
      // modules/saas-authentication/test/acceptance/src/ExportsTests.mjs) --
      // this records the wire payload verbatim for later inspection rather
      // than reading any field of it itself.
      this.exportParams = Object.assign({}, getRawReqInput(req).body)
      res.json({ exportId: this.exportId, token: this.exportToken })
    })

    this.app.get('/api/v1/overleaf/exports/:id', (req, res) => {
      const { params, query } = parseReq(req, exportByIdSchema)
      const { token } = query
      if (token && token !== this.exportToken) {
        return res.sendStatus(404)
      }
      res.json({
        id: parseInt(params.id, 10),
        status_summary: 'succeeded',
        token: this.exportToken,
      })
    })

    this.app.get('/api/v1/overleaf/exports/:id/zip_url', (req, res) => {
      const { query } = parseReq(req, exportZipUrlSchema)
      const { token } = query
      if (token && token !== this.exportToken) {
        return res.sendStatus(404)
      }
      res.set('Content-Type', 'text/plain')
      return res.end('https://example.com/export.zip')
    })

    this.app.get('/api/v2/users/:userId/affiliations', (req, res) => {
      const { params } = parseReq(req, userIdParamsSchema)
      if (!this.affiliations[params.userId]) return res.json([])
      const affiliations = this.affiliations[params.userId].map(affiliation => {
        const institutionId = affiliation.institution.id
        const domain = affiliation.email.split('@').pop()
        const domainData = this.institutionDomains[institutionId][domain] || {}
        const institutionData = this.institutions[institutionId] || {}

        affiliation.institution = {
          id: institutionId,
          name: institutionData.name,
          commonsAccount: institutionData.commonsAccount,
          writefullCommonsAccount:
            institutionData.writefullCommonsAccount || false,
          isUniversity: !institutionData.institution,
          ssoBeta: institutionData.sso_beta || false,
          ssoEnabled: institutionData.sso_enabled || false,
          maxConfirmationMonths: institutionData.maxConfirmationMonths || null,
        }

        affiliation.institution.confirmed = !!domainData.confirmed

        affiliation.licence = 'free'
        if (
          institutionData.commonsAccount &&
          (!institutionData.sso_enabled ||
            (institutionData.sso_enabled &&
              affiliation.cached_entitlement === true))
        ) {
          affiliation.licence = 'pro_plus'
        }

        if (
          institutionData.maxConfirmationMonths &&
          affiliation.cached_reconfirmed_at
        ) {
          const lastDayToReconfirm = moment(
            affiliation.cached_reconfirmed_at
          ).add(institutionData.maxConfirmationMonths, 'months')
          affiliation.last_day_to_reconfirm = lastDayToReconfirm.toDate()
          affiliation.past_reconfirm_date = lastDayToReconfirm.isBefore()
        }

        affiliation.domainCapturedByGroup = domainData.captured_by_group
        return affiliation
      })
      res.json(affiliations)
    })

    this.app.post('/api/v2/users/:userId/affiliations', (req, res) => {
      const { params, body } = parseReq(req, addAffiliationSchema)
      this.addAffiliation(
        params.userId,
        body.email,
        body.entitlement,
        body.confirmedAt
      )
      res.sendStatus(201)
    })

    this.app.delete('/api/v2/users/:userId/affiliations', (req, res) => {
      res.sendStatus(201)
    })

    this.app.delete('/api/v2/users/:userId/affiliations/:email', (req, res) => {
      res.sendStatus(204)
    })

    this.app.post(
      '/api/v2/institutions/reconfirmation_lapsed_processed',
      (req, res) => {
        res.sendStatus(200)
      }
    )

    this.app.get(
      '/api/v2/institutions/need_reconfirmation_lapsed_processed',
      (req, res) => {
        const usersWithAffiliations = []
        Object.keys(this.affiliations).forEach(userId => {
          if (this.affiliations[userId].length > 0) {
            usersWithAffiliations.push(userId)
          }
        })
        res.json({ data: { users: usersWithAffiliations } })
      }
    )

    this.app.get('/api/v2/brands/:slug', (req, res) => {
      const { params } = parseReq(req, brandSlugSchema)
      let brand
      if ((brand = this.brands[params.slug])) {
        res.json(brand)
      } else {
        res.sendStatus(404)
      }
    })

    this.app.get('/universities/list', (req, res) => {
      const { query } = parseReq(req, universitiesListSchema)
      const response = []

      const university1 = {
        id: 1337,
        name: 'Institution 1337',
        country_code: 'en',
        departments: [],
      }

      const university2 = {
        id: 243,
        name: 'Institution 243',
        country_code: 'en',
        departments: [],
      }

      if (query.country_code === 'en') {
        response.push(university1)
      }
      if (query.search === 'Institution') {
        response.push(university1)
        if (query.max_results !== '1') {
          response.push(university2)
        }
      }
      res.json(response)
    })

    this.app.get('/universities/list/:id', (req, res) => {
      const { params } = parseReq(req, universityByIdSchema)
      res.json({
        id: parseInt(params.id),
        name: `Institution ${params.id}`,
      })
    })

    this.app.get('/university/domains', (req, res) => {
      const { query } = parseReq(req, universityDomainsSchema)
      if (query.hostname === 'overleaf.com') {
        res.json([
          {
            id: 42,
            hostname: 'overleaf.com',
            department: 'Overleaf',
            confirmed: true,
            university: {
              id: 1337,
              name: 'Institution 1337',
              departments: [],
              ssoBeta: false,
              ssoEnabled: false,
            },
          },
        ])
      } else if (query.hostname === 'sharelatex.com') {
        res.json([
          {
            id: 44,
            hostname: 'sharelatex.com',
            department: 'test dept',
            confirmed: true,
            university: {
              id: 5000,
              name: 'Institution sharelatex',
              departments: [],
              ssoBeta: false,
              ssoEnabled: false,
              commons: false,
            },
          },
        ])
      } else {
        res.json([])
      }
    })

    this.app.put('/api/v1/overleaf/users/:id/email', (req, res) => {
      const { params, body } = parseReq(req, updateEmailSchema)
      const { email } = body.user
      if (this.existingEmails.includes(email)) {
        res.sendStatus(409)
      } else {
        this.updateEmail(parseInt(params.id), email)
        res.sendStatus(200)
      }
    })

    this.app.post('/api/v1/overleaf/login', (req, res) => {
      const { body } = parseReq(req, loginSchema)
      for (const id in this.users) {
        const user = this.users[id]
        if (
          user &&
          user.email === body.email &&
          user.password === body.password
        ) {
          return res.json({
            email: user.email,
            valid: true,
            user_profile: user.profile,
          })
        }
      }
      res.status(403).json({
        email: body.email,
        valid: false,
      })
    })

    this.app.get('/api/v2/partners/:partner/conversions/:id', (req, res) => {
      const { params } = parseReq(req, partnerConversionSchema)
      const partner = this.validation_clients[params.partner]
      const conversion =
        partner && partner.conversions && partner.conversions[params.id]

      if (conversion) {
        res.status(200).json({
          input_file_uri: conversion,
          brand_variation_id: partner.brand_variation_id,
        })
      } else {
        res.status(404).json({})
      }
    })

    this.app.get('/api/v2/brand_variations/:id', (req, res) => {
      const { params } = parseReq(req, brandVariationSchema)
      const variation = this.brand_variations[params.id]
      if (variation) {
        res.status(200).json(variation)
      } else {
        res.status(404).json({})
      }
    })

    this.app.get('/api/v1/overleaf/docs/:token/is_published', (req, res) => {
      return res.json({ allow: true })
    })

    this.app.get(
      '/api/v1/overleaf/users/:user_id/docs/:token/info',
      (req, res) => {
        const { params } = parseReq(req, tokenParamsSchema)
        const info = this.getDocInfo(params.token) || {
          exists: false,
          exported: false,
        }
        res.json(info)
      }
    )

    this.app.get('/api/v1/overleaf/docs/:token/info', (req, res) => {
      const { params } = parseReq(req, tokenParamsSchema)
      const info = this.getDocInfo(params.token) || {
        exists: false,
        exported: false,
      }
      res.json(info)
    })

    this.app.get(
      '/api/v1/overleaf/docs/read_token/:token/exists',
      (req, res) => {
        res.json({ exists: false })
      }
    )

    this.app.get('/api/v2/templates/:templateId', (req, res) => {
      const { params } = parseReq(req, templateSchema)
      const template = this.templates[params.templateId]
      if (!template) {
        return res.sendStatus(404)
      }
      res.json(template)
    })

    this.app.get(
      '/api/v1/overleaf/fake_route_api_handler_tests',
      (req, res) => {
        const { query } = parseReq(req, fakeRouteApiHandlerTestsSchema)
        const expectedStatus = query.expectedStatus
        const expectedBody = query.expectedBody
        const statusCode = Number(expectedStatus)
        if (
          !Number.isInteger(statusCode) ||
          statusCode < 100 ||
          statusCode > 599
        ) {
          return res
            .status(500)
            .json({ error: 'Invalid expectedStatus query parameter' })
        }
        return res.status(statusCode).json(JSON.parse(expectedBody))
      }
    )
  }
}

export default MockV1Api

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockV1Api
 * @static
 * @returns {MockV1Api}
 */
