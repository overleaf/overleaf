const _ = require('lodash')
const { expect } = require('chai')

const modulePath = '../../../../app/src/Features/Project/ProjectEditorHandler'
const SandboxedModule = require('sandboxed-module')

describe('ProjectEditorHandler', function () {
  beforeEach(function () {
    this.project = {
      _id: 'project-id',
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
                  lines: (this.lines = ['line 1', 'line 2', 'line 3']),
                },
              ],
              fileRefs: [
                {
                  _id: 'file-id',
                  name: 'image.png',
                  created: (this.created = new Date()),
                  size: 1234,
                },
              ],
              folders: [],
            },
          ],
        },
      ],
      deletedDocs: [
        {
          _id: 'deleted-doc-id',
          name: 'main.tex',
          deletedAt: (this.deletedAt = new Date('2017-01-01')),
        },
      ],
    }
    this.members = [
      {
        user: (this.owner = {
          _id: 'owner-id',
          first_name: 'Owner',
          last_name: 'Overleaf',
          email: 'owner@overleaf.com',
        }),
        privilegeLevel: 'owner',
      },
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
    this.invites = [
      {
        _id: 'invite_one',
        email: 'user-one@example.com',
        privileges: 'readOnly',
        projectId: this.project._id,
        token: 'my-secret-token1',
      },
      {
        _id: 'invite_two',
        email: 'user-two@example.com',
        privileges: 'readOnly',
        projectId: this.project._id,
        token: 'my-secret-token2',
      },
    ]
    this.deletedDocsFromDocstore = [
      { _id: 'deleted-doc-id-from-docstore', name: 'docstore.tex' },
    ]
    this.handler = SandboxedModule.require(modulePath)
  })

  describe('buildProjectModelView', function () {
    describe('with owner, members and invites included', function () {
      beforeEach(function () {
        this.result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          this.invites,
          this.deletedDocsFromDocstore
        )
      })

      it('should include the id', function () {
        expect(this.result._id).to.exist
        this.result._id.should.equal('project-id')
      })

      it('should include the name', function () {
        expect(this.result.name).to.exist
        this.result.name.should.equal('Project Name')
      })

      it('should include the root doc id', function () {
        expect(this.result.rootDoc_id).to.exist
        this.result.rootDoc_id.should.equal('file-id')
      })

      it('should include the public access level', function () {
        expect(this.result.publicAccesLevel).to.exist
        this.result.publicAccesLevel.should.equal('private')
      })

      it('should include the owner', function () {
        expect(this.result.owner).to.exist
        this.result.owner._id.should.equal('owner-id')
        this.result.owner.email.should.equal('owner@overleaf.com')
        this.result.owner.first_name.should.equal('Owner')
        this.result.owner.last_name.should.equal('Overleaf')
        this.result.owner.privileges.should.equal('owner')
      })

      it('should include the deletedDocs', function () {
        expect(this.result.deletedDocs).to.exist
        this.result.deletedDocs.should.deep.equal([
          {
            // omit deletedAt field
            _id: this.project.deletedDocs[0]._id,
            name: this.project.deletedDocs[0].name,
          },
          this.deletedDocsFromDocstore[0],
        ])
      })

      it('should gather readOnly_refs and collaberators_refs into a list of members', function () {
        const findMember = id => {
          for (const member of this.result.members) {
            if (member._id === id) {
              return member
            }
          }
          return null
        }

        this.result.members.length.should.equal(2)

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

      it('should include folders in the project', function () {
        this.result.rootFolder[0]._id.should.equal('root-folder-id')
        this.result.rootFolder[0].name.should.equal('')

        this.result.rootFolder[0].folders[0]._id.should.equal('sub-folder-id')
        this.result.rootFolder[0].folders[0].name.should.equal('folder')
      })

      it('should not duplicate folder contents', function () {
        this.result.rootFolder[0].docs.length.should.equal(0)
        this.result.rootFolder[0].fileRefs.length.should.equal(0)
      })

      it('should include files in the project', function () {
        this.result.rootFolder[0].folders[0].fileRefs[0]._id.should.equal(
          'file-id'
        )
        this.result.rootFolder[0].folders[0].fileRefs[0].name.should.equal(
          'image.png'
        )
        this.result.rootFolder[0].folders[0].fileRefs[0].created.should.equal(
          this.created
        )
        expect(this.result.rootFolder[0].folders[0].fileRefs[0].size).not.to
          .exist
      })

      it('should include docs in the project but not the lines', function () {
        this.result.rootFolder[0].folders[0].docs[0]._id.should.equal('doc-id')
        this.result.rootFolder[0].folders[0].docs[0].name.should.equal(
          'main.tex'
        )
        expect(this.result.rootFolder[0].folders[0].docs[0].lines).not.to.exist
      })

      it('should include invites', function () {
        expect(this.result.invites).to.exist
        this.result.invites.should.deep.equal(
          this.invites.map(invite =>
            _.pick(invite, ['_id', 'email', 'privileges'])
          )
        )
      })

      it('invites should not include the token', function () {
        for (const invite of this.result.invites) {
          expect(invite.token).not.to.exist
        }
      })
    })

    describe('when docstore sends a deleted doc that is also present in the project', function () {
      beforeEach(function () {
        this.deletedDocsFromDocstore.push(this.project.deletedDocs[0])
        this.result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          this.invites,
          this.deletedDocsFromDocstore
        )
      })

      it('should not send any duplicate', function () {
        expect(this.result.deletedDocs).to.exist
        this.result.deletedDocs.should.deep.equal([
          this.project.deletedDocs[0],
          this.deletedDocsFromDocstore[0],
        ])
      })
    })

    describe('deletedByExternalDataSource', function () {
      it('should set the deletedByExternalDataSource flag to false when it is not there', function () {
        delete this.project.deletedByExternalDataSource
        const result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          [],
          []
        )
        result.deletedByExternalDataSource.should.equal(false)
      })

      it('should set the deletedByExternalDataSource flag to false when it is false', function () {
        const result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          [],
          []
        )
        result.deletedByExternalDataSource.should.equal(false)
      })

      it('should set the deletedByExternalDataSource flag to true when it is true', function () {
        this.project.deletedByExternalDataSource = true
        const result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          [],
          []
        )
        result.deletedByExternalDataSource.should.equal(true)
      })
    })

    describe('features', function () {
      beforeEach(function () {
        this.owner.features = {
          versioning: true,
          collaborators: 3,
          compileGroup: 'priority',
          compileTimeout: 96,
        }
        this.result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          [],
          []
        )
      })

      it('should copy the owner features to the project', function () {
        this.result.features.versioning.should.equal(
          this.owner.features.versioning
        )
        this.result.features.collaborators.should.equal(
          this.owner.features.collaborators
        )
        this.result.features.compileGroup.should.equal(
          this.owner.features.compileGroup
        )
        this.result.features.compileTimeout.should.equal(
          this.owner.features.compileTimeout
        )
      })
    })

    describe('trackChangesState', function () {
      describe('when the owner does not have the trackChanges feature', function () {
        beforeEach(function () {
          this.owner.features = {
            trackChanges: false,
          }
          this.result = this.handler.buildProjectModelView(
            this.project,
            this.members,
            [],
            []
          )
        })
        it('should not emit trackChangesState', function () {
          expect(this.result.trackChangesState).to.not.exist
        })
      })

      describe('when the owner has got the trackChanges feature', function () {
        beforeEach(function () {
          this.owner.features = {
            trackChanges: true,
          }
        })

        function genCase([dbEntry, expected]) {
          describe(`when track_changes is ${JSON.stringify(
            dbEntry
          )}`, function () {
            beforeEach(function () {
              this.project.track_changes = dbEntry
              this.result = this.handler.buildProjectModelView(
                this.project,
                this.members,
                [],
                []
              )
            })
            it(`should set trackChangesState=${expected}`, function () {
              expect(this.result.trackChangesState).to.deep.equal(expected)
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

  describe('buildOwnerAndMembersViews', function () {
    beforeEach(function () {
      this.owner.features = {
        versioning: true,
        collaborators: 3,
        compileGroup: 'priority',
        compileTimeout: 22,
      }
      this.result = this.handler.buildOwnerAndMembersViews(this.members)
    })

    it('should produce an object with the right keys', function () {
      expect(this.result).to.have.all.keys([
        'owner',
        'ownerFeatures',
        'members',
      ])
    })

    it('should separate the owner from the members', function () {
      this.result.members.length.should.equal(this.members.length - 1)
      expect(this.result.owner._id).to.equal(this.owner._id)
      expect(this.result.owner.email).to.equal(this.owner.email)
      expect(
        this.result.members.filter(m => m._id === this.owner._id).length
      ).to.equal(0)
    })

    it('should extract the ownerFeatures from the owner object', function () {
      expect(this.result.ownerFeatures).to.deep.equal(this.owner.features)
    })

    describe('when there is no owner', function () {
      beforeEach(function () {
        // remove the owner from members list
        this.membersWithoutOwner = this.members.filter(
          m => m.user._id !== this.owner._id
        )
        this.result = this.handler.buildOwnerAndMembersViews(
          this.membersWithoutOwner
        )
      })

      it('should produce an object with the right keys', function () {
        expect(this.result).to.have.all.keys([
          'owner',
          'ownerFeatures',
          'members',
        ])
      })

      it('should not separate out an owner', function () {
        this.result.members.length.should.equal(this.membersWithoutOwner.length)
        expect(this.result.owner).to.equal(null)
      })

      it('should not extract the ownerFeatures from the owner object', function () {
        expect(this.result.ownerFeatures).to.equal(null)
      })
    })
  })
})
