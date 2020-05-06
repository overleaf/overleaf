/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
const modulePath = "../../../../app/js/ProjectManager.js";
const SandboxedModule = require('sandboxed-module');
const _ = require('lodash');

describe("ProjectManager", function() {
	beforeEach(function() {
		let Timer;
		this.ProjectManager = SandboxedModule.require(modulePath, { requires: {
			"./RedisManager": (this.RedisManager = {}),
			"./ProjectHistoryRedisManager": (this.ProjectHistoryRedisManager = {}),
			"./DocumentManager": (this.DocumentManager = {}),
			"logger-sharelatex": (this.logger = { log: sinon.stub(), error: sinon.stub() }),
			"./HistoryManager": (this.HistoryManager = {}),
			"./Metrics": (this.Metrics = {
				Timer: (Timer = (function() {
					Timer = class Timer {
						static initClass() {
							this.prototype.done = sinon.stub();
						}
					};
					Timer.initClass();
					return Timer;
				})())
			})
		}
	}
		);

		this.project_id = "project-id-123";
		this.projectHistoryId = 'history-id-123';
		this.user_id = "user-id-123";
		this.version = 1234567;
		this.HistoryManager.shouldFlushHistoryOps = sinon.stub().returns(false);
		this.HistoryManager.flushProjectChangesAsync = sinon.stub();
		return this.callback = sinon.stub();
	});

	return describe("updateProjectWithLocks", function() {
		describe("rename operations", function() {
			beforeEach(function() {
				this.firstDocUpdate = {
					id: 1,
					pathname: 'foo',
					newPathname: 'foo'
				};
				this.secondDocUpdate = {
					id: 2,
					pathname: 'bar',
					newPathname: 'bar2'
				};
				this.docUpdates = [ this.firstDocUpdate, this.secondDocUpdate ];
				this.firstFileUpdate = {
					id: 2,
					pathname: 'bar',
					newPathname: 'bar2'
				};
				this.fileUpdates = [ this.firstFileUpdate ];
				this.DocumentManager.renameDocWithLock = sinon.stub().yields();
				return this.ProjectHistoryRedisManager.queueRenameEntity = sinon.stub().yields();
			});

			describe("successfully", function() {
				beforeEach(function() {
					return this.ProjectManager.updateProjectWithLocks(this.project_id, this.projectHistoryId, this.user_id, this.docUpdates, this.fileUpdates, this.version, this.callback);
				});

				it("should rename the docs in the updates", function() {
					const firstDocUpdateWithVersion = _.extend({}, this.firstDocUpdate, {version: `${this.version}.0`});
					const secondDocUpdateWithVersion = _.extend({}, this.secondDocUpdate, {version: `${this.version}.1`});
					this.DocumentManager.renameDocWithLock
						.calledWith(this.project_id, this.firstDocUpdate.id, this.user_id, firstDocUpdateWithVersion, this.projectHistoryId)
						.should.equal(true);
					return this.DocumentManager.renameDocWithLock
						.calledWith(this.project_id, this.secondDocUpdate.id, this.user_id, secondDocUpdateWithVersion, this.projectHistoryId)
						.should.equal(true);
				});

				it("should rename the files in the updates", function() {
					const firstFileUpdateWithVersion = _.extend({}, this.firstFileUpdate, {version: `${this.version}.2`});
					return this.ProjectHistoryRedisManager.queueRenameEntity
						.calledWith(this.project_id, this.projectHistoryId, 'file', this.firstFileUpdate.id, this.user_id, firstFileUpdateWithVersion)
						.should.equal(true);
				});

				it("should not flush the history", function() {
					return this.HistoryManager.flushProjectChangesAsync
						.calledWith(this.project_id)
						.should.equal(false);
				});

				return it("should call the callback", function() {
					return this.callback.called.should.equal(true);
				});
			});

			describe("when renaming a doc fails", function() {
				beforeEach(function() {
					this.error = new Error('error');
					this.DocumentManager.renameDocWithLock = sinon.stub().yields(this.error);
					return this.ProjectManager.updateProjectWithLocks(this.project_id, this.projectHistoryId, this.user_id, this.docUpdates, this.fileUpdates, this.version, this.callback);
				});

				return it("should call the callback with the error", function() {
					return this.callback.calledWith(this.error).should.equal(true);
				});
			});

			describe("when renaming a file fails", function() {
				beforeEach(function() {
					this.error = new Error('error');
					this.ProjectHistoryRedisManager.queueRenameEntity = sinon.stub().yields(this.error);
					return this.ProjectManager.updateProjectWithLocks(this.project_id, this.projectHistoryId, this.user_id, this.docUpdates, this.fileUpdates, this.version, this.callback);
				});

				return it("should call the callback with the error", function() {
					return this.callback.calledWith(this.error).should.equal(true);
				});
			});

			return describe("with enough ops to flush", function() {
				beforeEach(function() {
					this.HistoryManager.shouldFlushHistoryOps = sinon.stub().returns(true);
					return this.ProjectManager.updateProjectWithLocks(this.project_id, this.projectHistoryId, this.user_id, this.docUpdates, this.fileUpdates, this.version, this.callback);
				});

				return it("should flush the history", function() {
					return this.HistoryManager.flushProjectChangesAsync
						.calledWith(this.project_id)
						.should.equal(true);
				});
			});
		});

		return describe("add operations", function() {
			beforeEach(function() {
				this.firstDocUpdate = {
					id: 1,
					docLines: "a\nb"
				};
				this.secondDocUpdate = {
					id: 2,
					docLines: "a\nb"
				};
				this.docUpdates = [ this.firstDocUpdate, this.secondDocUpdate ];
				this.firstFileUpdate = {
					id: 3,
					url: 'filestore.example.com/2'
				};
				this.secondFileUpdate = {
					id: 4,
					url: 'filestore.example.com/3'
				};
				this.fileUpdates = [ this.firstFileUpdate, this.secondFileUpdate ];
				return this.ProjectHistoryRedisManager.queueAddEntity = sinon.stub().yields();
			});

			describe("successfully", function() {
				beforeEach(function() {
					return this.ProjectManager.updateProjectWithLocks(this.project_id, this.projectHistoryId, this.user_id, this.docUpdates, this.fileUpdates, this.version, this.callback);
				});

				it("should add the docs in the updates", function() {
					const firstDocUpdateWithVersion = _.extend({}, this.firstDocUpdate, {version: `${this.version}.0`});
					const secondDocUpdateWithVersion = _.extend({}, this.secondDocUpdate, {version: `${this.version}.1`});
					this.ProjectHistoryRedisManager.queueAddEntity.getCall(0)
						.calledWith(this.project_id, this.projectHistoryId, 'doc', this.firstDocUpdate.id, this.user_id, firstDocUpdateWithVersion)
						.should.equal(true);
					return this.ProjectHistoryRedisManager.queueAddEntity.getCall(1)
						.calledWith(this.project_id, this.projectHistoryId, 'doc', this.secondDocUpdate.id, this.user_id, secondDocUpdateWithVersion)
						.should.equal(true);
				});

				it("should add the files in the updates", function() {
					const firstFileUpdateWithVersion = _.extend({}, this.firstFileUpdate, {version: `${this.version}.2`});
					const secondFileUpdateWithVersion = _.extend({}, this.secondFileUpdate, {version: `${this.version}.3`});
					this.ProjectHistoryRedisManager.queueAddEntity.getCall(2)
						.calledWith(this.project_id, this.projectHistoryId, 'file', this.firstFileUpdate.id, this.user_id, firstFileUpdateWithVersion)
						.should.equal(true);
					return this.ProjectHistoryRedisManager.queueAddEntity.getCall(3)
						.calledWith(this.project_id, this.projectHistoryId, 'file', this.secondFileUpdate.id, this.user_id, secondFileUpdateWithVersion)
						.should.equal(true);
				});

				it("should not flush the history", function() {
					return this.HistoryManager.flushProjectChangesAsync
						.calledWith(this.project_id)
						.should.equal(false);
				});

				return it("should call the callback", function() {
					return this.callback.called.should.equal(true);
				});
			});

			describe("when adding a doc fails", function() {
				beforeEach(function() {
					this.error = new Error('error');
					this.ProjectHistoryRedisManager.queueAddEntity = sinon.stub().yields(this.error);
					return this.ProjectManager.updateProjectWithLocks(this.project_id, this.projectHistoryId, this.user_id, this.docUpdates, this.fileUpdates, this.version, this.callback);
				});

				return it("should call the callback with the error", function() {
					return this.callback.calledWith(this.error).should.equal(true);
				});
			});

			describe("when adding a file fails", function() {
				beforeEach(function() {
					this.error = new Error('error');
					this.ProjectHistoryRedisManager.queueAddEntity = sinon.stub().yields(this.error);
					return this.ProjectManager.updateProjectWithLocks(this.project_id, this.projectHistoryId, this.user_id, this.docUpdates, this.fileUpdates, this.version, this.callback);
				});

				return it("should call the callback with the error", function() {
					return this.callback.calledWith(this.error).should.equal(true);
				});
			});

			return describe("with enough ops to flush", function() {
				beforeEach(function() {
					this.HistoryManager.shouldFlushHistoryOps = sinon.stub().returns(true);
					return this.ProjectManager.updateProjectWithLocks(this.project_id, this.projectHistoryId, this.user_id, this.docUpdates, this.fileUpdates, this.version, this.callback);
				});

				return it("should flush the history", function() {
					return this.HistoryManager.flushProjectChangesAsync
						.calledWith(this.project_id)
						.should.equal(true);
				});
			});
		});
	});
});
