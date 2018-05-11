const fs = require('fs')
const path = require('path')
const webpack = require('webpack')

const MODULES_PATH = path.join(__dirname, '/modules')
const webpackENV = process.env.WEBPACK_ENV || 'development'

// Generate a hash of entry points, including modules
const entryPoints = {}
if (fs.existsSync(MODULES_PATH)) {
	fs.readdirSync(MODULES_PATH).reduce((acc, module) => {
		const entryPath = path.join(MODULES_PATH, module, '/public/es/index.js')
		if (fs.existsSync(entryPath)) {
			acc[module] = entryPath
		}
		return acc
	}, entryPoints)
}

// If no entry points are found, silently exit
if (!Object.keys(entryPoints).length) {
	console.warn('No entry points found, exiting')
	process.exit(0)
}

module.exports = {
	// Defines the "entry point(s)" for the application - i.e. the file which
	// bootstraps the application
	entry: entryPoints,

	// Define where and how the bundle will be output to disk
	// Note: webpack-dev-server does not write the bundle to disk, instead it is
	// kept in memory for speed
	output: {
		path: path.join(__dirname, '/public/js/es'),

		filename: '[name].js',

		// Output as UMD bundle (allows main JS to import with CJS, AMD or global
		// style code bundles
		libraryTarget: 'umd',
		// Name the exported variable from output bundle
		library: ['Frontend', '[name]']
	},

	// Define how file types are handled by webpack
	module: {
		rules: [{
			// Pass application JS files through babel-loader, compiling to ES5
			test: /\.js$/,
			// Only compile application files (dependencies are in ES5 already)
			exclude: /node_modules/,
			use: [{
				loader: 'babel-loader',
				options: {
					presets: [
						'react',
						['env', { modules: false }]
					],
					// Configure babel-loader to cache compiled output so that subsequent
					// compile runs are much faster
					cacheDirectory: true
				}
			}]
		}]
	},

	plugins: [
		new webpack.DefinePlugin({
			// Swaps out checks for NODE_ENV with the env. This is used by various
			// libs to enable dev-only features. These checks then become something
			// like `if ('production' == 'production')`. Minification will then strip
			// the dev-only code from the bundle
			'process.env': {
				NODE_ENV: JSON.stringify(webpackENV)
			},
		})
	]
}

