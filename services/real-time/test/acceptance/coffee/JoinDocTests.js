/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require("chai");
const {
    expect
} = chai;
chai.should();

const RealTimeClient = require("./helpers/RealTimeClient");
const MockDocUpdaterServer = require("./helpers/MockDocUpdaterServer");
const FixturesManager = require("./helpers/FixturesManager");

const async = require("async");

describe("joinDoc", function() {
	before(function() {
		this.lines = ["test", "doc", "lines"];
		this.version = 42;
		this.ops = ["mock", "doc", "ops"];
		return this.ranges = {"mock": "ranges"};});
			
	describe("when authorised readAndWrite", function() {
		before(function(done) {
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "readAndWrite"
					}, (e, {project_id, user_id}) => {
						this.project_id = project_id;
						this.user_id = user_id;
						return cb(e);
					});
				},
					
				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops, ranges: this.ranges}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.client = RealTimeClient.connect();
					return this.client.on("connectionAccepted", cb);
				},
						
				cb => {
					return this.client.emit("joinProject", {project_id: this.project_id}, cb);
				},
				
				cb => {
					return this.client.emit("joinDoc", this.doc_id, (error, ...rest) => { [...this.returnedArgs] = Array.from(rest); return cb(error); });
				}
			], done);
		});

		it("should get the doc from the doc updater", function() {
			return MockDocUpdaterServer.getDocument
				.calledWith(this.project_id, this.doc_id, -1)
				.should.equal(true);
		});
		
		it("should return the doc lines, version, ranges and ops", function() {
			return this.returnedArgs.should.deep.equal([this.lines, this.version, this.ops, this.ranges]);
	});
			
		return it("should have joined the doc room", function(done) {
			return RealTimeClient.getConnectedClient(this.client.socket.sessionid, (error, client) => {
				expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true);
				return done();
			});
		});
	});
		
	describe("when authorised readOnly", function() {
		before(function(done) {
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "readOnly"
					}, (e, {project_id, user_id}) => {
						this.project_id = project_id;
						this.user_id = user_id;
						return cb(e);
					});
				},
					
				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops, ranges: this.ranges}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.client = RealTimeClient.connect();
					return this.client.on("connectionAccepted", cb);
				},
						
				cb => {
					return this.client.emit("joinProject", {project_id: this.project_id}, cb);
				},
				
				cb => {
					return this.client.emit("joinDoc", this.doc_id, (error, ...rest) => { [...this.returnedArgs] = Array.from(rest); return cb(error); });
				}
			], done);
		});

		it("should get the doc from the doc updater", function() {
			return MockDocUpdaterServer.getDocument
				.calledWith(this.project_id, this.doc_id, -1)
				.should.equal(true);
		});
		
		it("should return the doc lines, version, ranges and ops", function() {
			return this.returnedArgs.should.deep.equal([this.lines, this.version, this.ops, this.ranges]);
	});
			
		return it("should have joined the doc room", function(done) {
			return RealTimeClient.getConnectedClient(this.client.socket.sessionid, (error, client) => {
				expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true);
				return done();
			});
		});
	});
		
	describe("when authorised as owner", function() {
		before(function(done) {
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "owner"
					}, (e, {project_id, user_id}) => {
						this.project_id = project_id;
						this.user_id = user_id;
						return cb(e);
					});
				},
					
				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops, ranges: this.ranges}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.client = RealTimeClient.connect();
					return this.client.on("connectionAccepted", cb);
				},
						
				cb => {
					return this.client.emit("joinProject", {project_id: this.project_id}, cb);
				},
				
				cb => {
					return this.client.emit("joinDoc", this.doc_id, (error, ...rest) => { [...this.returnedArgs] = Array.from(rest); return cb(error); });
				}
			], done);
		});

		it("should get the doc from the doc updater", function() {
			return MockDocUpdaterServer.getDocument
				.calledWith(this.project_id, this.doc_id, -1)
				.should.equal(true);
		});
		
		it("should return the doc lines, version, ranges and ops", function() {
			return this.returnedArgs.should.deep.equal([this.lines, this.version, this.ops, this.ranges]);
	});
			
		return it("should have joined the doc room", function(done) {
			return RealTimeClient.getConnectedClient(this.client.socket.sessionid, (error, client) => {
				expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true);
				return done();
			});
		});
	});

	// It is impossible to write an acceptance test to test joining an unauthorized
	// project, since joinProject already catches that. If you can join a project,
	// then you can join a doc in that project.
			
	describe("with a fromVersion", function() {
		before(function(done) {
			this.fromVersion = 36;
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "readAndWrite"
					}, (e, {project_id, user_id}) => {
						this.project_id = project_id;
						this.user_id = user_id;
						return cb(e);
					});
				},
					
				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops, ranges: this.ranges}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.client = RealTimeClient.connect();
					return this.client.on("connectionAccepted", cb);
				},
						
				cb => {
					return this.client.emit("joinProject", {project_id: this.project_id}, cb);
				},
				
				cb => {
					return this.client.emit("joinDoc", this.doc_id, this.fromVersion, (error, ...rest) => { [...this.returnedArgs] = Array.from(rest); return cb(error); });
				}
			], done);
		});

		it("should get the doc from the doc updater with the fromVersion", function() {
			return MockDocUpdaterServer.getDocument
				.calledWith(this.project_id, this.doc_id, this.fromVersion)
				.should.equal(true);
		});
		
		it("should return the doc lines, version, ranges and ops", function() {
			return this.returnedArgs.should.deep.equal([this.lines, this.version, this.ops, this.ranges]);
	});
			
		return it("should have joined the doc room", function(done) {
			return RealTimeClient.getConnectedClient(this.client.socket.sessionid, (error, client) => {
				expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true);
				return done();
			});
		});
	});

	describe("with options", function() {
		before(function(done) {
			this.options = { encodeRanges: true };
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "readAndWrite"
					}, (e, {project_id, user_id}) => {
						this.project_id = project_id;
						this.user_id = user_id;
						return cb(e);
					});
				},

				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops, ranges: this.ranges}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.client = RealTimeClient.connect();
					return this.client.on("connectionAccepted", cb);
				},

				cb => {
					return this.client.emit("joinProject", {project_id: this.project_id}, cb);
				},

				cb => {
					return this.client.emit("joinDoc", this.doc_id, this.options, (error, ...rest) => { [...this.returnedArgs] = Array.from(rest); return cb(error); });
				}
			], done);
		});

		it("should get the doc from the doc updater with the default fromVersion", function() {
			return MockDocUpdaterServer.getDocument
				.calledWith(this.project_id, this.doc_id, -1)
				.should.equal(true);
		});

		it("should return the doc lines, version, ranges and ops", function() {
			return this.returnedArgs.should.deep.equal([this.lines, this.version, this.ops, this.ranges]);
	});

		return it("should have joined the doc room", function(done) {
			return RealTimeClient.getConnectedClient(this.client.socket.sessionid, (error, client) => {
				expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true);
				return done();
			});
		});
	});

	return describe("with fromVersion and options", function() {
		before(function(done) {
			this.fromVersion = 36;
			this.options = { encodeRanges: true };
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "readAndWrite"
					}, (e, {project_id, user_id}) => {
						this.project_id = project_id;
						this.user_id = user_id;
						return cb(e);
					});
				},

				cb => {
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops, ranges: this.ranges}, (e, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(e);
					});
				},

				cb => {
					this.client = RealTimeClient.connect();
					return this.client.on("connectionAccepted", cb);
				},

				cb => {
					return this.client.emit("joinProject", {project_id: this.project_id}, cb);
				},

				cb => {
					return this.client.emit("joinDoc", this.doc_id, this.fromVersion, this.options, (error, ...rest) => { [...this.returnedArgs] = Array.from(rest); return cb(error); });
				}
			], done);
		});

		it("should get the doc from the doc updater with the fromVersion", function() {
			return MockDocUpdaterServer.getDocument
				.calledWith(this.project_id, this.doc_id, this.fromVersion)
				.should.equal(true);
		});

		it("should return the doc lines, version, ranges and ops", function() {
			return this.returnedArgs.should.deep.equal([this.lines, this.version, this.ops, this.ranges]);
	});

		return it("should have joined the doc room", function(done) {
			return RealTimeClient.getConnectedClient(this.client.socket.sessionid, (error, client) => {
				expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(true);
				return done();
			});
		});
	});
});
