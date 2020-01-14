const merge = require('webpack-merge')
const TerserPlugin = require('terser-webpack-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const base = require('./webpack.config')

module.exports = merge(base, {
  mode: 'production',

  // Enable a full source map. Generates a comment linking to the source map
  devtool: 'source-map',

  output: {
    // Override filename to include hash for immutable caching
    filename: 'js/[name]-[chunkhash].js'
  },

  optimization: {
    // Minify JS (with Terser) and CSS (with cssnano)
    minimizer: [new TerserPlugin(), new OptimizeCssAssetsPlugin()]
  },

  plugins: [
    // Extract CSS to a separate file (rather than inlining to a <style> tag)
    new MiniCssExtractPlugin({
      // Output to public/stylesheets directory and append hash for immutable caching
      filename: 'stylesheets/[name]-[chunkhash].css'
    })
  ]
})
