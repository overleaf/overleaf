const { merge } = require('webpack-merge')
const TerserPlugin = require('terser-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const base = require('./webpack.config')

module.exports = merge(
  base,
  {
    mode: 'production',

    // Enable a full source map. Generates a comment linking to the source map
    devtool: 'hidden-source-map',

    optimization: {
      // Minify JS (with Terser) and CSS (with cssnano)
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            keep_classnames: /(Error|Exception)$/,
            keep_fnames: /(Error|Exception)$/,
          },
        }),
        new CssMinimizerPlugin({
          minimizerOptions: {
            // disable mergeLonghand to avoid a cssnano bug https://github.com/cssnano/cssnano/issues/864
            preset: ['default', { mergeLonghand: false }],
          },
        }),
      ],
    },

    plugins: [
      // Extract CSS to a separate file (rather than inlining to a <style> tag)
      new MiniCssExtractPlugin({
        // Output to public/stylesheets directory and append hash for immutable
        // caching
        filename: 'stylesheets/[name]-[contenthash].css',
      }),
    ],
  },
  {}
)
