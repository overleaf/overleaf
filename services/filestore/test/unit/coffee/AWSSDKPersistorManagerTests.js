/* eslint-disable
    handle-callback-err,
    no-dupe-keys,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon');
const chai = require('chai');

const should = chai.should();
const {
    expect
} = chai;

const modulePath = "../../../app/js/AWSSDKPersistorManager.js";
const SandboxedModule = require('sandboxed-module');

describe("AWSSDKPersistorManager", function() {
	beforeEach(function() {
		this.settings = {
			filestore: {
				backend: "aws-sdk"
			}
		};
		this.s3 = {
			upload: sinon.stub(),
			getObject: sinon.stub(),
			copyObject: sinon.stub(),
			deleteObject: sinon.stub(),
			listObjects: sinon.stub(),
			deleteObjects: sinon.stub(),
			headObject: sinon.stub()
		};
		this.awssdk =
			{S3: sinon.stub().returns(this.s3)};

		this.requires = {
			"aws-sdk": this.awssdk,
			"settings-sharelatex": this.settings,
			"logger-sharelatex": {
				log() {},
				err() {}
			},
			"fs": (this.fs =
				{createReadStream: sinon.stub()}),
			"./Errors": (this.Errors =
				{NotFoundError: sinon.stub()})
		};
		this.key = "my/key";
		this.bucketName = "my-bucket";
		this.error = "my error";
		return this.AWSSDKPersistorManager = SandboxedModule.require(modulePath, {requires: this.requires});
	});

	describe("sendFile", function() {
		beforeEach(function() {
			this.stream = {};
			this.fsPath = "/usr/local/some/file";
			return this.fs.createReadStream.returns(this.stream);
		});

		it("should put the file with s3.upload", function(done) {
			this.s3.upload.callsArgWith(1);
			return this.AWSSDKPersistorManager.sendFile(this.bucketName, this.key, this.fsPath, err => {
				expect(err).to.not.be.ok;
				expect(this.s3.upload.calledOnce, "called only once").to.be.true;
				expect((this.s3.upload.calledWith({Bucket: this.bucketName, Key: this.key, Body: this.stream}))
							 , "called with correct arguments").to.be.true;
				return done();
			});
		});

		return it("should dispatch the error from s3.upload", function(done) {
			this.s3.upload.callsArgWith(1, this.error);
			return this.AWSSDKPersistorManager.sendFile(this.bucketName, this.key, this.fsPath, err => {
				expect(err).to.equal(this.error);
				return done();
			});
		});
	});


	describe("sendStream", function() {
		beforeEach(function() {
			return this.stream = {};});

		it("should put the file with s3.upload", function(done) {
			this.s3.upload.callsArgWith(1);
			return this.AWSSDKPersistorManager.sendStream(this.bucketName, this.key, this.stream, err => {
				expect(err).to.not.be.ok;
				expect(this.s3.upload.calledOnce, "called only once").to.be.true;
				expect((this.s3.upload.calledWith({Bucket: this.bucketName, Key: this.key, Body: this.stream})),
							 "called with correct arguments").to.be.true;
				return done();
			});
		});

		return it("should dispatch the error from s3.upload", function(done) {
			this.s3.upload.callsArgWith(1, this.error);
			return this.AWSSDKPersistorManager.sendStream(this.bucketName, this.key, this.stream, err => {
				expect(err).to.equal(this.error);
				return done();
			});
		});
	});

	describe("getFileStream", function() {
		beforeEach(function() {
			this.opts = {};
			this.stream = {};
			this.read_stream =
				{on: (this.read_stream_on = sinon.stub())};
			this.object =
				{createReadStream: sinon.stub().returns(this.read_stream)};
			return this.s3.getObject.returns(this.object);
		});

		it("should return a stream from s3.getObject", function(done) {
			this.read_stream_on.withArgs('readable').callsArgWith(1);

			return this.AWSSDKPersistorManager.getFileStream(this.bucketName, this.key, this.opts, (err, stream) => {
				expect(this.read_stream_on.calledTwice);
				expect(err).to.not.be.ok;
				expect(stream, "returned the stream").to.equal(this.read_stream);
				expect((this.s3.getObject.calledWith({Bucket: this.bucketName, Key: this.key})),
							 "called with correct arguments").to.be.true;
				return done();
			});
		});

		describe("with start and end options", function() {
			beforeEach(function() {
				return this.opts = {
					start: 0,
					end: 8
				};
			});
			return it("should pass headers to the s3.GetObject", function(done) {
				this.read_stream_on.withArgs('readable').callsArgWith(1);
				this.AWSSDKPersistorManager.getFileStream(this.bucketName, this.key, this.opts, (err, stream) => {
					return expect((this.s3.getObject.calledWith({Bucket: this.bucketName, Key: this.key, Range: 'bytes=0-8'})),
						"called with correct arguments").to.be.true;
				});
				return done();
			});
		});

		return describe("error conditions", function() {
			describe("when the file doesn't exist", function() {
				beforeEach(function() {
					this.error = new Error();
					return this.error.code = 'NoSuchKey';
				});
				return it("should produce a NotFoundError", function(done) {
					this.read_stream_on.withArgs('error').callsArgWith(1, this.error);
					return this.AWSSDKPersistorManager.getFileStream(this.bucketName, this.key, this.opts, (err, stream) => {
						expect(stream).to.not.be.ok;
						expect(err).to.be.ok;
						expect(err instanceof this.Errors.NotFoundError, "error is a correct instance").to.equal(true);
						return done();
					});
				});
			});

			return describe("when there is some other error", function() {
				beforeEach(function() {
					return this.error = new Error();
				});
				return it("should dispatch the error from s3 object stream", function(done) {
					this.read_stream_on.withArgs('error').callsArgWith(1, this.error);
					return this.AWSSDKPersistorManager.getFileStream(this.bucketName, this.key, this.opts, (err, stream) => {
						expect(stream).to.not.be.ok;
						expect(err).to.be.ok;
						expect(err).to.equal(this.error);
						return done();
					});
				});
			});
		});
	});

	describe("copyFile", function() {
		beforeEach(function() {
			this.destKey = "some/key";
			return this.stream = {};});

		it("should copy the file with s3.copyObject", function(done) {
			this.s3.copyObject.callsArgWith(1);
			return this.AWSSDKPersistorManager.copyFile(this.bucketName, this.key, this.destKey, err => {
				expect(err).to.not.be.ok;
				expect(this.s3.copyObject.calledOnce, "called only once").to.be.true;
				expect((this.s3.copyObject.calledWith({Bucket: this.bucketName, Key: this.destKey, CopySource: this.bucketName + '/' + this.key})),
					"called with correct arguments").to.be.true;
				return done();
			});
		});

		return it("should dispatch the error from s3.copyObject", function(done) {
			this.s3.copyObject.callsArgWith(1, this.error);
			return this.AWSSDKPersistorManager.copyFile(this.bucketName, this.key, this.destKey, err => {
				expect(err).to.equal(this.error);
				return done();
			});
		});
	});

	describe("deleteFile", function() {
		it("should delete the file with s3.deleteObject", function(done) {
			this.s3.deleteObject.callsArgWith(1);
			return this.AWSSDKPersistorManager.deleteFile(this.bucketName, this.key, err => {
				expect(err).to.not.be.ok;
				expect(this.s3.deleteObject.calledOnce, "called only once").to.be.true;
				expect((this.s3.deleteObject.calledWith({Bucket: this.bucketName, Key: this.key})),
					"called with correct arguments").to.be.true;
				return done();
			});
		});

		return it("should dispatch the error from s3.deleteObject", function(done) {
			this.s3.deleteObject.callsArgWith(1, this.error);
			return this.AWSSDKPersistorManager.deleteFile(this.bucketName, this.key, err => {
				expect(err).to.equal(this.error);
				return done();
			});
		});
	});

	describe("deleteDirectory", function() {

		it("should list the directory content using s3.listObjects", function(done) {
			this.s3.listObjects.callsArgWith(1, null, {Contents: []});
			return this.AWSSDKPersistorManager.deleteDirectory(this.bucketName, this.key, err => {
				expect(err).to.not.be.ok;
				expect(this.s3.listObjects.calledOnce, "called only once").to.be.true;
				expect((this.s3.listObjects.calledWith({Bucket: this.bucketName, Prefix: this.key})),
					"called with correct arguments").to.be.true;
				return done();
			});
		});

		it("should dispatch the error from s3.listObjects", function(done) {
			this.s3.listObjects.callsArgWith(1, this.error);
			return this.AWSSDKPersistorManager.deleteDirectory(this.bucketName, this.key, err => {
				expect(err).to.equal(this.error);
				return done();
			});
		});

		return describe("with directory content", function() {
			beforeEach(function() {
				return this.fileList = [
					{Key: 'foo'}
				, { Key: 'bar'
				, Key: 'baz'
			}
				];});

			it("should forward the file keys to s3.deleteObjects", function(done) {
				this.s3.listObjects.callsArgWith(1, null, {Contents: this.fileList});
				this.s3.deleteObjects.callsArgWith(1);
				return this.AWSSDKPersistorManager.deleteDirectory(this.bucketName, this.key, err => {
					expect(err).to.not.be.ok;
					expect(this.s3.deleteObjects.calledOnce, "called only once").to.be.true;
					expect((this.s3.deleteObjects.calledWith({
							Bucket: this.bucketName,
							Delete: {
								Quiet: true,
								Objects: this.fileList
							}})),
						"called with correct arguments").to.be.true;
					return done();
				});
			});

			return it("should dispatch the error from s3.deleteObjects", function(done) {
				this.s3.listObjects.callsArgWith(1, null, {Contents: this.fileList});
				this.s3.deleteObjects.callsArgWith(1, this.error);
				return this.AWSSDKPersistorManager.deleteDirectory(this.bucketName, this.key, err => {
					expect(err).to.equal(this.error);
					return done();
				});
			});
		});
	});


	describe("checkIfFileExists", function() {

		it("should check for the file with s3.headObject", function(done) {
			this.s3.headObject.callsArgWith(1, null, {});
			return this.AWSSDKPersistorManager.checkIfFileExists(this.bucketName, this.key, (err, exists) => {
				expect(err).to.not.be.ok;
				expect(this.s3.headObject.calledOnce, "called only once").to.be.true;
				expect((this.s3.headObject.calledWith({Bucket: this.bucketName, Key: this.key})),
					"called with correct arguments").to.be.true;
				return done();
			});
		});

		it("should return false on an inexistant file", function(done) {
			this.s3.headObject.callsArgWith(1, null, {});
			return this.AWSSDKPersistorManager.checkIfFileExists(this.bucketName, this.key, (err, exists) => {
				expect(exists).to.be.false;
				return done();
			});
		});

		it("should return true on an existing file", function(done) {
			this.s3.headObject.callsArgWith(1, null, {ETag: "etag"});
			return this.AWSSDKPersistorManager.checkIfFileExists(this.bucketName, this.key, (err, exists) => {
				expect(exists).to.be.true;
				return done();
			});
		});

		return it("should dispatch the error from s3.headObject", function(done) {
			this.s3.headObject.callsArgWith(1, this.error);
			return this.AWSSDKPersistorManager.checkIfFileExists(this.bucketName, this.key, (err, exists) => {
				expect(err).to.equal(this.error);
				return done();
			});
		});
	});

	return describe("directorySize", function() {

		it("should list the directory content using s3.listObjects", function(done) {
			this.s3.listObjects.callsArgWith(1, null, {Contents: []});
			return this.AWSSDKPersistorManager.directorySize(this.bucketName, this.key, err => {
				expect(err).to.not.be.ok;
				expect(this.s3.listObjects.calledOnce, "called only once").to.be.true;
				expect((this.s3.listObjects.calledWith({Bucket: this.bucketName, Prefix: this.key})),
					"called with correct arguments").to.be.true;
				return done();
			});
		});

		it("should dispatch the error from s3.listObjects", function(done) {
			this.s3.listObjects.callsArgWith(1, this.error);
			return this.AWSSDKPersistorManager.directorySize(this.bucketName, this.key, err => {
				expect(err).to.equal(this.error);
				return done();
			});
		});

		return it("should sum directory files sizes", function(done) {
			this.s3.listObjects.callsArgWith(1, null, {Contents: [ { Size: 1024 }, { Size: 2048 }]});
			return this.AWSSDKPersistorManager.directorySize(this.bucketName, this.key, (err, size) => {
				expect(size).to.equal(3072);
				return done();
			});
		});
	});
});
