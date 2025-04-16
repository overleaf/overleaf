import getMeta from '@/utils/meta'

// The reason this is a function is to ensure that the meta tag is read before
// any isBootstrap5 check is performed
export const isBootstrap5 = () => getMeta('ol-bootstrapVersion') === 5
