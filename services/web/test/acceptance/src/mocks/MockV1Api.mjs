import AbstractMockApi from './AbstractMockApi.mjs'
import moment from 'moment'
import sinon from 'sinon'

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
      const user = this.users[req.params.v1_user_id]
      if (user) {
        res.json(user)
      } else {
        res.sendStatus(404)
      }
    })

    this.app.get(
      '/api/v1/overleaf/users/:v1_user_id/subscriptions',
      (req, res) => {
        const user = this.users[req.params.v1_user_id]
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
        const user = this.users[req.params.v1_user_id]
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
        const user = this.users[req.params.v1_user_id]
        if (user) {
          user.canceled = true
          res.sendStatus(200)
        } else {
          res.sendStatus(404)
        }
      }
    )

    this.app.post('/api/v1/overleaf/users/:v1_user_id/sync', (req, res) => {
      this.syncUserFeatures(req.params.v1_user_id)
      res.sendStatus(200)
    })

    this.app.post('/api/v1/overleaf/exports', (req, res) => {
      this.exportParams = Object.assign({}, req.body)
      res.json({ exportId: this.exportId })
    })

    this.app.get('/api/v2/users/:userId/affiliations', (req, res) => {
      if (!this.affiliations[req.params.userId]) return res.json([])
      const affiliations = this.affiliations[req.params.userId].map(
        affiliation => {
          const institutionId = affiliation.institution.id
          const domain = affiliation.email.split('@').pop()
          const domainData =
            this.institutionDomains[institutionId][domain] || {}
          const institutionData = this.institutions[institutionId] || {}

          affiliation.institution = {
            id: institutionId,
            name: institutionData.name,
            commonsAccount: institutionData.commonsAccount,
            isUniversity: !institutionData.institution,
            ssoBeta: institutionData.sso_beta || false,
            ssoEnabled: institutionData.sso_enabled || false,
            maxConfirmationMonths:
              institutionData.maxConfirmationMonths || null,
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

          return affiliation
        }
      )
      res.json(affiliations)
    })

    this.app.post('/api/v2/users/:userId/affiliations', (req, res) => {
      this.addAffiliation(
        req.params.userId,
        req.body.email,
        req.body.entitlement,
        req.body.confirmedAt
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
      let brand
      if ((brand = this.brands[req.params.slug])) {
        res.json(brand)
      } else {
        res.sendStatus(404)
      }
    })

    this.app.get('/universities/list', (req, res) => {
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

      if (req.query.country_code === 'en') {
        response.push(university1)
      }
      if (req.query.search === 'Institution') {
        response.push(university1)
        if (req.query.max_results !== '1') {
          response.push(university2)
        }
      }
      res.json(response)
    })

    this.app.get('/universities/list/:id', (req, res) =>
      res.json({
        id: parseInt(req.params.id),
        name: `Institution ${req.params.id}`,
      })
    )

    this.app.get('/university/domains', (req, res) => {
      if (req.query.hostname === 'overleaf.com') {
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
      } else if (req.query.hostname === 'sharelatex.com') {
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
      const { email } = req.body && req.body.user
      if (this.existingEmails.includes(email)) {
        res.sendStatus(409)
      } else {
        this.updateEmail(parseInt(req.params.id), email)
        res.sendStatus(200)
      }
    })

    this.app.post('/api/v1/overleaf/login', (req, res) => {
      for (const id in this.users) {
        const user = this.users[id]
        if (
          user &&
          user.email === req.body.email &&
          user.password === req.body.password
        ) {
          return res.json({
            email: user.email,
            valid: true,
            user_profile: user.profile,
          })
        }
      }
      res.status(403).json({
        email: req.body.email,
        valid: false,
      })
    })

    this.app.get('/api/v2/partners/:partner/conversions/:id', (req, res) => {
      const partner = this.validation_clients[req.params.partner]
      const conversion =
        partner && partner.conversions && partner.conversions[req.params.id]

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
      const variation = this.brand_variations[req.params.id]
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
        const info = this.getDocInfo(req.params.token) || {
          exists: false,
          exported: false,
        }
        res.json(info)
      }
    )

    this.app.get('/api/v1/overleaf/docs/:token/info', (req, res) => {
      const info = this.getDocInfo(req.params.token) || {
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
      const template = this.templates[req.params.templateId]
      if (!template) {
        return res.sendStatus(404)
      }
      res.json(template)
    })
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
