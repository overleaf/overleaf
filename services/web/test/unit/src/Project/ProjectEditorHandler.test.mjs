import _ from 'lodash'
import { expect } from 'vitest'

const modulePath = '../../../../app/src/Features/Project/ProjectEditorHandler'

describe('ProjectEditorHandler', function () {
  beforeEach(async function (ctx) {
    ctx.project = {
      _id: 'project-id',
      owner_ref: 'owner-id',
      name: 'Project Name',
      rootDoc_id: 'file-id',
      publicAccesLevel: 'private',
      deletedByExternalDataSource: false,
      rootFolder: [
        {
          _id: 'root-folder-id',
          name: '',
          docs: [],
          fileRefs: [],
          folders: [
            {
              _id: 'sub-folder-id',
              name: 'folder',
              docs: [
                {
                  _id: 'doc-id',
                  name: 'main.tex',
                  lines: (ctx.lines = ['line 1', 'line 2', 'line 3']),
                },
              ],
              fileRefs: [
                {
                  _id: 'file-id',
                  name: 'image.png',
                  created: (ctx.created = new Date()),
                  size: 1234,
                },
              ],
              folders: [],
            },
          ],
        },
      ],
    }
    ctx.ownerMember = {
      user: (ctx.owner = {
        _id: 'owner-id',
        first_name: 'Owner',
        last_name: 'Overleaf',
        email: 'owner@overleaf.com',
        features: {
          compileTimeout: 240,
        },
      }),
      privilegeLevel: 'owner',
    }
    ctx.members = [
      {
        user: {
          _id: 'read-only-id',
          first_name: 'Read',
          last_name: 'Only',
          email: 'read-only@overleaf.com',
        },
        privilegeLevel: 'readOnly',
      },
      {
        user: {
          _id: 'read-write-id',
          first_name: 'Read',
          last_name: 'Write',
          email: 'read-write@overleaf.com',
        },
        privilegeLevel: 'readAndWrite',
      },
    ]
    ctx.invites = [
      {
        _id: 'invite_one',
        email: 'user-one@example.com',
        privileges: 'readOnly',
        projectId: ctx.project._id,
        token: 'my-secret-token1',
      },
      {
        _id: 'invite_two',
        email: 'user-two@example.com',
        privileges: 'readOnly',
        projectId: ctx.project._id,
        token: 'my-secret-token2',
      },
    ]
    ctx.handler = (await import(modulePath)).default
  })

  describe('buildProjectModelView', function () {
    describe('with owner, members and invites included', function () {
      beforeEach(function (ctx) {
        ctx.result = ctx.handler.buildProjectModelView(
          ctx.project,
          ctx.ownerMember,
          ctx.members,
          ctx.invites,
          false
        )
      })

      it('should include the id', function (ctx) {
        expect(ctx.result._id).to.exist
        ctx.result._id.should.equal('project-id')
      })

      it('should include the name', function (ctx) {
        expect(ctx.result.name).to.exist
        ctx.result.name.should.equal('Project Name')
      })

      it('should include the root doc id', function (ctx) {
        expect(ctx.result.rootDoc_id).to.exist
        ctx.result.rootDoc_id.should.equal('file-id')
      })

      it('should include the public access level', function (ctx) {
        expect(ctx.result.publicAccesLevel).to.exist
        ctx.result.publicAccesLevel.should.equal('private')
      })

      it('should include the owner', function (ctx) {
        expect(ctx.result.owner).to.exist
        ctx.result.owner._id.should.equal('owner-id')
        ctx.result.owner.email.should.equal('owner@overleaf.com')
        ctx.result.owner.first_name.should.equal('Owner')
        ctx.result.owner.last_name.should.equal('Overleaf')
        ctx.result.owner.privileges.should.equal('owner')
      })

      it('should gather readOnly_refs and collaberators_refs into a list of members', function (ctx) {
        const findMember = id => {
          for (const member of ctx.result.members) {
            if (member._id === id) {
              return member
            }
          }
          return null
        }

        ctx.result.members.length.should.equal(2)

        expect(findMember('read-only-id')).to.exist
        findMember('read-only-id').privileges.should.equal('readOnly')
        findMember('read-only-id').first_name.should.equal('Read')
        findMember('read-only-id').last_name.should.equal('Only')
        findMember('read-only-id').email.should.equal('read-only@overleaf.com')

        expect(findMember('read-write-id')).to.exist
        findMember('read-write-id').privileges.should.equal('readAndWrite')
        findMember('read-write-id').first_name.should.equal('Read')
        findMember('read-write-id').last_name.should.equal('Write')
        findMember('read-write-id').email.should.equal(
          'read-write@overleaf.com'
        )
      })

      it('should include folders in the project', function (ctx) {
        ctx.result.rootFolder[0]._id.should.equal('root-folder-id')
        ctx.result.rootFolder[0].name.should.equal('')

        ctx.result.rootFolder[0].folders[0]._id.should.equal('sub-folder-id')
        ctx.result.rootFolder[0].folders[0].name.should.equal('folder')
      })

      it('should not duplicate folder contents', function (ctx) {
        ctx.result.rootFolder[0].docs.length.should.equal(0)
        ctx.result.rootFolder[0].fileRefs.length.should.equal(0)
      })

      it('should include files in the project', function (ctx) {
        ctx.result.rootFolder[0].folders[0].fileRefs[0]._id.should.equal(
          'file-id'
        )
        ctx.result.rootFolder[0].folders[0].fileRefs[0].name.should.equal(
          'image.png'
        )
        ctx.result.rootFolder[0].folders[0].fileRefs[0].created.should.equal(
          ctx.created
        )
        expect(ctx.result.rootFolder[0].folders[0].fileRefs[0].size).not.to
          .exist
      })

      it('should include docs in the project but not the lines', function (ctx) {
        ctx.result.rootFolder[0].folders[0].docs[0]._id.should.equal('doc-id')
        ctx.result.rootFolder[0].folders[0].docs[0].name.should.equal(
          'main.tex'
        )
        expect(ctx.result.rootFolder[0].folders[0].docs[0].lines).not.to.exist
      })

      it('should include invites', function (ctx) {
        expect(ctx.result.invites).to.exist
        ctx.result.invites.should.deep.equal(
          ctx.invites.map(invite =>
            _.pick(invite, ['_id', 'email', 'privileges'])
          )
        )
      })

      it('invites should not include the token', function (ctx) {
        for (const invite of ctx.result.invites) {
          expect(invite.token).not.to.exist
        }
      })

      it('should have the correct features', function (ctx) {
        expect(ctx.result.features.compileTimeout).to.equal(240)
      })
    })

    describe('with a restricted user', function () {
      beforeEach(function (ctx) {
        ctx.result = ctx.handler.buildProjectModelView(
          ctx.project,
          ctx.ownerMember,
          [],
          [],
          true
        )
      })

      it('should include the id', function (ctx) {
        expect(ctx.result._id).to.exist
        ctx.result._id.should.equal('project-id')
      })

      it('should include the name', function (ctx) {
        expect(ctx.result.name).to.exist
        ctx.result.name.should.equal('Project Name')
      })

      it('should include the root doc id', function (ctx) {
        expect(ctx.result.rootDoc_id).to.exist
        ctx.result.rootDoc_id.should.equal('file-id')
      })

      it('should include the public access level', function (ctx) {
        expect(ctx.result.publicAccesLevel).to.exist
        ctx.result.publicAccesLevel.should.equal('private')
      })

      it('should hide the owner', function (ctx) {
        expect(ctx.result.owner).to.deep.equal({ _id: 'owner-id' })
      })

      it('should hide members', function (ctx) {
        ctx.result.members.length.should.equal(0)
      })

      it('should include folders in the project', function (ctx) {
        ctx.result.rootFolder[0]._id.should.equal('root-folder-id')
        ctx.result.rootFolder[0].name.should.equal('')

        ctx.result.rootFolder[0].folders[0]._id.should.equal('sub-folder-id')
        ctx.result.rootFolder[0].folders[0].name.should.equal('folder')
      })

      it('should not duplicate folder contents', function (ctx) {
        ctx.result.rootFolder[0].docs.length.should.equal(0)
        ctx.result.rootFolder[0].fileRefs.length.should.equal(0)
      })

      it('should include files in the project', function (ctx) {
        ctx.result.rootFolder[0].folders[0].fileRefs[0]._id.should.equal(
          'file-id'
        )
        ctx.result.rootFolder[0].folders[0].fileRefs[0].name.should.equal(
          'image.png'
        )
        ctx.result.rootFolder[0].folders[0].fileRefs[0].created.should.equal(
          ctx.created
        )
        expect(ctx.result.rootFolder[0].folders[0].fileRefs[0].size).not.to
          .exist
      })

      it('should include docs in the project but not the lines', function (ctx) {
        ctx.result.rootFolder[0].folders[0].docs[0]._id.should.equal('doc-id')
        ctx.result.rootFolder[0].folders[0].docs[0].name.should.equal(
          'main.tex'
        )
        expect(ctx.result.rootFolder[0].folders[0].docs[0].lines).not.to.exist
      })

      it('should hide invites', function (ctx) {
        expect(ctx.result.invites).to.have.length(0)
      })

      it('should have the correct features', function (ctx) {
        expect(ctx.result.features.compileTimeout).to.equal(240)
      })
    })

    describe('deletedByExternalDataSource', function () {
      it('should set the deletedByExternalDataSource flag to false when it is not there', function (ctx) {
        delete ctx.project.deletedByExternalDataSource
        const result = ctx.handler.buildProjectModelView(
          ctx.project,
          ctx.ownerMember,
          ctx.members,
          [],
          false
        )
        result.deletedByExternalDataSource.should.equal(false)
      })

      it('should set the deletedByExternalDataSource flag to false when it is false', function (ctx) {
        const result = ctx.handler.buildProjectModelView(
          ctx.project,
          ctx.ownerMember,
          ctx.members,
          [],
          false
        )
        result.deletedByExternalDataSource.should.equal(false)
      })

      it('should set the deletedByExternalDataSource flag to true when it is true', function (ctx) {
        ctx.project.deletedByExternalDataSource = true
        const result = ctx.handler.buildProjectModelView(
          ctx.project,
          ctx.ownerMember,
          ctx.members,
          [],
          false
        )
        result.deletedByExternalDataSource.should.equal(true)
      })
    })

    describe('features', function () {
      beforeEach(function (ctx) {
        ctx.owner.features = {
          versioning: true,
          collaborators: 3,
          compileGroup: 'priority',
          compileTimeout: 96,
        }
        ctx.result = ctx.handler.buildProjectModelView(
          ctx.project,
          ctx.ownerMember,
          ctx.members,
          [],
          false
        )
      })

      it('should copy the owner features to the project', function (ctx) {
        ctx.result.features.versioning.should.equal(
          ctx.owner.features.versioning
        )
        ctx.result.features.collaborators.should.equal(
          ctx.owner.features.collaborators
        )
        ctx.result.features.compileGroup.should.equal(
          ctx.owner.features.compileGroup
        )
        ctx.result.features.compileTimeout.should.equal(
          ctx.owner.features.compileTimeout
        )
      })
    })

    describe('trackChangesState', function () {
      describe('when the owner does not have the trackChanges feature', function () {
        beforeEach(function (ctx) {
          ctx.owner.features = {
            trackChanges: false,
          }
          ctx.result = ctx.handler.buildProjectModelView(
            ctx.project,
            ctx.ownerMember,
            ctx.members,
            [],
            false
          )
        })
        it('should not emit trackChangesState', function (ctx) {
          expect(ctx.result.trackChangesState).to.not.exist
        })
      })

      describe('when the owner has got the trackChanges feature', function () {
        beforeEach(function (ctx) {
          ctx.owner.features = {
            trackChanges: true,
          }
        })

        function genCase([dbEntry, expected]) {
          describe(`when track_changes is ${JSON.stringify(
            dbEntry
          )}`, function () {
            beforeEach(function (ctx) {
              ctx.project.track_changes = dbEntry
              ctx.result = ctx.handler.buildProjectModelView(
                ctx.project,
                ctx.ownerMember,
                ctx.members,
                [],
                false
              )
            })
            it(`should set trackChangesState=${expected}`, function (ctx) {
              expect(ctx.result.trackChangesState).to.deep.equal(expected)
            })
          })
        }

        const CASES = [
          [null, false],
          [false, false],
          [true, true],
          [{ someId: true }, { someId: true }],
        ]
        CASES.map(genCase)
      })
    })
  })
})
