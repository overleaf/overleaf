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
const modulePath = "../../../app/js/FileHandler.js";
const SandboxedModule = require('sandboxed-module');

describe("FileHandler", function() {

	beforeEach(function() {
		this.settings = {
			s3: {
				buckets: {
					user_files:"user_files"
				}
			}
		};
		this.PersistorManager = {
			getFileStream: sinon.stub(),
			checkIfFileExists: sinon.stub(),
			deleteFile: sinon.stub(),
			deleteDirectory: sinon.stub(),
			sendStream: sinon.stub(),
			insertFile: sinon.stub(),
			directorySize: sinon.stub()
		};
		this.LocalFileWriter = {
			writeStream: sinon.stub(),
			getStream: sinon.stub(),
			deleteFile: sinon.stub()
		};
		this.FileConverter = {
			convert: sinon.stub(),
			thumbnail: sinon.stub(),
			preview: sinon.stub()
		};
		this.keyBuilder = {
			addCachingToKey: sinon.stub(),
			getConvertedFolderKey: sinon.stub()
		};
		this.ImageOptimiser =
			{compressPng: sinon.stub()};
		this.handler = SandboxedModule.require(modulePath, { requires: {
			"settings-sharelatex": this.settings,
			"./PersistorManager":this.PersistorManager,
			"./LocalFileWriter":this.LocalFileWriter,
			"./FileConverter":this.FileConverter,
			"./KeyBuilder": this.keyBuilder,
			"./ImageOptimiser":this.ImageOptimiser,
			"logger-sharelatex": {
				log() {},
				err() {}
			}
		}
	}
		);
		this.bucket = "my_bucket";
		this.key = "key/here";
		this.stubbedPath = "/var/somewhere/path";
		this.format = "png";
		return this.formattedStubbedPath = `${this.stubbedPath}.${this.format}`;
	});

	describe("insertFile", function() {
		beforeEach(function() {
			this.stream = {};
			this.PersistorManager.deleteDirectory.callsArgWith(2);
			return this.PersistorManager.sendStream.callsArgWith(3);
		});

		it("should send file to the filestore", function(done){
			return this.handler.insertFile(this.bucket, this.key, this.stream, () => {
				this.PersistorManager.sendStream.calledWith(this.bucket, this.key, this.stream).should.equal(true);
				return done();
			});
		});

		return it("should delete the convetedKey folder", function(done){
			this.keyBuilder.getConvertedFolderKey.returns(this.stubbedConvetedKey);
			return this.handler.insertFile(this.bucket, this.key, this.stream, () => {
				this.PersistorManager.deleteDirectory.calledWith(this.bucket, this.stubbedConvetedKey).should.equal(true);
				return done();
			});
		});
	});

	describe("deleteFile", function() {
		beforeEach(function() {
			this.keyBuilder.getConvertedFolderKey.returns(this.stubbedConvetedKey);
			this.PersistorManager.deleteFile.callsArgWith(2);
			return this.PersistorManager.deleteDirectory.callsArgWith(2);
		});

		it("should tell the filestore manager to delete the file", function(done){
			return this.handler.deleteFile(this.bucket, this.key, () => {
				this.PersistorManager.deleteFile.calledWith(this.bucket, this.key).should.equal(true);
				return done();
			});
		});

		return it("should tell the filestore manager to delete the cached foler", function(done){
			return this.handler.deleteFile(this.bucket, this.key, () => {
				this.PersistorManager.deleteDirectory.calledWith(this.bucket, this.stubbedConvetedKey).should.equal(true);
				return done();
			});
		});
	});

	describe("getFile", function() {
		beforeEach(function() {
			this.handler._getStandardFile = sinon.stub().callsArgWith(3);
			return this.handler._getConvertedFile = sinon.stub().callsArgWith(3);
		});

		it("should call _getStandardFile if no format or style are defined", function(done){

			return this.handler.getFile(this.bucket, this.key, null, () => {
				this.handler._getStandardFile.called.should.equal(true);
				this.handler._getConvertedFile.called.should.equal(false);
				return done();
			});
		});

		it("should pass options to _getStandardFile", function(done) {
			const options = {start: 0, end: 8};
			return this.handler.getFile(this.bucket, this.key, options, () => {
				expect(this.handler._getStandardFile.lastCall.args[2].start).to.equal(0);
				expect(this.handler._getStandardFile.lastCall.args[2].end).to.equal(8);
				return done();
			});
		});

		return it("should call _getConvertedFile if a format is defined", function(done){
			return this.handler.getFile(this.bucket, this.key, {format:"png"}, () => {
				this.handler._getStandardFile.called.should.equal(false);
				this.handler._getConvertedFile.called.should.equal(true);
				return done();
			});
		});
	});

	describe("_getStandardFile", function() {

		beforeEach(function() {
			this.fileStream = {on() {}};
			return this.PersistorManager.getFileStream.callsArgWith(3, "err", this.fileStream);
		});

		it("should get the stream", function(done){
			return this.handler.getFile(this.bucket, this.key, null, () => {
				this.PersistorManager.getFileStream.calledWith(this.bucket, this.key).should.equal(true);
				return done();
			});
		});

		it("should return the stream and error", function(done){
			return this.handler.getFile(this.bucket, this.key, null, (err, stream)=> {
				err.should.equal("err");
				stream.should.equal(this.fileStream);
				return done();
			});
		});

		return it("should pass options to PersistorManager", function(done) {
			return this.handler.getFile(this.bucket, this.key, {start: 0, end: 8}, () => {
				expect(this.PersistorManager.getFileStream.lastCall.args[2].start).to.equal(0);
				expect(this.PersistorManager.getFileStream.lastCall.args[2].end).to.equal(8);
				return done();
			});
		});
	});


	describe("_getConvertedFile", function() {

		it("should getFileStream if it does exists", function(done){
			this.PersistorManager.checkIfFileExists.callsArgWith(2, null, true);
			this.PersistorManager.getFileStream.callsArgWith(3);
			return this.handler._getConvertedFile(this.bucket, this.key, {}, () => {
				this.PersistorManager.getFileStream.calledWith(this.bucket).should.equal(true);
				return done();
			});
		});

		return it("should call _getConvertedFileAndCache if it does exists", function(done){
			this.PersistorManager.checkIfFileExists.callsArgWith(2, null, false);
			this.handler._getConvertedFileAndCache = sinon.stub().callsArgWith(4);
			return this.handler._getConvertedFile(this.bucket, this.key, {}, () => {
				this.handler._getConvertedFileAndCache.calledWith(this.bucket, this.key).should.equal(true);
				return done();
			});
		});
	});

	describe("_getConvertedFileAndCache", () => it("should _convertFile ", function(done){
        this.stubbedStream = {"something":"here"};
        this.localStream = {
            on() {}
        };
        this.PersistorManager.sendFile = sinon.stub().callsArgWith(3);
        this.LocalFileWriter.getStream = sinon.stub().callsArgWith(1, null, this.localStream);
        this.convetedKey = this.key+"converted";
        this.handler._convertFile = sinon.stub().callsArgWith(3, null, this.stubbedPath);
        this.ImageOptimiser.compressPng = sinon.stub().callsArgWith(1);
        return this.handler._getConvertedFileAndCache(this.bucket, this.key, this.convetedKey, {}, (err, fsStream)=> {
            this.handler._convertFile.called.should.equal(true);
            this.PersistorManager.sendFile.calledWith(this.bucket, this.convetedKey, this.stubbedPath).should.equal(true);
            this.ImageOptimiser.compressPng.calledWith(this.stubbedPath).should.equal(true);
            this.LocalFileWriter.getStream.calledWith(this.stubbedPath).should.equal(true);
            fsStream.should.equal(this.localStream);
            return done();
        });
    }));

	describe("_convertFile", function() {
		beforeEach(function() {
			this.FileConverter.convert.callsArgWith(2, null, this.formattedStubbedPath);
			this.FileConverter.thumbnail.callsArgWith(1, null, this.formattedStubbedPath);
			this.FileConverter.preview.callsArgWith(1, null, this.formattedStubbedPath);
			this.handler._writeS3FileToDisk = sinon.stub().callsArgWith(3, null, this.stubbedPath);
			return this.LocalFileWriter.deleteFile.callsArgWith(1);
		});

		it("should call thumbnail on the writer path if style was thumbnail was specified", function(done){
			return this.handler._convertFile(this.bucket, this.key, {style:"thumbnail"}, (err, path)=> {
				path.should.equal(this.formattedStubbedPath);
				this.FileConverter.thumbnail.calledWith(this.stubbedPath).should.equal(true);
				this.LocalFileWriter.deleteFile.calledWith(this.stubbedPath).should.equal(true);
				return done();
			});
		});

		it("should call preview on the writer path if style was preview was specified", function(done){
			return this.handler._convertFile(this.bucket, this.key, {style:"preview"}, (err, path)=> {
				path.should.equal(this.formattedStubbedPath);
				this.FileConverter.preview.calledWith(this.stubbedPath).should.equal(true);
				this.LocalFileWriter.deleteFile.calledWith(this.stubbedPath).should.equal(true);
				return done();
			});
		});

		return it("should call convert on the writer path if a format was specified", function(done){
			return this.handler._convertFile(this.bucket, this.key, {format:this.format}, (err, path)=> {
				path.should.equal(this.formattedStubbedPath);
				this.FileConverter.convert.calledWith(this.stubbedPath, this.format).should.equal(true);
				this.LocalFileWriter.deleteFile.calledWith(this.stubbedPath).should.equal(true);
				return done();
			});
		});
	});

	return describe("getDirectorySize", function() {

		beforeEach(function() {
			return this.PersistorManager.directorySize.callsArgWith(2);
		});

		return it("should call the filestore manager to get directory size", function(done){
			return this.handler.getDirectorySize(this.bucket, this.key, () => {
				this.PersistorManager.directorySize.calledWith(this.bucket, this.key).should.equal(true);
				return done();
			});
		});
	});
});
