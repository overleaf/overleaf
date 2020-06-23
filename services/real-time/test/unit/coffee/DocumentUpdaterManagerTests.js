/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
require('chai').should();
const sinon = require("sinon");
const SandboxedModule = require('sandboxed-module');
const path = require("path");
const modulePath = '../../../app/js/DocumentUpdaterManager';

describe('DocumentUpdaterManager', function() {
	beforeEach(function() {
		let Timer;
		this.project_id = "project-id-923";
		this.doc_id = "doc-id-394";
		this.lines = ["one", "two", "three"];
		this.version = 42;
		this.settings = {
			apis: { documentupdater: {url: "http://doc-updater.example.com"}
		},
			redis: { documentupdater: {
				key_schema: {
					pendingUpdates({doc_id}) { return `PendingUpdates:${doc_id}`; }
				}
			}
		},
			maxUpdateSize: 7 * 1024 * 1024
		};
		this.rclient = {auth() {}};

		return this.DocumentUpdaterManager = SandboxedModule.require(modulePath, {
			requires: {
				'settings-sharelatex':this.settings,
				'logger-sharelatex': (this.logger = {log: sinon.stub(), error: sinon.stub(), warn: sinon.stub()}),
				'request': (this.request = {}),
				'redis-sharelatex' : { createClient: () => this.rclient
			},
				'metrics-sharelatex': (this.Metrics = {
					summary: sinon.stub(),
					Timer: (Timer = class Timer {
						done() {}
					})
				})
			},
			globals: {
				JSON: (this.JSON = Object.create(JSON))
			}
		}
		);
	}); // avoid modifying JSON object directly

	describe("getDocument", function() {
		beforeEach(function() {
			return this.callback = sinon.stub();
		});

		describe("successfully", function() {
			beforeEach(function() {
				this.body = JSON.stringify({
					lines: this.lines,
					version: this.version,
					ops: (this.ops = ["mock-op-1", "mock-op-2"]),
					ranges: (this.ranges = {"mock": "ranges"})});
				this.fromVersion = 2;
				this.request.get = sinon.stub().callsArgWith(1, null, {statusCode: 200}, this.body);
				return this.DocumentUpdaterManager.getDocument(this.project_id, this.doc_id, this.fromVersion, this.callback);
			});

			it('should get the document from the document updater', function() {
				const url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}?fromVersion=${this.fromVersion}`;
				return this.request.get.calledWith(url).should.equal(true);
			});

			return it("should call the callback with the lines, version, ranges and ops", function() {
				return this.callback.calledWith(null, this.lines, this.version, this.ranges, this.ops).should.equal(true);
			});
		});

		describe("when the document updater API returns an error", function() {
			beforeEach(function() {
				this.request.get = sinon.stub().callsArgWith(1, (this.error = new Error("something went wrong")), null, null);
				return this.DocumentUpdaterManager.getDocument(this.project_id, this.doc_id, this.fromVersion, this.callback);
			});

			return it("should return an error to the callback", function() {
				return this.callback.calledWith(this.error).should.equal(true);
			});
		});

		[404, 422].forEach(statusCode => describe(`when the document updater returns a ${statusCode} status code`, function() {
            beforeEach(function() {
                this.request.get = sinon.stub().callsArgWith(1, null, { statusCode }, "");
                return this.DocumentUpdaterManager.getDocument(this.project_id, this.doc_id, this.fromVersion, this.callback);
            });

            return it("should return the callback with an error", function() {
                this.callback.called.should.equal(true);
                const err = this.callback.getCall(0).args[0];
                err.should.have.property('statusCode', statusCode);
                err.should.have.property('message', "doc updater could not load requested ops");
                this.logger.error.called.should.equal(false);
                return this.logger.warn.called.should.equal(true);
            });
        }));

		return describe("when the document updater returns a failure error code", function() {
			beforeEach(function() {
				this.request.get = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "");
				return this.DocumentUpdaterManager.getDocument(this.project_id, this.doc_id, this.fromVersion, this.callback);
			});

			return it("should return the callback with an error", function() {
				this.callback.called.should.equal(true);
				const err = this.callback.getCall(0).args[0];
				err.should.have.property('statusCode', 500);
				err.should.have.property('message', "doc updater returned a non-success status code: 500");
				return this.logger.error.called.should.equal(true);
			});
		});
	});

	describe('flushProjectToMongoAndDelete', function() {
		beforeEach(function() {
			return this.callback = sinon.stub();
		});

		describe("successfully", function() {
			beforeEach(function() {
				this.request.del = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "");
				return this.DocumentUpdaterManager.flushProjectToMongoAndDelete(this.project_id, this.callback);
			});

			it('should delete the project from the document updater', function() {
				const url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}?background=true`;
				return this.request.del.calledWith(url).should.equal(true);
			});

			return it("should call the callback with no error", function() {
				return this.callback.calledWith(null).should.equal(true);
			});
		});

		describe("when the document updater API returns an error", function() {
			beforeEach(function() {
				this.request.del = sinon.stub().callsArgWith(1, (this.error = new Error("something went wrong")), null, null);
				return this.DocumentUpdaterManager.flushProjectToMongoAndDelete(this.project_id, this.callback);
			});

			return it("should return an error to the callback", function() {
				return this.callback.calledWith(this.error).should.equal(true);
			});
		});

		return describe("when the document updater returns a failure error code", function() {
			beforeEach(function() {
				this.request.del = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "");
				return this.DocumentUpdaterManager.flushProjectToMongoAndDelete(this.project_id, this.callback);
			});

			return it("should return the callback with an error", function() {
				this.callback.called.should.equal(true);
				const err = this.callback.getCall(0).args[0];
				err.should.have.property('statusCode', 500);
				return err.should.have.property('message', "document updater returned a failure status code: 500");
			});
		});
	});

	return describe('queueChange', function() {
		beforeEach(function() {
			this.change = {
				"doc":"1234567890",
				"op":[{"d":"test", "p":345}],
				"v": 789
			};
			this.rclient.rpush = sinon.stub().yields();
			return this.callback = sinon.stub();
		});

		describe("successfully", function() {
			beforeEach(function() {
				return this.DocumentUpdaterManager.queueChange(this.project_id, this.doc_id, this.change, this.callback);
			});

			it("should push the change", function() {
				return this.rclient.rpush
					.calledWith(`PendingUpdates:${this.doc_id}`, JSON.stringify(this.change))
					.should.equal(true);
			});

			return it("should notify the doc updater of the change via the pending-updates-list queue", function() {
				return this.rclient.rpush
					.calledWith("pending-updates-list", `${this.project_id}:${this.doc_id}`)
					.should.equal(true);
			});
		});

		describe("with error talking to redis during rpush", function() {
			beforeEach(function() {
				this.rclient.rpush = sinon.stub().yields(new Error("something went wrong"));
				return this.DocumentUpdaterManager.queueChange(this.project_id, this.doc_id, this.change, this.callback);
			});

			return it("should return an error", function() {
				return this.callback.calledWithExactly(sinon.match(Error)).should.equal(true);
			});
		});

		describe("with null byte corruption", function() {
			beforeEach(function() {
				this.JSON.stringify = () => '["bad bytes! \u0000 <- here"]';
				return this.DocumentUpdaterManager.queueChange(this.project_id, this.doc_id, this.change, this.callback);
			});

			it("should return an error", function() {
				return this.callback.calledWithExactly(sinon.match(Error)).should.equal(true);
			});

			return it("should not push the change onto the pending-updates-list queue", function() {
				return this.rclient.rpush.called.should.equal(false);
			});
		});

		describe("when the update is too large", function() {
			beforeEach(function() {
				this.change = {op: {p: 12,t: "update is too large".repeat(1024 * 400)}};
				return this.DocumentUpdaterManager.queueChange(this.project_id, this.doc_id, this.change, this.callback);
			});

			it("should return an error", function() {
				return this.callback.calledWithExactly(sinon.match(Error)).should.equal(true);
			});

			it("should add the size to the error", function() {
				return this.callback.args[0][0].updateSize.should.equal(7782422);
			});

			return it("should not push the change onto the pending-updates-list queue", function() {
				return this.rclient.rpush.called.should.equal(false);
			});
		});

		return describe("with invalid keys", function() {
			beforeEach(function() {
				this.change = {
					"op":[{"d":"test", "p":345}],
					"version": 789 // not a valid key
				};
				return this.DocumentUpdaterManager.queueChange(this.project_id, this.doc_id, this.change, this.callback);
			});

			return it("should remove the invalid keys from the change", function() {
				return this.rclient.rpush
					.calledWith(`PendingUpdates:${this.doc_id}`, JSON.stringify({op:this.change.op}))
					.should.equal(true);
			});
		});
	});
});
