import { __vitePreload } from "../_virtual/_vite/preload-helper.js";
//#region src/editor/extensions/ext-layer_view/ext-layer_view.js
function __variableDynamicImportRuntime0__(path) {
	switch (path) {
		case "./locale/en.js": return __vitePreload(() => import("./locale/en.js"), [], import.meta.url);
		case "./locale/zh-CN.js": return __vitePreload(() => import("./locale/zh-CN.js"), [], import.meta.url);
		default: return new Promise(function(resolve, reject) {
			(typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(reject.bind(null, /* @__PURE__ */ new Error("Unknown variable dynamic import: " + path)));
		});
	}
}
/**
* @file ext-layer_view.js
*
* @license MIT
*
*
*/
var name = "layer_view";
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
var ext_layer_view_default = {
	name,
	async init(_S) {
		const svgEditor = this;
		const { svgCanvas } = svgEditor;
		const { $id, $click } = svgCanvas;
		await loadExtensionTranslation(svgEditor);
		const clickLayerView = (e) => {
			$id("tool_layerView").pressed = !$id("tool_layerView").pressed;
			updateLayerView(e);
		};
		const updateLayerView = (e) => {
			const drawing = svgCanvas.getCurrentDrawing();
			const curLayer = drawing.getCurrentLayerName();
			let layer = drawing.getNumLayers();
			while (layer--) {
				const name = drawing.getLayerName(layer);
				if (name !== curLayer && $id("tool_layerView").pressed) drawing.setLayerVisibility(name, false);
				else drawing.setLayerVisibility(name, true);
			}
			$id("layerlist").querySelectorAll("tr.layer").forEach(function(el) {
				const layervis = el.querySelector("td.layervis");
				const vis = el.classList.contains("layersel") || !$id("tool_layerView").pressed ? "layervis" : "layerinvis layervis";
				layervis.setAttribute("class", vis);
			});
		};
		return {
			name: svgEditor.i18next.t(`${name}:name`),
			layersChanged() {
				if ($id("tool_layerView").pressed) updateLayerView();
				if (svgEditor.configObj.curConfig.layerView) {
					svgEditor.configObj.curConfig.layerView = false;
					$id("tool_layerView").pressed = true;
					updateLayerView();
				}
			},
			layerVisChanged() {
				if ($id("tool_layerView").pressed) $id("tool_layerView").pressed = !$id("tool_layerView").pressed;
			},
			callback() {
				const buttonTemplate = document.createElement("template");
				buttonTemplate.innerHTML = `
      <se-button id="tool_layerView" title="${`${name}:buttons.0.title`}" shortcut="${`${name}:buttons.0.key`}" src="layer_view.svg"></se-button>`;
				$id("editor_panel").append(buttonTemplate.content.cloneNode(true));
				$click($id("tool_layerView"), clickLayerView.bind(this));
			}
		};
	}
};
//#endregion
export { ext_layer_view_default as default };

//# sourceMappingURL=ext-layer_view.js.map