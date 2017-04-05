Path = require('path')

# These credentials are used for authenticating api requests
# between services that may need to go over public channels
httpAuthUser = "sharelatex"
httpAuthPass = "CRYPTO_RANDOM" # Randomly generated for you
httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

parse = (option)->
	if option?
		try
			opt = JSON.parse(option)
			return opt
		catch err
			console.error "problem parsing #{option}, invalid JSON"
			return undefined


DATA_DIR = '/var/lib/sharelatex/data'
TMP_DIR = '/var/lib/sharelatex/tmp'

settings =

	# Databases
	# ---------

	# ShareLaTeX's main persistant data store is MongoDB (http://www.mongodb.org/)
	# Documentation about the URL connection string format can be found at:
	#
	#    http://docs.mongodb.org/manual/reference/connection-string/
	# 
	# The following works out of the box with Mongo's default settings:
	mongo:
		url : process.env["SHARELATEX_MONGO_URL"] or 'mongodb://dockerhost/sharelatex'

	# Redis is used in ShareLaTeX for high volume queries, like real-time
	# editing, and session management.
	#
	# The following config will work with Redis's default settings:
	redis:
		web: redisConfig =
			host: process.env["SHARELATEX_REDIS_HOST"] or "dockerhost"
			port: process.env["SHARELATEX_REDIS_PORT"] or "6379"
			password: process.env["SHARELATEX_REDIS_PASS"] or ""
		fairy: redisConfig
		documentupdater: [{
			primary: true
			port: process.env["SHARELATEX_REDIS_PORT"] or "6379"
			host: process.env["SHARELATEX_REDIS_HOST"] or "dockerhost"
			password: process.env["SHARELATEX_REDIS_PASS"] or ""
			key_schema:
				blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"
				docLines: ({doc_id}) -> "doclines:#{doc_id}"
				docOps: ({doc_id}) -> "DocOps:#{doc_id}"
				docVersion: ({doc_id}) -> "DocVersion:#{doc_id}"
				docHash: ({doc_id}) -> "DocHash:#{doc_id}"
				projectKey: ({doc_id}) -> "ProjectId:#{doc_id}"
				docsInProject: ({project_id}) -> "DocsIn:#{project_id}"
				ranges: ({doc_id}) -> "Ranges:#{doc_id}"
		}]


	# The compile server (the clsi) uses a SQL database to cache files and
	# meta-data. sqllite is the default, and the load is low enough that this will
	# be fine in production (we use sqllite at sharelatex.com).
	#
	# If you want to configure a different database, see the Sequelize documentation
	# for available options:
	#
	#    https://github.com/sequelize/sequelize/wiki/API-Reference-Sequelize#example-usage
	#
	mysql:
		clsi:
			database: "clsi"
			username: "clsi"
			password: ""
			dialect: "sqlite"
			storage: Path.join(DATA_DIR, "db.sqlite")

	# File storage
	# ------------

	# ShareLaTeX can store binary files like images either locally or in Amazon
	# S3. The default is locally:
	filestore:
		backend: "fs"	
		stores:
			user_files: Path.join(DATA_DIR, "user_files")
			template_files: Path.join(DATA_DIR, "template_files")
			
	# To use Amazon S3 as a storage backend, comment out the above config, and
	# uncomment the following, filling in your key, secret, and bucket name:
	#
	# filestore:
	# 	backend: "s3"
	# 	stores:
	# 		user_files: "BUCKET_NAME"
	# 	s3:
	# 		key: "AWS_KEY"
	# 		secret: "AWS_SECRET"
	# 		

	trackchanges:
		continueOnError: true

	# Local disk caching
	# ------------------
	path:
		# If we ever need to write something to disk (e.g. incoming requests
		# that need processing but may be too big for memory), then write
		# them to disk here:
		dumpFolder:   Path.join(TMP_DIR, "dumpFolder")
		# Where to write uploads before they are processed
		uploadFolder: Path.join(TMP_DIR, "uploads")
		# Where to write the project to disk before running LaTeX on it
		compilesDir:  Path.join(DATA_DIR, "compiles")
		# Where to cache downloaded URLs for the CLSI
		clsiCacheDir: Path.join(DATA_DIR, "cache")

	# Server Config
	# -------------

	# Where your instance of ShareLaTeX can be found publicly. This is used
	# when emails are sent out and in generated links:
	siteUrl: siteUrl = process.env["SHARELATEX_SITE_URL"] or 'http://localhost'

	# The name this is used to describe your ShareLaTeX Installation
	appName: process.env["SHARELATEX_APP_NAME"] or "ShareLaTeX (Community Edition)"

	restrictInvitesToExistingAccounts: process.env["SHARELATEX_RESTRICT_INVITES_TO_EXISTING_ACCOUNTS"] == 'true'

	nav:
		title: process.env["SHARELATEX_NAV_TITLE"] or  process.env["SHARELATEX_APP_NAME"] or "ShareLaTeX Community Edition"


	# The email address which users will be directed to as the main point of
	# contact for this installation of ShareLaTeX.
	adminEmail: process.env["SHARELATEX_ADMIN_EMAIL"] or "placeholder@example.com"
	
	# If provided, a sessionSecret is used to sign cookies so that they cannot be
	# spoofed. This is recommended.
	security:
		sessionSecret: process.env["SHARELATEX_SESSION_SECRET"] or "CRYPTO_RANDOM" # This was randomly generated for you

	# These credentials are used for authenticating api requests
	# between services that may need to go over public channels
	httpAuthUsers: httpAuthUsers
	
	# Should javascript assets be served minified or not. Note that you will
	# need to run `grunt compile:minify` within the web-sharelatex directory
	# to generate these.
	useMinifiedJs: true

	# Should static assets be sent with a header to tell the browser to cache
	# them. This should be false in development where changes are being made,
	# but should be set to true in production.
	cacheStaticAssets: true

	# If you are running ShareLaTeX over https, set this to true to send the
	# cookie with a secure flag (recommended).
	secureCookie: process.env["SHARELATEX_SECURE_COOKIE"]?
	
	# If you are running ShareLaTeX behind a proxy (like Apache, Nginx, etc)
	# then set this to true to allow it to correctly detect the forwarded IP
	# address and http/https protocol information.

	behindProxy: process.env["SHARELATEX_BEHIND_PROXY"] or false

	i18n:
		subdomainLang:
			www: {lngCode:process.env["SHARELATEX_SITE_LANGUAGE"] or "en", url: siteUrl}
		defaultLng: process.env["SHARELATEX_SITE_LANGUAGE"] or "en"

	# Spell Check Languages
	# ---------------------
	#
	# You must have the corresponding aspell dictionary installed to
	# be able to use a language. Run `grunt check:aspell` to check which
	# dictionaries you have installed. These should be set for the `code` for
	# each language.
	languages: [{
		"code":"en", "name":"English (American)"
		},{
		"code":"en_GB", "name":"English (British)"
		},{
		"code":"af", "name":"Africaans"
		},{
		"code":"am", "name":"Amharic"
		},{
		"code":"ar", "name":"Arabic"
		},{
		"code":"hy", "name":"Armenian"
		},{
		"code":"gl", "name":"Galician"
		},{
		"code":"eu", "name":"Basque"
		},{
		"code":"bn", "name":"Bengali"
		},{
		"code":"br", "name":"Breton"
		},{
		"code":"bg", "name":"Bulgarian"
		},{
		"code":"ca", "name":"Catalan"
		},{
		"code":"hr", "name":"Croatian"
		},{
		"code":"cs", "name":"Czech"
		},{
		"code":"da", "name":"Danish"
		},{
		"code":"nl", "name":"Dutch"
		},{
		"code":"eo", "name":"Esperanto"
		},{
		"code":"et", "name":"Estonian"
		},{
		"code":"fo", "name":"Faroese"
		},{
		"code":"fr", "name":"French"
		},{
		"code":"de", "name":"German"
		},{
		"code":"el", "name":"Greek"
		},{
		"code":"gu", "name":"Gujarati"
		},{
		"code":"he", "name":"Hebrew"
		},{
		"code":"hi", "name":"Hindi"
		},{
		"code":"hu", "name":"Hungarian"
		},{
		"code":"is", "name":"Icelandic"
		},{
		"code":"id", "name":"Indonesian"
		},{
		"code":"ga", "name":"Irish"
		},{
		"code":"it", "name":"Italian"
		},{
		"code":"kn", "name":"Kannada"
		},{
		"code":"kk", "name":"Kazakh"
		},{
		"code":"ku", "name":"Kurdish"
		},{
		"code":"lv", "name":"Latvian"
		},{
		"code":"lt", "name":"Lithuanian"
		},{
		"code":"ml", "name":"Malayalam"
		},{
		"code":"mr", "name":"Marathi"
		},{
		"code":"nr", "name":"Ndebele"
		},{
		"code":"ns", "name":"Northern Sotho"
		},{
		"code":"no", "name":"Norwegian"
		},{
		"code":"or", "name":"Oriya"
		},{
		"code":"fa", "name":"Persian"
		},{
		"code":"pl", "name":"Polish"
		},{
		"code":"pt_BR", "name":"Portuguese (Brazilian)"
		},{
		"code":"pt_PT", "name":"Portuguese (European)"
		},{
		"code":"pa", "name":"Punjabi"
		},{
		"code":"ro", "name":"Romanian"
		},{
		"code":"ru", "name":"Russian"
		},{
		"code":"sk", "name":"Slovak"
		},{
		"code":"sl", "name":"Slovenian"
		},{
		"code":"st", "name":"Southern Sotho"
		},{
		"code":"es", "name":"Spanish"
		},{
		"code":"ss", "name":"Swazi"
		},{
		"code":"sv", "name":"Swedish"
		},{
		"code":"tl", "name":"Tagalog"
		},{
		"code":"ta", "name":"Tamil"
		},{
		"code":"te", "name":"Telugu"
		},{
		"code":"ts", "name":"Tsonga"
		},{
		"code":"tn", "name":"Tswana"
		},{
		"code":"uk", "name":"Ukrainian"
		},{
		"code":"hsb", "name":"Upper Sorbian"
		},{
		"code":"uz", "name":"Uzbek"
		},{
		"code":"cy", "name":"Welsh"
		},{
		"code":"xh", "name":"Xhosa"
		},{
		"code":"zu", "name":"Zulu"
		}
	]

	apis:
		web:
			url: "http://localhost:3000"
			user: httpAuthUser
			pass: httpAuthPass
	references:{}
	notifications:undefined

	defaultFeatures:
		collaborators: -1
		dropbox: true
		versioning: true
		compileTimeout: 180
		compileGroup: "standard"
		references: true
		templates: true

## OPTIONAL CONFIGERABLE SETTINGS

if process.env["SHARELATEX_LEFT_FOOTER"]?
	try
		settings.nav.left_footer = JSON.parse(process.env["SHARELATEX_LEFT_FOOTER"])
	catch e
		console.error("could not parse SHARELATEX_LEFT_FOOTER, not valid JSON")

if process.env["SHARELATEX_RIGHT_FOOTER"]?
	settings.nav.right_footer = process.env["SHARELATEX_RIGHT_FOOTER"]
	try
		settings.nav.right_footer = JSON.parse(process.env["SHARELATEX_RIGHT_FOOTER"])
	catch e
		console.error("could not parse SHARELATEX_RIGHT_FOOTER, not valid JSON")

if process.env["SHARELATEX_HEADER_IMAGE_URL"]?
	settings.nav.custom_logo = process.env["SHARELATEX_HEADER_IMAGE_URL"]

if process.env["SHARELATEX_HEADER_NAV_LINKS"]?
	console.error """
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
#
#  WARNING: SHARELATEX_HEADER_NAV_LINKS is no longer supported
#  See https://github.com/sharelatex/sharelatex/wiki/Configuring-Headers,-Footers-&-Logo
#
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
"""

if process.env["SHARELATEX_HEADER_EXTRAS"]?
	try
		settings.nav.header_extras = JSON.parse(process.env["SHARELATEX_HEADER_EXTRAS"])
	catch e
		console.error("could not parse SHARELATEX_HEADER_EXTRAS, not valid JSON")



# Sending Email
# -------------
#
# You must configure a mail server to be able to send invite emails from
# ShareLaTeX. The config settings are passed to nodemailer. See the nodemailer
# documentation for available options:
#
#     http://www.nodemailer.com/docs/transports


if process.env["SHARELATEX_EMAIL_FROM_ADDRESS"]?
	
	settings.email =
		fromAddress: process.env["SHARELATEX_EMAIL_FROM_ADDRESS"]
		replyTo: process.env["SHARELATEX_EMAIL_REPLY_TO"] or ""
		parameters:
			#AWS Creds
			AWSAccessKeyID: process.env["SHARELATEX_EMAIL_AWS_SES_ACCESS_KEY_ID"]
			AWSSecretKey: process.env["SHARELATEX_EMAIL_AWS_SES_SECRET_KEY"]

			#SMTP Creds
			host: process.env["SHARELATEX_EMAIL_SMTP_HOST"]
			port: process.env["SHARELATEX_EMAIL_SMTP_PORT"],
			secure: parse(process.env["SHARELATEX_EMAIL_SMTP_SECURE"])
			ignoreTLS: parse(process.env["SHARELATEX_EMAIL_SMTP_IGNORE_TLS"])

		textEncoding:  process.env["SHARELATEX_EMAIL_TEXT_ENCODING"]
		templates:
			customFooter: process.env["SHARELATEX_CUSTOM_EMAIL_FOOTER"]

	if process.env["SHARELATEX_EMAIL_SMTP_USER"]? or process.env["SHARELATEX_EMAIL_SMTP_PASS"]?
		settings.email.parameters.auth =
			user: process.env["SHARELATEX_EMAIL_SMTP_USER"]
			pass: process.env["SHARELATEX_EMAIL_SMTP_PASS"]

	if process.env["SHARELATEX_EMAIL_SMTP_TLS_REJECT_UNAUTH"]?
		settings.email.parameters.tls =
			rejectUnauthorized: parse(process.env["SHARELATEX_EMAIL_SMTP_TLS_REJECT_UNAUTH"])


# i18n
if process.env["SHARELATEX_LANG_DOMAIN_MAPPING"]?		

	settings.i18n.subdomainLang = parse(process.env["SHARELATEX_LANG_DOMAIN_MAPPING"])

# Password Settings
# -----------
# These restrict the passwords users can use when registering
# opts are from http://antelle.github.io/passfield
if process.env["SHARELATEX_PASSWORD_VALIDATION_PATTERN"] or process.env["SHARELATEX_PASSWORD_VALIDATION_MIN_LENGTH"] or process.env["SHARELATEX_PASSWORD_VALIDATION_MAX_LENGTH"]

	settings.passwordStrengthOptions =
		pattern: process.env["SHARELATEX_PASSWORD_VALIDATION_PATTERN"] or "aA$3"
		length: {min:process.env["SHARELATEX_PASSWORD_VALIDATION_MIN_LENGTH"] or 8, max: process.env["SHARELATEX_PASSWORD_VALIDATION_MAX_LENGTH"] or 150}




#######################
# ShareLaTeX Server Pro
#######################

if parse(process.env["SHARELATEX_IS_SERVER_PRO"]) == true
	settings.apis.references =
		 url: "http://localhost:3040"


# LDAP - SERVER PRO ONLY
# ----------

if process.env["SHARELATEX_LDAP_HOST"]
	console.error """
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
#
#  WARNING: The LDAP configuration format has changed in version 0.5.1
#  See https://github.com/sharelatex/sharelatex/wiki/Server-Pro:-LDAP-Config
#
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
"""

if process.env["SHARELATEX_LDAP_URL"]
	settings.externalAuth = true
	settings.ldap =
		emailAtt: process.env["SHARELATEX_LDAP_EMAIL_ATT"]
		nameAtt: process.env["SHARELATEX_LDAP_NAME_ATT"]
		lastNameAtt: process.env["SHARELATEX_LDAP_LAST_NAME_ATT"]
		updateUserDetailsOnLogin: process.env["SHARELATEX_LDAP_UPDATE_USER_DETAILS_ON_LOGIN"] == 'true'
		placeholder: process.env["SHARELATEX_LDAP_PLACEHOLDER"]
		server:
			url: process.env["SHARELATEX_LDAP_URL"]
			bindDn: process.env["SHARELATEX_LDAP_BIND_DN"]
			bindCredentials: process.env["SHARELATEX_LDAP_BIND_CREDENTIALS"]
			bindProperty: process.env["SHARELATEX_LDAP_BIND_PROPERTY"]
			searchBase: process.env["SHARELATEX_LDAP_SEARCH_BASE"]
			searchScope: process.env["SHARELATEX_LDAP_SEARCH_SCOPE"]
			searchFilter: process.env["SHARELATEX_LDAP_SEARCH_FILTER"]
			searchAttributes: (
				if _ldap_search_attribs = process.env["SHARELATEX_LDAP_SEARCH_ATTRIBUTES"]
					try
						JSON.parse(_ldap_search_attribs)
					catch e
						console.error "could not parse SHARELATEX_LDAP_SEARCH_ATTRIBUTES"
				else
					undefined
			)
			groupDnProperty: process.env["SHARELATEX_LDAP_GROUP_DN_PROPERTY"]
			groupSearchBase: process.env["SHARELATEX_LDAP_GROUP_SEARCH_BASE"]
			groupSearchScope: process.env["SHARELATEX_LDAP_GROUP_SEARCH_SCOPE"]
			groupSearchFilter: process.env["SHARELATEX_LDAP_GROUP_SEARCH_FILTER"]
			groupSearchAttributes: (
				if _ldap_group_search_attribs = process.env["SHARELATEX_LDAP_GROUP_SEARCH_ATTRIBUTES"]
					try
						JSON.parse(_ldap_group_search_attribs)
					catch e
						console.error "could not parse SHARELATEX_LDAP_GROUP_SEARCH_ATTRIBUTES"
				else
					undefined
			)
			cache: process.env["SHARELATEX_LDAP_CACHE"] == 'true'
			timeout: (
				if _ldap_timeout = process.env["SHARELATEX_LDAP_TIMEOUT"]
					try
						parseInt(_ldap_timeout)
					catch e
						console.error "Cannot parse SHARELATEX_LDAP_TIMEOUT"
				else
					undefined
			)
			connectTimeout: (
				if _ldap_connect_timeout = process.env["SHARELATEX_LDAP_CONNECT_TIMEOUT"]
					try
						parseInt(_ldap_connect_timeout)
					catch e
						console.error "Cannot parse SHARELATEX_LDAP_CONNECT_TIMEOUT"
				else
					undefined
			)

	if process.env["SHARELATEX_LDAP_TLS_OPTS_CA_PATH"]
		try
			ca = JSON.parse(process.env["SHARELATEX_LDAP_TLS_OPTS_CA_PATH"])
		catch e
			console.error "could not parse SHARELATEX_LDAP_TLS_OPTS_CA_PATH, invalid JSON"

		if typeof(ca)  == 'string'
			ca_paths = [ca]
		else if typeof(ca) == 'object' && ca?.length?
			ca_paths = ca
		else
			console.error "problem parsing SHARELATEX_LDAP_TLS_OPTS_CA_PATH"

		settings.ldap.server.tlsOptions =
			rejectUnauthorized: process.env["SHARELATEX_LDAP_TLS_OPTS_REJECT_UNAUTH"] == "true"
			ca:ca_paths  # e.g.'/etc/ldap/ca_certs.pem'





if process.env["SHARELATEX_SAML_ENTRYPOINT"]
	# NOTE: see https://github.com/bergie/passport-saml/blob/master/README.md for docs of `server` options
	settings.externalAuth = true
	settings.saml =
		updateUserDetailsOnLogin: process.env["SHARELATEX_SAML_UPDATE_USER_DETAILS_ON_LOGIN"] == 'true'
		identityServiceName: process.env["SHARELATEX_SAML_IDENTITY_SERVICE_NAME"]
		emailField: process.env["SHARELATEX_SAML_EMAIL_FIELD"] || process.env["SHARELATEX_SAML_EMAIL_FIELD_NAME"]
		firstNameField: process.env["SHARELATEX_SAML_FIRST_NAME_FIELD"]
		lastNameField:  process.env["SHARELATEX_SAML_LAST_NAME_FIELD"]
		server:
			# strings
			entryPoint: process.env["SHARELATEX_SAML_ENTRYPOINT"]
			callbackUrl: process.env["SHARELATEX_SAML_CALLBACK_URL"]
			issuer: process.env["SHARELATEX_SAML_ISSUER"]
			cert: process.env["SHARELATEX_SAML_CERT"]
			privateCert: process.env["SHARELATEX_SAML_PRIVATE_CERT"]
			decryptionPvk: process.env["SHARELATEX_SAML_DECRYPTION_PVK"]
			signatureAlgorithm: process.env["SHARELATEX_SAML_SIGNATURE_ALGORITHM"]
			identifierFormat: process.env["SHARELATEX_SAML_IDENTIFIER_FORMAT"]
			attributeConsumingServiceIndex: process.env["SHARELATEX_SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX"]
			authnContext: process.env["SHARELATEX_SAML_AUTHN_CONTEXT"]
			authnRequestBinding: process.env["SHARELATEX_SAML_AUTHN_REQUEST_BINDING"]
			validateInResponseTo: process.env["SHARELATEX_SAML_VALIDATE_IN_RESPONSE_TO"]
			cacheProvider: process.env["SHARELATEX_SAML_CACHE_PROVIDER"]
			logoutUrl: process.env["SHARELATEX_SAML_LOGOUT_URL"]
			logoutCallbackUrl: process.env["SHARELATEX_SAML_LOGOUT_CALLBACK_URL"]
			disableRequestedAuthnContext: process.env["SHARELATEX_SAML_DISABLE_REQUESTED_AUTHN_CONTEXT"] == 'true'
			forceAuthn: process.env["SHARELATEX_SAML_FORCE_AUTHN"] == 'true'
			skipRequestCompression: process.env["SHARELATEX_SAML_SKIP_REQUEST_COMPRESSION"] == 'true'
			acceptedClockSkewMs: (
				if _saml_skew = process.env["SHARELATEX_SAML_ACCEPTED_CLOCK_SKEW_MS"]
					try
						parseInt(_saml_skew)
					catch e
						console.error "Cannot parse SHARELATEX_SAML_ACCEPTED_CLOCK_SKEW_MS"
				else
					undefined
			)
			requestIdExpirationPeriodMs: (
				if _saml_exiration = process.env["SHARELATEX_SAML_REQUEST_ID_EXPIRATION_PERIOD_MS"]
					try
						parseInt(_saml_expiration)
					catch e
						console.error "Cannot parse SHARELATEX_SAML_REQUEST_ID_EXPIRATION_PERIOD_MS"
				else
					undefined
			)
			additionalParams: (
				if _saml_additionalParams = process.env["SHARELATEX_SAML_ADDITIONAL_PARAMS"]
					try
						JSON.parse(_saml_additionalParams)
					catch e
						console.error "Cannot parse SHARELATEX_SAML_ADDITIONAL_PARAMS"
				else
					undefined
			)
			additionalAuthorizeParams: (
				if _saml_additionalAuthorizeParams = process.env["SHARELATEX_SAML_ADDITIONAL_AUTHORIZE_PARAMS"]
					try
						JSON.parse(_saml_additionalAuthorizeParams )
					catch e
						console.error "Cannot parse SHARELATEX_SAML_ADDITIONAL_AUTHORIZE_PARAMS"
				else
					undefined
			)
			additionalLogoutParams: (
				if _saml_additionalLogoutParams = process.env["SHARELATEX_SAML_ADDITIONAL_LOGOUT_PARAMS"]
					try
						JSON.parse(_saml_additionalLogoutParams )
					catch e
						console.error "Cannot parse SHARELATEX_SAML_ADDITIONAL_LOGOUT_PARAMS"
				else
					undefined
			)


# Compiler
# --------
if process.env["SANDBOXED_COMPILES"] == "true"
	settings.clsi =
		commandRunner: "docker-runner-sharelatex"
		docker:
			image: process.env["TEX_LIVE_DOCKER_IMAGE"]
			env:
				HOME: "/tmp"
				PATH: process.env["COMPILER_PATH"] or "/usr/local/texlive/2015/bin/x86_64-linux:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
			user: "www-data"

	if !settings.path?
		settings.path = {}
	settings.path.synctexBaseDir = () -> "/compile"
	if process.env['SANDBOXED_COMPILES_SIBLING_CONTAINERS']  == 'true'
		console.log("Using sibling containers for sandoxed compiles")
		if process.env['SANDBOXED_COMPILES_HOST_DIR']
			settings.path.sandboxedCompilesHostDir = process.env['SANDBOXED_COMPILES_HOST_DIR']
		else
			console.error('Sibling containers, but SANDBOXED_COMPILES_HOST_DIR not set')


# Templates
# ---------
if process.env["SHARELATEX_TEMPLATES_USER_ID"]
	settings.templates =
		mountPointUrl: "/templates"
		user_id: process.env["SHARELATEX_TEMPLATES_USER_ID"]
		
	settings.templateLinks = parse(process.env["SHARELATEX_NEW_PROJECT_TEMPLATE_LINKS"])


# /Learn
# -------
if process.env["SHARELATEX_PROXY_LEARN"]?
	settings.proxyLearn = parse(process.env["SHARELATEX_PROXY_LEARN"])


# /References
# -----------
if process.env["SHARELATEX_ELASTICSEARCH_URL"]?
	settings.references.elasticsearch =
			host: process.env["SHARELATEX_ELASTICSEARCH_URL"]
	

# With lots of incoming and outgoing HTTP connections to different services,
# sometimes long running, it is a good idea to increase the default number
# of sockets that Node will hold open.
http = require('http')
http.globalAgent.maxSockets = 300
https = require('https')
https.globalAgent.maxSockets = 300

module.exports = settings

