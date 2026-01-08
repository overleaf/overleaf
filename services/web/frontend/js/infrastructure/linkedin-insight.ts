import getMeta from '@/utils/meta'
import {
  createTrackingLoader,
  insertScript,
} from '@/infrastructure/tracking-loader'

const loadLinkedInInsightScript = (linkedInInsightsPartnerId: string) => {
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || []
  window._linkedin_data_partner_ids.push(linkedInInsightsPartnerId)

  if (!window.lintrk) {
    window.lintrk = Object.assign(
      (a: string, b?: unknown) => {
        window.lintrk!.q.push([a, b])
      },
      { q: [] }
    )
  }
  insertScript({
    src: 'https://snap.licdn.com/li.lms-analytics/insight.min.js',
    async: true,
  })
}

const { linkedInInsightsPartnerId } = getMeta('ol-ExposedSettings')

if (linkedInInsightsPartnerId) {
  createTrackingLoader(
    () => loadLinkedInInsightScript(linkedInInsightsPartnerId),
    'LinkedIn Insight'
  )
}
