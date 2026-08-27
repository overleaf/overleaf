import { __vitePreload } from "../_virtual/_vite/preload-helper.js";
//#region src/editor/extensions/ext-polystar/ext-polystar.js
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
/**
* @file ext-polystar.js
*
*
* @copyright 2010 CloudCanvas, Inc. All rights reserved
* @copyright 2021 Optimistik SAS, Inc. All rights reserved
* @license MIT
*
*/
var name = "polystar";
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
var ext_polystar_default = {
	name,
	async init() {
		const svgEditor = this;
		const { svgCanvas } = svgEditor;
		const { ChangeElementCommand } = svgCanvas.history;
		const addToHistory = (cmd) => {
			svgCanvas.undoMgr.addCommandToHistory(cmd);
		};
		const { $id, $click } = svgCanvas;
		let selElems;
		let started;
		let newFO;
		await loadExtensionTranslation(svgEditor);
		/**
		* @param {boolean} on true=display
		* @param {string} tool "star" or "polygone"
		* @returns {void}
		*/
		const showPanel = (on, tool) => {
			if (on) $id(`${tool}_panel`).style.removeProperty("display");
			else $id(`${tool}_panel`).style.display = "none";
		};
		/**
		*
		* @param {string} attr attribute to change
		* @param {string|Float} val new value
		* @returns {void}
		*/
		const setAttr = (attr, val) => {
			svgCanvas.changeSelectedAttribute(attr, val);
			svgCanvas.call("changed", selElems);
		};
		/**
		* @param {Float} n angle
		* @return {Float} cotangeante
		*/
		const cot = (n) => 1 / Math.tan(n);
		/**
		* @param {Float} n angle
		* @returns {Float} sec
		*/
		const sec = (n) => 1 / Math.cos(n);
		return {
			name: svgEditor.i18next.t(`${name}:name`),
			callback() {
				const buttonTemplate = `
            <se-flyingbutton id="tools_polygon" title="${`${name}:title`}">
              <se-button id="tool_star" title="${`${name}:buttons.0.title`}" src="star.svg">
              </se-button>
              <se-button id="tool_polygon" title="${`${name}:buttons.1.title`}" src="polygon.svg">
              </se-button>
            </se-flyingbutton>
          `;
				svgCanvas.insertChildAtIndex($id("tools_left"), buttonTemplate, 10);
				$click($id("tool_star"), () => {
					if (this.leftPanel.updateLeftPanel("tool_star")) {
						svgCanvas.setMode("star");
						showPanel(true, "star");
						showPanel(false, "polygon");
					}
				});
				$click($id("tool_polygon"), () => {
					if (this.leftPanel.updateLeftPanel("tool_polygon")) {
						svgCanvas.setMode("polygon");
						showPanel(true, "polygon");
						showPanel(false, "star");
					}
				});
				const label0 = `${name}:contextTools.0.label`;
				const title0 = `${name}:contextTools.0.title`;
				const label1 = `${name}:contextTools.1.label`;
				const title1 = `${name}:contextTools.1.title`;
				const label2 = `${name}:contextTools.2.label`;
				const title2 = `${name}:contextTools.2.title`;
				const label3 = `${name}:contextTools.3.label`;
				const title3 = `${name}:contextTools.3.title`;
				const panelTemplate = document.createElement("template");
				panelTemplate.innerHTML = `
          <div id="star_panel">
            <se-spin-input id="starNumPoints" label="${label0}" min=1 step=1 value=5 title="${title0}">
            </se-spin-input>
            <se-spin-input id="RadiusMultiplier" label="${label1}" min=1 step=2.5 value=3 title="${title1}">
            </se-spin-input>
            <se-spin-input id="radialShift" min=0 step=1 value=0 label="${label2}" title="${title2}">
            </se-spin-input>
          </div>
          <div id="polygon_panel">
            <se-spin-input size="3" id="polySides" min=1 step=1 value=5 label="${label3}" title="${title3}">
            </se-spin-input>
          </div>
        `;
				$id("tools_top").appendChild(panelTemplate.content.cloneNode(true));
				showPanel(false, "star");
				showPanel(false, "polygon");
				$id("starNumPoints").addEventListener("change", (event) => {
					setAttr("point", event.target.value);
					const point = event.target.value;
					let i = selElems.length;
					while (i--) {
						const elem = selElems[i];
						if (elem.hasAttribute("r")) {
							const oldPoint = elem.getAttribute("point");
							const oldPoints = elem.getAttribute("points");
							const radialshift = elem.getAttribute("radialshift");
							let xpos = 0;
							let ypos = 0;
							if (elem.points) {
								const list = elem.points;
								const len = list.numberOfItems;
								for (let i = 0; i < len; ++i) {
									const pt = list.getItem(i);
									xpos += parseFloat(pt.x);
									ypos += parseFloat(pt.y);
								}
								const cx = xpos / len;
								const cy = ypos / len;
								const circumradius = Number(elem.getAttribute("r"));
								const inradius = circumradius / elem.getAttribute("starRadiusMultiplier");
								let polyPoints = "";
								for (let s = 0; point >= s; s++) {
									let angle = 2 * Math.PI * (s / point);
									angle -= Math.PI / 2;
									let x = circumradius * Math.cos(angle) + cx;
									let y = circumradius * Math.sin(angle) + cy;
									polyPoints += x + "," + y + " ";
									if (!isNaN(inradius)) {
										angle = 2 * Math.PI * (s / point) + Math.PI / point;
										angle -= Math.PI / 2;
										angle += radialshift;
										x = inradius * Math.cos(angle) + cx;
										y = inradius * Math.sin(angle) + cy;
										polyPoints += x + "," + y + " ";
									}
								}
								elem.setAttribute("points", polyPoints);
								addToHistory(new ChangeElementCommand(elem, {
									point: oldPoint,
									points: oldPoints
								}));
							}
						}
					}
				});
				$id("RadiusMultiplier").addEventListener("change", (event) => {
					setAttr("starRadiusMultiplier", event.target.value);
				});
				$id("radialShift").addEventListener("change", (event) => {
					setAttr("radialshift", event.target.value);
				});
				$id("polySides").addEventListener("change", (event) => {
					setAttr("sides", event.target.value);
					const sides = event.target.value;
					let i = selElems.length;
					while (i--) {
						const elem = selElems[i];
						if (elem.hasAttribute("edge")) {
							const oldSides = elem.getAttribute("sides");
							const oldPoints = elem.getAttribute("points");
							let xpos = 0;
							let ypos = 0;
							if (elem.points) {
								const list = elem.points;
								const len = list.numberOfItems;
								for (let i = 0; i < len; ++i) {
									const pt = list.getItem(i);
									xpos += parseFloat(pt.x);
									ypos += parseFloat(pt.y);
								}
								const cx = xpos / len;
								const cy = ypos / len;
								const circumradius = elem.getAttribute("edge") / 2 * cot(Math.PI / sides) * sec(Math.PI / sides);
								let points = "";
								for (let s = 0; sides >= s; s++) {
									const angle = 2 * Math.PI * s / sides;
									const x = circumradius * Math.cos(angle) + cx;
									const y = circumradius * Math.sin(angle) + cy;
									points += x + "," + y + " ";
								}
								elem.setAttribute("points", points);
								addToHistory(new ChangeElementCommand(elem, {
									sides: oldSides,
									points: oldPoints
								}));
							}
						}
					}
				});
			},
			mouseDown(opts) {
				if (svgCanvas.getMode() === "star") {
					const fill = svgCanvas.getColor("fill");
					const stroke = svgCanvas.getColor("stroke");
					const strokeWidth = svgCanvas.getStrokeWidth();
					started = true;
					newFO = svgCanvas.addSVGElementsFromJson({
						element: "polygon",
						attr: {
							cx: opts.start_x,
							cy: opts.start_y,
							id: svgCanvas.getNextId(),
							shape: "star",
							point: $id("starNumPoints").value,
							r: 0,
							radialshift: $id("radialShift").value,
							r2: 0,
							orient: "point",
							fill,
							stroke,
							"stroke-width": strokeWidth
						}
					});
					return { started: true };
				}
				if (svgCanvas.getMode() === "polygon") {
					const fill = svgCanvas.getColor("fill");
					const stroke = svgCanvas.getColor("stroke");
					const strokeWidth = svgCanvas.getStrokeWidth();
					started = true;
					newFO = svgCanvas.addSVGElementsFromJson({
						element: "polygon",
						attr: {
							cx: opts.start_x,
							cy: opts.start_y,
							id: svgCanvas.getNextId(),
							shape: "regularPoly",
							sides: $id("polySides").value,
							orient: "x",
							edge: 0,
							fill,
							stroke,
							"stroke-width": strokeWidth
						}
					});
					return { started: true };
				}
			},
			mouseMove(opts) {
				if (!started) return;
				if (svgCanvas.getMode() === "star") {
					const cx = Number(newFO.getAttribute("cx"));
					const cy = Number(newFO.getAttribute("cy"));
					const point = Number(newFO.getAttribute("point"));
					const orient = newFO.getAttribute("orient");
					const fill = newFO.getAttribute("fill");
					const stroke = newFO.getAttribute("stroke");
					const strokeWidth = Number(newFO.getAttribute("stroke-width"));
					const radialshift = Number(newFO.getAttribute("radialshift"));
					let x = opts.mouse_x;
					let y = opts.mouse_y;
					const circumradius = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / 1.5;
					const RadiusMultiplier = document.getElementById("RadiusMultiplier").value;
					const inradius = circumradius / RadiusMultiplier;
					newFO.setAttribute("r", circumradius);
					newFO.setAttribute("r2", inradius);
					newFO.setAttribute("starRadiusMultiplier", RadiusMultiplier);
					let polyPoints = "";
					for (let s = 0; point >= s; s++) {
						let angle = 2 * Math.PI * (s / point);
						if (orient === "point") angle -= Math.PI / 2;
						else if (orient === "edge") angle = angle + Math.PI / point - Math.PI / 2;
						x = circumradius * Math.cos(angle) + cx;
						y = circumradius * Math.sin(angle) + cy;
						polyPoints += x + "," + y + " ";
						if (!isNaN(inradius)) {
							angle = 2 * Math.PI * (s / point) + Math.PI / point;
							if (orient === "point") angle -= Math.PI / 2;
							else if (orient === "edge") angle = angle + Math.PI / point - Math.PI / 2;
							angle += radialshift;
							x = inradius * Math.cos(angle) + cx;
							y = inradius * Math.sin(angle) + cy;
							polyPoints += x + "," + y + " ";
						}
					}
					newFO.setAttribute("points", polyPoints);
					newFO.setAttribute("fill", fill);
					newFO.setAttribute("stroke", stroke);
					newFO.setAttribute("stroke-width", strokeWidth);
					newFO.getAttribute("shape");
					return { started: true };
				}
				if (svgCanvas.getMode() === "polygon") {
					const cx = Number(newFO.getAttribute("cx"));
					const cy = Number(newFO.getAttribute("cy"));
					const sides = Number(newFO.getAttribute("sides"));
					const fill = newFO.getAttribute("fill");
					const stroke = newFO.getAttribute("stroke");
					const strokeWidth = Number(newFO.getAttribute("stroke-width"));
					let x = opts.mouse_x;
					let y = opts.mouse_y;
					const edg = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / 1.5;
					newFO.setAttribute("edge", edg);
					const circumradius = edg / 2 * cot(Math.PI / sides) * sec(Math.PI / sides);
					let points = "";
					for (let s = 0; sides >= s; s++) {
						const angle = 2 * Math.PI * s / sides;
						x = circumradius * Math.cos(angle) + cx;
						y = circumradius * Math.sin(angle) + cy;
						points += x + "," + y + " ";
					}
					newFO.setAttribute("points", points);
					newFO.setAttribute("fill", fill);
					newFO.setAttribute("stroke", stroke);
					newFO.setAttribute("stroke-width", strokeWidth);
					return { started: true };
				}
			},
			mouseUp() {
				if (svgCanvas.getMode() === "star") return {
					keep: newFO.getAttribute("r") !== "0",
					element: newFO
				};
				if (svgCanvas.getMode() === "polygon") return {
					keep: newFO.getAttribute("edge") !== "0",
					element: newFO
				};
			},
			selectedChanged(opts) {
				selElems = opts.elems;
				let i = selElems.length;
				if (!i) {
					showPanel(false, "star");
					showPanel(false, "polygon");
					return;
				}
				while (i--) {
					const elem = selElems[i];
					if (elem?.getAttribute("shape") === "star") if (opts.selectedElement && !opts.multiselected) {
						$id("starNumPoints").value = elem.getAttribute("point");
						$id("radialShift").value = elem.getAttribute("radialshift");
						showPanel(true, "star");
					} else showPanel(false, "star");
					else if (elem?.getAttribute("shape") === "regularPoly") if (opts.selectedElement && !opts.multiselected) {
						$id("polySides").value = elem.getAttribute("sides");
						showPanel(true, "polygon");
					} else showPanel(false, "polygon");
					else {
						showPanel(false, "star");
						showPanel(false, "polygon");
					}
				}
			}
		};
	}
};
//#endregion
export { ext_polystar_default as default };

//# sourceMappingURL=ext-polystar.js.map