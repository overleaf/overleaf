/* eslint-disable
    camelcase,
    handle-callback-err,
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
const sinon = require("sinon");
const chai = require("chai");
chai.should();
const {db, ObjectId} = require("../../../app/js/mongojs");
const {
    expect
} = chai;
const DocstoreApp = require("./helpers/DocstoreApp");

const DocstoreClient = require("./helpers/DocstoreClient");

describe("Deleting a doc", function() {
	beforeEach(function(done) {
		this.project_id = ObjectId();
		this.doc_id = ObjectId();
		this.lines = ["original", "lines"];
		this.version = 42;
		this.ranges = [];
		return DocstoreApp.ensureRunning(() => {
			return DocstoreClient.createDoc(this.project_id, this.doc_id, this.lines, this.version, this.ranges, error => {
				if (error != null) { throw error; }
				return done();
			});
		});
	});

	describe("when the doc exists", function() {
		beforeEach(function(done) {
			return DocstoreClient.deleteDoc(this.project_id, this.doc_id, (error, res, doc) => {
				this.res = res;
				return done();
			});
		});

		afterEach(function(done) {
			return db.docs.remove({_id: this.doc_id}, done);
		});

		return it("should insert a deleted doc into the docs collection", function(done) {
			return db.docs.find({_id: this.doc_id}, (error, docs) => {
				docs[0]._id.should.deep.equal(this.doc_id);
				docs[0].lines.should.deep.equal(this.lines);
				docs[0].deleted.should.equal(true);
				return done();
			});
		});
	});

	return describe("when the doc does not exist", function() { return it("should return a 404", function(done) {
        const missing_doc_id = ObjectId();
        return DocstoreClient.deleteDoc(this.project_id, missing_doc_id, (error, res, doc) => {
            res.statusCode.should.equal(404);
            return done();
        });
    }); });
});

describe("Destroying a project's documents", function() {
	describe("when the doc exists", function() {
		beforeEach(function(done) {
			return db.docOps.insert({doc_id: ObjectId(this.doc_id), version: 1}, function(err) {
				if (err != null) { return done(err); }
				return DocstoreClient.destroyAllDoc(this.project_id, done);
			});
		});

		it("should remove the doc from the docs collection", function(done) {
			return db.docs.find({_id: this.doc_id}, (err, docs) => {
				expect(err).not.to.exist;
				expect(docs).to.deep.equal([]);
				return done();
			});
		});

		return it("should remove the docOps from the docOps collection", function(done) {
			return db.docOps.find({doc_id: this.doc_id}, (err, docOps) => {
				expect(err).not.to.exist;
				expect(docOps).to.deep.equal([]);
				return done();
			});
		});
	});

	return describe("when the doc is archived", function() {
		beforeEach(function(done) {
			return DocstoreClient.archiveAllDoc(this.project_id, function(err) {
				if (err != null) { return done(err); }
				return DocstoreClient.destroyAllDoc(this.project_id, done);
			});
		});

		it("should remove the doc from the docs collection", function(done) {
			return db.docs.find({_id: this.doc_id}, (err, docs) => {
				expect(err).not.to.exist;
				expect(docs).to.deep.equal([]);
				return done();
			});
		});

		it("should remove the docOps from the docOps collection", function(done) {
			return db.docOps.find({doc_id: this.doc_id}, (err, docOps) => {
				expect(err).not.to.exist;
				expect(docOps).to.deep.equal([]);
				return done();
			});
		});

		return it("should remove the doc contents from s3", function(done) {
			return DocstoreClient.getS3Doc(this.project_id, this.doc_id, (error, res, s3_doc) => {
				if (error != null) { throw error; }
				expect(res.statusCode).to.equal(404);
				return done();
			});
		});
	});
});
