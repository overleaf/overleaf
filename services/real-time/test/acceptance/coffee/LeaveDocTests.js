/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require("chai");
const {
    expect
} = chai;
chai.should();
const sinon = require("sinon");

const RealTimeClient = require("./helpers/RealTimeClient");
const MockDocUpdaterServer = require("./helpers/MockDocUpdaterServer");
const FixturesManager = require("./helpers/FixturesManager");
const logger = require("logger-sharelatex");

const async = require("async");

describe("leaveDoc", function() {
	before(function() {
		this.lines = ["test", "doc", "lines"];
		this.version = 42;
		this.ops = ["mock", "doc", "ops"];
		sinon.spy(logger, "error");
		sinon.spy(logger, "warn");
		sinon.spy(logger, "log");
		return this.other_doc_id = FixturesManager.getRandomId();
	});
	
	after(function() {
		logger.error.restore(); // remove the spy
		logger.warn.restore();
		return logger.log.restore();
	});

	return describe("when joined to a doc", function() {
		beforeEach(function(done) {
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
					return FixturesManager.setUpDoc(this.project_id, {lines: this.lines, version: this.version, ops: this.ops}, (e, {doc_id}) => {
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
							
		describe("then leaving the doc", function() {
			beforeEach(function(done) {
				return this.client.emit("leaveDoc", this.doc_id, (error) => {
					if (error != null) { throw error; }
					return done();
				});
			});
			
			return it("should have left the doc room", function(done) {
				return RealTimeClient.getConnectedClient(this.client.socket.sessionid, (error, client) => {
					expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(false);
					return done();
				});
			});
		});

		describe("when sending a leaveDoc request before the previous joinDoc request has completed", function() {
			beforeEach(function(done) {
				this.client.emit("leaveDoc", this.doc_id, () => {});
				this.client.emit("joinDoc", this.doc_id, () => {});
				return this.client.emit("leaveDoc", this.doc_id, (error) => {
					if (error != null) { throw error; }
					return done();
				});
			});

			it("should not trigger an error", function() { return sinon.assert.neverCalledWith(logger.error, sinon.match.any, "not subscribed - shouldn't happen"); });

			return it("should have left the doc room", function(done) {
				return RealTimeClient.getConnectedClient(this.client.socket.sessionid, (error, client) => {
					expect(Array.from(client.rooms).includes(this.doc_id)).to.equal(false);
					return done();
				});
			});
		});

		return describe("when sending a leaveDoc for a room the client has not joined ", function() {
			beforeEach(function(done) {
				return this.client.emit("leaveDoc", this.other_doc_id, (error) => {
					if (error != null) { throw error; }
					return done();
				});
			});

			return it("should trigger a low level message only", function() { return sinon.assert.calledWith(logger.log, sinon.match.any, "ignoring request from client to leave room it is not in"); });
		});
	});
});
