import { expect } from 'vitest'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import PrivilegeLevels, {
  isPrivilegeUpgrade,
} from '../../../../app/src/Features/Authorization/PrivilegeLevels.mjs'

describe('PrivilegeLevels', function () {
  describe('isPrivilegeUpgrade', function () {
    it('returns true when upgrading from NONE to READ_ONLY', function () {
      expect(
        isPrivilegeUpgrade(PrivilegeLevels.NONE, PrivilegeLevels.READ_ONLY)
      ).to.be.true
    })

    it('returns true when upgrading from READ_ONLY to REVIEW', function () {
      expect(
        isPrivilegeUpgrade(PrivilegeLevels.READ_ONLY, PrivilegeLevels.REVIEW)
      ).to.be.true
    })

    it('returns true when upgrading from REVIEW to READ_AND_WRITE', function () {
      expect(
        isPrivilegeUpgrade(
          PrivilegeLevels.REVIEW,
          PrivilegeLevels.READ_AND_WRITE
        )
      ).to.be.true
    })

    it('returns true when upgrading from READ_AND_WRITE to OWNER', function () {
      expect(
        isPrivilegeUpgrade(
          PrivilegeLevels.READ_AND_WRITE,
          PrivilegeLevels.OWNER
        )
      ).to.be.true
    })

    it('returns true when upgrading by more than one step', function () {
      expect(isPrivilegeUpgrade(PrivilegeLevels.NONE, PrivilegeLevels.OWNER)).to
        .be.true
    })

    it('returns false when the levels are equal', function () {
      expect(
        isPrivilegeUpgrade(PrivilegeLevels.READ_ONLY, PrivilegeLevels.READ_ONLY)
      ).to.be.false
      expect(isPrivilegeUpgrade(PrivilegeLevels.OWNER, PrivilegeLevels.OWNER))
        .to.be.false
    })

    it('returns false when downgrading from OWNER to READ_AND_WRITE', function () {
      expect(
        isPrivilegeUpgrade(
          PrivilegeLevels.OWNER,
          PrivilegeLevels.READ_AND_WRITE
        )
      ).to.be.false
    })

    it('returns false when downgrading from READ_AND_WRITE to REVIEW', function () {
      expect(
        isPrivilegeUpgrade(
          PrivilegeLevels.READ_AND_WRITE,
          PrivilegeLevels.REVIEW
        )
      ).to.be.false
    })

    it('returns false when downgrading from REVIEW to READ_ONLY', function () {
      expect(
        isPrivilegeUpgrade(PrivilegeLevels.REVIEW, PrivilegeLevels.READ_ONLY)
      ).to.be.false
    })

    it('returns false when downgrading to NONE', function () {
      expect(
        isPrivilegeUpgrade(PrivilegeLevels.READ_ONLY, PrivilegeLevels.NONE)
      ).to.be.false
    })

    it('treats REVIEW as higher than READ_ONLY but lower than READ_AND_WRITE', function () {
      expect(
        isPrivilegeUpgrade(PrivilegeLevels.READ_ONLY, PrivilegeLevels.REVIEW)
      ).to.be.true
      expect(
        isPrivilegeUpgrade(
          PrivilegeLevels.REVIEW,
          PrivilegeLevels.READ_AND_WRITE
        )
      ).to.be.true
      expect(
        isPrivilegeUpgrade(
          PrivilegeLevels.READ_AND_WRITE,
          PrivilegeLevels.REVIEW
        )
      ).to.be.false
    })

    it('throws InvalidError when currentLevel is not a known privilege level', function () {
      expect(() =>
        isPrivilegeUpgrade('bogus', PrivilegeLevels.READ_ONLY)
      ).to.throw(Errors.InvalidError)
    })

    it('throws InvalidError when newLevel is not a known privilege level', function () {
      expect(() =>
        isPrivilegeUpgrade(PrivilegeLevels.READ_ONLY, 'bogus')
      ).to.throw(Errors.InvalidError)
    })

    it('throws InvalidError when both levels are invalid', function () {
      expect(() => isPrivilegeUpgrade('foo', 'bar')).to.throw(
        Errors.InvalidError
      )
    })

    it('throws InvalidError for undefined inputs', function () {
      expect(() =>
        isPrivilegeUpgrade(undefined, PrivilegeLevels.READ_ONLY)
      ).to.throw(Errors.InvalidError)
      expect(() =>
        isPrivilegeUpgrade(PrivilegeLevels.READ_ONLY, undefined)
      ).to.throw(Errors.InvalidError)
    })
  })
})
