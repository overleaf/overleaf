/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
const { expect } = chai
const should = chai.should()

const modulePath = '../../../../app/src/Features/Project/ProjectEditorHandler'
const SandboxedModule = require('sandboxed-module')

describe('ProjectEditorHandler', function() {
  beforeEach(function() {
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
                  lines: (this.lines = ['line 1', 'line 2', 'line 3'])
                }
              ],
              fileRefs: [
                {
                  _id: 'file-id',
                  name: 'image.png',
                  created: (this.created = new Date()),
                  size: 1234
                }
              ],
              folders: []
            }
          ]
        }
      ],
      deletedDocs: [
        {
          _id: 'deleted-doc-id',
          name: 'main.tex',
          deletedAt: (this.deletedAt = new Date('2017-01-01'))
        }
      ]
    }
    this.members = [
      {
        user: (this.owner = {
          _id: 'owner-id',
          first_name: 'Owner',
          last_name: 'ShareLaTeX',
          email: 'owner@sharelatex.com'
        }),
        privilegeLevel: 'owner'
      },
      {
        user: {
          _id: 'read-only-id',
          first_name: 'Read',
          last_name: 'Only',
          email: 'read-only@sharelatex.com'
        },
        privilegeLevel: 'readOnly'
      },
      {
        user: {
          _id: 'read-write-id',
          first_name: 'Read',
          last_name: 'Write',
          email: 'read-write@sharelatex.com'
        },
        privilegeLevel: 'readAndWrite'
      }
    ]
    this.invites = [
      {
        _id: 'invite_one',
        email: 'user-one@example.com',
        privileges: 'readOnly',
        projectId: this.project._id
      },
      {
        _id: 'invite_two',
        email: 'user-two@example.com',
        privileges: 'readOnly',
        projectId: this.project._id
      }
    ]
    return (this.handler = SandboxedModule.require(modulePath))
  })

  describe('buildProjectModelView', function() {
    describe('with owner and members included', function() {
      beforeEach(function() {
        return (this.result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          this.invites
        ))
      })

      it('should include the id', function() {
        should.exist(this.result._id)
        return this.result._id.should.equal('project-id')
      })

      it('should include the name', function() {
        should.exist(this.result.name)
        return this.result.name.should.equal('Project Name')
      })

      it('should include the root doc id', function() {
        should.exist(this.result.rootDoc_id)
        return this.result.rootDoc_id.should.equal('file-id')
      })

      it('should include the public access level', function() {
        should.exist(this.result.publicAccesLevel)
        return this.result.publicAccesLevel.should.equal('private')
      })

      it('should include the owner', function() {
        should.exist(this.result.owner)
        this.result.owner._id.should.equal('owner-id')
        this.result.owner.email.should.equal('owner@sharelatex.com')
        this.result.owner.first_name.should.equal('Owner')
        this.result.owner.last_name.should.equal('ShareLaTeX')
        return this.result.owner.privileges.should.equal('owner')
      })

      it('should include the deletedDocs', function() {
        should.exist(this.result.deletedDocs)
        return this.result.deletedDocs.should.equal(this.project.deletedDocs)
      })

      it('should gather readOnly_refs and collaberators_refs into a list of members', function() {
        const findMember = id => {
          for (let member of Array.from(this.result.members)) {
            if (member._id === id) {
              return member
            }
          }
          return null
        }

        this.result.members.length.should.equal(2)

        should.exist(findMember('read-only-id'))
        findMember('read-only-id').privileges.should.equal('readOnly')
        findMember('read-only-id').first_name.should.equal('Read')
        findMember('read-only-id').last_name.should.equal('Only')
        findMember('read-only-id').email.should.equal(
          'read-only@sharelatex.com'
        )

        should.exist(findMember('read-write-id'))
        findMember('read-write-id').privileges.should.equal('readAndWrite')
        findMember('read-write-id').first_name.should.equal('Read')
        findMember('read-write-id').last_name.should.equal('Write')
        return findMember('read-write-id').email.should.equal(
          'read-write@sharelatex.com'
        )
      })

      it('should include folders in the project', function() {
        this.result.rootFolder[0]._id.should.equal('root-folder-id')
        this.result.rootFolder[0].name.should.equal('')

        this.result.rootFolder[0].folders[0]._id.should.equal('sub-folder-id')
        return this.result.rootFolder[0].folders[0].name.should.equal('folder')
      })

      it('should not duplicate folder contents', function() {
        this.result.rootFolder[0].docs.length.should.equal(0)
        return this.result.rootFolder[0].fileRefs.length.should.equal(0)
      })

      it('should include files in the project', function() {
        this.result.rootFolder[0].folders[0].fileRefs[0]._id.should.equal(
          'file-id'
        )
        this.result.rootFolder[0].folders[0].fileRefs[0].name.should.equal(
          'image.png'
        )
        this.result.rootFolder[0].folders[0].fileRefs[0].created.should.equal(
          this.created
        )
        return should.not.exist(
          this.result.rootFolder[0].folders[0].fileRefs[0].size
        )
      })

      it('should include docs in the project but not the lines', function() {
        this.result.rootFolder[0].folders[0].docs[0]._id.should.equal('doc-id')
        this.result.rootFolder[0].folders[0].docs[0].name.should.equal(
          'main.tex'
        )
        return should.not.exist(
          this.result.rootFolder[0].folders[0].docs[0].lines
        )
      })

      it('should include invites', function() {
        should.exist(this.result.invites)
        return this.result.invites.should.deep.equal(this.invites)
      })
    })

    describe('deletedByExternalDataSource', function() {
      it('should set the deletedByExternalDataSource flag to false when it is not there', function() {
        delete this.project.deletedByExternalDataSource
        const result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          [],
          []
        )
        return result.deletedByExternalDataSource.should.equal(false)
      })

      it('should set the deletedByExternalDataSource flag to false when it is false', function() {
        const result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          [],
          []
        )
        return result.deletedByExternalDataSource.should.equal(false)
      })

      it('should set the deletedByExternalDataSource flag to true when it is true', function() {
        this.project.deletedByExternalDataSource = true
        const result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          [],
          []
        )
        return result.deletedByExternalDataSource.should.equal(true)
      })
    })

    describe('features', function() {
      beforeEach(function() {
        this.owner.features = {
          versioning: true,
          collaborators: 3,
          compileGroup: 'priority',
          compileTimeout: 96
        }
        return (this.result = this.handler.buildProjectModelView(
          this.project,
          this.members,
          [],
          []
        ))
      })

      it('should copy the owner features to the project', function() {
        this.result.features.versioning.should.equal(
          this.owner.features.versioning
        )
        this.result.features.collaborators.should.equal(
          this.owner.features.collaborators
        )
        this.result.features.compileGroup.should.equal(
          this.owner.features.compileGroup
        )
        return this.result.features.compileTimeout.should.equal(
          this.owner.features.compileTimeout
        )
      })
    })
  })

  describe('buildOwnerAndMembersViews', function() {
    beforeEach(function() {
      this.owner.features = {
        versioning: true,
        collaborators: 3,
        compileGroup: 'priority',
        compileTimeout: 22
      }
      return (this.result = this.handler.buildOwnerAndMembersViews(
        this.members
      ))
    })

    it('should produce an object with the right keys', function() {
      return expect(this.result).to.have.all.keys([
        'owner',
        'ownerFeatures',
        'members'
      ])
    })

    it('should separate the owner from the members', function() {
      this.result.members.length.should.equal(this.members.length - 1)
      expect(this.result.owner._id).to.equal(this.owner._id)
      expect(this.result.owner.email).to.equal(this.owner.email)
      return expect(
        this.result.members.filter(m => m._id === this.owner._id).length
      ).to.equal(0)
    })

    it('should extract the ownerFeatures from the owner object', function() {
      return expect(this.result.ownerFeatures).to.deep.equal(
        this.owner.features
      )
    })

    describe('when there is no owner', function() {
      beforeEach(function() {
        // remove the owner from members list
        this.membersWithoutOwner = this.members.filter(
          m => m.user._id !== this.owner._id
        )
        return (this.result = this.handler.buildOwnerAndMembersViews(
          this.membersWithoutOwner
        ))
      })

      it('should produce an object with the right keys', function() {
        return expect(this.result).to.have.all.keys([
          'owner',
          'ownerFeatures',
          'members'
        ])
      })

      it('should not separate out an owner', function() {
        this.result.members.length.should.equal(this.membersWithoutOwner.length)
        return expect(this.result.owner).to.equal(null)
      })

      it('should not extract the ownerFeatures from the owner object', function() {
        return expect(this.result.ownerFeatures).to.equal(null)
      })
    })
  })
})
