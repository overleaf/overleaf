import getMeta from '@/utils/meta'
import INRBanner from './ads/inr-banner'
import LATAMBanner from './ads/latam-banner'

function GeoBanners() {
  const showInrGeoBanner = getMeta('ol-showInrGeoBanner')
  const showLATAMBanner = getMeta('ol-showLATAMBanner')
  return (
    <>
      {showLATAMBanner && <LATAMBanner />}
      {showInrGeoBanner && <INRBanner />}
    </>
  )
}

export default GeoBanners
