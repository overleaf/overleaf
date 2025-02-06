import {
  pathToProjectFolder,
  projectBlobsBucket,
} from '../../../../storage/lib/backupPersistor.mjs'
import { expect } from 'chai'

describe('backupPersistor', () => {
  describe('pathToProjectFolder', () => {
    it('handles postgres and mongo-ids', function () {
      expect(pathToProjectFolder(projectBlobsBucket, '100/000/000')).to.equal(
        '100/000/000/'
      )
      expect(pathToProjectFolder(projectBlobsBucket, '100/000/000/')).to.equal(
        '100/000/000/'
      )
      expect(
        pathToProjectFolder(projectBlobsBucket, '100/000/000/foo')
      ).to.equal('100/000/000/')
      expect(pathToProjectFolder(projectBlobsBucket, '210/000/000')).to.equal(
        '210/000/000/'
      )
      expect(pathToProjectFolder(projectBlobsBucket, '987/654/321')).to.equal(
        '987/654/321/'
      )
      expect(pathToProjectFolder(projectBlobsBucket, '987/654/3219')).to.equal(
        '987/654/3219/'
      )
      expect(
        pathToProjectFolder(projectBlobsBucket, 'fed/cba/987654321000000000')
      ).to.equal('fed/cba/987654321000000000/')
      expect(
        pathToProjectFolder(projectBlobsBucket, 'fed/cba/987654321000000000/')
      ).to.equal('fed/cba/987654321000000000/')
      expect(
        pathToProjectFolder(
          projectBlobsBucket,
          'fed/cba/987654321000000000/foo'
        )
      ).to.equal('fed/cba/987654321000000000/')
    })

    it('rejects invalid input', function () {
      const cases = ['', '//', '1/2/3', '123/456/78', 'abc/d/e', 'abc/def/012']
      for (const key of cases) {
        expect(() => {
          pathToProjectFolder(projectBlobsBucket, key)
        }, key).to.throw('invalid project folder')
      }
    })
  })
})
