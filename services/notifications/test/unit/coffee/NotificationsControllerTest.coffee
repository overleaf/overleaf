sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../app/js/NotificationsController.js"
SandboxedModule = require('sandboxed-module')
assert = require('assert')

user_id = "51dc93e6fb625a261300003b"
notification_key = '123434'

describe 'Notifications controller', ->
