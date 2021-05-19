Path = require('path')

module.exports = {
	overleafModuleImports: {
		# modules to import (an array of paths relative to this file in /app/config at build time)
		createFileModes: [
			Path.resolve(__dirname, '../modules/tpr-webmodule/frontend/js/components/create-file-mode-mendeley.js'),
			Path.resolve(__dirname, '../modules/tpr-webmodule/frontend/js/components/create-file-mode-zotero.js')
		],
		tprLinkedFileInfo: [
			Path.resolve(__dirname, '../modules/tpr-webmodule/frontend/js/components/linked-file-info.js')
		],
		tprLinkedFileRefreshError: [
			Path.resolve(__dirname, '../modules/tpr-webmodule/frontend/js/components/linked-file-refresh-error.js')
		],
		gitBridge: [Path.resolve(__dirname, '../modules/git-bridge/frontend/js/components/git-bridge-modal.js')]
		publishModal: [
			Path.resolve(__dirname, '../modules/publish-modal/frontend/js/components/publish-toolbar-button')
		]
	}
}
