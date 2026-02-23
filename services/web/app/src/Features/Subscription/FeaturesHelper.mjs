import _ from 'lodash'
import Settings from '@overleaf/settings'

/**
 * merges an array of feature sets to produce a final feature set
 */
function computeFeatureSet(featureSets) {
  return featureSets.reduce(mergeFeatures, {})
}

/**
 * Merge feature sets coming from different sources
 */
function mergeFeatures(featuresA, featuresB) {
  const features = Object.assign({}, featuresA)
  for (const key in featuresB) {
    // Special merging logic for non-boolean features
    if (key === 'compileGroup') {
      if (
        features.compileGroup === 'priority' ||
        featuresB.compileGroup === 'priority'
      ) {
        features.compileGroup = 'priority'
      } else {
        features.compileGroup = 'standard'
      }
    } else if (key === 'collaborators') {
      if (features.collaborators === -1 || featuresB.collaborators === -1) {
        features.collaborators = -1
      } else {
        features.collaborators = Math.max(
          features.collaborators || 0,
          featuresB.collaborators || 0
        )
      }
    } else if (key === 'compileTimeout') {
      features.compileTimeout = Math.max(
        features.compileTimeout || 0,
        featuresB.compileTimeout || 0
      )
    } else {
      // Boolean keys, true is better
      features[key] = features[key] || featuresB[key]
    }
  }
  if (features.mendeley && features.referencesSearch && features.zotero) {
    // Back fill legacy feature flag for isFeatureSetBetter to work properly
    //  with professional feature overrides.
    features.references = true
  }
  return features
}

/**
 * Returns whether `featuresA` is a better feature set than `featuresB`
 */
function isFeatureSetBetter(featuresA, featuresB) {
  const mergedFeatures = mergeFeatures(featuresA, featuresB)
  return _.isEqual(featuresA, mergedFeatures)
}

/**
 * Return what's missing from `currentFeatures` to equal `expectedFeatures`
 */
function compareFeatures(currentFeatures, expectedFeatures) {
  currentFeatures = _.clone(currentFeatures)
  expectedFeatures = _.clone(expectedFeatures)
  if (_.isEqual(currentFeatures, expectedFeatures)) {
    return {}
  }

  const mismatchReasons = {}
  const featureKeys = [
    ...new Set([
      ...Object.keys(currentFeatures),
      ...Object.keys(expectedFeatures),
    ]),
  ]
  featureKeys.sort().forEach(key => {
    if (expectedFeatures[key] !== currentFeatures[key]) {
      mismatchReasons[key] = expectedFeatures[key]
    }
  })

  if (mismatchReasons.compileTimeout) {
    // store the compile timeout difference instead of the new compile timeout
    mismatchReasons.compileTimeout =
      expectedFeatures.compileTimeout - currentFeatures.compileTimeout
  }

  if (mismatchReasons.collaborators) {
    // store the collaborators difference instead of the new number only
    // replace -1 by 100 to make it clearer
    if (expectedFeatures.collaborators === -1) {
      expectedFeatures.collaborators = 100
    }
    if (currentFeatures.collaborators === -1) {
      currentFeatures.collaborators = 100
    }
    mismatchReasons.collaborators =
      expectedFeatures.collaborators - currentFeatures.collaborators
  }

  return mismatchReasons
}

function getMatchedFeatureSet(features) {
  for (const [name, featureSet] of Object.entries(Settings.features)) {
    if (_.isEqual(features, featureSet)) {
      return name
    }
  }
  return 'mixed'
}

export default {
  mergeFeatures,
  computeFeatureSet,
  isFeatureSetBetter,
  compareFeatures,
  getMatchedFeatureSet,
}
