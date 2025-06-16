const config = require('config')
const sinon = require('sinon')
const { expect } = require('chai')

const cleanup = require('../storage/support/cleanup')
const Rollout = require('../../../../api/app/rollout')

describe('rollout', function () {
  beforeEach(cleanup.everything)
  beforeEach('Set up stubs', function () {
    sinon.stub(config, 'has').callThrough()
    sinon.stub(config, 'get').callThrough()
  })
  afterEach(sinon.restore)

  it('should return a valid history buffer level', function () {
    setMockConfig('historyBufferLevel', '2')
    setMockConfig('forcePersistBuffer', 'false')

    const rollout = new Rollout(config)
    const { historyBufferLevel, forcePersistBuffer } =
      rollout.getHistoryBufferLevelOptions('test-project-id')
    expect(historyBufferLevel).to.equal(2)
    expect(forcePersistBuffer).to.be.false
  })

  it('should return a valid history buffer level and force persist buffer options', function () {
    setMockConfig('historyBufferLevel', '1')
    setMockConfig('forcePersistBuffer', 'true')
    const rollout = new Rollout(config)
    const { historyBufferLevel, forcePersistBuffer } =
      rollout.getHistoryBufferLevelOptions('test-project-id')
    expect(historyBufferLevel).to.equal(1)
    expect(forcePersistBuffer).to.be.true
  })

  describe('with a higher next history buffer level rollout', function () {
    beforeEach(function () {
      setMockConfig('historyBufferLevel', '2')
      setMockConfig('forcePersistBuffer', 'false')
      setMockConfig('nextHistoryBufferLevel', '3')
    })
    it('should return the expected history buffer level when the rollout percentage is zero', function () {
      setMockConfig('nextHistoryBufferLevelRolloutPercentage', '0')
      const rollout = new Rollout(config)
      for (let i = 0; i < 1000; i++) {
        const { historyBufferLevel, forcePersistBuffer } =
          rollout.getHistoryBufferLevelOptions(`test-project-id-${i}`)
        expect(historyBufferLevel).to.equal(2)
        expect(forcePersistBuffer).to.be.false
      }
    })

    it('should return the expected distribution of levels when the rollout percentage is 10%', function () {
      setMockConfig('nextHistoryBufferLevelRolloutPercentage', '10')
      const rollout = new Rollout(config)
      let currentLevel = 0
      let nextLevel = 0
      for (let i = 0; i < 1000; i++) {
        const { historyBufferLevel } = rollout.getHistoryBufferLevelOptions(
          `test-project-id-${i}`
        )
        switch (historyBufferLevel) {
          case 2:
            currentLevel++
            break
          case 3:
            nextLevel++
            break
          default:
            expect.fail(
              `Unexpected history buffer level: ${historyBufferLevel}`
            )
        }
      }
      const twoPercentage = (currentLevel / 1000) * 100
      const threePercentage = (nextLevel / 1000) * 100
      expect(twoPercentage).to.be.closeTo(90, 5) // 90% for level 2
      expect(threePercentage).to.be.closeTo(10, 5) // 10% for level 3
    })
  })
  describe('with a next history buffer level lower than the current level', function () {
    beforeEach(function () {
      setMockConfig('historyBufferLevel', '3')
      setMockConfig('forcePersistBuffer', 'false')
      setMockConfig('nextHistoryBufferLevel', '2')
    })
    it('should always return the current level when the rollout percentage is zero', function () {
      setMockConfig('nextHistoryBufferLevelRolloutPercentage', '0')
      const rollout = new Rollout(config)
      for (let i = 0; i < 1000; i++) {
        const { historyBufferLevel, forcePersistBuffer } =
          rollout.getHistoryBufferLevelOptions(`test-project-id-${i}`)
        expect(historyBufferLevel).to.equal(3)
        expect(forcePersistBuffer).to.be.false
      }
    })

    it('should always return the current level regardless of the rollout percentage', function () {
      setMockConfig('nextHistoryBufferLevelRolloutPercentage', '10')
      const rollout = new Rollout(config)
      for (let i = 0; i < 1000; i++) {
        const { historyBufferLevel } = rollout.getHistoryBufferLevelOptions(
          `test-project-id-${i}`
        )
        expect(historyBufferLevel).to.equal(3)
      }
    })
  })
})

function setMockConfig(path, value) {
  config.has.withArgs(path).returns(true)
  config.get.withArgs(path).returns(value)
}
