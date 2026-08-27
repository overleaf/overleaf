import { __vitePreload } from "../_virtual/_vite/preload-helper.js";
import { fileOpen as n, fileSave as o } from "../node_modules/browser-fs-access/dist/index.modern.js";
//#region src/editor/extensions/ext-opensave/ext-opensave.js
/**
* @file ext-opensave.js
*
* @license MIT
*
* @copyright 2020 OptimistikSAS
*
*/
/**
* @type {module:svgcanvas.EventHandler}
* @param {external:Window} wind
* @param {module:svgcanvas.SvgCanvas#event:saved} svg The SVG source
* @listens module:svgcanvas.SvgCanvas#event:saved
* @returns {void}
*/
function __variableDynamicImportRuntime0__(path) {
	switch (path) {
		case "./locale/en.js": return __vitePreload(() => import("./locale/en.js"), [], import.meta.url);
		case "./locale/fr.js": return __vitePreload(() => import("./locale/fr.js"), [], import.meta.url);
		case "./locale/sv.js": return __vitePreload(() => import("./locale/sv.js"), [], import.meta.url);
		case "./locale/tr.js": return __vitePreload(() => import("./locale/tr.js"), [], import.meta.url);
		case "./locale/uk.js": return __vitePreload(() => import("./locale/uk.js"), [], import.meta.url);
		case "./locale/zh-CN.js": return __vitePreload(() => import("./locale/zh-CN.js"), [], import.meta.url);
		default: return new Promise(function(resolve, reject) {
			(typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(reject.bind(null, /* @__PURE__ */ new Error("Unknown variable dynamic import: " + path)));
		});
	}
}
var name = "opensave";
var handle = null;
var loadExtensionTranslation = async function(svgEditor) {
	let translationModule;
	const lang = svgEditor.configObj.pref("lang");
	try {
		translationModule = await __variableDynamicImportRuntime0__(`./locale/${lang}.js`);
	} catch (_error) {
		console.warn(`Missing translation (${lang}) for ${name} - using 'en'`);
		translationModule = await __vitePreload(() => import("./locale/en.js"), [], import.meta.url);
	}
	svgEditor.i18next.addResourceBundle(lang, "translation", translationModule.default, true, true);
};
var ext_opensave_default = {
	name,
	async init(_S) {
		const svgEditor = this;
		const { svgCanvas } = svgEditor;
		const { $id, $click } = svgCanvas;
		await loadExtensionTranslation(svgEditor);
		/**
		* @param {Event} e
		* @returns {void}
		*/
		const importImage = (e) => {
			const fileInput = e.target && e.target.type === "file" ? e.target : null;
			const resetFileInput = () => {
				if (fileInput) fileInput.value = "";
			};
			if (e.dataTransfer && !e.dataTransfer.types?.includes("Files")) return;
			$id("se-prompt-dialog").title = this.i18next.t("notification.loadingImage");
			$id("se-prompt-dialog").setAttribute("close", false);
			e.stopPropagation();
			e.preventDefault();
			const file = e.type === "drop" ? e.dataTransfer.files[0] : e.currentTarget.files[0];
			if (!file) {
				$id("se-prompt-dialog").setAttribute("close", true);
				resetFileInput();
				return;
			}
			if (!file.type.includes("image")) {
				resetFileInput();
				return;
			}
			let reader;
			if (file.type.includes("svg")) {
				reader = new FileReader();
				reader.onloadend = (ev) => {
					const newElement = this.svgCanvas.importSvgString(ev.target.result, imgImport.shiftKey);
					this.svgCanvas.alignSelectedElements("m", "page");
					this.svgCanvas.alignSelectedElements("c", "page");
					this.svgCanvas.selectOnly([newElement]);
					$id("se-prompt-dialog").setAttribute("close", true);
					resetFileInput();
				};
				reader.readAsText(file);
			} else {
				reader = new FileReader();
				reader.onloadend = ({ target: { result } }) => {
					/**
					* Insert the new image until we know its dimensions.
					* @param {Float} imageWidth
					* @param {Float} imageHeight
					* @returns {void}
					*/
					const insertNewImage = (imageWidth, imageHeight) => {
						const newImage = this.svgCanvas.addSVGElementsFromJson({
							element: "image",
							attr: {
								x: 0,
								y: 0,
								width: imageWidth,
								height: imageHeight,
								id: this.svgCanvas.getNextId(),
								style: "pointer-events:inherit"
							}
						});
						this.svgCanvas.setHref(newImage, result);
						this.svgCanvas.selectOnly([newImage]);
						this.svgCanvas.alignSelectedElements("m", "page");
						this.svgCanvas.alignSelectedElements("c", "page");
						this.topPanel.updateContextPanel();
						$id("se-prompt-dialog").setAttribute("close", true);
						resetFileInput();
					};
					let imgWidth = 100;
					let imgHeight = 100;
					const img = new Image();
					img.style.opacity = 0;
					img.addEventListener("load", () => {
						imgWidth = img.offsetWidth || img.naturalWidth || img.width;
						imgHeight = img.offsetHeight || img.naturalHeight || img.height;
						insertNewImage(imgWidth, imgHeight);
					});
					img.src = result;
				};
				reader.readAsDataURL(file);
			}
		};
		const imgImport = document.createElement("input");
		imgImport.type = "file";
		imgImport.addEventListener("change", importImage);
		this.workarea.addEventListener("drop", importImage);
		const clickClear = async function() {
			const [x, y] = svgEditor.configObj.curConfig.dimensions;
			if (await seConfirm(svgEditor.i18next.t("notification.QwantToClear")) === "Cancel") return;
			svgEditor.leftPanel.clickSelect();
			svgEditor.svgCanvas.clear();
			svgEditor.svgCanvas.setResolution(x, y);
			svgEditor.updateCanvas(true);
			svgEditor.zoomImage();
			svgEditor.layersPanel.populateLayers();
			svgEditor.topPanel.updateContextPanel();
			svgEditor.topPanel.updateTitle("untitled.svg");
		};
		/**
		* By default,  this.editor.svgCanvas.open() is a no-op. It is up to an extension
		*  mechanism (opera widget, etc.) to call `setCustomHandlers()` which
		*  will make it do something.
		* @returns {void}
		*/
		const clickOpen = async function() {
			if (await svgEditor.openPrep() === "Cancel") return;
			svgCanvas.clear();
			try {
				const blob = await n({ mimeTypes: ["image/*"] });
				const svgContent = await blob.text();
				await svgEditor.loadSvgString(svgContent);
				svgEditor.updateCanvas();
				handle = blob.handle;
				svgEditor.topPanel.updateTitle(blob.name);
				svgEditor.svgCanvas.runExtensions("onOpenedDocument", {
					name: blob.name,
					lastModified: blob.lastModified,
					size: blob.size,
					type: blob.type
				});
				svgEditor.layersPanel.populateLayers();
			} catch (err) {
				if (err.name !== "AbortError") return console.error(err);
			}
		};
		const b64toBlob = (b64Data, contentType = "", sliceSize = 512) => {
			const byteCharacters = atob(b64Data);
			const byteArrays = [];
			for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
				const slice = byteCharacters.slice(offset, offset + sliceSize);
				const byteNumbers = new Array(slice.length);
				for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
				const byteArray = new Uint8Array(byteNumbers);
				byteArrays.push(byteArray);
			}
			return new Blob(byteArrays, { type: contentType });
		};
		/**
		*
		* @returns {void}
		*/
		const clickSave = async function(type) {
			if ($id("se-svg-editor-dialog").getAttribute("dialog") === "open") svgEditor.saveSourceEditor();
			else {
				const saveOpts = {
					images: svgEditor.configObj.pref("img_save"),
					round_digits: 2
				};
				svgCanvas.clearSelection();
				if (saveOpts) {
					const saveOptions = svgCanvas.mergeDeep(svgCanvas.getSvgOption(), saveOpts);
					for (const [key, value] of Object.entries(saveOptions)) svgCanvas.setSvgOption(key, value);
				}
				svgCanvas.setSvgOption("apply", true);
				const svg = "<?xml version=\"1.0\"?>\n" + svgCanvas.svgCanvasToString();
				const b64Data = svgCanvas.encode64(svg);
				const blob = b64toBlob(b64Data, "image/svg+xml");
				try {
					if (type === "save" && handle !== null) handle = await o(blob, {
						fileName: "untitled.svg",
						extensions: [".svg"]
					}, handle, false);
					else handle = await o(blob, {
						fileName: svgEditor.title,
						extensions: [".svg"]
					});
					svgEditor.topPanel.updateTitle(handle.name);
					svgCanvas.runExtensions("onSavedDocument", {
						name: handle.name,
						kind: handle.kind
					});
				} catch (err) {
					if (err.name !== "AbortError") return console.error(err);
				}
			}
		};
		return {
			name: svgEditor.i18next.t(`${name}:name`),
			callback() {
				svgCanvas.insertChildAtIndex($id("main_button"), `
        <se-menu-item id="tool_clear" label="opensave.new_doc" shortcut="N" src="new.svg"></se-menu-item>`, 0);
				svgCanvas.insertChildAtIndex($id("main_button"), "<se-menu-item id=\"tool_open\" label=\"opensave.open_image_doc\" src=\"open.svg\"></se-menu-item>", 1);
				svgCanvas.insertChildAtIndex($id("main_button"), "<se-menu-item id=\"tool_save\" label=\"opensave.save_doc\" shortcut=\"S\" src=\"saveImg.svg\"></se-menu-item>", 2);
				svgCanvas.insertChildAtIndex($id("main_button"), "<se-menu-item id=\"tool_save_as\" label=\"opensave.save_as_doc\" src=\"saveImg.svg\"></se-menu-item>", 3);
				svgCanvas.insertChildAtIndex($id("main_button"), "<se-menu-item id=\"tool_import\" label=\"tools.import_doc\" src=\"importImg.svg\"></se-menu-item>", 4);
				$click($id("tool_clear"), clickClear.bind(this));
				$click($id("tool_open"), clickOpen.bind(this));
				$click($id("tool_save"), clickSave.bind(this, "save"));
				$click($id("tool_save_as"), clickSave.bind(this, "saveas"));
				$click($id("tool_import"), (ev) => {
					imgImport.shiftKey = ev.shiftKey;
					imgImport.click();
				});
			}
		};
	}
};
//#endregion
export { ext_opensave_default as default };

//# sourceMappingURL=ext-opensave.js.map