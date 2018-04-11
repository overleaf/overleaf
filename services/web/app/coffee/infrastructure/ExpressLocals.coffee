logger = require 'logger-sharelatex'
fs = require 'fs'
crypto = require 'crypto'
Settings = require('settings-sharelatex')
SubscriptionFormatters = require('../Features/Subscription/SubscriptionFormatters')
querystring = require('querystring')
SystemMessageManager = require("../Features/SystemMessages/SystemMessageManager")
AuthenticationController = require("../Features/Authentication/AuthenticationController")
_ = require("underscore")
async = require("async")
Modules = require "./Modules"
Url = require "url"
PackageVersions = require "./PackageVersions"
htmlEncoder = new require("node-html-encoder").Encoder("numerical")
hashedFiles = {}
Path = require 'path'
Features = require "./Features"

jsPath =
	if Settings.useMinifiedJs
		"/minjs/"
	else
		"/js/"

ace = PackageVersions.lib('ace')
pdfjs = PackageVersions.lib('pdfjs')
fineuploader = PackageVersions.lib('fineuploader')

getFileContent = (filePath)->
	filePath = Path.join __dirname, "../../../", "public#{filePath}"
	exists = fs.existsSync filePath
	if exists
		content = fs.readFileSync filePath, "UTF-8"
		return content
	else
		logger.log filePath:filePath, "file does not exist for hashing"
		return ""

pathList = [
	"#{jsPath}libs/require.js"
	"#{jsPath}ide.js"
	"#{jsPath}main.js"
	"#{jsPath}libraries.js"
	"#{jsPath}es/rich-text.js"
	"/stylesheets/style.css"
	"/stylesheets/ol-style.css"
]

if !Settings.useMinifiedJs 
	logger.log "not using minified JS, not hashing static files"
else
	logger.log "Generating file hashes..."
	for path in pathList
		content = getFileContent(path)
		hash = crypto.createHash("md5").update(content).digest("hex")
		
		splitPath = path.split("/")
		filenameSplit = splitPath.pop().split(".")
		filenameSplit.splice(filenameSplit.length-1, 0, hash)
		splitPath.push(filenameSplit.join("."))

		hashPath = splitPath.join("/")
		hashedFiles[path] = hashPath

		fsHashPath = Path.join __dirname, "../../../", "public#{hashPath}"
		fs.writeFileSync(fsHashPath, content)


		logger.log "Finished hashing static content"

cdnAvailable = Settings.cdn?.web?.host?
darkCdnAvailable = Settings.cdn?.web?.darkHost?

module.exports = (app, webRouter, privateApiRouter, publicApiRouter)->
	webRouter.use (req, res, next)->
		res.locals.session = req.session
		next()

	addSetContentDisposition = (req, res, next) ->
		res.setContentDisposition = (type, opts) ->
			directives = for k, v of opts
				"#{k}=\"#{encodeURIComponent(v)}\""
			contentDispositionValue = "#{type}; #{directives.join('; ')}"
			res.setHeader(
				'Content-Disposition',
				contentDispositionValue
			)
		next()
	webRouter.use addSetContentDisposition
	privateApiRouter.use addSetContentDisposition
	publicApiRouter.use addSetContentDisposition

	webRouter.use (req, res, next)->
		req.externalAuthenticationSystemUsed = Features.externalAuthenticationSystemUsed
		res.locals.externalAuthenticationSystemUsed = Features.externalAuthenticationSystemUsed
		req.hasFeature = res.locals.hasFeature = Features.hasFeature
		res.locals.userIsFromOLv1 = (user) ->
			user.overleaf?.id?
		res.locals.userIsFromSL = (user) ->
			!user.overleaf?.id?
		next()

	webRouter.use (req, res, next)->

		cdnBlocked = req.query.nocdn == 'true' or req.session.cdnBlocked
		user_id = AuthenticationController.getLoggedInUserId(req)

		if cdnBlocked and !req.session.cdnBlocked?
			logger.log user_id:user_id, ip:req?.ip, "cdnBlocked for user, not using it and turning it off for future requets"
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
		res.locals.lib = PackageVersions.lib



		res.locals.buildJsPath = (jsFile, opts = {})->
			path = Path.join(jsPath, jsFile)

			if opts.hashedPath && hashedFiles[path]?
				path = hashedFiles[path]

			if !opts.qs?
				opts.qs = {}

			if opts.cdn != false
				path = Url.resolve(staticFilesBase, path)

			qs = querystring.stringify(opts.qs)

			if opts.removeExtension == true
				path = path.slice(0,-3)
				
			if qs? and qs.length > 0
				path = path + "?" + qs
			return path

		res.locals.buildWebpackPath = (jsFile, opts = {}) ->
			if Settings.webpack? and !Settings.useMinifiedJs
				path = Path.join(jsPath, jsFile)
				if opts.removeExtension == true
					path = path.slice(0,-3)
				return "#{Settings.webpack.url}/public#{path}"
			else
				return res.locals.buildJsPath(jsFile, opts)

		res.locals.buildCssPath = (cssFile, opts)->
			path = Path.join("/stylesheets/", cssFile)
			if opts?.hashedPath && hashedFiles[path]?
				hashedPath = hashedFiles[path]
				return Url.resolve(staticFilesBase, hashedPath)
			return Url.resolve(staticFilesBase, path)

		res.locals.buildImgPath = (imgFile)->
			path = Path.join("/img/", imgFile)
			return Url.resolve(staticFilesBase, path)

		next()



	webRouter.use (req, res, next)->
		res.locals.settings = Settings
		next()

	webRouter.use (req, res, next)->
		res.locals.translate = (key, vars = {}, htmlEncode = false) ->
			vars.appName = Settings.appName
			str = req.i18n.translate(key, vars)
			if htmlEncode then htmlEncoder.htmlEncode(str) else str
		# Don't include the query string parameters, otherwise Google
		# treats ?nocdn=true as the canonical version
		res.locals.currentUrl = Url.parse(req.originalUrl).pathname
		next()

	webRouter.use (req, res, next)->
		res.locals.getSiteHost = ->
			Settings.siteUrl.substring(Settings.siteUrl.indexOf("//")+2)
		next()

	webRouter.use (req, res, next) ->
		res.locals.getUserEmail = ->
			user = AuthenticationController.getSessionUser(req)
			email = user?.email or ""
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
			currentUser = AuthenticationController.getSessionUser(req)
			if currentUser? and currentUser?.referal_id?
				url+="?r=#{currentUser.referal_id}&rm=#{referal_medium}&rs=b" # Referal source = bonus
			return url
		res.locals.getReferalId = ->
			currentUser = AuthenticationController.getSessionUser(req)
			if currentUser? and currentUser?.referal_id?
				return currentUser.referal_id
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
		res.locals.isUserLoggedIn = ->
			return AuthenticationController.isUserLoggedIn(req)
		res.locals.getSessionUser = ->
			return AuthenticationController.getSessionUser(req)

		next()

	webRouter.use (req, res, next) ->
		res.locals.csrfToken = req?.csrfToken()
		next()

	webRouter.use (req, res, next) ->
		res.locals.getReqQueryParam = (field)->
			return req.query?[field]
		next()

	webRouter.use (req, res, next)->
		res.locals.formatPrice = SubscriptionFormatters.formatPrice
		next()

	webRouter.use (req, res, next)->
		currentUser = AuthenticationController.getSessionUser(req)
		if currentUser?
			res.locals.user =
				email: currentUser.email
				first_name: currentUser.first_name
				last_name: currentUser.last_name
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
		if res.locals.nav.header
			console.error {}, "The `nav.header` setting is no longer supported, use `nav.header_extras` instead"
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

	webRouter.use (req, res, next) ->
		isOl = (Settings.brandPrefix == 'ol-')
		res.locals.uiConfig = 
			defaultResizerSizeOpen     : if isOl then 7 else 24
			defaultResizerSizeClosed   : if isOl then 7 else 24
			eastResizerCursor          : if isOl then "ew-resize" else null
			westResizerCursor          : if isOl then "ew-resize" else null
			chatResizerSizeOpen        : if isOl then 7 else 12
			chatResizerSizeClosed      : 0
			chatMessageBorderSaturation: if isOl then "85%" else "70%"
			chatMessageBorderLightness : if isOl then "40%" else "70%"
			chatMessageBgSaturation    : if isOl then "85%" else "60%"
			chatMessageBgLightness     : if isOl then "40%" else "97%"
			renderAnnouncements        : !isOl
		next()
