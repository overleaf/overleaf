import getMeta from './meta'

// Configure dynamically loaded assets (via webpack) to be downloaded from CDN
// See: https://webpack.js.org/guides/public-path/#on-the-fly
__webpack_public_path__ = getMeta('ol-baseAssetPath')
