/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require("logger-sharelatex");
const {
    assert
} = require("chai");
const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
const {
    expect
} = chai;
const modulePath = "../../../app/js/PersistorManager.js";
const SandboxedModule = require('sandboxed-module');


describe("PersistorManagerTests", function() {

	beforeEach(function() {
		return this.S3PersistorManager = {
			getFileStream: sinon.stub(),
			checkIfFileExists: sinon.stub(),
			deleteFile: sinon.stub(),
			deleteDirectory: sinon.stub(),
			sendStream: sinon.stub(),
			insertFile: sinon.stub()
		};
	});

	describe("test s3 mixin", function() {
		beforeEach(function() {
			this.settings = {
				filestore: {
					backend: "s3"
				}
			};
			this.requires = {
				"./S3PersistorManager": this.S3PersistorManager,
				"settings-sharelatex": this.settings,
				"logger-sharelatex": {
					log() {},
					err() {}
				}
			};
			return this.PersistorManager = SandboxedModule.require(modulePath, {requires: this.requires});
		});

		it("should load getFileStream", function(done) {
			this.PersistorManager.should.respondTo("getFileStream");
			this.PersistorManager.getFileStream();
			this.S3PersistorManager.getFileStream.calledOnce.should.equal(true);
			return done();
		});

		it("should load checkIfFileExists", function(done) {
			this.PersistorManager.checkIfFileExists();
			this.S3PersistorManager.checkIfFileExists.calledOnce.should.equal(true);
			return done();
		});

		it("should load deleteFile", function(done) {
			this.PersistorManager.deleteFile();
			this.S3PersistorManager.deleteFile.calledOnce.should.equal(true);
			return done();
		});

		it("should load deleteDirectory", function(done) {
			this.PersistorManager.deleteDirectory();
			this.S3PersistorManager.deleteDirectory.calledOnce.should.equal(true);
			return done();
		});

		it("should load sendStream", function(done) {
			this.PersistorManager.sendStream();
			this.S3PersistorManager.sendStream.calledOnce.should.equal(true);
			return done();
		});

		return it("should load insertFile", function(done) {
			this.PersistorManager.insertFile();
			this.S3PersistorManager.insertFile.calledOnce.should.equal(true);
			return done();
		});
	});

	describe("test unspecified mixins", () => it("should load s3 when no wrapper specified", function(done) {
        this.settings = {filestore:{}};
        this.requires = {
            "./S3PersistorManager": this.S3PersistorManager,
            "settings-sharelatex": this.settings,
            "logger-sharelatex": {
                log() {},
                err() {}
            }
        };
        this.PersistorManager = SandboxedModule.require(modulePath, {requires: this.requires});
        this.PersistorManager.should.respondTo("getFileStream");
        this.PersistorManager.getFileStream();
        this.S3PersistorManager.getFileStream.calledOnce.should.equal(true);
        return done();
    }));

	return describe("test invalid mixins", () => it("should not load an invalid wrapper", function(done) {
        this.settings = {
            filestore: {
                backend:"magic"
            }
        };
        this.requires = {
            "./S3PersistorManager": this.S3PersistorManager,
            "settings-sharelatex": this.settings,
            "logger-sharelatex": {
                log() {},
                err() {}
            }
        };
        this.fsWrapper=null;
        try {
            this.PersistorManager=SandboxedModule.require(modulePath, {requires: this.requires});
        } catch (error) {
            assert.equal("Unknown filestore backend: magic",error.message);
        }
        assert.isNull(this.fsWrapper);
        return done();
    }));
});


