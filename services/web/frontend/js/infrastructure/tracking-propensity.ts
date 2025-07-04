import getMeta from '@/utils/meta'
import {
  createTrackingLoader,
  insertScript,
} from '@/infrastructure/tracking-loader'

const { propensityId } = getMeta('ol-ExposedSettings')

const loadPropensityScript = (id: string) => {
  insertScript({
    src: 'https://cdn.propensity.com/propensity/propensity_analytics.js',
    crossorigin: 'anonymous',
    onload: () => {
      if (typeof window.propensity !== 'undefined') {
        window.propensity(id)
      }
    },
  })
}

if (propensityId) {
  createTrackingLoader(() => loadPropensityScript(propensityId), 'Propensity')
}
