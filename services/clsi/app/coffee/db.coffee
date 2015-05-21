Sequelize = require("sequelize")
Settings = require("settings-sharelatex")
_ = require("underscore")

options = _.extend {logging:false}, Settings.mysql.clsi

sequelize = new Sequelize(
	Settings.mysql.clsi.database,
	Settings.mysql.clsi.username,
	Settings.mysql.clsi.password,
	options
)

module.exports =
	UrlCache: sequelize.define("UrlCache", {
		url: Sequelize.STRING
		project_id: Sequelize.STRING
		lastModified: Sequelize.DATE
	}, {
		indexes: [
			{fields: ['url', 'project_id']},
			{fields: ['project_id']}
		]
	})

	Project: sequelize.define("Project", {
		project_id: {type: Sequelize.STRING, primaryKey: true}
		lastAccessed: Sequelize.DATE
	}, {
		indexes: [
			{fields: ['lastAccessed']}
		]
	})

	sync: () -> sequelize.sync()
	
