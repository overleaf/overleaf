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

let v1Id = 1000

module.exports = MockV1Api = {
  nextV1Id() {
    return v1Id++
  },

  users: {},

  setUser(id, user) {
    return (this.users[id] = user)
  },

  exportId: null,

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

  affiliations: [],

  updateEmail: sinon.stub(),

  existingEmails: [],

  brands: {},

  brand_variations: {},

  validation_clients: {},

  setAffiliations(affiliations) {
    return (this.affiliations = affiliations)
  },

  doc_exported: {},

  setDocExported(token, info) {
    return (this.doc_exported[token] = info)
  },

  templates: {},

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
      return res.json(this.affiliations)
    })

    app.post('/api/v2/users/:userId/affiliations', (req, res, next) => {
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
        return res.json({
          exists: true,
          exported: false
        })
      }
    )

    app.get(
      '/api/v1/sharelatex/docs/:token/exported_to_v2',
      (req, res, next) => {
        if (this.doc_exported[req.params.token] != null) {
          return res.json(this.doc_exported[req.params.token])
        }
        return res.json({ exporting: false, exported: false })
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

MockV1Api.run()

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
