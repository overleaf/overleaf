logger = require 'logger-sharelatex'
fs = require 'fs'
crypto = require 'crypto'
Settings = require('settings-sharelatex')
SubscriptionFormatters = require('../Features/Subscription/SubscriptionFormatters')
querystring = require('querystring')
SystemMessageManager = require("../Features/SystemMessages/SystemMessageManager")
AuthenticationController = require("../Features/Authentication/AuthenticationController")
_ = require("underscore")
Modules = require "./Modules"
Url = require "url"

fingerprints = {}
Path = require 'path'


jsPath =
	if Settings.useMinifiedJs
		"/minjs/"
	else
		"/js/"


logger.log "Generating file fingerprints..."
for path in [
	"#{jsPath}libs/require.js",
	"#{jsPath}ide.js",
	"#{jsPath}main.js",
	"#{jsPath}libs.js",
	"#{jsPath}ace/ace.js",
	"#{jsPath}libs/pdfjs-1.3.91/pdf.js",
	"#{jsPath}libs/pdfjs-1.3.91/pdf.worker.js",
	"#{jsPath}libs/pdfjs-1.3.91/compatibility.js",
	"/stylesheets/style.css"
]
	filePath = Path.join __dirname, "../../../", "public#{path}"
	exists = fs.existsSync filePath
	if exists
		content = fs.readFileSync filePath
		hash = crypto.createHash("md5").update(content).digest("hex")
		logger.log "#{filePath}: #{hash}"
		fingerprints[path] = hash
	else
		logger.log filePath:filePath, "file does not exist for fingerprints"

getFingerprint = (path) ->
	if fingerprints[path]?
		return fingerprints[path]
	else
		logger.err "No fingerprint for file: #{path}"
		return ""

logger.log "Finished generating file fingerprints"

cdnAvailable = Settings.cdn?.web?.host?
darkCdnAvailable = Settings.cdn?.web?.darkHost?

module.exports = (app, webRouter, apiRouter)->
	webRouter.use (req, res, next)->
		res.locals.session = req.session
		next()

	webRouter.use (req, res, next)->

		cdnBlocked = req.query.nocdn == 'true' or req.session.cdnBlocked

		if cdnBlocked and !req.session.cdnBlocked?
			logger.log user_id:req?.session?.user?._id, ip:req?.ip, "cdnBlocked for user, not using it and turning it off for future requets"
			req.session.cdnBlocked = true

		isDark = req.headers?.host?.slice(0,4)?.toLowerCase() == "dark"
		isSmoke = req.headers?.host?.slice(0,5)?.toLowerCase() == "smoke"
		isLive = !isDark and !isSmoke

		if cdnAvailable and isLive and !cdnBlocked
			staticFilesBase = Settings.cdn?.web?.host
		else if darkCdnAvailable and isDark
			staticFilesBase = Settings.cdn?.web?.darkHost
		else
			staticFilesBase = ""

		res.locals.jsPath = jsPath
		res.locals.fullJsPath = Url.resolve(staticFilesBase, jsPath)


		res.locals.buildJsPath = (jsFile, opts = {})->
			path = Path.join(jsPath, jsFile)

			doFingerPrint = opts.fingerprint != false

			if !opts.qs?
				opts.qs = {}

			if !opts.qs?.fingerprint? and doFingerPrint
				opts.qs.fingerprint = getFingerprint(path)

			if opts.cdn != false
				path = Url.resolve(staticFilesBase, path)

			qs = querystring.stringify(opts.qs)

			if qs? and qs.length > 0
				path = path + "?" + qs
			return path


		res.locals.buildCssPath = (cssFile)->
			path = Path.join("/stylesheets/", cssFile)
			return Url.resolve(staticFilesBase, path) + "?fingerprint=" + getFingerprint(path)

		res.locals.buildImgPath = (imgFile)->
			path = Path.join("/img/", imgFile)
			return Url.resolve(staticFilesBase, path)

		next()



	webRouter.use (req, res, next)->
		res.locals.settings = Settings
		next()

	webRouter.use (req, res, next)->
		res.locals.translate = (key, vars = {}) ->
			vars.appName = Settings.appName
			req.i18n.translate(key, vars)
		res.locals.currentUrl = req.originalUrl
		next()

	webRouter.use (req, res, next)->
		res.locals.getSiteHost = ->
			Settings.siteUrl.substring(Settings.siteUrl.indexOf("//")+2)
		next()

	webRouter.use (req, res, next)->
		res.locals.getUserEmail = ->
			email = req?.session?.user?.email or ""
			return email
		next()

	webRouter.use (req, res, next)->
		res.locals.formatProjectPublicAccessLevel = (privilegeLevel)->
			formatedPrivileges = private:"Private", readOnly:"Public: Read Only", readAndWrite:"Public: Read and Write"
			return formatedPrivileges[privilegeLevel] || "Private"
		next()

	webRouter.use (req, res, next)->
		res.locals.buildReferalUrl = (referal_medium) ->
			url = Settings.siteUrl
			if req.session? and req.session.user? and req.session.user.referal_id?
				url+="?r=#{req.session.user.referal_id}&rm=#{referal_medium}&rs=b" # Referal source = bonus
			return url
		res.locals.getReferalId = ->
			if req.session? and req.session.user? and req.session.user.referal_id
				return req.session.user.referal_id
		res.locals.getReferalTagLine = ->
			tagLines = [
				"Roar!"
				"Shout about us!"
				"Please recommend us"
				"Tell the world!"
				"Thanks for using ShareLaTeX"
			]
			return tagLines[Math.floor(Math.random()*tagLines.length)]
		res.locals.getRedirAsQueryString = ->
			if req.query.redir?
				return "?#{querystring.stringify({redir:req.query.redir})}"
			return ""

		res.locals.getLoggedInUserId = ->
			return AuthenticationController.getLoggedInUserId(req)
		next()

	webRouter.use (req, res, next) ->
		res.locals.csrfToken = req?.csrfToken()
		next()

	webRouter.use (req, res, next) ->
		res.locals.getReqQueryParam = (field)->
			return req.query?[field]
		next()

	webRouter.use (req, res, next)->
		res.locals.fingerprint = getFingerprint
		next()

	webRouter.use (req, res, next)->
		res.locals.formatPrice = SubscriptionFormatters.formatPrice
		next()

	webRouter.use (req, res, next)->
		res.locals.externalAuthenticationSystemUsed = ->
			Settings.ldap?
		next()

	webRouter.use (req, res, next)->
		if req.user?
			res.locals.user =
				email: req.user.email
				first_name: req.user.first_name
				last_name: req.user.last_name
			if req.session.justRegistered
				res.locals.justRegistered = true
				delete req.session.justRegistered
			if req.session.justLoggedIn
				res.locals.justLoggedIn = true
				delete req.session.justLoggedIn
		res.locals.gaToken       = Settings.analytics?.ga?.token
		res.locals.tenderUrl     = Settings.tenderUrl
		res.locals.sentrySrc     = Settings.sentry?.src
		res.locals.sentryPublicDSN = Settings.sentry?.publicDSN
		next()

	webRouter.use (req, res, next) ->
		if req.query? and req.query.scribtex_path?
			res.locals.lookingForScribtex = true
			res.locals.scribtexPath = req.query.scribtex_path
		next()

	webRouter.use (req, res, next) ->
		# Clone the nav settings so they can be modified for each request
		res.locals.nav = {}
		for key, value of Settings.nav
			res.locals.nav[key] = _.clone(Settings.nav[key])
		res.locals.templates = Settings.templateLinks
		next()

	webRouter.use (req, res, next) ->
		SystemMessageManager.getMessages (error, messages = []) ->
			res.locals.systemMessages = messages
			next()

	webRouter.use (req, res, next)->
		res.locals.query = req.query
		next()

	webRouter.use (req, res, next)->
		subdomain = _.find Settings.i18n.subdomainLang, (subdomain)->
			subdomain.lngCode == req.showUserOtherLng and !subdomain.hide
		res.locals.recomendSubdomain = subdomain
		res.locals.currentLngCode = req.lng
		next()

	webRouter.use (req, res, next) ->
		if Settings.reloadModuleViewsOnEachRequest
			Modules.loadViewIncludes()
		res.locals.moduleIncludes = Modules.moduleIncludes
		res.locals.moduleIncludesAvailable = Modules.moduleIncludesAvailable
		next()
