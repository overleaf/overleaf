import getMeta from '@/utils/meta'

export function isIEEEBranded() {
  const brandVariation = getMeta('ol-brandVariation')
  const { ieeeBrandId } = getMeta('ol-ExposedSettings')

  return brandVariation?.brand_id === ieeeBrandId
}
