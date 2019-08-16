v1Api =
	url: "http://#{process.env['V1_HOST'] or 'localhost'}:5000"

module.exports =
	enableSubscriptions: true

	apis:
		recurly:
			# Set up our own mock recurly server
			url: 'http://localhost:6034'
			subdomain: 'test'

	# for registration via SL, set enableLegacyRegistration to true
	# for registration via Overleaf v1, set enableLegacyLogin to true

	# Currently, acceptance tests require enableLegacyRegistration.
	enableLegacyRegistration: true

	features: features =
		v1_free:
			collaborators: 1
			dropbox: false
			versioning: false
			github: true
			gitBridge: true
			templates: false
			references: false
			referencesSearch: false
			mendeley: true
			compileTimeout: 60
			compileGroup: "standard"
			trackChanges: false
		personal:
			collaborators: 1
			dropbox: false
			versioning: false
			github: false
			gitBridge: false
			templates: false
			references: false
			referencesSearch: false
			mendeley: false
			compileTimeout: 60
			compileGroup: "standard"
			trackChanges: false
		collaborator:
			collaborators: 10
			dropbox: true
			versioning: true
			github: true
			gitBridge: true
			templates: true
			references: true
			referencesSearch: true
			mendeley: true
			compileTimeout: 180
			compileGroup: "priority"
			trackChanges: true
		professional:
			collaborators: -1
			dropbox: true
			versioning: true
			github: true
			gitBridge: true
			templates: true
			references: true
			referencesSearch: true
			mendeley: true
			compileTimeout: 180
			compileGroup: "priority"
			trackChanges: true

	defaultFeatures: features.personal
	defaultPlanCode: 'personal'
	institutionPlanCode: 'professional'

	plans: plans = [{
		planCode: "v1_free"
		name: "V1 Free"
		price: 0
		features: features.v1_free
	},{
		planCode: "personal"
		name: "Personal"
		price: 0
		features: features.personal
	},{
		planCode: "collaborator"
		name: "Collaborator"
		price: 1500
		features: features.collaborator
	},{
		planCode: "professional"
		name: "Professional"
		price: 3000
		features: features.professional
	}]

	bonus_features:
		1:
			collaborators: 2
			dropbox: false
			versioning: false
		3:
			collaborators: 4
			dropbox: false
			versioning: false
		6:
			collaborators: 4
			dropbox: true
			versioning: true
		9:
			collaborators: -1
			dropbox: true
			versioning: true

	proxyUrls:
		'/institutions/list': { baseUrl: v1Api.url, path: '/universities/list' }
		'/institutions/list/:id':
			baseUrl: v1Api.url
			path: (params) -> "/universities/list/#{params.id}"
		'/institutions/domains': { baseUrl: v1Api.url, path: '/university/domains' }
		'/proxy/missing/baseUrl': path: '/foo/bar'
		'/proxy/get_and_post': {
			methods: ['get', 'post'],
			path: '/destination/get_and_post'
		}

	redirects:
		'/redirect/one': '/destination/one',
		'/redirect/get_and_post': {
			methods: ['get', 'post'],
			url: '/destination/get_and_post'
		},
		'/redirect/base_url': {
			baseUrl: 'https://example.com'
			url: '/destination/base_url'
		},
		'/redirect/params/:id': {
			url: (params) -> "/destination/#{params.id}/params"
		},
		'/redirect/qs': '/destination/qs'
		'/docs_v1': {
			url: '/docs'
		}

	oauthProviders:
		'provider': {
			name: 'provider'
		},
		'collabratec': {
			name: 'collabratec'
		}
		'google': {
			name: 'google'
		},
  # setting to true since many features are enabled/disabled after availability of this
  # property (check Features.js)
	overleaf: true
