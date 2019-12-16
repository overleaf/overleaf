/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
    assert
} = require("chai");
const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
const {
    expect
} = chai;
const modulePath = "../../../app/js/FileController.js";
const SandboxedModule = require('sandboxed-module');

describe("FileController", function() {

	beforeEach(function() {
		this.PersistorManager = {
			sendStream: sinon.stub(),
			copyFile: sinon.stub(),
			deleteFile:sinon.stub()
		};

		this.settings = {
			s3: {
				buckets: {
					user_files:"user_files"
				}
			}
		};
		this.FileHandler = {
			getFile: sinon.stub(),
			getFileSize: sinon.stub(),
			deleteFile: sinon.stub(),
			insertFile: sinon.stub(),
			getDirectorySize: sinon.stub()
		};
		this.LocalFileWriter = {};
		this.controller = SandboxedModule.require(modulePath, { requires: {
			"./LocalFileWriter":this.LocalFileWriter,
			"./FileHandler": this.FileHandler,
			"./PersistorManager":this.PersistorManager,
			"./Errors": (this.Errors =
				{NotFoundError: sinon.stub()}),
			"settings-sharelatex": this.settings,
			"metrics-sharelatex": { 
				inc() {}
			},
			"logger-sharelatex": {
				log() {},
				err() {}
			}
		}
	}
		);
		this.project_id = "project_id";
		this.file_id = "file_id";
		this.bucket = "user_files";
		this.key = `${this.project_id}/${this.file_id}`;
		this.req = {
			key:this.key,
			bucket:this.bucket,
			query:{},
			params: {
				project_id:this.project_id,
				file_id:this.file_id
			},
			headers: {}
		};
		this.res = {
			set: sinon.stub().returnsThis(),
			status: sinon.stub().returnsThis()
		};
		return this.fileStream = {};});

	describe("getFile", function() {

		it("should pipe the stream", function(done){
			this.FileHandler.getFile.callsArgWith(3, null, this.fileStream);
			this.fileStream.pipe = res=> {
				res.should.equal(this.res);
				return done();
			};
			return this.controller.getFile(this.req, this.res);
		});

		it("should send a 200 if the cacheWarm param is true", function(done){
			this.req.query.cacheWarm = true;
			this.FileHandler.getFile.callsArgWith(3, null, this.fileStream);
			this.res.send = statusCode=> {
				statusCode.should.equal(200);
				return done();
			};
			return this.controller.getFile(this.req, this.res);
		});

		it("should send a 500 if there is a problem", function(done){
			this.FileHandler.getFile.callsArgWith(3, "error");
			this.res.send = code=> {
				code.should.equal(500);
				return done();
			};
			return this.controller.getFile(this.req, this.res);
		});

		return describe("with a 'Range' header set", function() {

			beforeEach(function() {
				return this.req.headers.range = 'bytes=0-8';
			});

			return it("should pass 'start' and 'end' options to FileHandler", function(done) {
				this.FileHandler.getFile.callsArgWith(3, null, this.fileStream);
				this.fileStream.pipe = res=> {
					expect(this.FileHandler.getFile.lastCall.args[2].start).to.equal(0);
					expect(this.FileHandler.getFile.lastCall.args[2].end).to.equal(8);
					return done();
				};
				return this.controller.getFile(this.req, this.res);
			});
		});
	});

	describe("getFileHead", function() {
		it("should return the file size in a Content-Length header", function(done) {
			const expectedFileSize = 84921;
			this.FileHandler.getFileSize.yields(
				new Error("FileHandler.getFileSize: unexpected arguments")
			);
			this.FileHandler.getFileSize.withArgs(this.bucket, this.key).yields(null, expectedFileSize);

			this.res.end = () => {
				expect(this.res.status.lastCall.args[0]).to.equal(200);
				expect(this.res.set.calledWith("Content-Length", expectedFileSize)).to.equal(true);
				return done();
			};

			return this.controller.getFileHead(this.req, this.res);
		});

		it("should return a 404 is the file is not found", function(done) {
			this.FileHandler.getFileSize.yields(new this.Errors.NotFoundError());

			this.res.end = () => {
				expect(this.res.status.lastCall.args[0]).to.equal(404);
				return done();
			};

			return this.controller.getFileHead(this.req, this.res);
		});

		return it("should return a 500 on internal errors", function(done) {
			this.FileHandler.getFileSize.yields(new Error());

			this.res.end = () => {
				expect(this.res.status.lastCall.args[0]).to.equal(500);
				return done();
			};

			return this.controller.getFileHead(this.req, this.res);
		});
	});

	describe("insertFile", () => it("should send bucket name key and res to PersistorManager", function(done){
        this.FileHandler.insertFile.callsArgWith(3);
        this.res.send = () => {
            this.FileHandler.insertFile.calledWith(this.bucket, this.key, this.req).should.equal(true);
            return done();
        };
        return this.controller.insertFile(this.req, this.res);
    }));

	describe("copyFile", function() {
		beforeEach(function() {
			this.oldFile_id = "old_file_id";
			this.oldProject_id = "old_project_id";
			return this.req.body = {
				source: {
					project_id: this.oldProject_id,
					file_id: this.oldFile_id
				}
			};
		});

		it("should send bucket name and both keys to PersistorManager", function(done){
			this.PersistorManager.copyFile.callsArgWith(3);
			this.res.send = code=> {
				code.should.equal(200);
				this.PersistorManager.copyFile.calledWith(this.bucket, `${this.oldProject_id}/${this.oldFile_id}`, this.key).should.equal(true);
				return done();
			};
			return this.controller.copyFile(this.req, this.res);
		});

		it("should send a 404 if the original file was not found", function(done) {
			this.PersistorManager.copyFile.callsArgWith(3, new this.Errors.NotFoundError());
			this.res.send = code=> {
				code.should.equal(404);
				return done();
			};
			return this.controller.copyFile(this.req, this.res);
		});

		return it("should send a 500 if there was an error", function(done){
			this.PersistorManager.copyFile.callsArgWith(3, "error");
			this.res.send = code=> {
				code.should.equal(500);
				return done();
			};
			return this.controller.copyFile(this.req, this.res);
		});
	});

	describe("delete file", function() {

		it("should tell the file handler", function(done){
			this.FileHandler.deleteFile.callsArgWith(2);
			this.res.send = code=> {
				code.should.equal(204);
				this.FileHandler.deleteFile.calledWith(this.bucket, this.key).should.equal(true);
				return done();
			};
			return this.controller.deleteFile(this.req, this.res);
		});

		return it("should send a 500 if there was an error", function(done){
			this.FileHandler.deleteFile.callsArgWith(2, "error");
			this.res.send = function(code){
				code.should.equal(500);
				return done();
			};
			return this.controller.deleteFile(this.req, this.res);
		});
	});

	describe("_get_range", function() {

		it("should parse a valid Range header", function(done) {
			const result = this.controller._get_range('bytes=0-200');
			expect(result).to.not.equal(null);
			expect(result.start).to.equal(0);
			expect(result.end).to.equal(200);
			return done();
		});

		it("should return null for an invalid Range header", function(done) {
			const result = this.controller._get_range('wat');
			expect(result).to.equal(null);
			return done();
		});

		return it("should return null for any type other than 'bytes'", function(done) {
			const result = this.controller._get_range('carrots=0-200');
			expect(result).to.equal(null);
			return done();
		});
	});

	return describe("directorySize", function() {

		it("should return total directory size bytes", function(done) {
			this.FileHandler.getDirectorySize.callsArgWith(2, null, 1024);
			return this.controller.directorySize(this.req, { json:result=> {
				expect(result['total bytes']).to.equal(1024);
				return done();
			}
		}
			);
		});

		return it("should send a 500 if there was an error", function(done){
			this.FileHandler.getDirectorySize.callsArgWith(2, "error");
			this.res.send = function(code){
				code.should.equal(500);
				return done();
			};
			return this.controller.directorySize(this.req, this.res);
		});
	});
});
