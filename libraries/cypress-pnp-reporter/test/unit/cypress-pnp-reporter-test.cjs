'use strict'

const { expect } = require('chai')
const Mocha = require('mocha')
const JUnitReporter = require('mocha-junit-reporter')

const MultiReporters = require('../../index.cjs')

function buildReporters(reporterEnabled) {
  const runner = new Mocha.Runner(new Mocha.Suite(''))
  const reporter = new MultiReporters(runner, {
    reporterOptions: { reporterEnabled },
  })
  return reporter._reporters
}

describe('cypress-pnp-reporter', function () {
  it('exports cypress-multi-reporters', function () {
    expect(MultiReporters).to.equal(require('cypress-multi-reporters'))
  })

  it('registers mocha-junit-reporter on mocha', function () {
    expect(Mocha.reporters['mocha-junit-reporter']).to.equal(JUnitReporter)
  })

  it('builds the reporters used across the Cypress suites', function () {
    const reporters = buildReporters('spec, mocha-junit-reporter')

    expect(reporters).to.have.length(2)
    expect(reporters[0]).to.be.an.instanceOf(Mocha.reporters.spec)
    expect(reporters[1]).to.be.an.instanceOf(JUnitReporter)
  })

  it('prefers the reporter registered on mocha over resolving it by name', function () {
    // Cypress builds the reporters after the shim has handed module resolution
    // back, so mocha's registry is the only place mocha-junit-reporter can
    // still be found. Everything above this still passes if
    // cypress-multi-reporters resolves it by name instead, so pin the lookup
    // order with a reporter that is only reachable through the registry.
    class Sentinel {}
    const registered = Mocha.reporters['mocha-junit-reporter']
    Mocha.reporters['mocha-junit-reporter'] = Sentinel

    try {
      expect(buildReporters('mocha-junit-reporter')[0]).to.be.an.instanceOf(
        Sentinel
      )
    } finally {
      Mocha.reporters['mocha-junit-reporter'] = registered
    }
  })
})
