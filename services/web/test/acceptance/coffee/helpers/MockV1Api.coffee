express = require("express")
app = express()
bodyParser = require('body-parser')
sinon = require 'sinon'

app.use(bodyParser.json())

v1Id = 1000

module.exports = MockV1Api =
	nextV1Id: -> v1Id++

	users: { }

	setUser: (id, user) ->
		@users[id] = user

	exportId: null

	exportParams: null

	setExportId: (id) ->
		@exportId = id

	getLastExportParams: () ->
		@exportParams

	clearExportParams: () ->
		@exportParams = null

	syncUserFeatures: sinon.stub()

	affiliations: []

	updateEmail: sinon.stub()

	existingEmails: []

	brands: {}

	validation_clients: {}

	setAffiliations: (affiliations) -> @affiliations = affiliations

	run: () ->
		app.get "/api/v1/sharelatex/users/:v1_user_id/plan_code", (req, res, next) =>
			user = @users[req.params.v1_user_id]
			if user
				res.json user
			else
				res.sendStatus 404

		app.get "/api/v1/sharelatex/users/:v1_user_id/subscriptions", (req, res, next) =>
			user = @users[req.params.v1_user_id]
			if user?.subscription?
				res.json user.subscription
			else
				res.sendStatus 404

		app.get "/api/v1/sharelatex/users/:v1_user_id/subscription_status", (req, res, next) =>
			user = @users[req.params.v1_user_id]
			if user?.subscription_status?
				res.json user.subscription_status
			else
				res.sendStatus 404

		app.delete "/api/v1/sharelatex/users/:v1_user_id/subscription", (req, res, next) =>
			user = @users[req.params.v1_user_id]
			if user?
				user.canceled = true
				res.sendStatus 200
			else
				res.sendStatus 404

		app.post "/api/v1/sharelatex/users/:v1_user_id/sync", (req, res, next) =>
			@syncUserFeatures(req.params.v1_user_id)
			res.sendStatus 200

		app.post "/api/v1/sharelatex/exports", (req, res, next) =>
			@exportParams = Object.assign({}, req.body)
			res.json exportId: @exportId

		app.get "/api/v2/users/:userId/affiliations", (req, res, next) =>
			res.json @affiliations

		app.post "/api/v2/users/:userId/affiliations", (req, res, next) =>
			res.sendStatus 201

		app.delete "/api/v2/users/:userId/affiliations/:email", (req, res, next) =>
			res.sendStatus 204

		app.get "/api/v2/brands/:slug", (req, res, next) =>
			if brand = @brands[req.params.slug]
				res.json brand
			else
				res.sendStatus 404

		app.get '/universities/list', (req, res, next) ->
			res.json []

		app.get '/universities/list/:id', (req, res, next) ->
			res.json {
				id: parseInt(req.params.id)
				name: "Institution #{req.params.id}"
			}

		app.get '/university/domains', (req, res, next) ->
			res.json []

		app.put '/api/v1/sharelatex/users/:id/email', (req, res, next) =>
			{ email } = req.body?.user
			if email in @existingEmails
				return res.sendStatus 409
			else
				@updateEmail parseInt(req.params.id), email
				return res.sendStatus 200

		app.post "/api/v1/sharelatex/login", (req, res, next) =>
			for id, user of @users
				if user? && user.email == req.body.email && user.password == req.body.password
					return res.json {
						email: user.email,
						valid: true,
						user_profile: user.profile
					}
			return res.status(403).json {
				email: req.body.email,
				valid: false
			}

		app.get "/api/v2/partners/:partner/conversions/:id", (req, res, next) =>
			partner = @validation_clients[req.params.partner]
			conversion = partner?.conversions?[req.params.id]
			if conversion?
				res.status(200).json {input_file_uri: conversion, brand_variation_id: partner.brand_variation_id}
			else
				res.status(404).json {}

		app.listen 5000, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockV1Api:", error.message
			process.exit(1)

		app.get '/api/v1/sharelatex/docs/:token/is_published', (req, res, next) =>
			res.json { allow: true }

		app.get '/api/v1/sharelatex/users/:user_id/docs/:token/info', (req, res, next) =>
			res.json { exported: false }

MockV1Api.run()
