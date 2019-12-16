/* eslint-disable
    handle-callback-err,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
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
const modulePath = "../../../app/js/S3PersistorManager.js";
const SandboxedModule = require('sandboxed-module');

describe("S3PersistorManagerTests", function() {

	beforeEach(function() {
		this.settings = {
			filestore: {
				backend: "s3",
				s3: {
					secret: "secret",
					key: "this_key"
				},
				stores: {
					user_files:"sl_user_files"
				}
			}
		};
		this.knoxClient = {
			putFile:sinon.stub(),
			copyFile:sinon.stub(),
			list: sinon.stub(),
			deleteMultiple: sinon.stub(),
			get: sinon.stub()
		};
		this.knox =
			{createClient: sinon.stub().returns(this.knoxClient)};
		this.s3EventHandlers = {};
		this.s3Request = {
			on: sinon.stub().callsFake((event, callback) => {
				return this.s3EventHandlers[event] = callback;
			}),
			send: sinon.stub()
		};
		this.s3Response = {
			httpResponse: {
				createUnbufferedStream: sinon.stub()
			}
		};
		this.s3Client = {
			copyObject: sinon.stub(),
			headObject: sinon.stub(),
			getObject: sinon.stub().returns(this.s3Request)
		};
		this.awsS3 = sinon.stub().returns(this.s3Client);
		this.LocalFileWriter = {
			writeStream: sinon.stub(),
			deleteFile: sinon.stub()
		};
		this.request = sinon.stub();
		this.requires = {
			"knox": this.knox,
			"aws-sdk/clients/s3": this.awsS3,
			"settings-sharelatex": this.settings,
			"./LocalFileWriter":this.LocalFileWriter,
			"logger-sharelatex": {
				log() {},
				err() {}
			},
			"request": this.request,
			"./Errors": (this.Errors =
				{NotFoundError: sinon.stub()})
		};
		this.key = "my/key";
		this.bucketName = "my-bucket";
		this.error = "my errror";
		return this.S3PersistorManager = SandboxedModule.require(modulePath, {requires: this.requires});
	});

	describe("getFileStream", function() {
		describe("success", function() {
			beforeEach(function() {
				this.expectedStream = { expectedStream: true };
				this.expectedStream.on = sinon.stub();
				this.s3Request.send.callsFake(() => {
					return this.s3EventHandlers.httpHeaders(200, {}, this.s3Response, "OK");
				});
				return this.s3Response.httpResponse.createUnbufferedStream.returns(this.expectedStream);
			});

			it("returns a stream", function(done) {
				return this.S3PersistorManager.getFileStream(this.bucketName, this.key, {}, (err, stream) => {
					if (err != null) {
						return done(err);
					}
					expect(stream).to.equal(this.expectedStream);
					return done();
				});
			});

			it("sets the AWS client up with credentials from settings", function(done) {
				return this.S3PersistorManager.getFileStream(this.bucketName, this.key, {}, (err, stream) => {
					if (err != null) {
						return done(err);
					}
					expect(this.awsS3.lastCall.args).to.deep.equal([{
						credentials: {
							accessKeyId: this.settings.filestore.s3.key,
							secretAccessKey: this.settings.filestore.s3.secret
						}
					}]);
					return done();
				});
			});

			it("fetches the right key from the right bucket", function(done) {
				return this.S3PersistorManager.getFileStream(this.bucketName, this.key, {}, (err, stream) => {
					if (err != null) {
						return done(err);
					}
					expect(this.s3Client.getObject.lastCall.args).to.deep.equal([{
						Bucket: this.bucketName,
						Key: this.key
					}]);
					return done();
				});
			});

			it("accepts alternative credentials", function(done) {
				const accessKeyId = "that_key";
				const secret = "that_secret";
				const opts = {
					credentials: {
						auth_key: accessKeyId,
						auth_secret: secret
					}
				};
				return this.S3PersistorManager.getFileStream(this.bucketName, this.key, opts, (err, stream) => {
					if (err != null) {
						return done(err);
					}
					expect(this.awsS3.lastCall.args).to.deep.equal([{
						credentials: {
							accessKeyId,
							secretAccessKey: secret
						}
					}]);
					expect(stream).to.equal(this.expectedStream);
					return done();
				});
			});

			return it("accepts byte range", function(done) {
				const start = 0;
				const end = 8;
				const opts = { start, end };
				return this.S3PersistorManager.getFileStream(this.bucketName, this.key, opts, (err, stream) => {
					if (err != null) {
						return done(err);
					}
					expect(this.s3Client.getObject.lastCall.args).to.deep.equal([{
						Bucket: this.bucketName,
						Key: this.key,
						Range: `bytes=${start}-${end}`
					}]);
					expect(stream).to.equal(this.expectedStream);
					return done();
				});
			});
		});

		return describe("errors", function() {
			describe("when the file doesn't exist", function() {
				beforeEach(function() {
					return this.s3Request.send.callsFake(() => {
						return this.s3EventHandlers.httpHeaders(404, {}, this.s3Response, "Not found");
					});
				});

				return it("returns a NotFoundError that indicates the bucket and key", function(done) {
					return this.S3PersistorManager.getFileStream(this.bucketName, this.key, {}, (err, stream) => {
						expect(err).to.be.instanceof(this.Errors.NotFoundError);
						const errMsg = this.Errors.NotFoundError.lastCall.args[0];
						expect(errMsg).to.match(new RegExp(`.*${this.bucketName}.*`));
						expect(errMsg).to.match(new RegExp(`.*${this.key}.*`));
						return done();
					});
				});
			});

			describe("when S3 encounters an unkown error", function() {
				beforeEach(function() {
					return this.s3Request.send.callsFake(() => {
						return this.s3EventHandlers.httpHeaders(500, {}, this.s3Response, "Internal server error");
					});
				});

				return it("returns an error", function(done) {
					return this.S3PersistorManager.getFileStream(this.bucketName, this.key, {}, (err, stream) => {
						expect(err).to.be.instanceof(Error);
						return done();
					});
				});
			});

			return describe("when the S3 request errors out before receiving HTTP headers", function() {
				beforeEach(function() {
					return this.s3Request.send.callsFake(() => {
						return this.s3EventHandlers.error(new Error("connection failed"));
					});
				});

				return it("returns an error", function(done) {
					return this.S3PersistorManager.getFileStream(this.bucketName, this.key, {}, (err, stream) => {
						expect(err).to.be.instanceof(Error);
						return done();
					});
				});
			});
		});
	});

	describe("getFileSize", function() {
		it("should obtain the file size from S3", function(done) {
			const expectedFileSize = 123;
			this.s3Client.headObject.yields(new Error(
				"s3Client.headObject got unexpected arguments"
			));
			this.s3Client.headObject.withArgs({
				Bucket: this.bucketName,
				Key: this.key
			}).yields(null, { ContentLength: expectedFileSize });

			return this.S3PersistorManager.getFileSize(this.bucketName, this.key, (err, fileSize) => {
				if (err != null) {
					return done(err);
				}
				expect(fileSize).to.equal(expectedFileSize);
				return done();
			});
		});

		[403, 404].forEach(statusCode => it(`should throw NotFoundError when S3 responds with ${statusCode}`, function(done) {
            const error = new Error();
            error.statusCode = statusCode;
            this.s3Client.headObject.yields(error);

            return this.S3PersistorManager.getFileSize(this.bucketName, this.key, (err, fileSize) => {
                expect(err).to.be.an.instanceof(this.Errors.NotFoundError);
                return done();
            });
        }));

		return it("should rethrow any other error", function(done) {
			const error = new Error();
			this.s3Client.headObject.yields(error);
			this.s3Client.headObject.yields(error);

			return this.S3PersistorManager.getFileSize(this.bucketName, this.key, (err, fileSize) => {
				expect(err).to.equal(error);
				return done();
			});
		});
	});

	describe("sendFile", function() {

		beforeEach(function() {
			return this.knoxClient.putFile.returns({on() {}});
		});

		it("should put file with knox", function(done){
			this.LocalFileWriter.deleteFile.callsArgWith(1);
			this.knoxClient.putFile.callsArgWith(2, this.error);
			return this.S3PersistorManager.sendFile(this.bucketName, this.key, this.fsPath, err=> {
				this.knoxClient.putFile.calledWith(this.fsPath, this.key).should.equal(true);
				err.should.equal(this.error);
				return done();
			});
		});

		return it("should delete the file and pass the error with it", function(done){
			this.LocalFileWriter.deleteFile.callsArgWith(1);
			this.knoxClient.putFile.callsArgWith(2, this.error);
			return this.S3PersistorManager.sendFile(this.bucketName, this.key, this.fsPath, err=> {
				this.knoxClient.putFile.calledWith(this.fsPath, this.key).should.equal(true);
				err.should.equal(this.error);
				return done();
			});
		});
	});

	describe("sendStream", function() {
		beforeEach(function() {
			this.fsPath = "to/some/where";
			this.origin =
				{on() {}};
			return this.S3PersistorManager.sendFile = sinon.stub().callsArgWith(3);
		});

		it("should send stream to LocalFileWriter", function(done){
			this.LocalFileWriter.deleteFile.callsArgWith(1);
			this.LocalFileWriter.writeStream.callsArgWith(2, null, this.fsPath);
			return this.S3PersistorManager.sendStream(this.bucketName, this.key, this.origin, () => {
				this.LocalFileWriter.writeStream.calledWith(this.origin).should.equal(true);
				return done();
			});
		});

		it("should return the error from LocalFileWriter", function(done){
			this.LocalFileWriter.deleteFile.callsArgWith(1);
			this.LocalFileWriter.writeStream.callsArgWith(2, this.error);
			return this.S3PersistorManager.sendStream(this.bucketName, this.key, this.origin, err=> {
				err.should.equal(this.error);
				return done();
			});
		});

		return it("should send the file to the filestore", function(done){
			this.LocalFileWriter.deleteFile.callsArgWith(1);
			this.LocalFileWriter.writeStream.callsArgWith(2);
			return this.S3PersistorManager.sendStream(this.bucketName, this.key, this.origin, err=> {
				this.S3PersistorManager.sendFile.called.should.equal(true);
				return done();
			});
		});
	});

	describe("copyFile", function() {
		beforeEach(function() {
			this.sourceKey = "my/key";
			return this.destKey = "my/dest/key";
		});

		it("should use AWS SDK to copy file", function(done){
			this.s3Client.copyObject.callsArgWith(1, this.error);
			return this.S3PersistorManager.copyFile(this.bucketName, this.sourceKey, this.destKey, err=> {
				err.should.equal(this.error);
				this.s3Client.copyObject.calledWith({Bucket: this.bucketName, Key: this.destKey, CopySource: this.bucketName + '/' + this.key}).should.equal(true);
				return done();
			});
		});

		return it("should return a NotFoundError object if the original file does not exist", function(done){
			const NoSuchKeyError = {code: "NoSuchKey"};
			this.s3Client.copyObject.callsArgWith(1, NoSuchKeyError);
			return this.S3PersistorManager.copyFile(this.bucketName, this.sourceKey, this.destKey, err=> {
				expect(err instanceof this.Errors.NotFoundError).to.equal(true);
				return done();
			});
		});
	});

	describe("deleteDirectory", () => it("should list the contents passing them onto multi delete", function(done){
        const data =
            {Contents: [{Key:"1234"}, {Key: "456"}]};
        this.knoxClient.list.callsArgWith(1, null, data);
        this.knoxClient.deleteMultiple.callsArgWith(1);
        return this.S3PersistorManager.deleteDirectory(this.bucketName, this.key, err=> {
            this.knoxClient.deleteMultiple.calledWith(["1234","456"]).should.equal(true);
            return done();
        });
    }));

	describe("deleteFile", function() {

		it("should use correct options", function(done){
			this.request.callsArgWith(1);

			return this.S3PersistorManager.deleteFile(this.bucketName, this.key, err=> {
				const opts = this.request.args[0][0];
				assert.deepEqual(opts.aws, {key:this.settings.filestore.s3.key, secret:this.settings.filestore.s3.secret, bucket:this.bucketName});
				opts.method.should.equal("delete");
				opts.timeout.should.equal((30*1000));
				opts.uri.should.equal(`https://${this.bucketName}.s3.amazonaws.com/${this.key}`);
				return done();
			});
		});

		return it("should return the error", function(done){
			this.request.callsArgWith(1, this.error);

			return this.S3PersistorManager.deleteFile(this.bucketName, this.key, err=> {
				err.should.equal(this.error);
				return done();
			});
		});
	});

	describe("checkIfFileExists", function() {

		it("should use correct options", function(done){
			this.request.callsArgWith(1,  null, {statusCode:200});

			return this.S3PersistorManager.checkIfFileExists(this.bucketName, this.key, err=> {
				const opts = this.request.args[0][0];
				assert.deepEqual(opts.aws, {key:this.settings.filestore.s3.key, secret:this.settings.filestore.s3.secret, bucket:this.bucketName});
				opts.method.should.equal("head");
				opts.timeout.should.equal((30*1000));
				opts.uri.should.equal(`https://${this.bucketName}.s3.amazonaws.com/${this.key}`);
				return done();
			});
		});

		it("should return true for a 200", function(done){
			this.request.callsArgWith(1, null, {statusCode:200});

			return this.S3PersistorManager.checkIfFileExists(this.bucketName, this.key, (err, exists)=> {
				exists.should.equal(true);
				return done();
			});
		});

		it("should return false for a non 200", function(done){
			this.request.callsArgWith(1, null, {statusCode:404});

			return this.S3PersistorManager.checkIfFileExists(this.bucketName, this.key, (err, exists)=> {
				exists.should.equal(false);
				return done();
			});
		});

		return it("should return the error", function(done){
			this.request.callsArgWith(1, this.error, {});

			return this.S3PersistorManager.checkIfFileExists(this.bucketName, this.key, err=> {
				err.should.equal(this.error);
				return done();
			});
		});
	});

	return describe("directorySize", () => it("should sum directory files size", function(done) {
        const data =
            {Contents: [ {Size: 1024}, {Size: 2048} ]};
        this.knoxClient.list.callsArgWith(1, null, data);
        return this.S3PersistorManager.directorySize(this.bucketName, this.key, (err, totalSize)=> {
            totalSize.should.equal(3072);
            return done();
        });
    }));
});
