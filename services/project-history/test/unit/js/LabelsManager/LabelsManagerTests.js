/* eslint-disable
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import tk from 'timekeeper'
import { strict as esmock } from 'esmock'
const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/js/LabelsManager.js'

describe('LabelsManager', function () {
  beforeEach(async function () {
    this.now = new Date()
    tk.freeze(this.now)
    this.db = {
      projectHistoryLabels: {
        deleteOne: sinon.stub(),
        find: sinon.stub(),
        insertOne: sinon.stub(),
      },
    }
    this.mongodb = {
      ObjectId,
      db: this.db,
    }
    this.HistoryStoreManager = {
      getChunkAtVersion: sinon.stub().yields(),
    }
    this.UpdatesProcessor = {
      processUpdatesForProject: sinon.stub().yields(),
    }
    this.WebApiManager = {
      getHistoryId: sinon.stub(),
    }
    this.LabelsManager = await esmock(MODULE_PATH, {
      '../../../../app/js/mongodb.js': this.mongodb,
      '../../../../app/js/HistoryStoreManager.js': this.HistoryStoreManager,
      '../../../../app/js/UpdatesProcessor.js': this.UpdatesProcessor,
      '../../../../app/js/WebApiManager.js': this.WebApiManager,
    })

    this.project_id = new ObjectId().toString()
    this.historyId = 123
    this.user_id = new ObjectId().toString()
    this.label_id = new ObjectId().toString()
    return (this.callback = sinon.stub())
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('getLabels', function () {
    beforeEach(function () {
      this.label = {
        _id: new ObjectId(),
        comment: 'some comment',
        version: 123,
        user_id: new ObjectId(),
        created_at: new Date(),
      }

      this.db.projectHistoryLabels.find.returns({
        toArray: sinon.stub().yields(null, [this.label]),
      })
    })

    describe('with valid project id', function () {
      beforeEach(function () {
        return this.LabelsManager.getLabels(this.project_id, this.callback)
      })

      it('gets the labels state from mongo', function () {
        return expect(
          this.db.projectHistoryLabels.find
        ).to.have.been.calledWith({ project_id: new ObjectId(this.project_id) })
      })

      return it('returns formatted labels', function () {
        return expect(this.callback).to.have.been.calledWith(null, [
          sinon.match({
            id: this.label._id,
            comment: this.label.comment,
            version: this.label.version,
            user_id: this.label.user_id,
            created_at: this.label.created_at,
          }),
        ])
      })
    })

    return describe('with invalid project id', function () {
      return it('returns an error', function (done) {
        return this.LabelsManager.getLabels('invalid id', error => {
          expect(error).to.exist
          return done()
        })
      })
    })
  })

  describe('createLabel', function () {
    beforeEach(function () {
      this.version = 123
      this.comment = 'a comment'
      this.WebApiManager.getHistoryId.yields(null, this.historyId)
    })

    describe('with createdAt', function () {
      beforeEach(function () {
        this.createdAt = new Date(1)
        this.db.projectHistoryLabels.insertOne.yields(null, {
          insertedId: new ObjectId(this.label_id),
        })
        return this.LabelsManager.createLabel(
          this.project_id,
          this.user_id,
          this.version,
          this.comment,
          this.createdAt,
          true,
          this.callback
        )
      })

      it('flushes unprocessed updates', function () {
        return expect(
          this.UpdatesProcessor.processUpdatesForProject
        ).to.have.been.calledWith(this.project_id)
      })

      it('finds the V1 project id', function () {
        return expect(this.WebApiManager.getHistoryId).to.have.been.calledWith(
          this.project_id
        )
      })

      it('checks there is a chunk for the project + version', function () {
        return expect(
          this.HistoryStoreManager.getChunkAtVersion
        ).to.have.been.calledWith(this.project_id, this.historyId, this.version)
      })

      it('create the label in mongo', function () {
        return expect(
          this.db.projectHistoryLabels.insertOne
        ).to.have.been.calledWith(
          sinon.match({
            project_id: new ObjectId(this.project_id),
            comment: this.comment,
            version: this.version,
            user_id: new ObjectId(this.user_id),
            created_at: this.createdAt,
          }),
          sinon.match.any
        )
      })

      return it('returns the label', function () {
        return expect(this.callback).to.have.been.calledWith(null, {
          id: new ObjectId(this.label_id),
          comment: this.comment,
          version: this.version,
          user_id: new ObjectId(this.user_id),
          created_at: this.createdAt,
        })
      })
    })

    describe('without createdAt', function () {
      beforeEach(function () {
        this.db.projectHistoryLabels.insertOne.yields(null, {
          insertedId: new ObjectId(this.label_id),
        })
        return this.LabelsManager.createLabel(
          this.project_id,
          this.user_id,
          this.version,
          this.comment,
          undefined,
          true,
          this.callback
        )
      })

      return it('create the label with the current date', function () {
        return expect(
          this.db.projectHistoryLabels.insertOne
        ).to.have.been.calledWith(
          sinon.match({
            project_id: new ObjectId(this.project_id),
            comment: this.comment,
            version: this.version,
            user_id: new ObjectId(this.user_id),
            created_at: this.now,
          })
        )
      })
    })

    return describe('with shouldValidateExists = false', function () {
      beforeEach(function () {
        this.createdAt = new Date(1)
        this.db.projectHistoryLabels.insertOne.yields(null, {
          insertedId: new ObjectId(this.label_id),
        })
        return this.LabelsManager.createLabel(
          this.project_id,
          this.user_id,
          this.version,
          this.comment,
          this.createdAt,
          false,
          this.callback
        )
      })

      return it('checks there is a chunk for the project + version', function () {
        return expect(this.HistoryStoreManager.getChunkAtVersion).to.not.have
          .been.called
      })
    })
  })

  describe('deleteLabelForUser', function () {
    beforeEach(function () {
      this.db.projectHistoryLabels.deleteOne.yields()
      return this.LabelsManager.deleteLabelForUser(
        this.project_id,
        this.user_id,
        this.label_id,
        this.callback
      )
    })

    return it('removes the label from the database', function () {
      return expect(
        this.db.projectHistoryLabels.deleteOne
      ).to.have.been.calledWith(
        {
          _id: new ObjectId(this.label_id),
          project_id: new ObjectId(this.project_id),
          user_id: new ObjectId(this.user_id),
        },
        this.callback
      )
    })
  })

  return describe('deleteLabel', function () {
    beforeEach(function () {
      this.db.projectHistoryLabels.deleteOne.yields()
      return this.LabelsManager.deleteLabel(
        this.project_id,
        this.label_id,
        this.callback
      )
    })

    return it('removes the label from the database', function () {
      return expect(
        this.db.projectHistoryLabels.deleteOne
      ).to.have.been.calledWith(
        {
          _id: new ObjectId(this.label_id),
          project_id: new ObjectId(this.project_id),
        },
        this.callback
      )
    })
  })
})
