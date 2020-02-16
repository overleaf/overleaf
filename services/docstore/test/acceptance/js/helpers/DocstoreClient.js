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
let DocstoreClient;
const request = require("request").defaults({jar: false});
const {db, ObjectId} = require("../../../../app/js/mongojs");
const settings = require("settings-sharelatex");
const DocArchiveManager = require("../../../../app/js/DocArchiveManager.js");

module.exports = (DocstoreClient = {

	createDoc(project_id, doc_id, lines, version, ranges, callback) {
		if (callback == null) { callback = function(error) {}; }
		return DocstoreClient.updateDoc(project_id, doc_id, lines, version, ranges, callback);
	},

	getDoc(project_id, doc_id, qs, callback) {
		if (callback == null) { callback = function(error, res, body) {}; }
		return request.get({
			url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc/${doc_id}`,
			json: true,
			qs
		}, callback);
	},

	getAllDocs(project_id, callback) {
		if (callback == null) { callback = function(error, res, body) {}; }
		return request.get({
			url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc`,
			json: true
		}, callback);
	},

	getAllRanges(project_id, callback) {
		if (callback == null) { callback = function(error, res, body) {}; }
		return request.get({
			url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/ranges`,
			json: true
		}, callback);
	},

	updateDoc(project_id, doc_id, lines, version, ranges, callback) {
		if (callback == null) { callback = function(error, res, body) {}; }
		return request.post({
			url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc/${doc_id}`,
			json: {
				lines,
				version,
				ranges
			}
		}, callback);
	},

	deleteDoc(project_id, doc_id, callback) {
		if (callback == null) { callback = function(error, res, body) {}; }
		return request.del({
			url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc/${doc_id}`
		}, callback);
	},	
		
	archiveAllDoc(project_id, callback) {
		if (callback == null) { callback = function(error, res, body) {}; }
		return request.post({
			url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/archive`
		}, callback);
	},

	destroyAllDoc(project_id, callback) {
		if (callback == null) { callback = function(error, res, body) {}; }
		return request.post({
			url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/destroy`
		}, callback);
	},

	getS3Doc(project_id, doc_id, callback) {
		if (callback == null) { callback = function(error, res, body) {}; }
		const options = DocArchiveManager.buildS3Options(project_id+"/"+doc_id);
		options.json = true;
		return request.get(options, callback);
	}
});
