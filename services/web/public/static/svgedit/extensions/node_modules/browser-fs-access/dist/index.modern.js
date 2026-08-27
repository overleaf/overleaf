//#region node_modules/browser-fs-access/dist/index.modern.js
var e = (() => {
	if ("undefined" == typeof self) return !1;
	if ("top" in self && self !== top) try {
		top.window.document._ = 0;
	} catch (e) {
		return !1;
	}
	return "showOpenFilePicker" in self;
})();
var t = e ? Promise.resolve().then(function() {
	return c;
}) : Promise.resolve().then(function() {
	return h;
});
async function n(...e) {
	return (await t).default(...e);
}
var r = e ? Promise.resolve().then(function() {
	return y;
}) : Promise.resolve().then(function() {
	return b;
});
async function i(...e) {
	return (await r).default(...e);
}
var a = e ? Promise.resolve().then(function() {
	return m;
}) : Promise.resolve().then(function() {
	return _;
});
async function o(...e) {
	return (await a).default(...e);
}
var s = async (e) => {
	const t = await e.getFile();
	return t.handle = e, t;
};
var l = async (e = [{}]) => {
	Array.isArray(e) || (e = [e]);
	const t = [];
	e.forEach((e, n) => {
		t[n] = {
			description: e.description || "Files",
			accept: {}
		}, e.mimeTypes ? e.mimeTypes.map((r) => {
			t[n].accept[r] = e.extensions || [];
		}) : t[n].accept["*/*"] = e.extensions || [];
	});
	const n = await window.showOpenFilePicker({
		id: e[0].id,
		startIn: e[0].startIn,
		types: t,
		multiple: e[0].multiple || !1,
		excludeAcceptAllOption: e[0].excludeAcceptAllOption || !1
	}), r = await Promise.all(n.map(s));
	return e[0].multiple ? r : r[0];
};
var c = {
	__proto__: null,
	default: l
};
function u(e) {
	function t(e) {
		if (Object(e) !== e) return Promise.reject(/* @__PURE__ */ new TypeError(e + " is not an object."));
		var t = e.done;
		return Promise.resolve(e.value).then(function(e) {
			return {
				value: e,
				done: t
			};
		});
	}
	return u = function(e) {
		this.s = e, this.n = e.next;
	}, u.prototype = {
		s: null,
		n: null,
		next: function() {
			return t(this.n.apply(this.s, arguments));
		},
		return: function(e) {
			var n = this.s.return;
			return void 0 === n ? Promise.resolve({
				value: e,
				done: !0
			}) : t(n.apply(this.s, arguments));
		},
		throw: function(e) {
			var n = this.s.return;
			return void 0 === n ? Promise.reject(e) : t(n.apply(this.s, arguments));
		}
	}, new u(e);
}
var p = async (e, t, n = e.name, r) => {
	const i = [], a = [];
	var o, s = !1, l = !1;
	try {
		for (var c, d = function(e) {
			var t, n, r, i = 2;
			for ("undefined" != typeof Symbol && (n = Symbol.asyncIterator, r = Symbol.iterator); i--;) {
				if (n && null != (t = e[n])) return t.call(e);
				if (r && null != (t = e[r])) return new u(t.call(e));
				n = "@@asyncIterator", r = "@@iterator";
			}
			throw new TypeError("Object is not async iterable");
		}(e.values()); s = !(c = await d.next()).done; s = !1) {
			const o = c.value, s = `${n}/${o.name}`;
			"file" === o.kind ? a.push(o.getFile().then((t) => (t.directoryHandle = e, t.handle = o, Object.defineProperty(t, "webkitRelativePath", {
				configurable: !0,
				enumerable: !0,
				get: () => s
			})))) : "directory" !== o.kind || !t || r && r(o) || i.push(p(o, t, s, r));
		}
	} catch (e) {
		l = !0, o = e;
	} finally {
		try {
			s && null != d.return && await d.return();
		} finally {
			if (l) throw o;
		}
	}
	return [...(await Promise.all(i)).flat(), ...await Promise.all(a)];
};
var d = async (e = {}) => {
	e.recursive = e.recursive || !1, e.mode = e.mode || "read";
	const t = await window.showDirectoryPicker({
		id: e.id,
		startIn: e.startIn,
		mode: e.mode
	});
	return (await (await t.values()).next()).done ? [t] : p(t, e.recursive, void 0, e.skipDirectory);
};
var y = {
	__proto__: null,
	default: d
};
var f = async (e, t = [{}], n = null, r = !1, i = null) => {
	Array.isArray(t) || (t = [t]), t[0].fileName = t[0].fileName || "Untitled";
	const a = [];
	let o = null;
	if (e instanceof Blob && e.type ? o = e.type : e.headers && e.headers.get("content-type") && (o = e.headers.get("content-type")), t.forEach((e, t) => {
		a[t] = {
			description: e.description || "Files",
			accept: {}
		}, e.mimeTypes ? (0 === t && o && e.mimeTypes.push(o), e.mimeTypes.map((n) => {
			a[t].accept[n] = e.extensions || [];
		})) : o ? a[t].accept[o] = e.extensions || [] : a[t].accept["*/*"] = e.extensions || [];
	}), n) try {
		await n.getFile();
	} catch (e) {
		if (n = null, r) throw e;
	}
	const s = n || await window.showSaveFilePicker({
		suggestedName: t[0].fileName,
		id: t[0].id,
		startIn: t[0].startIn,
		types: a,
		excludeAcceptAllOption: t[0].excludeAcceptAllOption || !1
	});
	!n && i && i(s);
	const l = await s.createWritable();
	if ("stream" in e) return await e.stream().pipeTo(l), s;
	return "body" in e ? (await e.body.pipeTo(l), s) : (await l.write(await e), await l.close(), s);
};
var m = {
	__proto__: null,
	default: f
};
var w = async (e = [{}]) => (Array.isArray(e) || (e = [e]), new Promise((t, n) => {
	const r = document.createElement("input");
	r.type = "file";
	const i = [...e.map((e) => e.mimeTypes || []), ...e.map((e) => e.extensions || [])].join();
	r.multiple = e[0].multiple || !1, r.accept = i || "", r.style.display = "none", document.body.append(r), r.addEventListener("cancel", () => {
		r.remove(), n(new DOMException("The user aborted a request.", "AbortError"));
	}), r.addEventListener("change", () => {
		r.remove(), t(r.multiple ? Array.from(r.files) : r.files[0]);
	}), "showPicker" in HTMLInputElement.prototype ? r.showPicker() : r.click();
}));
var h = {
	__proto__: null,
	default: w
};
var v = async (e = [{}]) => (Array.isArray(e) || (e = [e]), e[0].recursive = e[0].recursive || !1, new Promise((t, n) => {
	const r = document.createElement("input");
	r.type = "file", r.webkitdirectory = !0, r.style.display = "none", document.body.append(r), r.addEventListener("cancel", () => {
		r.remove(), n(new DOMException("The user aborted a request.", "AbortError"));
	}), r.addEventListener("change", () => {
		r.remove();
		let n = Array.from(r.files);
		e[0].recursive ? e[0].recursive && e[0].skipDirectory && (n = n.filter((t) => t.webkitRelativePath.split("/").every((t) => !e[0].skipDirectory({
			name: t,
			kind: "directory"
		})))) : n = n.filter((e) => 2 === e.webkitRelativePath.split("/").length), t(n);
	}), "showPicker" in HTMLInputElement.prototype ? r.showPicker() : r.click();
}));
var b = {
	__proto__: null,
	default: v
};
var P = async (e, t = {}) => {
	Array.isArray(t) && (t = t[0]);
	const n = document.createElement("a");
	let r = e;
	"body" in e && (r = await async function(e, t) {
		const n = e.getReader(), r = new ReadableStream({ start: (e) => async function t() {
			return n.read().then(({ done: n, value: r }) => {
				if (!n) return e.enqueue(r), t();
				e.close();
			});
		}() }), a = await new Response(r).blob();
		return n.releaseLock(), new Blob([a], { type: t });
	}(e.body, e.headers.get("content-type"))), n.download = t.fileName || "Untitled", n.href = URL.createObjectURL(await r);
	const i = () => {
		"function" == typeof a && a();
	}, a = t.legacySetup && t.legacySetup(i, () => a(), n);
	return n.addEventListener("click", () => {
		setTimeout(() => URL.revokeObjectURL(n.href), 3e4), i();
	}), n.click(), null;
};
var _ = {
	__proto__: null,
	default: P
};
//#endregion
export { i as directoryOpen, v as directoryOpenLegacy, d as directoryOpenModern, n as fileOpen, w as fileOpenLegacy, l as fileOpenModern, o as fileSave, P as fileSaveLegacy, f as fileSaveModern, e as supported };

//# sourceMappingURL=index.modern.js.map