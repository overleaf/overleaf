/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockWebApi;
const express = require("express");
const app = express();

module.exports = (MockWebApi = {
	users: {},

	projects: {},

	getUserInfo(user_id, callback) {
		if (callback == null) { callback = function(error) {}; }
		return callback(null, this.users[user_id] || null);
	},

	getProjectDetails(project_id, callback) {
		if (callback == null) { callback = function(error, project) {}; }
		return callback(null, this.projects[project_id]);
	},

	run() {
		app.get("/user/:user_id/personal_info", (req, res, next) => {
			return this.getUserInfo(req.params.user_id, function(error, user) {
				if (error != null) {
					res.send(500);
				}
				if ((user == null)) {
					return res.send(404);
				} else {
					return res.send(JSON.stringify(user));
				}
			});
		});

		app.get("/project/:project_id/details", (req, res, next) => {
			return this.getProjectDetails(req.params.project_id, function(error, project) {
				if (error != null) {
					res.send(500);
				}
				if ((project == null)) {
					return res.send(404);
				} else {
					return res.send(JSON.stringify(project));
				}
			});
		});

		return app.listen(3000, function(error) {
			if (error != null) { throw error; }
	}).on("error", function(error) {
			console.error("error starting MockWebApiServer:", error.message);
			return process.exit(1);
		});
	}
});

MockWebApi.run();

