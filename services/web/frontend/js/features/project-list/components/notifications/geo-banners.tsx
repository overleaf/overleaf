import getMeta from '@/utils/meta'
import BRLBanner from './ads/brl-banner'
import INRBanner from './ads/inr-banner'
import LATAMBanner from './ads/latam-banner'

function GeoBanners() {
  const showInrGeoBanner = getMeta('ol-showInrGeoBanner')
  const showBrlGeoBanner = getMeta('ol-showBrlGeoBanner')
  const showLATAMBanner = getMeta('ol-showLATAMBanner')
  return (
    <>
      {showBrlGeoBanner && <BRLBanner />}
      {showLATAMBanner && <LATAMBanner />}
      {showInrGeoBanner && <INRBanner />}
    </>
  )
}

export default GeoBanners
