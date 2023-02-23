import { expect } from 'chai'
import canExtendTrial from '../../../../../frontend/js/features/subscription/util/can-extend-trial'

describe('canExtendTrial', function () {
  const d = new Date()
  d.setDate(d.getDate() + 6)

  it('returns false when no trial end date', function () {
    expect(canExtendTrial('collab')).to.be.false
  })
  it('returns false when a plan code without "collaborator" ', function () {
    expect(canExtendTrial('test', false, d.toString())).to.be.false
  })
  it('returns false when on a plan with trial date in future but has "collaborator" and "ann" in plan code', function () {
    expect(canExtendTrial('collaborator-annual', false, d.toString())).to.be
      .false
  })
  it('returns false when on a plan with trial date in future and plan code has "collaborator" and no "ann" but is a group plan', function () {
    expect(canExtendTrial('collaborator', true, d.toString())).to.be.false
  })
  it('returns true when on a plan with "collaborator" and without "ann" and trial date in future', function () {
    expect(canExtendTrial('collaborator', false, d.toString())).to.be.true
  })
})
