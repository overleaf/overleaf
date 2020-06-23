/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let FixturesManager;
const RealTimeClient = require("./RealTimeClient");
const MockWebServer = require("./MockWebServer");
const MockDocUpdaterServer = require("./MockDocUpdaterServer");

module.exports = (FixturesManager = {
	setUpProject(options, callback) {
		if (options == null) { options = {}; }
		if (callback == null) { callback = function(error, data) {}; }
		if (!options.user_id) { options.user_id = FixturesManager.getRandomId(); }
		if (!options.project_id) { options.project_id = FixturesManager.getRandomId(); }
		if (!options.project) { options.project = { name: "Test Project" }; }
		const {project_id, user_id, privilegeLevel, project, publicAccess} = options;
		
		const privileges = {};
		privileges[user_id] = privilegeLevel;
		if (publicAccess) {
			privileges["anonymous-user"] = publicAccess;
		}
		
		MockWebServer.createMockProject(project_id, privileges, project);
		return MockWebServer.run(error => {
			if (error != null) { throw error; }
			return RealTimeClient.setSession({
				user: {
					_id: user_id,
					first_name: "Joe",
					last_name: "Bloggs"
				}
			}, error => {
				if (error != null) { throw error; }
				return callback(null, {project_id, user_id, privilegeLevel, project});
		});
	});
	},
				
	setUpDoc(project_id, options, callback) {
		if (options == null) { options = {}; }
		if (callback == null) { callback = function(error, data) {}; }
		if (!options.doc_id) { options.doc_id = FixturesManager.getRandomId(); }
		if (!options.lines) { options.lines = ["doc", "lines"]; }
		if (!options.version) { options.version = 42; }
		if (!options.ops) { options.ops = ["mock", "ops"]; }
		const {doc_id, lines, version, ops, ranges} = options;
				
		MockDocUpdaterServer.createMockDoc(project_id, doc_id, {lines, version, ops, ranges});
		return MockDocUpdaterServer.run(error => {
			if (error != null) { throw error; }
			return callback(null, {project_id, doc_id, lines, version, ops});
	});
	},
		
	getRandomId() {
		return require("crypto")
			.createHash("sha1")
			.update(Math.random().toString())
			.digest("hex")
			.slice(0,24);
	}
});
		