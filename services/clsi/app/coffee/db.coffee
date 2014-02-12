Sequelize = require("sequelize")
Settings = require("settings-sharelatex")

sequelize = new Sequelize(
	Settings.mysql.clsi.database,
	Settings.mysql.clsi.username,
	Settings.mysql.clsi.password,
	Settings.mysql.clsi
)

module.exports =
	UrlCache: sequelize.define("UrlCache", {
		url: Sequelize.STRING
		project_id: Sequelize.STRING
		lastModified: Sequelize.DATE
	})

	Project: sequelize.define("Project", {
		project_id: Sequelize.STRING
		lastAccessed: Sequelize.DATE
	})

	sync: () -> sequelize.sync()
	
