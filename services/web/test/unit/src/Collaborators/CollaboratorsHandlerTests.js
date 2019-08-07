/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Collaborators/CollaboratorsHandler'
)
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors.js')
const { ObjectId } = require('mongojs')

describe('CollaboratorsHandler', function() {
  beforeEach(function() {
    this.CollaboratorHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub(),
          err: sinon.stub()
        }),
        '../User/UserCreator': (this.UserCreator = {}),
        '../User/UserGetter': (this.UserGetter = {}),
        '../Contacts/ContactManager': (this.ContactManager = {}),
        '../../models/Project': {
          Project: (this.Project = {})
        },
        '../Project/ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        './CollaboratorsEmailHandler': (this.CollaboratorsEmailHandler = {}),
        '../Errors/Errors': Errors,
        '../Project/ProjectEditorHandler': (this.ProjectEditorHandler = {})
      }
    })

    this.project_id = 'mock-project-id'
    this.user_id = 'mock-user-id'
    this.adding_user_id = 'adding-user-id'
    this.email = 'joe@sharelatex.com'
    return (this.callback = sinon.stub())
  })

  describe('getMemberIdsWithPrivilegeLevels', function() {
    describe('with project', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject = sinon.stub()
        this.ProjectGetter.getProject
          .withArgs(this.project_id, {
            owner_ref: 1,
            collaberator_refs: 1,
            readOnly_refs: 1,
            tokenAccessReadOnly_refs: 1,
            tokenAccessReadAndWrite_refs: 1,
            publicAccesLevel: 1
          })
          .yields(
            null,
            (this.project = {
              owner_ref: ['owner-ref'],
              readOnly_refs: ['read-only-ref-1', 'read-only-ref-2'],
              collaberator_refs: ['read-write-ref-1', 'read-write-ref-2']
            })
          )
        return this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels(
          this.project_id,
          this.callback
        )
      })

      it('should return an array of member ids with their privilege levels', function() {
        return this.callback
          .calledWith(null, [
            { id: 'owner-ref', privilegeLevel: 'owner', source: 'owner' },
            {
              id: 'read-write-ref-1',
              privilegeLevel: 'readAndWrite',
              source: 'invite'
            },
            {
              id: 'read-write-ref-2',
              privilegeLevel: 'readAndWrite',
              source: 'invite'
            },
            {
              id: 'read-only-ref-1',
              privilegeLevel: 'readOnly',
              source: 'invite'
            },
            {
              id: 'read-only-ref-2',
              privilegeLevel: 'readOnly',
              source: 'invite'
            }
          ])
          .should.equal(true)
      })
    })

    describe('with a missing project', function() {
      beforeEach(function() {
        return (this.ProjectGetter.getProject = sinon.stub().yields(null, null))
      })

      it('should return a NotFoundError', function(done) {
        return this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels(
          this.project_id,
          error => {
            error.should.be.instanceof(Errors.NotFoundError)
            return done()
          }
        )
      })
    })
  })

  describe('getMemberIds', function() {
    beforeEach(function() {
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels
        .withArgs(this.project_id)
        .yields(null, [
          { id: 'member-id-1', source: 'invite' },
          { id: 'member-id-2', source: 'token' }
        ])
      return this.CollaboratorHandler.getMemberIds(
        this.project_id,
        this.callback
      )
    })

    it('should return the ids', function() {
      return this.callback
        .calledWith(null, ['member-id-1', 'member-id-2'])
        .should.equal(true)
    })
  })

  describe('getInvitedMemberIds', function() {
    beforeEach(function() {
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels
        .withArgs(this.project_id)
        .yields(null, [
          { id: 'member-id-1', source: 'invite' },
          { id: 'member-id-2', source: 'token' }
        ])
      return this.CollaboratorHandler.getInvitedMemberIds(
        this.project_id,
        this.callback
      )
    })

    it('should return the invited ids', function() {
      return this.callback.calledWith(null, ['member-id-1']).should.equal(true)
    })
  })

  describe('getMembersWithPrivilegeLevels', function() {
    beforeEach(function() {
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels
        .withArgs(this.project_id)
        .yields(null, [
          {
            id: 'read-only-ref-1',
            privilegeLevel: 'readOnly',
            source: 'token'
          },
          {
            id: 'read-only-ref-2',
            privilegeLevel: 'readOnly',
            source: 'invite'
          },
          {
            id: 'read-write-ref-1',
            privilegeLevel: 'readAndWrite',
            source: 'token'
          },
          {
            id: 'read-write-ref-2',
            privilegeLevel: 'readAndWrite',
            source: 'invite'
          },
          {
            id: 'doesnt-exist',
            privilegeLevel: 'readAndWrite',
            source: 'invite'
          }
        ])
      this.UserGetter.getUserOrUserStubById = sinon.stub()
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-only-ref-1')
        .yields(null, { _id: 'read-only-ref-1' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-only-ref-2')
        .yields(null, { _id: 'read-only-ref-2' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-write-ref-1')
        .yields(null, { _id: 'read-write-ref-1' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-write-ref-2')
        .yields(null, { _id: 'read-write-ref-2' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('doesnt-exist')
        .yields(null, null)
      return this.CollaboratorHandler.getMembersWithPrivilegeLevels(
        this.project_id,
        this.callback
      )
    })

    it('should return an array of members with their privilege levels', function() {
      return this.callback
        .calledWith(null, [
          { user: { _id: 'read-only-ref-1' }, privilegeLevel: 'readOnly' },
          { user: { _id: 'read-only-ref-2' }, privilegeLevel: 'readOnly' },
          { user: { _id: 'read-write-ref-1' }, privilegeLevel: 'readAndWrite' },
          { user: { _id: 'read-write-ref-2' }, privilegeLevel: 'readAndWrite' }
        ])
        .should.equal(true)
    })
  })

  describe('getInvitedMembersWithPrivilegeLevels', function() {
    beforeEach(function() {
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels
        .withArgs(this.project_id)
        .yields(null, [
          {
            id: 'read-only-ref-1',
            privilegeLevel: 'readOnly',
            source: 'token'
          },
          {
            id: 'read-only-ref-2',
            privilegeLevel: 'readOnly',
            source: 'invite'
          },
          {
            id: 'read-write-ref-1',
            privilegeLevel: 'readAndWrite',
            source: 'token'
          },
          {
            id: 'read-write-ref-2',
            privilegeLevel: 'readAndWrite',
            source: 'invite'
          },
          {
            id: 'doesnt-exist',
            privilegeLevel: 'readAndWrite',
            source: 'invite'
          }
        ])
      this.UserGetter.getUserOrUserStubById = sinon.stub()
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-only-ref-1')
        .yields(null, { _id: 'read-only-ref-1' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-only-ref-2')
        .yields(null, { _id: 'read-only-ref-2' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-write-ref-1')
        .yields(null, { _id: 'read-write-ref-1' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-write-ref-2')
        .yields(null, { _id: 'read-write-ref-2' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('doesnt-exist')
        .yields(null, null)
      return this.CollaboratorHandler.getInvitedMembersWithPrivilegeLevels(
        this.project_id,
        this.callback
      )
    })

    it('should return an array of invited members with their privilege levels', function() {
      return this.callback
        .calledWith(null, [
          { user: { _id: 'read-only-ref-2' }, privilegeLevel: 'readOnly' },
          { user: { _id: 'read-write-ref-2' }, privilegeLevel: 'readAndWrite' }
        ])
        .should.equal(true)
    })
  })

  describe('getTokenMembersWithPrivilegeLevels', function() {
    beforeEach(function() {
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels
        .withArgs(this.project_id)
        .yields(null, [
          {
            id: 'read-only-ref-1',
            privilegeLevel: 'readOnly',
            source: 'token'
          },
          {
            id: 'read-only-ref-2',
            privilegeLevel: 'readOnly',
            source: 'invite'
          },
          {
            id: 'read-write-ref-1',
            privilegeLevel: 'readAndWrite',
            source: 'token'
          },
          {
            id: 'read-write-ref-2',
            privilegeLevel: 'readAndWrite',
            source: 'invite'
          },
          {
            id: 'doesnt-exist',
            privilegeLevel: 'readAndWrite',
            source: 'invite'
          }
        ])
      this.UserGetter.getUserOrUserStubById = sinon.stub()
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-only-ref-1')
        .yields(null, { _id: 'read-only-ref-1' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-only-ref-2')
        .yields(null, { _id: 'read-only-ref-2' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-write-ref-1')
        .yields(null, { _id: 'read-write-ref-1' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('read-write-ref-2')
        .yields(null, { _id: 'read-write-ref-2' })
      this.UserGetter.getUserOrUserStubById
        .withArgs('doesnt-exist')
        .yields(null, null)
      return this.CollaboratorHandler.getTokenMembersWithPrivilegeLevels(
        this.project_id,
        this.callback
      )
    })

    it('should return an array of token members with their privilege levels', function() {
      return this.callback
        .calledWith(null, [
          { user: { _id: 'read-only-ref-1' }, privilegeLevel: 'readOnly' },
          { user: { _id: 'read-write-ref-1' }, privilegeLevel: 'readAndWrite' }
        ])
        .should.equal(true)
    })
  })

  describe('getMemberIdPrivilegeLevel', function() {
    beforeEach(function() {
      this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub()
      return this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels
        .withArgs(this.project_id)
        .yields(null, [
          { id: 'member-id-1', privilegeLevel: 'readAndWrite' },
          { id: 'member-id-2', privilegeLevel: 'readOnly' }
        ])
    })

    it('should return the privilege level if it exists', function(done) {
      return this.CollaboratorHandler.getMemberIdPrivilegeLevel(
        'member-id-2',
        this.project_id,
        (error, level) => {
          expect(level).to.equal('readOnly')
          return done()
        }
      )
    })

    it('should return false if the member has no privilege level', function(done) {
      return this.CollaboratorHandler.getMemberIdPrivilegeLevel(
        'member-id-3',
        this.project_id,
        (error, level) => {
          expect(level).to.equal(false)
          return done()
        }
      )
    })
  })

  describe('isUserInvitedMemberOfProject', function() {
    beforeEach(function() {
      return (this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels = sinon.stub())
    })

    describe('when user is a member of the project', function() {
      beforeEach(function() {
        this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels
          .withArgs(this.project_id)
          .yields(null, [
            {
              id: 'not-the-user',
              privilegeLevel: 'readOnly',
              source: 'invite'
            },
            {
              id: this.user_id,
              privilegeLevel: 'readAndWrite',
              source: 'invite'
            }
          ])
        return this.CollaboratorHandler.isUserInvitedMemberOfProject(
          this.user_id,
          this.project_id,
          this.callback
        )
      })

      it('should return true and the privilegeLevel', function() {
        return this.callback
          .calledWith(null, true, 'readAndWrite')
          .should.equal(true)
      })
    })

    describe('when user is not a member of the project', function() {
      beforeEach(function() {
        this.CollaboratorHandler.getMemberIdsWithPrivilegeLevels
          .withArgs(this.project_id)
          .yields(null, [{ id: 'not-the-user', privilegeLevel: 'readOnly' }])
        return this.CollaboratorHandler.isUserInvitedMemberOfProject(
          this.user_id,
          this.project_id,
          this.callback
        )
      })

      it('should return false', function() {
        return this.callback.calledWith(null, false, null).should.equal(true)
      })
    })
  })

  describe('getProjectsUserIsMemberOf', function() {
    beforeEach(function() {
      this.fields = 'mock fields'
      this.Project.find = sinon.stub()
      this.Project.find
        .withArgs({ collaberator_refs: this.user_id }, this.fields)
        .yields(null, [
          'mock-read-write-project-1',
          'mock-read-write-project-2'
        ])
      this.Project.find
        .withArgs({ readOnly_refs: this.user_id }, this.fields)
        .yields(null, ['mock-read-only-project-1', 'mock-read-only-project-2'])
      this.Project.find
        .withArgs(
          {
            tokenAccessReadAndWrite_refs: this.user_id,
            publicAccesLevel: 'tokenBased'
          },
          this.fields
        )
        .yields(null, [
          'mock-token-read-write-project-1',
          'mock-token-read-write-project-2'
        ])
      this.Project.find
        .withArgs(
          {
            tokenAccessReadOnly_refs: this.user_id,
            publicAccesLevel: 'tokenBased'
          },
          this.fields
        )
        .yields(null, [
          'mock-token-read-only-project-1',
          'mock-token-read-only-project-2'
        ])
      return this.CollaboratorHandler.getProjectsUserIsMemberOf(
        this.user_id,
        this.fields,
        this.callback
      )
    })

    it('should call the callback with the projects', function() {
      return this.callback
        .calledWith(null, {
          readAndWrite: [
            'mock-read-write-project-1',
            'mock-read-write-project-2'
          ],
          readOnly: ['mock-read-only-project-1', 'mock-read-only-project-2'],
          tokenReadAndWrite: [
            'mock-token-read-write-project-1',
            'mock-token-read-write-project-2'
          ],
          tokenReadOnly: [
            'mock-token-read-only-project-1',
            'mock-token-read-only-project-2'
          ]
        })
        .should.equal(true)
    })
  })

  describe('removeUserFromProject', function() {
    beforeEach(function() {
      this.Project.update = sinon.stub().callsArg(2)
      return this.CollaboratorHandler.removeUserFromProject(
        this.project_id,
        this.user_id,
        this.callback
      )
    })

    it('should remove the user from mongo', function() {
      return this.Project.update
        .calledWith(
          {
            _id: this.project_id
          },
          {
            $pull: {
              collaberator_refs: this.user_id,
              readOnly_refs: this.user_id,
              tokenAccessReadOnly_refs: this.user_id,
              tokenAccessReadAndWrite_refs: this.user_id
            }
          }
        )
        .should.equal(true)
    })
  })

  describe('addUserToProject', function() {
    beforeEach(function() {
      this.Project.update = sinon.stub().callsArg(2)
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, (this.project = {}))
      this.ProjectEntityHandler.flushProjectToThirdPartyDataStore = sinon
        .stub()
        .callsArg(1)
      this.CollaboratorHandler.addEmailToProject = sinon
        .stub()
        .callsArgWith(4, null, this.user_id)
      return (this.ContactManager.addContact = sinon.stub())
    })

    describe('as readOnly', function() {
      beforeEach(function() {
        return this.CollaboratorHandler.addUserIdToProject(
          this.project_id,
          this.adding_user_id,
          this.user_id,
          'readOnly',
          this.callback
        )
      })

      it('should add the user to the readOnly_refs', function() {
        return this.Project.update
          .calledWith(
            {
              _id: this.project_id
            },
            {
              $addToSet: { readOnly_refs: this.user_id }
            }
          )
          .should.equal(true)
      })

      it('should flush the project to the TPDS', function() {
        return this.ProjectEntityHandler.flushProjectToThirdPartyDataStore
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should add the user as a contact for the adding user', function() {
        return this.ContactManager.addContact
          .calledWith(this.adding_user_id, this.user_id)
          .should.equal(true)
      })
    })

    describe('as readAndWrite', function() {
      beforeEach(function() {
        return this.CollaboratorHandler.addUserIdToProject(
          this.project_id,
          this.adding_user_id,
          this.user_id,
          'readAndWrite',
          this.callback
        )
      })

      it('should add the user to the collaberator_refs', function() {
        return this.Project.update
          .calledWith(
            {
              _id: this.project_id
            },
            {
              $addToSet: { collaberator_refs: this.user_id }
            }
          )
          .should.equal(true)
      })

      it('should flush the project to the TPDS', function() {
        return this.ProjectEntityHandler.flushProjectToThirdPartyDataStore
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('with invalid privilegeLevel', function() {
      beforeEach(function() {
        return this.CollaboratorHandler.addUserIdToProject(
          this.project_id,
          this.adding_user_id,
          this.user_id,
          'notValid',
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback.calledWith(new Error()).should.equal(true)
      })
    })

    describe('when user already exists as a collaborator', function() {
      beforeEach(function() {
        this.project.collaberator_refs = [this.user_id]
        return this.CollaboratorHandler.addUserIdToProject(
          this.project_id,
          this.adding_user_id,
          this.user_id,
          'readAndWrite',
          this.callback
        )
      })

      it('should not add the user again', function() {
        return this.Project.update.called.should.equal(false)
      })
    })

    describe('with null adding_user_id', function() {
      beforeEach(function() {
        return this.CollaboratorHandler.addUserIdToProject(
          this.project_id,
          null,
          this.user_id,
          'readAndWrite',
          this.callback
        )
      })

      it('should not add the adding user as a contact', function() {
        return this.ContactManager.addContact.called.should.equal(false)
      })
    })
  })

  describe('removeUserFromAllProjects', function() {
    beforeEach(function(done) {
      this.CollaboratorHandler.getProjectsUserIsMemberOf = sinon.stub()
      this.CollaboratorHandler.getProjectsUserIsMemberOf
        .withArgs(this.user_id, { _id: 1 })
        .yields(null, {
          readAndWrite: [
            { _id: 'read-and-write-0' },
            { _id: 'read-and-write-1' },
            null
          ],
          readOnly: [{ _id: 'read-only-0' }, { _id: 'read-only-1' }, null],
          tokenReadAndWrite: [
            { _id: 'token-read-and-write-0' },
            { _id: 'token-read-and-write-1' },
            null
          ],
          tokenReadOnly: [
            { _id: 'token-read-only-0' },
            { _id: 'token-read-only-1' },
            null
          ]
        })
      this.CollaboratorHandler.removeUserFromProject = sinon.stub().yields()
      return this.CollaboratorHandler.removeUserFromAllProjets(
        this.user_id,
        done
      )
    })

    it('should remove the user from each project', function() {
      const expectedProjects = [
        'read-and-write-0',
        'read-and-write-1',
        'read-only-0',
        'read-only-1',
        'token-read-and-write-0',
        'token-read-and-write-1',
        'token-read-only-0',
        'token-read-only-1'
      ]
      return Array.from(expectedProjects).map(project_id =>
        this.CollaboratorHandler.removeUserFromProject
          .calledWith(project_id, this.user_id)
          .should.equal(true)
      )
    })
  })

  describe('getAllInvitedMembers', function() {
    beforeEach(function() {
      this.owning_user = {
        _id: 'owner-id',
        email: 'owner@example.com',
        features: { a: 1 }
      }
      this.readwrite_user = {
        _id: 'readwrite-id',
        email: 'readwrite@example.com'
      }
      this.members = [
        { user: this.owning_user, privilegeLevel: 'owner' },
        { user: this.readwrite_user, privilegeLevel: 'readAndWrite' }
      ]
      this.CollaboratorHandler.getInvitedMembersWithPrivilegeLevels = sinon
        .stub()
        .callsArgWith(1, null, this.members)
      this.ProjectEditorHandler.buildOwnerAndMembersViews = sinon
        .stub()
        .returns(
          (this.views = {
            owner: this.owning_user,
            ownerFeatures: this.owning_user.features,
            members: [
              { _id: this.readwrite_user._id, email: this.readwrite_user.email }
            ]
          })
        )
      this.callback = sinon.stub()
      return this.CollaboratorHandler.getAllInvitedMembers(
        this.project_id,
        this.callback
      )
    })

    it('should not produce an error', function() {
      this.callback.callCount.should.equal(1)
      return expect(this.callback.firstCall.args[0]).to.equal(null)
    })

    it('should produce a list of members', function() {
      this.callback.callCount.should.equal(1)
      return expect(this.callback.firstCall.args[1]).to.deep.equal(
        this.views.members
      )
    })

    it('should call getMembersWithPrivileges', function() {
      this.CollaboratorHandler.getInvitedMembersWithPrivilegeLevels.callCount.should.equal(
        1
      )
      return this.CollaboratorHandler.getInvitedMembersWithPrivilegeLevels.firstCall.args[0].should.equal(
        this.project_id
      )
    })

    it('should call ProjectEditorHandler.buildOwnerAndMembersViews', function() {
      this.ProjectEditorHandler.buildOwnerAndMembersViews.callCount.should.equal(
        1
      )
      return this.ProjectEditorHandler.buildOwnerAndMembersViews.firstCall.args[0].should.equal(
        this.members
      )
    })

    describe('when getMembersWithPrivileges produces an error', function() {
      beforeEach(function() {
        this.CollaboratorHandler.getInvitedMembersWithPrivilegeLevels = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        this.ProjectEditorHandler.buildOwnerAndMembersViews = sinon
          .stub()
          .returns(
            (this.views = {
              owner: this.owning_user,
              ownerFeatures: this.owning_user.features,
              members: [
                {
                  _id: this.readwrite_user._id,
                  email: this.readwrite_user.email
                }
              ]
            })
          )
        this.callback = sinon.stub()
        return this.CollaboratorHandler.getAllInvitedMembers(
          this.project_id,
          this.callback
        )
      })

      it('should produce an error', function() {
        this.callback.callCount.should.equal(1)
        expect(this.callback.firstCall.args[0]).to.not.equal(null)
        return expect(this.callback.firstCall.args[0]).to.be.instanceof(Error)
      })

      it('should call getMembersWithPrivileges', function() {
        this.CollaboratorHandler.getInvitedMembersWithPrivilegeLevels.callCount.should.equal(
          1
        )
        return this.CollaboratorHandler.getInvitedMembersWithPrivilegeLevels.firstCall.args[0].should.equal(
          this.project_id
        )
      })

      it('should not call ProjectEditorHandler.buildOwnerAndMembersViews', function() {
        return this.ProjectEditorHandler.buildOwnerAndMembersViews.callCount.should.equal(
          0
        )
      })
    })
  })

  describe('userIsTokenMember', function() {
    beforeEach(function() {
      this.user_id = ObjectId()
      this.project_id = ObjectId()
      this.project = { _id: this.project_id }
      return (this.Project.findOne = sinon
        .stub()
        .callsArgWith(2, null, this.project))
    })

    it('should check the database', function(done) {
      return this.CollaboratorHandler.userIsTokenMember(
        this.user_id,
        this.project_id,
        (err, isTokenMember) => {
          this.Project.findOne.callCount.should.equal(1)
          return done()
        }
      )
    })

    it('should return true when the project is found', function(done) {
      return this.CollaboratorHandler.userIsTokenMember(
        this.user_id,
        this.project_id,
        (err, isTokenMember) => {
          expect(err).to.not.exist
          expect(isTokenMember).to.equal(true)
          return done()
        }
      )
    })

    it('should return false when the project is not found', function(done) {
      this.project = null
      this.Project.findOne = sinon.stub().callsArgWith(2, null, this.project)
      return this.CollaboratorHandler.userIsTokenMember(
        this.user_id,
        this.project_id,
        (err, isTokenMember) => {
          expect(err).to.not.exist
          expect(isTokenMember).to.equal(false)
          return done()
        }
      )
    })
  })

  describe('transferProjects', function() {
    beforeEach(function() {
      this.from_user_id = 'from-user-id'
      this.to_user_id = 'to-user-id'
      this.projects = [
        {
          _id: 'project-id-1'
        },
        {
          _id: 'project-id-2'
        }
      ]
      this.Project.find = sinon.stub().yields(null, this.projects)
      this.Project.update = sinon.stub().yields()
      return (this.ProjectEntityHandler.flushProjectToThirdPartyDataStore = sinon
        .stub()
        .yields())
    })

    describe('successfully', function() {
      beforeEach(function() {
        return this.CollaboratorHandler.transferProjects(
          this.from_user_id,
          this.to_user_id,
          this.callback
        )
      })

      it('should look up the affected projects', function() {
        return this.Project.find
          .calledWith({
            $or: [
              { owner_ref: this.from_user_id },
              { collaberator_refs: this.from_user_id },
              { readOnly_refs: this.from_user_id }
            ]
          })
          .should.equal(true)
      })

      it('should transfer owned projects', function() {
        return this.Project.update
          .calledWith(
            {
              owner_ref: this.from_user_id
            },
            {
              $set: { owner_ref: this.to_user_id }
            },
            {
              multi: true
            }
          )
          .should.equal(true)
      })

      it('should transfer collaborator projects', function() {
        this.Project.update
          .calledWith(
            {
              collaberator_refs: this.from_user_id
            },
            {
              $addToSet: { collaberator_refs: this.to_user_id }
            },
            {
              multi: true
            }
          )
          .should.equal(true)
        return this.Project.update
          .calledWith(
            {
              collaberator_refs: this.from_user_id
            },
            {
              $pull: { collaberator_refs: this.from_user_id }
            },
            {
              multi: true
            }
          )
          .should.equal(true)
      })

      it('should transfer read only collaborator projects', function() {
        this.Project.update
          .calledWith(
            {
              readOnly_refs: this.from_user_id
            },
            {
              $addToSet: { readOnly_refs: this.to_user_id }
            },
            {
              multi: true
            }
          )
          .should.equal(true)
        return this.Project.update
          .calledWith(
            {
              readOnly_refs: this.from_user_id
            },
            {
              $pull: { readOnly_refs: this.from_user_id }
            },
            {
              multi: true
            }
          )
          .should.equal(true)
      })

      it('should flush each project to the TPDS', function() {
        return Array.from(this.projects).map(project =>
          this.ProjectEntityHandler.flushProjectToThirdPartyDataStore
            .calledWith(project._id)
            .should.equal(true)
        )
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when flushing to TPDS fails', function() {
      beforeEach(function() {
        this.ProjectEntityHandler.flushProjectToThirdPartyDataStore = sinon
          .stub()
          .yields(new Error('oops'))
        return this.CollaboratorHandler.transferProjects(
          this.from_user_id,
          this.to_user_id,
          this.callback
        )
      })

      it('should log an error', function() {
        return this.logger.err.called.should.equal(true)
      })

      it('should not return an error since it happens in the background', function() {
        this.callback.called.should.equal(true)
        return this.callback.calledWith(new Error('oops')).should.equal(false)
      })
    })
  })
})
