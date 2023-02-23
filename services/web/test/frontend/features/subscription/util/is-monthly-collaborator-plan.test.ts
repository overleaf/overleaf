import { expect } from 'chai'
import isMonthlyCollaboratorPlan from '../../../../../frontend/js/features/subscription/util/is-monthly-collaborator-plan'

describe('isMonthlyCollaboratorPlan', function () {
  it('returns false when a plan code without "collaborator" ', function () {
    expect(isMonthlyCollaboratorPlan('test', false)).to.be.false
  })
  it('returns false when on a plan with "collaborator" and "ann"', function () {
    expect(isMonthlyCollaboratorPlan('collaborator-annual', false)).to.be.false
  })
  it('returns false when on a plan with "collaborator" and without "ann" but is a group plan', function () {
    expect(isMonthlyCollaboratorPlan('collaborator', true)).to.be.false
  })
  it('returns true when on a plan with non-group "collaborator" monthly plan', function () {
    expect(isMonthlyCollaboratorPlan('collaborator', false)).to.be.true
  })
})
