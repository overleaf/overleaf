/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockV1Api
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const sinon = require('sinon')

app.use(bodyParser.json())
const blocklistedDomains = []

module.exports = MockV1Api = {
  reset() {
    this.affiliations = []
    this.exportId = null
    this.v1Id = 1000
    this.users = {}
    this.docInfo = {}
    this.existingEmails = []
    this.brands = {}
    this.brand_variations = {}
    this.validation_clients = {}
    this.doc_exported = {}
    this.templates = {}
    this.institutionId = 1000
    this.institutions = {}
    this.allInstitutionDomains = new Set()
    this.institutionDomains = {}
  },

  nextInstitutionId() {
    return this.institutionId++
  },

  nextV1Id() {
    return this.v1Id++
  },

  setUser(id, user) {
    return (this.users[id] = user)
  },

  getDocInfo(token) {
    return this.docInfo[token] || null
  },

  setDocInfo(token, info) {
    this.docInfo[token] = info
  },

  exportParams: null,

  setExportId(id) {
    return (this.exportId = id)
  },

  getLastExportParams() {
    return this.exportParams
  },

  clearExportParams() {
    return (this.exportParams = null)
  },

  syncUserFeatures: sinon.stub(),

  updateEmail: sinon.stub(),

  createInstitution(options = {}) {
    const id = options.university_id || this.nextInstitutionId()
    options.id = id // include ID so that it is included in APIs
    this.institutions[id] = { ...options }
    if (options && options.hostname) {
      this.addInstitutionDomain(id, options.hostname)
    }
    return id
  },

  addInstitutionDomain(id, domain) {
    if (this.allInstitutionDomains.has(domain)) return
    if (!this.institutionDomains[id]) this.institutionDomains[id] = new Set()
    this.institutionDomains[id].add(domain)
    this.allInstitutionDomains.add(domain)
  },

  updateInstitution(id, options) {
    Object.assign(this.institutions[id], options)
  },

  addAffiliation(userId, email) {
    let institution
    if (!email) return

    const domain = email.split('@').pop()

    if (blocklistedDomains.indexOf(domain.replace('.com', '')) !== -1) return

    if (this.allInstitutionDomains.has(domain)) {
      for (const [id, domainSet] of Object.entries(this.institutionDomains)) {
        if (domainSet.has(domain)) {
          institution = this.institutions[id]
        }
      }
    }

    if (institution) {
      if (!this.affiliations[userId]) this.affiliations[userId] = []
      this.affiliations[userId].push({ email, institution })
    }
  },

  setAffiliations(userId, affiliations) {
    this.affiliations[userId] = affiliations
  },

  setDocExported(token, info) {
    return (this.doc_exported[token] = info)
  },

  setTemplates(templates) {
    this.templates = templates
  },

  run() {
    app.get(
      '/api/v1/sharelatex/users/:v1_user_id/plan_code',
      (req, res, next) => {
        const user = this.users[req.params.v1_user_id]
        if (user) {
          return res.json(user)
        } else {
          return res.sendStatus(404)
        }
      }
    )

    app.get(
      '/api/v1/sharelatex/users/:v1_user_id/subscriptions',
      (req, res, next) => {
        const user = this.users[req.params.v1_user_id]
        if ((user != null ? user.subscription : undefined) != null) {
          return res.json(user.subscription)
        } else {
          return res.sendStatus(404)
        }
      }
    )

    app.get(
      '/api/v1/sharelatex/users/:v1_user_id/subscription_status',
      (req, res, next) => {
        const user = this.users[req.params.v1_user_id]
        if ((user != null ? user.subscription_status : undefined) != null) {
          return res.json(user.subscription_status)
        } else {
          return res.sendStatus(404)
        }
      }
    )

    app.delete(
      '/api/v1/sharelatex/users/:v1_user_id/subscription',
      (req, res, next) => {
        const user = this.users[req.params.v1_user_id]
        if (user != null) {
          user.canceled = true
          return res.sendStatus(200)
        } else {
          return res.sendStatus(404)
        }
      }
    )

    app.post('/api/v1/sharelatex/users/:v1_user_id/sync', (req, res, next) => {
      this.syncUserFeatures(req.params.v1_user_id)
      return res.sendStatus(200)
    })

    app.post('/api/v1/sharelatex/exports', (req, res, next) => {
      this.exportParams = Object.assign({}, req.body)
      return res.json({ exportId: this.exportId })
    })

    app.get('/api/v2/users/:userId/affiliations', (req, res, next) => {
      return res.json(this.affiliations[req.params.userId] || [])
    })

    app.post('/api/v2/users/:userId/affiliations', (req, res, next) => {
      this.addAffiliation(req.params.userId, req.body.email)
      return res.sendStatus(201)
    })

    app.delete('/api/v2/users/:userId/affiliations', (req, res, next) => {
      return res.sendStatus(201)
    })

    app.delete(
      '/api/v2/users/:userId/affiliations/:email',
      (req, res, next) => {
        return res.sendStatus(204)
      }
    )

    app.get('/api/v2/brands/:slug', (req, res, next) => {
      let brand
      if ((brand = this.brands[req.params.slug])) {
        return res.json(brand)
      } else {
        return res.sendStatus(404)
      }
    })

    app.get('/universities/list', (req, res, next) => res.json([]))

    app.get('/universities/list/:id', (req, res, next) =>
      res.json({
        id: parseInt(req.params.id),
        name: `Institution ${req.params.id}`
      })
    )

    app.get('/university/domains', (req, res, next) => res.json([]))

    app.put('/api/v1/sharelatex/users/:id/email', (req, res, next) => {
      const { email } = req.body != null ? req.body.user : undefined
      if (Array.from(this.existingEmails).includes(email)) {
        return res.sendStatus(409)
      } else {
        this.updateEmail(parseInt(req.params.id), email)
        return res.sendStatus(200)
      }
    })

    app.post('/api/v1/sharelatex/login', (req, res, next) => {
      for (let id in this.users) {
        const user = this.users[id]
        if (
          user != null &&
          user.email === req.body.email &&
          user.password === req.body.password
        ) {
          return res.json({
            email: user.email,
            valid: true,
            user_profile: user.profile
          })
        }
      }
      return res.status(403).json({
        email: req.body.email,
        valid: false
      })
    })

    app.get('/api/v2/partners/:partner/conversions/:id', (req, res, next) => {
      const partner = this.validation_clients[req.params.partner]
      const conversion = __guard__(
        partner != null ? partner.conversions : undefined,
        x => x[req.params.id]
      )
      if (conversion != null) {
        return res.status(200).json({
          input_file_uri: conversion,
          brand_variation_id: partner.brand_variation_id
        })
      } else {
        return res.status(404).json({})
      }
    })

    app.get('/api/v2/brand_variations/:id', (req, res, next) => {
      const variation = this.brand_variations[req.params.id]
      if (variation != null) {
        return res.status(200).json(variation)
      } else {
        return res.status(404).json({})
      }
    })

    app.get('/api/v1/sharelatex/docs/:token/is_published', (req, res, next) => {
      return res.json({ allow: true })
    })

    app.get(
      '/api/v1/sharelatex/users/:user_id/docs/:token/info',
      (req, res, next) => {
        const info = this.getDocInfo(req.params.token) || {
          exists: false,
          exported: false
        }
        return res.json(info)
      }
    )

    app.get(
      '/api/v1/sharelatex/docs/read_token/:token/exists',
      (req, res, next) => {
        return res.json({ exists: false })
      }
    )

    app.get('/api/v2/templates/:templateId', (req, res, next) => {
      const template = this.templates[req.params.templateId]
      if (!template) {
        res.sendStatus(404)
      }
      return res.json(template)
    })

    return app
      .listen(5000, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockV1Api:', error.message)
        return process.exit(1)
      })
  }
}

MockV1Api.reset()
MockV1Api.run()

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
