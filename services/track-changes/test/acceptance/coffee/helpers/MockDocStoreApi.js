/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockDocUpdaterApi;
const express = require("express");
const app = express();

module.exports = (MockDocUpdaterApi = {
	docs: {},

	getAllDoc(project_id, callback) {
		if (callback == null) { callback = function(error) {}; }
		return callback(null, this.docs);
	},

	run() {
		app.get("/project/:project_id/doc", (req, res, next) => {
			return this.getAllDoc(req.params.project_id, function(error, docs) {
				if (error != null) {
					res.send(500);
				}
				if ((docs == null)) {
					return res.send(404);
				} else {
					return res.send(JSON.stringify(docs));
				}
			});
		});

		return app.listen(3016, function(error) {
			if (error != null) { throw error; }
	}).on("error", function(error) {
			console.error("error starting MockDocStoreApi:", error.message);
			return process.exit(1);
		});
	}
});

MockDocUpdaterApi.run();

