/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const request = require("request").defaults({baseUrl: "http://localhost:3010"});

module.exports = {
	sendGlobalMessage(project_id, user_id, content, callback) {
		return request.post({
			url: `/project/${project_id}/messages`,
			json: {
				user_id,
				content
			}
		}, callback);
	},
	
	getGlobalMessages(project_id, callback) {
		return request.get({
			url: `/project/${project_id}/messages`,
			json: true
		}, callback);
	},

	sendMessage(project_id, thread_id, user_id, content, callback) {
		return request.post({
			url: `/project/${project_id}/thread/${thread_id}/messages`,
			json: {
				user_id,
				content
			}
		}, callback);
	},
	
	getThreads(project_id, callback) {
		return request.get({
			url: `/project/${project_id}/threads`,
			json: true
		}, callback);
	},
	
	resolveThread(project_id, thread_id, user_id, callback) {
		return request.post({
			url: `/project/${project_id}/thread/${thread_id}/resolve`,
			json: {
				user_id
			}
		}, callback);
	},

	reopenThread(project_id, thread_id, callback) {
		return request.post({
			url: `/project/${project_id}/thread/${thread_id}/reopen`,
		}, callback);
	},

	deleteThread(project_id, thread_id, callback) {
		return request.del({
			url: `/project/${project_id}/thread/${thread_id}`,
		}, callback);
	},

	editMessage(project_id, thread_id, message_id, content, callback) {
		return request.post({
			url: `/project/${project_id}/thread/${thread_id}/messages/${message_id}/edit`,
			json: {
				content
			}
		}, callback);
	},

	deleteMessage(project_id, thread_id, message_id, callback) {
		return request.del({
			url: `/project/${project_id}/thread/${thread_id}/messages/${message_id}`,
		}, callback);
	}
};
