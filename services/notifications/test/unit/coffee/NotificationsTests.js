/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.should;
const should = chai.should();
const modulePath = "../../../app/js/Notifications.js";
const SandboxedModule = require('sandboxed-module');
const assert = require('assert');
const { ObjectId } = require("mongojs");

const user_id = "51dc93e6fb625a261300003b";
const notification_id = "fb625a26f09d";
const notification_key = "notification-key";

describe('Notifications Tests', function() {
	beforeEach(function() {
		const self = this;
		this.findStub = sinon.stub();
		this.insertStub = sinon.stub();
		this.countStub = sinon.stub();
		this.updateStub = sinon.stub();
		this.removeStub = sinon.stub();
		this.mongojs = () => {
			return {
				notifications: {
					update: self.mongojsUpdate,
					find: this.findStub,
					insert: this.insertStub,
					count: this.countStub,
					update: this.updateStub,
					remove: this.removeStub
				}
			};
		};
		this.mongojs.ObjectId = ObjectId;

		this.notifications = SandboxedModule.require(modulePath, {
			requires: {
				'logger-sharelatex': {
					log(){},
					error(){}
				},
				'settings-sharelatex': {},
				'mongojs':this.mongojs,
				'metrics-sharelatex': {timeAsyncMethod: sinon.stub()}
			},
			globals: {
				console
			}
		}
		);

		this.stubbedNotification = {user_id: ObjectId(user_id), key:"notification-key", messageOpts:"some info", templateKey:"template-key"};
		return this.stubbedNotificationArray = [this.stubbedNotification];});

	describe('getUserNotifications', () =>
		it("should find all notifications and return i", function(done){
			this.findStub.callsArgWith(1, null, this.stubbedNotificationArray);
			return this.notifications.getUserNotifications(user_id, (err, notifications)=> {
				notifications.should.equal(this.stubbedNotificationArray);
				assert.deepEqual(this.findStub.args[0][0], {"user_id" :ObjectId(user_id), "templateKey": {"$exists":true}});
				return done();
			});
		})
	);

	describe('addNotification', function() {
		beforeEach(function() {
			this.stubbedNotification = {
				user_id: ObjectId(user_id),
				key:"notification-key",
				messageOpts:"some info",
				templateKey:"template-key"
			};
			this.expectedDocument = {
				user_id: this.stubbedNotification.user_id,
				key:"notification-key",
				messageOpts:"some info",
				templateKey:"template-key"
			};
			this.expectedQuery = {
				user_id: this.stubbedNotification.user_id,
				key:"notification-key",
			};
			this.updateStub.yields();
			return this.countStub.yields(null, 0);
		});

		it('should insert the notification into the collection', function(done){
			return this.notifications.addNotification(user_id, this.stubbedNotification, err=> {
				expect(err).not.exists;
				sinon.assert.calledWith(this.updateStub, this.expectedQuery, this.expectedDocument, { upsert: true });
				return done();
			});
		});

		describe('when there is an existing notification', function(done) {
			beforeEach(function() {
				return this.countStub.yields(null, 1);
			});

			it('should fail to insert', function(done){
				return this.notifications.addNotification(user_id, this.stubbedNotification, err=> {
					expect(err).not.exists;
					sinon.assert.notCalled(this.updateStub);
					return done();
				});
			});

			return it("should update the key if forceCreate is true", function(done) {
				this.stubbedNotification.forceCreate = true;
				return this.notifications.addNotification(user_id, this.stubbedNotification, err=> {
					expect(err).not.exists;
					sinon.assert.calledWith(this.updateStub, this.expectedQuery, this.expectedDocument, { upsert: true });
					return done();
				});
			});
		});

		describe('when the notification is set to expire', function() {
			beforeEach(function() {
				this.stubbedNotification = {
					user_id: ObjectId(user_id),
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: '2922-02-13T09:32:56.289Z'
				};
				this.expectedDocument = {
					user_id: this.stubbedNotification.user_id,
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: new Date(this.stubbedNotification.expires),
				};
				return this.expectedQuery = {
					user_id: this.stubbedNotification.user_id,
					key:"notification-key",
				};});

			return it('should add an `expires` Date field to the document', function(done){
				return this.notifications.addNotification(user_id, this.stubbedNotification, err=> {
					expect(err).not.exists;
					sinon.assert.calledWith(this.updateStub, this.expectedQuery, this.expectedDocument, { upsert: true });
					return done();
				});
			});
		});

		return describe('when the notification has a nonsensical expires field', function() {
			beforeEach(function() {
				this.stubbedNotification = {
					user_id: ObjectId(user_id),
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: 'WAT'
				};
				return this.expectedDocument = {
					user_id: this.stubbedNotification.user_id,
					key:"notification-key",
					messageOpts:"some info",
					templateKey:"template-key",
					expires: new Date(this.stubbedNotification.expires),
				};});

			return it('should produce an error', function(done){
				return this.notifications.addNotification(user_id, this.stubbedNotification, err=> {
					(err instanceof Error).should.equal(true);
					sinon.assert.notCalled(this.updateStub);
					return done();
				});
			});
		});
	});

	describe('removeNotificationId', () =>
		it('should mark the notification id as read', function(done){
			this.updateStub.callsArgWith(2, null);

			return this.notifications.removeNotificationId(user_id, notification_id, err=> {
				const searchOps = {
					user_id:ObjectId(user_id),
					_id:ObjectId(notification_id)
				};
				const updateOperation =
					{"$unset": {templateKey:true, messageOpts:true}};
				assert.deepEqual(this.updateStub.args[0][0], searchOps);
				assert.deepEqual(this.updateStub.args[0][1], updateOperation);
				return done();
			});
		})
	);

	describe('removeNotificationKey', () =>
		it('should mark the notification key as read', function(done){
			this.updateStub.callsArgWith(2, null);

			return this.notifications.removeNotificationKey(user_id, notification_key, err=> {
				const searchOps = {
					user_id:ObjectId(user_id),
					key: notification_key
				};
				const updateOperation = {
					"$unset": {templateKey:true}
				};
				assert.deepEqual(this.updateStub.args[0][0], searchOps);
				assert.deepEqual(this.updateStub.args[0][1], updateOperation);
				return done();
			});
		})
	);

	describe('removeNotificationByKeyOnly', () =>
		it('should mark the notification key as read', function(done){
			this.updateStub.callsArgWith(2, null);

			return this.notifications.removeNotificationByKeyOnly(notification_key, err=> {
				const searchOps =
					{key: notification_key};
				const updateOperation =
					{"$unset": {templateKey:true}};
				assert.deepEqual(this.updateStub.args[0][0], searchOps);
				assert.deepEqual(this.updateStub.args[0][1], updateOperation);
				return done();
			});
		})
	);

	return describe('deleteNotificationByKeyOnly', () =>
		it('should completely remove the notification', function(done){
			this.removeStub.callsArgWith(2, null);

			return this.notifications.deleteNotificationByKeyOnly(notification_key, err=> {
				const searchOps =
					{key: notification_key};
				const opts =
					{justOne: true};
				assert.deepEqual(this.removeStub.args[0][0], searchOps);
				assert.deepEqual(this.removeStub.args[0][1], opts);
				return done();
			});
		})
	);
});
