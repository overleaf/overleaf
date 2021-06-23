import getMeta from './meta'

// Configure dynamically loaded assets (via webpack) to be downloaded from CDN
// See: https://webpack.js.org/guides/public-path/#on-the-fly
// eslint-disable-next-line no-undef, camelcase
__webpack_public_path__ = getMeta('ol-baseAssetPath')
