import { __vitePreload } from "../_virtual/_vite/preload-helper.js";
//#region src/editor/extensions/ext-panning/ext-panning.js
function __variableDynamicImportRuntime0__(path) {
	switch (path) {
		case "./locale/en.js": return __vitePreload(() => import("./locale/en.js"), [], import.meta.url);
		case "./locale/sv.js": return __vitePreload(() => import("./locale/sv.js"), [], import.meta.url);
		case "./locale/tr.js": return __vitePreload(() => import("./locale/tr.js"), [], import.meta.url);
		case "./locale/uk.js": return __vitePreload(() => import("./locale/uk.js"), [], import.meta.url);
		case "./locale/zh-CN.js": return __vitePreload(() => import("./locale/zh-CN.js"), [], import.meta.url);
		default: return new Promise(function(resolve, reject) {
			(typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(reject.bind(null, /* @__PURE__ */ new Error("Unknown variable dynamic import: " + path)));
		});
	}
}
/**
* @file ext-panning.js
*
* @license MIT
*
* @copyright 2013 Luis Aguirre
*
*/
var name = "panning";
var loadExtensionTranslation = async function(svgEditor) {
	let translationModule;
	const lang = svgEditor.configObj.pref("lang");
	try {
		translationModule = await __variableDynamicImportRuntime0__(`./locale/${lang}.js`);
	} catch (_error) {
		console.warn(`Missing translation (${lang}) for ${name} - using 'en'`);
		translationModule = await __vitePreload(() => import("./locale/en.js"), [], import.meta.url);
	}
	svgEditor.i18next.addResourceBundle(lang, name, translationModule.default);
};
var ext_panning_default = {
	name,
	async init() {
		const svgEditor = this;
		await loadExtensionTranslation(svgEditor);
		const { svgCanvas } = svgEditor;
		const { $id, $click } = svgCanvas;
		const insertAfter = (referenceNode, newNode) => {
			referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
		};
		return {
			name: svgEditor.i18next.t(`${name}:name`),
			callback() {
				const btitle = `${svgEditor.i18next.t(`${name}:buttons.0.title`)} ${svgEditor.i18next.t(`${name}:buttons.0.key`)}`;
				const buttonTemplate = document.createElement("template");
				buttonTemplate.innerHTML = `
        <se-button id="ext-panning" title="${btitle}" src="panning.svg"></se-button>
        `;
				insertAfter($id("tool_zoom"), buttonTemplate.content.cloneNode(true));
				$click($id("ext-panning"), () => {
					if (this.leftPanel.updateLeftPanel("ext-panning")) svgCanvas.setMode("ext-panning");
				});
			},
			mouseDown() {
				if (svgCanvas.getMode() === "ext-panning") {
					svgEditor.setPanning(true);
					return { started: true };
				}
			},
			mouseUp() {
				if (svgCanvas.getMode() === "ext-panning") {
					svgEditor.setPanning(false);
					return {
						keep: false,
						element: null
					};
				}
			}
		};
	}
};
//#endregion
export { ext_panning_default as default };

//# sourceMappingURL=ext-panning.js.map