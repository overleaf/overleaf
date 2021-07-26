const SplitTestManager = require('./SplitTestManager')

async function getSplitTests(req, res, next) {
  try {
    const splitTests = await SplitTestManager.getSplitTests()
    res.send(splitTests)
  } catch (error) {
    res.status(500).json({
      error: `Error while fetching split tests list: ${error.message}`,
    })
  }
}

async function createSplitTest(req, res, next) {
  const { name, configuration } = req.body
  try {
    const splitTest = await SplitTestManager.createSplitTest(
      name,
      configuration
    )
    res.send(splitTest)
  } catch (error) {
    res
      .status(500)
      .json({ error: `Error while creating split test: ${error.message}` })
  }
}

async function updateSplitTest(req, res, next) {
  const { name, configuration } = req.body
  try {
    const splitTest = await SplitTestManager.updateSplitTest(
      name,
      configuration
    )
    res.send(splitTest)
  } catch (error) {
    res
      .status(500)
      .json({ error: `Error while updating split test: ${error.message}` })
  }
}

async function switchToNextPhase(req, res, next) {
  const { name } = req.body
  try {
    const splitTest = await SplitTestManager.switchToNextPhase(name)
    res.send(splitTest)
  } catch (error) {
    res.status(500).json({
      error: `Error while switching split test to next phase: ${error.message}`,
    })
  }
}

async function revertToPreviousVersion(req, res, next) {
  const { name, versionNumber } = req.body
  try {
    const splitTest = await SplitTestManager.revertToPreviousVersion(
      name,
      versionNumber
    )
    res.send(splitTest)
  } catch (error) {
    res.status(500).json({
      error: `Error while reverting to previous version: ${error.message}`,
    })
  }
}

module.exports = {
  getSplitTests,
  createSplitTest,
  updateSplitTest,
  switchToNextPhase,
  revertToPreviousVersion,
}
