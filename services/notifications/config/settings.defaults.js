let Settings;
module.exports = (Settings = {
	internal: {
		notifications: {
			port: 3042,
			host: process.env["LISTEN_ADDRESS"] || "localhost"
		}
	},

	mongo: {
		url: process.env['MONGO_CONNECTION_STRING'] || `mongodb://${process.env["MONGO_HOST"] || "localhost"}/sharelatex`
	}
});
