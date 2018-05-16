module.exports =
	apis:
		v1:
			url: "http://localhost:5000"
			user: 'overleaf'
			pass: 'password'

	enableSubscriptions: true

	features: features =
		v1_free:
			collaborators: 1
			dropbox: false
			versioning: false
			github: true
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
			templates: true
			references: true
			referencesSearch: true
			mendeley: true
			compileTimeout: 180
			compileGroup: "priority"
			trackChanges: true

	defaultFeatures: features.personal
	defaultPlanCode: 'personal'

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
