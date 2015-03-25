Path = require('path')

# These credentials are used for authenticating api requests
# between services that may need to go over public channels
httpAuthUser = "sharelatex"
httpAuthPass = "CRYPTO_RANDOM" # Randomly generated for you
httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

DATA_DIR = '/var/lib/sharelatex/data'
TMP_DIR = '/var/lib/sharelatex/tmp'

module.exports =
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

	# The email address which users will be directed to as the main point of
	# contact for this installation of ShareLaTeX.
	adminEmail: process.env["SHARELATEX_ADMIN_EMAIL"] or "placeholder@example.com"
	
	# If provided, a sessionSecret is used to sign cookies so that they cannot be
	# spoofed. This is recommended.
	security:
		sessionSecret: "CRYPTO_RANDOM" # This was randomly generated for you

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
	behindProxy: true

	# Sending Email
	# -------------
	#
	# You must configure a mail server to be able to send invite emails from
	# ShareLaTeX. The config settings are passed to nodemailer. See the nodemailer
	# documentation for available options:
	#
	#     http://www.nodemailer.com/docs/transports
	#
	# email:
	#	fromAddress: ""
	#	replyTo: ""
	#	transport: "SES"
	#	parameters:
	#		AWSAccessKeyID: ""
	#		AWSSecretKey: ""

	# Spell Check Languages
	# ---------------------
	#
	# You must have the corresponding aspell dictionary installed to 
	# be able to use a language. Run `grunt check:aspell` to check which
	# dictionaries you have installed. These should be set for the `code` for
	# each language.
	languages: [{
		"code":"en",
		"name":"English (American)"
		},{
		"code":"en_GB",
		"name":"English (British)"
		},{
		"code":"af",
		"name":"Africaans"
		},{
		"code":"am",
		"name":"Amharic"
		},{
		"code":"ar",
		"name":"Arabic"
		},{
		"code":"hy",
		"name":"Armenian"
		},{
		"code":"gl",
		"name":"Galician"
		},{
		"code":"eu",
		"name":"Basque"
		},{
		"code":"bn",
		"name":"Bengali"
		},{
		"code":"br",
		"name":"Breton"
		},{
		"code":"bg",
		"name":"Bulgarian"
		},{
		"code":"ca",
		"name":"Catalan"
		},{
		"code":"hr",
		"name":"Croatian"
		},{
		"code":"cs",
		"name":"Czech"
		},{
		"code":"da",
		"name":"Danish"
		},{
		"code":"nl",
		"name":"Dutch"
		},{
		"code":"eo",
		"name":"Esperanto"
		},{
		"code":"et",
		"name":"Estonian"
		},{
		"code":"fo",
		"name":"Faroese"
		},{
		"code":"fr",
		"name":"French"
		},{
		"code":"de",
		"name":"German"
		},{
		"code":"el",
		"name":"Greek"
		},{
		"code":"gu",
		"name":"Gujarati"
		},{
		"code":"he",
		"name":"Hebrew"
		},{
		"code":"hi",
		"name":"Hindi"
		},{
		"code":"hu",
		"name":"Hungarian"
		},{
		"code":"is",
		"name":"Icelandic"
		},{
		"code":"id",
		"name":"Indonesian"
		},{
		"code":"ga",
		"name":"Irish"
		},{
		"code":"it",
		"name":"Italian"
		},{
		"code":"kn",
		"name":"Kannada"
		},{
		"code":"kk",
		"name":"Kazakh"
		},{
		"code":"ku",
		"name":"Kurdish"
		},{
		"code":"lv",
		"name":"Latvian"
		},{
		"code":"lt",
		"name":"Lithuanian"
		},{
		"code":"ml",
		"name":"Malayalam"
		},{
		"code":"mr",
		"name":"Marathi"
		},{
		"code":"nr",
		"name":"Ndebele"
		},{
		"code":"ns",
		"name":"Northern Sotho"
		},{
		"code":"no",
		"name":"Norwegian"
		},{
		"code":"or",
		"name":"Oriya"
		},{
		"code":"fa",
		"name":"Persian"
		},{
		"code":"pl",
		"name":"Polish"
		},{
		"code":"pt_BR",
		"name":"Portuguese (Brazilian)"
		},{
		"code":"pt_PT",
		"name":"Portuguese (European)"
		},{
		"code":"pa",
		"name":"Punjabi"
		},{
		"code":"ro",
		"name":"Romanian"
		},{
		"code":"ru",
		"name":"Russian"
		},{
		"code":"sk",
		"name":"Slovak"
		},{
		"code":"sl",
		"name":"Slovenian"
		},{
		"code":"st",
		"name":"Southern Sotho"
		},{
		"code":"es",
		"name":"Spanish"
		},{
		"code":"ss",
		"name":"Swazi"
		},{
		"code":"sv",
		"name":"Swedish"
		},{
		"code":"tl",
		"name":"Tagalog"
		},{
		"code":"ta",
		"name":"Tamil"
		},{
		"code":"te",
		"name":"Telugu"
		},{
		"code":"ts",
		"name":"Tsonga"
		},{
		"code":"tn",
		"name":"Tswana"
		},{
		"code":"uk",
		"name":"Ukrainian"
		},{
		"code":"hsb",
		"name":"Upper Sorbian"
		},{
		"code":"uz",
		"name":"Uzbek"
		},{
		"code":"cy",
		"name":"Welsh"
		},{
		"code":"xh",
		"name":"Xhosa"
		},{
		"code":"zu",
		"name":"Zulu"
		}
	]
	
	# Service locations
	# -----------------

	# ShareLaTeX is comprised of many small services, which each expose
	# an HTTP API running on a different port. Generally you
	# can leave these as they are unless you have some other services
	# running which conflict, or want to run the web process on port 80.
	# internal:
	# 	web:
	# 		port: webPort = 3000
	# 		host: "localhost"
	# 	documentupdater:
	# 		port: docUpdaterPort = 3003
	# 		host: "localhost"
	# 	filestore:
	# 		port: filestorePort = 3009
	# 		host: "localhost"
	# 	chat:
	# 		port: chatPort = 3010
	# 		host: "localhost"
	# 	tags:
	# 		port: tagsPort = 3012
	# 		host: "localhost"
	# 	clsi:
	# 		port: clsiPort = 3013
	# 		host: "localhost"
	# 	trackchanges:
	# 		port: trackchangesPort = 3015
	# 		host: "localhost"
	# 	docstore:
	# 		port: docstorePort = 3016
	# 		host: "localhost"
	# 	spelling:
	# 		port: spellingPort = 3005
	# 		host: "localhost"

	# If you change the above config, or run some services on remote servers,
	# you need to tell the other services where to find them:
	apis:
		web:
			url: "http://localhost:3000"
			user: httpAuthUser
			pass: httpAuthPass
	# 	documentupdater:
	# 		url : "http://localhost:#{docUpdaterPort}"
	# 	clsi:
	# 		url: "http://localhost:#{clsiPort}"
	# 	filestore:
	# 		url: "http://localhost:#{filestorePort}"
	# 	trackchanges:
	# 		url: "http://localhost:#{trackchangesPort}"
	# 	docstore:
	# 		url: "http://localhost:#{docstorePort}"
	# 	tags:
	# 		url: "http://localhost:#{tagsPort}"
	# 	spelling:
	# 		url: "http://localhost:#{spellingPort}"
	# 	chat:
	# 		url: "http://localhost:#{chatPort}"
	

# With lots of incoming and outgoing HTTP connections to different services,
# sometimes long running, it is a good idea to increase the default number
# of sockets that Node will hold open.
http = require('http')
http.globalAgent.maxSockets = 300
https = require('https')
https.globalAgent.maxSockets = 300
