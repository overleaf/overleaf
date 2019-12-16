/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
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
const modulePath = "../../../app/js/LocalFileWriter.js";
const SandboxedModule = require('sandboxed-module');
const fs = require("fs");
const request = require("request");
const settings = require("settings-sharelatex");
const FilestoreApp = require("./FilestoreApp");
const async = require('async');


const getMetric = (filestoreUrl, metric, cb) => request.get(`${filestoreUrl}/metrics`, function(err, res) {
    expect(res.statusCode).to.equal(200);
    const metricRegex = new RegExp(`^${metric}{[^}]+} ([0-9]+)$`, "m");
    return cb(parseInt(__guard__(metricRegex.exec(res.body), x => x[1]) || '0'));
});

describe("Filestore", function() {
	before(function(done){
		this.localFileReadPath = "/tmp/filestore_acceptence_tests_file_read.txt";
		this.localFileWritePath = "/tmp/filestore_acceptence_tests_file_write.txt";

		this.constantFileContent = [
			"hello world",
			`line 2 goes here ${Math.random()}`,
			"there are 3 lines in all"
		].join("\n");

		this.filestoreUrl = `http://localhost:${settings.internal.filestore.port}`;
		return fs.writeFile(this.localFileReadPath, this.constantFileContent, function(err) {
			if (err) { return done(err); }
			return FilestoreApp.waitForS3(done);
		});
	});

	beforeEach(function(done){
		return FilestoreApp.ensureRunning(() => {
			return async.parallel([
				cb => {
					return fs.unlink(this.localFileWritePath, () => cb());
				},
				cb => {
					return getMetric(this.filestoreUrl, 's3_egress', metric => {
						this.previousEgress = metric;
						return cb();
					});
				},
				cb => {
					return getMetric(this.filestoreUrl, 's3_ingress', metric => {
						this.previousIngress = metric;
						return cb();
					});
				}
			], done);
		});
	});

	it("should send a 200 for status endpoint", function(done){
		return request(`${this.filestoreUrl}/status`, function(err, response, body){
			response.statusCode.should.equal(200);
			body.indexOf("filestore").should.not.equal(-1);
			body.indexOf("up").should.not.equal(-1);
			return done();
		});
	});

	describe("with a file on the server", function() {

		beforeEach(function(done){
			this.timeout(1000 * 10);
			this.file_id = Math.random();
			this.fileUrl = `${this.filestoreUrl}/project/acceptence_tests/file/${this.file_id}`;

			const writeStream = request.post(this.fileUrl);

			writeStream.on("end", done);
			return fs.createReadStream(this.localFileReadPath).pipe(writeStream);
		});

		it("should return 404 for a non-existant id", function(done) {
			this.timeout(1000 * 20);
			const options =
				{uri: this.fileUrl + '___this_is_clearly_wrong___'};
			return request.get(options, (err, response, body) => {
				response.statusCode.should.equal(404);
				return done();
			});
		});

		it('should record an egress metric for the upload', function(done) {
			return getMetric(this.filestoreUrl, 's3_egress', metric => {
				expect(metric - this.previousEgress).to.equal(this.constantFileContent.length);
				return done();
			});
		});

		it("should return the file size on a HEAD request", function(done) {
			const expectedLength = Buffer.byteLength(this.constantFileContent);
			return request.head(this.fileUrl, (err, res) => {
				expect(res.statusCode).to.equal(200);
				expect(res.headers['content-length']).to.equal(expectedLength.toString());
				return done();
			});
		});

		it("should be able get the file back", function(done){
			this.timeout(1000 * 10);
			return request.get(this.fileUrl, (err, response, body)=> {
				body.should.equal(this.constantFileContent);
				return done();
			});
		});

		it("should record an ingress metric when downloading the file", function(done){
			this.timeout(1000 * 10);
			return request.get(this.fileUrl, () => {
				return getMetric(this.filestoreUrl, 's3_ingress', metric => {
					expect(metric - this.previousIngress).to.equal(this.constantFileContent.length);
					return done();
				});
			});
		});

		it("should be able to get back the first 9 bytes of the file", function(done) {
			this.timeout(1000 * 10);
			const options = {
				uri: this.fileUrl,
				headers: {
					'Range': 'bytes=0-8'
				}
			};
			return request.get(options, (err, response, body)=> {
				body.should.equal('hello wor');
				return done();
			});
		});

		it("should record an ingress metric for a partial download", function(done){
			this.timeout(1000 * 10);
			const options = {
				uri: this.fileUrl,
				headers: {
					'Range': 'bytes=0-8'
				}
			};
			return request.get(options, ()=> {
				return getMetric(this.filestoreUrl, 's3_ingress', metric => {
					expect(metric - this.previousIngress).to.equal(9);
					return done();
				});
			});
		});

		it("should be able to get back bytes 4 through 10 of the file", function(done) {
			this.timeout(1000 * 10);
			const options = {
				uri: this.fileUrl,
				headers: {
					'Range': 'bytes=4-10'
				}
			};
			return request.get(options, (err, response, body)=> {
				body.should.equal('o world');
				return done();
			});
		});

		it("should be able to delete the file", function(done){
			this.timeout(1000 * 20);
			return request.del(this.fileUrl, (err, response, body)=> {
				response.statusCode.should.equal(204);
				return request.get(this.fileUrl, (err, response, body)=> {
					response.statusCode.should.equal(404);
					return done();
				});
			});
		});

		return it("should be able to copy files", function(done){
			this.timeout(1000 * 20);

			const newProjectID = "acceptence_tests_copyied_project";
			const newFileId = Math.random();
			const newFileUrl = `${this.filestoreUrl}/project/${newProjectID}/file/${newFileId}`;
			const opts = {
				method: 'put',
				uri: newFileUrl,
				json: {
					source: {
						project_id:"acceptence_tests",
						file_id: this.file_id
					}
				}
			};
			return request(opts, (err, response, body)=> {
				response.statusCode.should.equal(200);
				return request.del(this.fileUrl, (err, response, body)=> {
					response.statusCode.should.equal(204);
					return request.get(newFileUrl, (err, response, body)=> {
						body.should.equal(this.constantFileContent);
						return done();
					});
				});
			});
		});
	});

	return describe("with a pdf file", function() {

		beforeEach(function(done){
			this.timeout(1000 * 10);
			this.file_id = Math.random();
			this.fileUrl = `${this.filestoreUrl}/project/acceptence_tests/file/${this.file_id}`;
			this.localFileReadPath = __dirname + '/../../fixtures/test.pdf';
			return fs.stat(this.localFileReadPath, (err, stat) => {
				this.localFileSize = stat.size;
				const writeStream = request.post(this.fileUrl);

				writeStream.on("end", done);
				return fs.createReadStream(this.localFileReadPath).pipe(writeStream);
			});
		});

		it('should record an egress metric for the upload', function(done) {
			return getMetric(this.filestoreUrl, 's3_egress', metric => {
				expect(metric - this.previousEgress).to.equal(this.localFileSize);
				return done();
			});
		});

		it("should be able get the file back", function(done){
			this.timeout(1000 * 10);
			return request.get(this.fileUrl, (err, response, body)=> {
				expect(body.substring(0, 8)).to.equal('%PDF-1.5');
				return done();
			});
		});

		describe("getting the preview image", function() {

			beforeEach(function() {
				return this.previewFileUrl = `${this.fileUrl}?style=preview`;
			});

			it("should not time out", function(done) {
				this.timeout(1000 * 20);
				return request.get(this.previewFileUrl, (err, response, body) => {
					expect(response).to.not.equal(null);
					return done();
				});
			});

			return it("should respond with image data", function(done) {
				// note: this test relies of the imagemagick conversion working
				this.timeout(1000 * 20);
				return request.get(this.previewFileUrl, (err, response, body) => {
					expect(response.statusCode).to.equal(200);
					expect(body.length).to.be.greaterThan(400);
					return done();
				});
			});
		});

		return describe("warming the cache", function() {

			beforeEach(function() {
				return this.fileUrl = this.fileUrl + '?style=preview&cacheWarm=true';
			});

			it("should not time out", function(done) {
				this.timeout(1000 * 20);
				return request.get(this.fileUrl, (err, response, body) => {
					expect(response).to.not.equal(null);
					return done();
				});
			});

			return it("should respond with only an 'OK'", function(done) {
				// note: this test relies of the imagemagick conversion working
				this.timeout(1000 * 20);
				return request.get(this.fileUrl, (err, response, body) => {
					expect(response.statusCode).to.equal(200);
					body.should.equal('OK');
					return done();
				});
			});
		});
	});
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}