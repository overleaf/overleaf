/* eslint-disable
    camelcase,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const RealTimeClient = require("./helpers/RealTimeClient");
const MockDocUpdaterServer = require("./helpers/MockDocUpdaterServer");
const FixturesManager = require("./helpers/FixturesManager");

const async = require("async");

const settings = require("settings-sharelatex");
const redis = require("redis-sharelatex");
const rclient = redis.createClient(settings.redis.pubsub);

describe("PubSubRace", function() {
	before(function(done) { return MockDocUpdaterServer.run(done); });

	describe("when the client leaves a doc before joinDoc completes", function() {
		before(function(done) {
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "owner",
						project: {
							name: "Test Project"
						}
					}, (e, {project_id, user_id}) => { this.project_id = project_id; this.user_id = user_id; return cb(); });
				},

				cb => {
					this.clientA = RealTimeClient.connect();
					return this.clientA.on("connect", cb);
				},

				cb => {
					return this.clientA.emit("joinProject", {project_id: this.project_id}, (error, project, privilegeLevel, protocolVersion) => {
						this.project = project;
						this.privilegeLevel = privilegeLevel;
						this.protocolVersion = protocolVersion;
						return cb(error);
					});
				},

				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					// leave before joinDoc completes
					return this.clientA.emit("leaveDoc", this.doc_id, cb);
				},

				cb => {
					// wait for subscribe and unsubscribe
					return setTimeout(cb, 100);
				}
			], done);
		});

		return it("should not subscribe to the applied-ops channels anymore", function(done) {
			rclient.pubsub('CHANNELS', (err, resp) => {
				if (err) { return done(err); }
				resp.should.not.include(`applied-ops:${this.doc_id}`);
				return done();
			});
			return null;
		});
	});

	describe("when the client emits joinDoc and leaveDoc requests frequently and leaves eventually", function() {
		before(function(done) {
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "owner",
						project: {
							name: "Test Project"
						}
					}, (e, {project_id, user_id}) => { this.project_id = project_id; this.user_id = user_id; return cb(); });
				},

				cb => {
					this.clientA = RealTimeClient.connect();
					return this.clientA.on("connect", cb);
				},

				cb => {
					return this.clientA.emit("joinProject", {project_id: this.project_id}, (error, project, privilegeLevel, protocolVersion) => {
						this.project = project;
						this.privilegeLevel = privilegeLevel;
						this.protocolVersion = protocolVersion;
						return cb(error);
					});
				},

				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					this.clientA.emit("leaveDoc", this.doc_id, () => {});
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					this.clientA.emit("leaveDoc", this.doc_id, () => {});
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					this.clientA.emit("leaveDoc", this.doc_id, () => {});
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					this.clientA.emit("leaveDoc", this.doc_id, () => {});
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					return this.clientA.emit("leaveDoc", this.doc_id, cb);
				},

				cb => {
					// wait for subscribe and unsubscribe
					return setTimeout(cb, 100);
				}
			], done);
		});

		return it("should not subscribe to the applied-ops channels anymore", function(done) {
			rclient.pubsub('CHANNELS', (err, resp) => {
				if (err) { return done(err); }
				resp.should.not.include(`applied-ops:${this.doc_id}`);
				return done();
			});
			return null;
		});
	});

	describe("when the client emits joinDoc and leaveDoc requests frequently and remains in the doc", function() {
		before(function(done) {
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "owner",
						project: {
							name: "Test Project"
						}
					}, (e, {project_id, user_id}) => { this.project_id = project_id; this.user_id = user_id; return cb(); });
				},

				cb => {
					this.clientA = RealTimeClient.connect();
					return this.clientA.on("connect", cb);
				},

				cb => {
					return this.clientA.emit("joinProject", {project_id: this.project_id}, (error, project, privilegeLevel, protocolVersion) => {
						this.project = project;
						this.privilegeLevel = privilegeLevel;
						this.protocolVersion = protocolVersion;
						return cb(error);
					});
				},

				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					this.clientA.emit("leaveDoc", this.doc_id, () => {});
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					this.clientA.emit("leaveDoc", this.doc_id, () => {});
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					this.clientA.emit("leaveDoc", this.doc_id, () => {});
					this.clientA.emit("joinDoc", this.doc_id, () => {});
					this.clientA.emit("leaveDoc", this.doc_id, () => {});
					return this.clientA.emit("joinDoc", this.doc_id, cb);
				},

				cb => {
					// wait for subscribe and unsubscribe
					return setTimeout(cb, 100);
				}
			], done);
		});

		return it("should subscribe to the applied-ops channels", function(done) {
			rclient.pubsub('CHANNELS', (err, resp) => {
				if (err) { return done(err); }
				resp.should.include(`applied-ops:${this.doc_id}`);
				return done();
			});
			return null;
		});
	});

	return describe("when the client disconnects before joinDoc completes", function() {
		before(function(done) {
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "owner",
						project: {
							name: "Test Project"
						}
					}, (e, {project_id, user_id}) => { this.project_id = project_id; this.user_id = user_id; return cb(); });
				},

				cb => {
					this.clientA = RealTimeClient.connect();
					return this.clientA.on("connect", cb);
				},

				cb => {
					return this.clientA.emit("joinProject", {project_id: this.project_id}, (error, project, privilegeLevel, protocolVersion) => {
						this.project = project;
						this.privilegeLevel = privilegeLevel;
						this.protocolVersion = protocolVersion;
						return cb(error);
					});
				},

				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					let joinDocCompleted = false;
					this.clientA.emit("joinDoc", this.doc_id, () => joinDocCompleted = true);
					// leave before joinDoc completes
					return setTimeout(() => {
						if (joinDocCompleted) {
							return cb(new Error('joinDocCompleted -- lower timeout'));
						}
						this.clientA.on("disconnect", () => cb());
						return this.clientA.disconnect();
					}
					// socket.io processes joinDoc and disconnect with different delays:
					//  - joinDoc goes through two process.nextTick
					//  - disconnect goes through one process.nextTick
					// We have to inject the disconnect event into a different event loop
					//  cycle.
					, 3);
				},

				cb => {
					// wait for subscribe and unsubscribe
					return setTimeout(cb, 100);
				}
			], done);
		});

		it("should not subscribe to the editor-events channels anymore", function(done) {
			rclient.pubsub('CHANNELS', (err, resp) => {
				if (err) { return done(err); }
				resp.should.not.include(`editor-events:${this.project_id}`);
				return done();
			});
			return null;
		});

		return it("should not subscribe to the applied-ops channels anymore", function(done) {
			rclient.pubsub('CHANNELS', (err, resp) => {
				if (err) { return done(err); }
				resp.should.not.include(`applied-ops:${this.doc_id}`);
				return done();
			});
			return null;
		});
	});
});
