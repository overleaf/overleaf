Path = require('path')
http = require('http')
http.globalAgent.maxSockets = 300

# Make time interval config easier.
seconds = 1000
minutes = 60 * seconds

# These credentials are used for authenticating api requests
# between services that may need to go over public channels
httpAuthUser = "sharelatex"
httpAuthPass = "password"
httpAuthUsers = {}
httpAuthUsers[httpAuthUser] = httpAuthPass

sessionSecret = "secret-please-change"

module.exports =
	# File storage
	# ------------
	#
	# ShareLaTeX stores binary files like images in S3.
	# Fill in your Amazon S3 credential below.
	s3:
		key: ""
		secret: ""
		bucketName : ""


	# Databases
	# ---------
	mongo:
		url : 'mongodb://127.0.0.1/sharelatexTesting'

	redis:
		web:
			host: "localhost"
			port: "6379"
			password: ""

		api:
			host: "localhost"
			port: "6379"
			password: ""

	# Service locations
	# -----------------

	# Configure which ports to run each service on. Generally you
	# can leave these as they are unless you have some other services
	# running which conflict, or want to run the web process on port 80.
	internal:
		web:
			port: webPort = 3000
		documentupdater:
			port: docUpdaterPort = 3003

	# Tell each service where to find the other services. If everything
	# is running locally then this is easy, but they exist as separate config
	# options incase you want to run some services on remote hosts.
	apis:
		web:
			url: "http://localhost:#{webPort}"
			user: httpAuthUser
			pass: httpAuthPass
		documentupdater:
			url : "http://localhost:#{docUpdaterPort}"
		thirdPartyDataStore:
			url : "http://localhost:3002"
			emptyProjectFlushDelayMiliseconds: 5 * seconds
		tags:
			url :"http://localhost:3012"
		spelling:
			url : "http://localhost:3005"
		versioning:
			snapshotwaitms:3000
			url: "http://localhost:4000"
			username: httpAuthUser
			password: httpAuthPass
		recurly:
			privateKey: ""
			apiKey: ""
			subdomain: ""
		chat:
			url: "http://localhost:3010"
		templates:
			port: 3007
		blog:
			port: 3008
		filestore:
			url: "http://localhost:3009"
		clsi:
			url: "http://localhost:3013"
		templates_api:
			url: "http://localhost:3007"

	# Where your instance of ShareLaTeX can be found publically. Used in emails
	# that are sent out, generated links, etc.
	siteUrl : 'http://localhost:3000'

	# Same, but with http auth credentials.
	httpAuthSiteUrl: 'http://#{httpAuthUser}:#{httpAuthPass}@localhost:3000'

	# Security
	# --------
	security:
		sessionSecret: sessionSecret

	httpAuthUsers: httpAuthUsers

	# Default features
	# ----------------
	#
	# You can select the features that are enabled by default for new
	# new users.
	defaultFeatures: defaultFeatures =
		collaborators: -1
		dropbox: true
		versioning: true

	plans: plans = [{
		planCode: "personal"
		name: "Personal"
		price: 0
		features: defaultFeatures
	}]

	# Spelling languages
	# ------------------
	#
	# You must have the corresponding aspell package installed to 
	# be able to use a language.
	languages: [
		{name: "English", code: "en"}
	]

	# Third party services
	# --------------------
	#
	# ShareLaTeX's regular newsletter is managed by Markdown mail. Add your
	# credentials here to integrate with this.
	# markdownmail:
	# 	secret: ""
	# 	list_id: ""
	#
	# Fill in your unique token from various analytics services to enable
	# them.
	# analytics:
	# 	ga:
	# 		token: ""
	# 
	# ShareLaTeX's help desk is provided by tenderapp.com
	# tenderUrl: ""
	#

	# email:
	#	fromAddress: ""
	# 	replyTo: ""
	#	lifecycle: false
	#	ShareLaTeX uses Amazon's SES api to send transactional emails.
	#	Uncomment these lines and provide your credentials to be able to send emails.
	#	ses:
	#		"key":""
	#		"secret":""

	# Production Settings
	# -------------------

	# Should javascript assets be served minified or not. Note that you will
	# need to run `grunt compile:minify` within the web-sharelatex directory
	# to generate these.
	useMinifiedJs: false

	# Should static assets be sent with a header to tell the browser to cache
	# them.
	cacheStaticAssets: false

	# If you are running ShareLaTeX over https, set this to true to send the
	# cookie with a secure flag (recommended).
	secureCookie: false

	# Internal configs
	# ----------------
	path:
		# If we ever need to write something to disk (e.g. incoming requests
		# that need processing but may be too big for memory, then write
		# them to disk here).
		dumpFolder: Path.resolve "data/dumpFolder"
	
	# Automatic Snapshots
	# -------------------
	automaticSnapshots:
		# How long should we wait after the user last edited to 
		# take a snapshot?
		waitTimeAfterLastEdit: 5 * minutes
		# Even if edits are still taking place, this is maximum
		# time to wait before taking another snapshot.
		maxTimeBetweenSnapshots: 30 * minutes

	# Smoke test
	# ----------
	# Provide log in credentials and a project to be able to run
	# some basic smoke tests to check the core functionality.
	#
	# smokeTest:
	# 	user: ""
	# 	password: ""
	# 	projectId: ""
