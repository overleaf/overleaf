import getMeta from '@/utils/meta'
const images = getMeta('ol-imageNames') || []

const rollingImages = images
  .filter(img => img.rolling)
  .map(img => img.imageName)

export function onRollingBuild(imageName: string | undefined) {
  return Boolean(imageName && rollingImages.includes(imageName))
}
