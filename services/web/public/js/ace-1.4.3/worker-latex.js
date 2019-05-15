"no use strict";
!(function(window) {
if (typeof window.window != "undefined" && window.document)
    return;
if (window.require && window.define)
    return;

if (!window.console) {
    window.console = function() {
        var msgs = Array.prototype.slice.call(arguments, 0);
        postMessage({type: "log", data: msgs});
    };
    window.console.error =
    window.console.warn = 
    window.console.log =
    window.console.trace = window.console;
}
window.window = window;
window.ace = window;

window.onerror = function(message, file, line, col, err) {
    postMessage({type: "error", data: {
        message: message,
        data: err.data,
        file: file,
        line: line, 
        col: col,
        stack: err.stack
    }});
};

window.normalizeModule = function(parentId, moduleName) {
    // normalize plugin requires
    if (moduleName.indexOf("!") !== -1) {
        var chunks = moduleName.split("!");
        return window.normalizeModule(parentId, chunks[0]) + "!" + window.normalizeModule(parentId, chunks[1]);
    }
    // normalize relative requires
    if (moduleName.charAt(0) == ".") {
        var base = parentId.split("/").slice(0, -1).join("/");
        moduleName = (base ? base + "/" : "") + moduleName;
        
        while (moduleName.indexOf(".") !== -1 && previous != moduleName) {
            var previous = moduleName;
            moduleName = moduleName.replace(/^\.\//, "").replace(/\/\.\//, "/").replace(/[^\/]+\/\.\.\//, "");
        }
    }
    
    return moduleName;
};

window.require = function require(parentId, id) {
    if (!id) {
        id = parentId;
        parentId = null;
    }
    if (!id.charAt)
        throw new Error("worker.js require() accepts only (parentId, id) as arguments");

    id = window.normalizeModule(parentId, id);

    var module = window.require.modules[id];
    if (module) {
        if (!module.initialized) {
            module.initialized = true;
            module.exports = module.factory().exports;
        }
        return module.exports;
    }
   
    if (!window.require.tlns)
        return console.log("unable to load " + id);
    
    var path = resolveModuleId(id, window.require.tlns);
    if (path.slice(-3) != ".js") path += ".js";
    
    window.require.id = id;
    window.require.modules[id] = {}; // prevent infinite loop on broken modules
    importScripts(path);
    return window.require(parentId, id);
};
function resolveModuleId(id, paths) {
    var testPath = id, tail = "";
    while (testPath) {
        var alias = paths[testPath];
        if (typeof alias == "string") {
            return alias + tail;
        } else if (alias) {
            return  alias.location.replace(/\/*$/, "/") + (tail || alias.main || alias.name);
        } else if (alias === false) {
            return "";
        }
        var i = testPath.lastIndexOf("/");
        if (i === -1) break;
        tail = testPath.substr(i) + tail;
        testPath = testPath.slice(0, i);
    }
    return id;
}
window.require.modules = {};
window.require.tlns = {};

window.define = function(id, deps, factory) {
    if (arguments.length == 2) {
        factory = deps;
        if (typeof id != "string") {
            deps = id;
            id = window.require.id;
        }
    } else if (arguments.length == 1) {
        factory = id;
        deps = [];
        id = window.require.id;
    }
    
    if (typeof factory != "function") {
        window.require.modules[id] = {
            exports: factory,
            initialized: true
        };
        return;
    }

    if (!deps.length)
        // If there is no dependencies, we inject "require", "exports" and
        // "module" as dependencies, to provide CommonJS compatibility.
        deps = ["require", "exports", "module"];

    var req = function(childId) {
        return window.require(id, childId);
    };

    window.require.modules[id] = {
        exports: {},
        factory: function() {
            var module = this;
            var returnExports = factory.apply(this, deps.slice(0, factory.length).map(function(dep) {
                switch (dep) {
                    // Because "require", "exports" and "module" aren't actual
                    // dependencies, we must handle them seperately.
                    case "require": return req;
                    case "exports": return module.exports;
                    case "module":  return module;
                    // But for all other dependencies, we can just go ahead and
                    // require them.
                    default:        return req(dep);
                }
            }));
            if (returnExports)
                module.exports = returnExports;
            return module;
        }
    };
};
window.define.amd = {};
require.tlns = {};
window.initBaseUrls  = function initBaseUrls(topLevelNamespaces) {
    for (var i in topLevelNamespaces)
        require.tlns[i] = topLevelNamespaces[i];
};

window.initSender = function initSender() {

    var EventEmitter = window.require("ace/lib/event_emitter").EventEmitter;
    var oop = window.require("ace/lib/oop");
    
    var Sender = function() {};
    
    (function() {
        
        oop.implement(this, EventEmitter);
                
        this.callback = function(data, callbackId) {
            postMessage({
                type: "call",
                id: callbackId,
                data: data
            });
        };
    
        this.emit = function(name, data) {
            postMessage({
                type: "event",
                name: name,
                data: data
            });
        };
        
    }).call(Sender.prototype);
    
    return new Sender();
};

var main = window.main = null;
var sender = window.sender = null;

window.onmessage = function(e) {
    var msg = e.data;
    if (msg.event && sender) {
        sender._signal(msg.event, msg.data);
    }
    else if (msg.command) {
        if (main[msg.command])
            main[msg.command].apply(main, msg.args);
        else if (window[msg.command])
            window[msg.command].apply(window, msg.args);
        else
            throw new Error("Unknown command:" + msg.command);
    }
    else if (msg.init) {
        window.initBaseUrls(msg.tlns);
        require("ace/lib/es5-shim");
        sender = window.sender = window.initSender();
        var clazz = require(msg.module)[msg.classname];
        main = window.main = new clazz(sender);
    }
};
})(this);

ace.define("ace/lib/oop",[], function(require, exports, module) {
"use strict";

exports.inherits = function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });
};

exports.mixin = function(obj, mixin) {
    for (var key in mixin) {
        obj[key] = mixin[key];
    }
    return obj;
};

exports.implement = function(proto, mixin) {
    exports.mixin(proto, mixin);
};

});

ace.define("ace/range",[], function(require, exports, module) {
"use strict";
var comparePoints = function(p1, p2) {
    return p1.row - p2.row || p1.column - p2.column;
};
var Range = function(startRow, startColumn, endRow, endColumn) {
    this.start = {
        row: startRow,
        column: startColumn
    };

    this.end = {
        row: endRow,
        column: endColumn
    };
};

(function() {
    this.isEqual = function(range) {
        return this.start.row === range.start.row &&
            this.end.row === range.end.row &&
            this.start.column === range.start.column &&
            this.end.column === range.end.column;
    };
    this.toString = function() {
        return ("Range: [" + this.start.row + "/" + this.start.column +
            "] -> [" + this.end.row + "/" + this.end.column + "]");
    };

    this.contains = function(row, column) {
        return this.compare(row, column) == 0;
    };
    this.compareRange = function(range) {
        var cmp,
            end = range.end,
            start = range.start;

        cmp = this.compare(end.row, end.column);
        if (cmp == 1) {
            cmp = this.compare(start.row, start.column);
            if (cmp == 1) {
                return 2;
            } else if (cmp == 0) {
                return 1;
            } else {
                return 0;
            }
        } else if (cmp == -1) {
            return -2;
        } else {
            cmp = this.compare(start.row, start.column);
            if (cmp == -1) {
                return -1;
            } else if (cmp == 1) {
                return 42;
            } else {
                return 0;
            }
        }
    };
    this.comparePoint = function(p) {
        return this.compare(p.row, p.column);
    };
    this.containsRange = function(range) {
        return this.comparePoint(range.start) == 0 && this.comparePoint(range.end) == 0;
    };
    this.intersects = function(range) {
        var cmp = this.compareRange(range);
        return (cmp == -1 || cmp == 0 || cmp == 1);
    };
    this.isEnd = function(row, column) {
        return this.end.row == row && this.end.column == column;
    };
    this.isStart = function(row, column) {
        return this.start.row == row && this.start.column == column;
    };
    this.setStart = function(row, column) {
        if (typeof row == "object") {
            this.start.column = row.column;
            this.start.row = row.row;
        } else {
            this.start.row = row;
            this.start.column = column;
        }
    };
    this.setEnd = function(row, column) {
        if (typeof row == "object") {
            this.end.column = row.column;
            this.end.row = row.row;
        } else {
            this.end.row = row;
            this.end.column = column;
        }
    };
    this.inside = function(row, column) {
        if (this.compare(row, column) == 0) {
            if (this.isEnd(row, column) || this.isStart(row, column)) {
                return false;
            } else {
                return true;
            }
        }
        return false;
    };
    this.insideStart = function(row, column) {
        if (this.compare(row, column) == 0) {
            if (this.isEnd(row, column)) {
                return false;
            } else {
                return true;
            }
        }
        return false;
    };
    this.insideEnd = function(row, column) {
        if (this.compare(row, column) == 0) {
            if (this.isStart(row, column)) {
                return false;
            } else {
                return true;
            }
        }
        return false;
    };
    this.compare = function(row, column) {
        if (!this.isMultiLine()) {
            if (row === this.start.row) {
                return column < this.start.column ? -1 : (column > this.end.column ? 1 : 0);
            }
        }

        if (row < this.start.row)
            return -1;

        if (row > this.end.row)
            return 1;

        if (this.start.row === row)
            return column >= this.start.column ? 0 : -1;

        if (this.end.row === row)
            return column <= this.end.column ? 0 : 1;

        return 0;
    };
    this.compareStart = function(row, column) {
        if (this.start.row == row && this.start.column == column) {
            return -1;
        } else {
            return this.compare(row, column);
        }
    };
    this.compareEnd = function(row, column) {
        if (this.end.row == row && this.end.column == column) {
            return 1;
        } else {
            return this.compare(row, column);
        }
    };
    this.compareInside = function(row, column) {
        if (this.end.row == row && this.end.column == column) {
            return 1;
        } else if (this.start.row == row && this.start.column == column) {
            return -1;
        } else {
            return this.compare(row, column);
        }
    };
    this.clipRows = function(firstRow, lastRow) {
        if (this.end.row > lastRow)
            var end = {row: lastRow + 1, column: 0};
        else if (this.end.row < firstRow)
            var end = {row: firstRow, column: 0};

        if (this.start.row > lastRow)
            var start = {row: lastRow + 1, column: 0};
        else if (this.start.row < firstRow)
            var start = {row: firstRow, column: 0};

        return Range.fromPoints(start || this.start, end || this.end);
    };
    this.extend = function(row, column) {
        var cmp = this.compare(row, column);

        if (cmp == 0)
            return this;
        else if (cmp == -1)
            var start = {row: row, column: column};
        else
            var end = {row: row, column: column};

        return Range.fromPoints(start || this.start, end || this.end);
    };

    this.isEmpty = function() {
        return (this.start.row === this.end.row && this.start.column === this.end.column);
    };
    this.isMultiLine = function() {
        return (this.start.row !== this.end.row);
    };
    this.clone = function() {
        return Range.fromPoints(this.start, this.end);
    };
    this.collapseRows = function() {
        if (this.end.column == 0)
            return new Range(this.start.row, 0, Math.max(this.start.row, this.end.row-1), 0);
        else
            return new Range(this.start.row, 0, this.end.row, 0);
    };
    this.toScreenRange = function(session) {
        var screenPosStart = session.documentToScreenPosition(this.start);
        var screenPosEnd = session.documentToScreenPosition(this.end);

        return new Range(
            screenPosStart.row, screenPosStart.column,
            screenPosEnd.row, screenPosEnd.column
        );
    };
    this.moveBy = function(row, column) {
        this.start.row += row;
        this.start.column += column;
        this.end.row += row;
        this.end.column += column;
    };

}).call(Range.prototype);
Range.fromPoints = function(start, end) {
    return new Range(start.row, start.column, end.row, end.column);
};
Range.comparePoints = comparePoints;

Range.comparePoints = function(p1, p2) {
    return p1.row - p2.row || p1.column - p2.column;
};


exports.Range = Range;
});

ace.define("ace/apply_delta",[], function(require, exports, module) {
"use strict";

function throwDeltaError(delta, errorText){
    console.log("Invalid Delta:", delta);
    throw "Invalid Delta: " + errorText;
}

function positionInDocument(docLines, position) {
    return position.row    >= 0 && position.row    <  docLines.length &&
           position.column >= 0 && position.column <= docLines[position.row].length;
}

function validateDelta(docLines, delta) {
    if (delta.action != "insert" && delta.action != "remove")
        throwDeltaError(delta, "delta.action must be 'insert' or 'remove'");
    if (!(delta.lines instanceof Array))
        throwDeltaError(delta, "delta.lines must be an Array");
    if (!delta.start || !delta.end)
       throwDeltaError(delta, "delta.start/end must be an present");
    var start = delta.start;
    if (!positionInDocument(docLines, delta.start))
        throwDeltaError(delta, "delta.start must be contained in document");
    var end = delta.end;
    if (delta.action == "remove" && !positionInDocument(docLines, end))
        throwDeltaError(delta, "delta.end must contained in document for 'remove' actions");
    var numRangeRows = end.row - start.row;
    var numRangeLastLineChars = (end.column - (numRangeRows == 0 ? start.column : 0));
    if (numRangeRows != delta.lines.length - 1 || delta.lines[numRangeRows].length != numRangeLastLineChars)
        throwDeltaError(delta, "delta.range must match delta lines");
}

exports.applyDelta = function(docLines, delta, doNotValidate) {
    
    var row = delta.start.row;
    var startColumn = delta.start.column;
    var line = docLines[row] || "";
    switch (delta.action) {
        case "insert":
            var lines = delta.lines;
            if (lines.length === 1) {
                docLines[row] = line.substring(0, startColumn) + delta.lines[0] + line.substring(startColumn);
            } else {
                var args = [row, 1].concat(delta.lines);
                docLines.splice.apply(docLines, args);
                docLines[row] = line.substring(0, startColumn) + docLines[row];
                docLines[row + delta.lines.length - 1] += line.substring(startColumn);
            }
            break;
        case "remove":
            var endColumn = delta.end.column;
            var endRow = delta.end.row;
            if (row === endRow) {
                docLines[row] = line.substring(0, startColumn) + line.substring(endColumn);
            } else {
                docLines.splice(
                    row, endRow - row + 1,
                    line.substring(0, startColumn) + docLines[endRow].substring(endColumn)
                );
            }
            break;
    }
};
});

ace.define("ace/lib/event_emitter",[], function(require, exports, module) {
"use strict";

var EventEmitter = {};
var stopPropagation = function() { this.propagationStopped = true; };
var preventDefault = function() { this.defaultPrevented = true; };

EventEmitter._emit =
EventEmitter._dispatchEvent = function(eventName, e) {
    this._eventRegistry || (this._eventRegistry = {});
    this._defaultHandlers || (this._defaultHandlers = {});

    var listeners = this._eventRegistry[eventName] || [];
    var defaultHandler = this._defaultHandlers[eventName];
    if (!listeners.length && !defaultHandler)
        return;

    if (typeof e != "object" || !e)
        e = {};

    if (!e.type)
        e.type = eventName;
    if (!e.stopPropagation)
        e.stopPropagation = stopPropagation;
    if (!e.preventDefault)
        e.preventDefault = preventDefault;

    listeners = listeners.slice();
    for (var i=0; i<listeners.length; i++) {
        listeners[i](e, this);
        if (e.propagationStopped)
            break;
    }
    
    if (defaultHandler && !e.defaultPrevented)
        return defaultHandler(e, this);
};


EventEmitter._signal = function(eventName, e) {
    var listeners = (this._eventRegistry || {})[eventName];
    if (!listeners)
        return;
    listeners = listeners.slice();
    for (var i=0; i<listeners.length; i++)
        listeners[i](e, this);
};

EventEmitter.once = function(eventName, callback) {
    var _self = this;
    this.addEventListener(eventName, function newCallback() {
        _self.removeEventListener(eventName, newCallback);
        callback.apply(null, arguments);
    });
    if (!callback) {
        return new Promise(function(resolve) {
            callback = resolve;
        });
    }
};


EventEmitter.setDefaultHandler = function(eventName, callback) {
    var handlers = this._defaultHandlers;
    if (!handlers)
        handlers = this._defaultHandlers = {_disabled_: {}};
    
    if (handlers[eventName]) {
        var old = handlers[eventName];
        var disabled = handlers._disabled_[eventName];
        if (!disabled)
            handlers._disabled_[eventName] = disabled = [];
        disabled.push(old);
        var i = disabled.indexOf(callback);
        if (i != -1) 
            disabled.splice(i, 1);
    }
    handlers[eventName] = callback;
};
EventEmitter.removeDefaultHandler = function(eventName, callback) {
    var handlers = this._defaultHandlers;
    if (!handlers)
        return;
    var disabled = handlers._disabled_[eventName];
    
    if (handlers[eventName] == callback) {
        if (disabled)
            this.setDefaultHandler(eventName, disabled.pop());
    } else if (disabled) {
        var i = disabled.indexOf(callback);
        if (i != -1)
            disabled.splice(i, 1);
    }
};

EventEmitter.on =
EventEmitter.addEventListener = function(eventName, callback, capturing) {
    this._eventRegistry = this._eventRegistry || {};

    var listeners = this._eventRegistry[eventName];
    if (!listeners)
        listeners = this._eventRegistry[eventName] = [];

    if (listeners.indexOf(callback) == -1)
        listeners[capturing ? "unshift" : "push"](callback);
    return callback;
};

EventEmitter.off =
EventEmitter.removeListener =
EventEmitter.removeEventListener = function(eventName, callback) {
    this._eventRegistry = this._eventRegistry || {};

    var listeners = this._eventRegistry[eventName];
    if (!listeners)
        return;

    var index = listeners.indexOf(callback);
    if (index !== -1)
        listeners.splice(index, 1);
};

EventEmitter.removeAllListeners = function(eventName) {
    if (this._eventRegistry) this._eventRegistry[eventName] = [];
};

exports.EventEmitter = EventEmitter;

});

ace.define("ace/anchor",[], function(require, exports, module) {
"use strict";

var oop = require("./lib/oop");
var EventEmitter = require("./lib/event_emitter").EventEmitter;

var Anchor = exports.Anchor = function(doc, row, column) {
    this.$onChange = this.onChange.bind(this);
    this.attach(doc);
    
    if (typeof column == "undefined")
        this.setPosition(row.row, row.column);
    else
        this.setPosition(row, column);
};

(function() {

    oop.implement(this, EventEmitter);
    this.getPosition = function() {
        return this.$clipPositionToDocument(this.row, this.column);
    };
    this.getDocument = function() {
        return this.document;
    };
    this.$insertRight = false;
    this.onChange = function(delta) {
        if (delta.start.row == delta.end.row && delta.start.row != this.row)
            return;

        if (delta.start.row > this.row)
            return;
            
        var point = $getTransformedPoint(delta, {row: this.row, column: this.column}, this.$insertRight);
        this.setPosition(point.row, point.column, true);
    };
    
    function $pointsInOrder(point1, point2, equalPointsInOrder) {
        var bColIsAfter = equalPointsInOrder ? point1.column <= point2.column : point1.column < point2.column;
        return (point1.row < point2.row) || (point1.row == point2.row && bColIsAfter);
    }
            
    function $getTransformedPoint(delta, point, moveIfEqual) {
        var deltaIsInsert = delta.action == "insert";
        var deltaRowShift = (deltaIsInsert ? 1 : -1) * (delta.end.row    - delta.start.row);
        var deltaColShift = (deltaIsInsert ? 1 : -1) * (delta.end.column - delta.start.column);
        var deltaStart = delta.start;
        var deltaEnd = deltaIsInsert ? deltaStart : delta.end; // Collapse insert range.
        if ($pointsInOrder(point, deltaStart, moveIfEqual)) {
            return {
                row: point.row,
                column: point.column
            };
        }
        if ($pointsInOrder(deltaEnd, point, !moveIfEqual)) {
            return {
                row: point.row + deltaRowShift,
                column: point.column + (point.row == deltaEnd.row ? deltaColShift : 0)
            };
        }
        
        return {
            row: deltaStart.row,
            column: deltaStart.column
        };
    }
    this.setPosition = function(row, column, noClip) {
        var pos;
        if (noClip) {
            pos = {
                row: row,
                column: column
            };
        } else {
            pos = this.$clipPositionToDocument(row, column);
        }

        if (this.row == pos.row && this.column == pos.column)
            return;

        var old = {
            row: this.row,
            column: this.column
        };

        this.row = pos.row;
        this.column = pos.column;
        this._signal("change", {
            old: old,
            value: pos
        });
    };
    this.detach = function() {
        this.document.removeEventListener("change", this.$onChange);
    };
    this.attach = function(doc) {
        this.document = doc || this.document;
        this.document.on("change", this.$onChange);
    };
    this.$clipPositionToDocument = function(row, column) {
        var pos = {};

        if (row >= this.document.getLength()) {
            pos.row = Math.max(0, this.document.getLength() - 1);
            pos.column = this.document.getLine(pos.row).length;
        }
        else if (row < 0) {
            pos.row = 0;
            pos.column = 0;
        }
        else {
            pos.row = row;
            pos.column = Math.min(this.document.getLine(pos.row).length, Math.max(0, column));
        }

        if (column < 0)
            pos.column = 0;

        return pos;
    };

}).call(Anchor.prototype);

});

ace.define("ace/document",[], function(require, exports, module) {
"use strict";

var oop = require("./lib/oop");
var applyDelta = require("./apply_delta").applyDelta;
var EventEmitter = require("./lib/event_emitter").EventEmitter;
var Range = require("./range").Range;
var Anchor = require("./anchor").Anchor;

var Document = function(textOrLines) {
    this.$lines = [""];
    if (textOrLines.length === 0) {
        this.$lines = [""];
    } else if (Array.isArray(textOrLines)) {
        this.insertMergedLines({row: 0, column: 0}, textOrLines);
    } else {
        this.insert({row: 0, column:0}, textOrLines);
    }
};

(function() {

    oop.implement(this, EventEmitter);
    this.setValue = function(text) {
        var len = this.getLength() - 1;
        this.remove(new Range(0, 0, len, this.getLine(len).length));
        this.insert({row: 0, column: 0}, text);
    };
    this.getValue = function() {
        return this.getAllLines().join(this.getNewLineCharacter());
    };
    this.createAnchor = function(row, column) {
        return new Anchor(this, row, column);
    };
    if ("aaa".split(/a/).length === 0) {
        this.$split = function(text) {
            return text.replace(/\r\n|\r/g, "\n").split("\n");
        };
    } else {
        this.$split = function(text) {
            return text.split(/\r\n|\r|\n/);
        };
    }


    this.$detectNewLine = function(text) {
        var match = text.match(/^.*?(\r\n|\r|\n)/m);
        this.$autoNewLine = match ? match[1] : "\n";
        this._signal("changeNewLineMode");
    };
    this.getNewLineCharacter = function() {
        switch (this.$newLineMode) {
          case "windows":
            return "\r\n";
          case "unix":
            return "\n";
          default:
            return this.$autoNewLine || "\n";
        }
    };

    this.$autoNewLine = "";
    this.$newLineMode = "auto";
    this.setNewLineMode = function(newLineMode) {
        if (this.$newLineMode === newLineMode)
            return;

        this.$newLineMode = newLineMode;
        this._signal("changeNewLineMode");
    };
    this.getNewLineMode = function() {
        return this.$newLineMode;
    };
    this.isNewLine = function(text) {
        return (text == "\r\n" || text == "\r" || text == "\n");
    };
    this.getLine = function(row) {
        return this.$lines[row] || "";
    };
    this.getLines = function(firstRow, lastRow) {
        return this.$lines.slice(firstRow, lastRow + 1);
    };
    this.getAllLines = function() {
        return this.getLines(0, this.getLength());
    };
    this.getLength = function() {
        return this.$lines.length;
    };
    this.getTextRange = function(range) {
        return this.getLinesForRange(range).join(this.getNewLineCharacter());
    };
    this.getLinesForRange = function(range) {
        var lines;
        if (range.start.row === range.end.row) {
            lines = [this.getLine(range.start.row).substring(range.start.column, range.end.column)];
        } else {
            lines = this.getLines(range.start.row, range.end.row);
            lines[0] = (lines[0] || "").substring(range.start.column);
            var l = lines.length - 1;
            if (range.end.row - range.start.row == l)
                lines[l] = lines[l].substring(0, range.end.column);
        }
        return lines;
    };
    this.insertLines = function(row, lines) {
        console.warn("Use of document.insertLines is deprecated. Use the insertFullLines method instead.");
        return this.insertFullLines(row, lines);
    };
    this.removeLines = function(firstRow, lastRow) {
        console.warn("Use of document.removeLines is deprecated. Use the removeFullLines method instead.");
        return this.removeFullLines(firstRow, lastRow);
    };
    this.insertNewLine = function(position) {
        console.warn("Use of document.insertNewLine is deprecated. Use insertMergedLines(position, ['', '']) instead.");
        return this.insertMergedLines(position, ["", ""]);
    };
    this.insert = function(position, text) {
        if (this.getLength() <= 1)
            this.$detectNewLine(text);
        
        return this.insertMergedLines(position, this.$split(text));
    };
    this.insertInLine = function(position, text) {
        var start = this.clippedPos(position.row, position.column);
        var end = this.pos(position.row, position.column + text.length);
        
        this.applyDelta({
            start: start,
            end: end,
            action: "insert",
            lines: [text]
        }, true);
        
        return this.clonePos(end);
    };
    
    this.clippedPos = function(row, column) {
        var length = this.getLength();
        if (row === undefined) {
            row = length;
        } else if (row < 0) {
            row = 0;
        } else if (row >= length) {
            row = length - 1;
            column = undefined;
        }
        var line = this.getLine(row);
        if (column == undefined)
            column = line.length;
        column = Math.min(Math.max(column, 0), line.length);
        return {row: row, column: column};
    };
    
    this.clonePos = function(pos) {
        return {row: pos.row, column: pos.column};
    };
    
    this.pos = function(row, column) {
        return {row: row, column: column};
    };
    
    this.$clipPosition = function(position) {
        var length = this.getLength();
        if (position.row >= length) {
            position.row = Math.max(0, length - 1);
            position.column = this.getLine(length - 1).length;
        } else {
            position.row = Math.max(0, position.row);
            position.column = Math.min(Math.max(position.column, 0), this.getLine(position.row).length);
        }
        return position;
    };
    this.insertFullLines = function(row, lines) {
        row = Math.min(Math.max(row, 0), this.getLength());
        var column = 0;
        if (row < this.getLength()) {
            lines = lines.concat([""]);
            column = 0;
        } else {
            lines = [""].concat(lines);
            row--;
            column = this.$lines[row].length;
        }
        this.insertMergedLines({row: row, column: column}, lines);
    };    
    this.insertMergedLines = function(position, lines) {
        var start = this.clippedPos(position.row, position.column);
        var end = {
            row: start.row + lines.length - 1,
            column: (lines.length == 1 ? start.column : 0) + lines[lines.length - 1].length
        };
        
        this.applyDelta({
            start: start,
            end: end,
            action: "insert",
            lines: lines
        });
        
        return this.clonePos(end);
    };
    this.remove = function(range) {
        var start = this.clippedPos(range.start.row, range.start.column);
        var end = this.clippedPos(range.end.row, range.end.column);
        this.applyDelta({
            start: start,
            end: end,
            action: "remove",
            lines: this.getLinesForRange({start: start, end: end})
        });
        return this.clonePos(start);
    };
    this.removeInLine = function(row, startColumn, endColumn) {
        var start = this.clippedPos(row, startColumn);
        var end = this.clippedPos(row, endColumn);
        
        this.applyDelta({
            start: start,
            end: end,
            action: "remove",
            lines: this.getLinesForRange({start: start, end: end})
        }, true);
        
        return this.clonePos(start);
    };
    this.removeFullLines = function(firstRow, lastRow) {
        firstRow = Math.min(Math.max(0, firstRow), this.getLength() - 1);
        lastRow  = Math.min(Math.max(0, lastRow ), this.getLength() - 1);
        var deleteFirstNewLine = lastRow == this.getLength() - 1 && firstRow > 0;
        var deleteLastNewLine  = lastRow  < this.getLength() - 1;
        var startRow = ( deleteFirstNewLine ? firstRow - 1                  : firstRow                    );
        var startCol = ( deleteFirstNewLine ? this.getLine(startRow).length : 0                           );
        var endRow   = ( deleteLastNewLine  ? lastRow + 1                   : lastRow                     );
        var endCol   = ( deleteLastNewLine  ? 0                             : this.getLine(endRow).length ); 
        var range = new Range(startRow, startCol, endRow, endCol);
        var deletedLines = this.$lines.slice(firstRow, lastRow + 1);
        
        this.applyDelta({
            start: range.start,
            end: range.end,
            action: "remove",
            lines: this.getLinesForRange(range)
        });
        return deletedLines;
    };
    this.removeNewLine = function(row) {
        if (row < this.getLength() - 1 && row >= 0) {
            this.applyDelta({
                start: this.pos(row, this.getLine(row).length),
                end: this.pos(row + 1, 0),
                action: "remove",
                lines: ["", ""]
            });
        }
    };
    this.replace = function(range, text) {
        if (!(range instanceof Range))
            range = Range.fromPoints(range.start, range.end);
        if (text.length === 0 && range.isEmpty())
            return range.start;
        if (text == this.getTextRange(range))
            return range.end;

        this.remove(range);
        var end;
        if (text) {
            end = this.insert(range.start, text);
        }
        else {
            end = range.start;
        }
        
        return end;
    };
    this.applyDeltas = function(deltas) {
        for (var i=0; i<deltas.length; i++) {
            this.applyDelta(deltas[i]);
        }
    };
    this.revertDeltas = function(deltas) {
        for (var i=deltas.length-1; i>=0; i--) {
            this.revertDelta(deltas[i]);
        }
    };
    this.applyDelta = function(delta, doNotValidate) {
        var isInsert = delta.action == "insert";
        if (isInsert ? delta.lines.length <= 1 && !delta.lines[0]
            : !Range.comparePoints(delta.start, delta.end)) {
            return;
        }
        
        if (isInsert && delta.lines.length > 20000) {
            this.$splitAndapplyLargeDelta(delta, 20000);
        }
        else {
            applyDelta(this.$lines, delta, doNotValidate);
            this._signal("change", delta);
        }
    };
    
    this.$splitAndapplyLargeDelta = function(delta, MAX) {
        var lines = delta.lines;
        var l = lines.length - MAX + 1;
        var row = delta.start.row; 
        var column = delta.start.column;
        for (var from = 0, to = 0; from < l; from = to) {
            to += MAX - 1;
            var chunk = lines.slice(from, to);
            chunk.push("");
            this.applyDelta({
                start: this.pos(row + from, column),
                end: this.pos(row + to, column = 0),
                action: delta.action,
                lines: chunk
            }, true);
        }
        delta.lines = lines.slice(from);
        delta.start.row = row + from;
        delta.start.column = column;
        this.applyDelta(delta, true);
    };
    this.revertDelta = function(delta) {
        this.applyDelta({
            start: this.clonePos(delta.start),
            end: this.clonePos(delta.end),
            action: (delta.action == "insert" ? "remove" : "insert"),
            lines: delta.lines.slice()
        });
    };
    this.indexToPosition = function(index, startRow) {
        var lines = this.$lines || this.getAllLines();
        var newlineLength = this.getNewLineCharacter().length;
        for (var i = startRow || 0, l = lines.length; i < l; i++) {
            index -= lines[i].length + newlineLength;
            if (index < 0)
                return {row: i, column: index + lines[i].length + newlineLength};
        }
        return {row: l-1, column: index + lines[l-1].length + newlineLength};
    };
    this.positionToIndex = function(pos, startRow) {
        var lines = this.$lines || this.getAllLines();
        var newlineLength = this.getNewLineCharacter().length;
        var index = 0;
        var row = Math.min(pos.row, lines.length);
        for (var i = startRow || 0; i < row; ++i)
            index += lines[i].length + newlineLength;

        return index + pos.column;
    };

}).call(Document.prototype);

exports.Document = Document;
});

ace.define("ace/lib/lang",[], function(require, exports, module) {
"use strict";

exports.last = function(a) {
    return a[a.length - 1];
};

exports.stringReverse = function(string) {
    return string.split("").reverse().join("");
};

exports.stringRepeat = function (string, count) {
    var result = '';
    while (count > 0) {
        if (count & 1)
            result += string;

        if (count >>= 1)
            string += string;
    }
    return result;
};

var trimBeginRegexp = /^\s\s*/;
var trimEndRegexp = /\s\s*$/;

exports.stringTrimLeft = function (string) {
    return string.replace(trimBeginRegexp, '');
};

exports.stringTrimRight = function (string) {
    return string.replace(trimEndRegexp, '');
};

exports.copyObject = function(obj) {
    var copy = {};
    for (var key in obj) {
        copy[key] = obj[key];
    }
    return copy;
};

exports.copyArray = function(array){
    var copy = [];
    for (var i=0, l=array.length; i<l; i++) {
        if (array[i] && typeof array[i] == "object")
            copy[i] = this.copyObject(array[i]);
        else 
            copy[i] = array[i];
    }
    return copy;
};

exports.deepCopy = function deepCopy(obj) {
    if (typeof obj !== "object" || !obj)
        return obj;
    var copy;
    if (Array.isArray(obj)) {
        copy = [];
        for (var key = 0; key < obj.length; key++) {
            copy[key] = deepCopy(obj[key]);
        }
        return copy;
    }
    if (Object.prototype.toString.call(obj) !== "[object Object]")
        return obj;
    
    copy = {};
    for (var key in obj)
        copy[key] = deepCopy(obj[key]);
    return copy;
};

exports.arrayToMap = function(arr) {
    var map = {};
    for (var i=0; i<arr.length; i++) {
        map[arr[i]] = 1;
    }
    return map;

};

exports.createMap = function(props) {
    var map = Object.create(null);
    for (var i in props) {
        map[i] = props[i];
    }
    return map;
};
exports.arrayRemove = function(array, value) {
  for (var i = 0; i <= array.length; i++) {
    if (value === array[i]) {
      array.splice(i, 1);
    }
  }
};

exports.escapeRegExp = function(str) {
    return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
};

exports.escapeHTML = function(str) {
    return ("" + str).replace(/&/g, "&#38;").replace(/"/g, "&#34;").replace(/'/g, "&#39;").replace(/</g, "&#60;");
};

exports.getMatchOffsets = function(string, regExp) {
    var matches = [];

    string.replace(regExp, function(str) {
        matches.push({
            offset: arguments[arguments.length-2],
            length: str.length
        });
    });

    return matches;
};
exports.deferredCall = function(fcn) {
    var timer = null;
    var callback = function() {
        timer = null;
        fcn();
    };

    var deferred = function(timeout) {
        deferred.cancel();
        timer = setTimeout(callback, timeout || 0);
        return deferred;
    };

    deferred.schedule = deferred;

    deferred.call = function() {
        this.cancel();
        fcn();
        return deferred;
    };

    deferred.cancel = function() {
        clearTimeout(timer);
        timer = null;
        return deferred;
    };
    
    deferred.isPending = function() {
        return timer;
    };

    return deferred;
};


exports.delayedCall = function(fcn, defaultTimeout) {
    var timer = null;
    var callback = function() {
        timer = null;
        fcn();
    };

    var _self = function(timeout) {
        if (timer == null)
            timer = setTimeout(callback, timeout || defaultTimeout);
    };

    _self.delay = function(timeout) {
        timer && clearTimeout(timer);
        timer = setTimeout(callback, timeout || defaultTimeout);
    };
    _self.schedule = _self;

    _self.call = function() {
        this.cancel();
        fcn();
    };

    _self.cancel = function() {
        timer && clearTimeout(timer);
        timer = null;
    };

    _self.isPending = function() {
        return timer;
    };

    return _self;
};
});

ace.define("ace/worker/mirror",[], function(require, exports, module) {
"use strict";

var Range = require("../range").Range;
var Document = require("../document").Document;
var lang = require("../lib/lang");
    
var Mirror = exports.Mirror = function(sender) {
    this.sender = sender;
    var doc = this.doc = new Document("");
    
    var deferredUpdate = this.deferredUpdate = lang.delayedCall(this.onUpdate.bind(this));
    
    var _self = this;
    sender.on("change", function(e) {
        var data = e.data;
        if (data[0].start) {
            doc.applyDeltas(data);
        } else {
            for (var i = 0; i < data.length; i += 2) {
                if (Array.isArray(data[i+1])) {
                    var d = {action: "insert", start: data[i], lines: data[i+1]};
                } else {
                    var d = {action: "remove", start: data[i], end: data[i+1]};
                }
                doc.applyDelta(d, true);
            }
        }
        if (_self.$timeout)
            return deferredUpdate.schedule(_self.$timeout);
        _self.onUpdate();
    });
};

(function() {
    
    this.$timeout = 500;
    
    this.setTimeout = function(timeout) {
        this.$timeout = timeout;
    };
    
    this.setValue = function(value) {
        this.doc.setValue(value);
        this.deferredUpdate.schedule(this.$timeout);
    };
    
    this.getValue = function(callbackId) {
        this.sender.callback(this.doc.getValue(), callbackId);
    };
    
    this.onUpdate = function() {
    };
    
    this.isPending = function() {
        return this.deferredUpdate.isPending();
    };
    
}).call(Mirror.prototype);

});

ace.define("ace/mode/latex_worker",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var Mirror = require("../worker/mirror").Mirror;

var LatexWorker = exports.LatexWorker = function(sender) {
    Mirror.call(this, sender);
    this.setTimeout(250);
};

oop.inherits(LatexWorker, Mirror);

(function() {
    var disabled = false;
    this.onUpdate = function() {
        if (disabled) { return ; };

        var value = this.doc.getValue();
        var errors = [];
        var contexts = [];
        try {
            if (value) {
                var result = Parse(value);
                errors = result.errors;
                contexts = result.contexts;
            }
        } catch (e) {
            console.log(e);
            disabled = true;
            this.sender.emit("fatal-error", e);
            errors = [];
        }
        this.sender.emit("lint", {
          errors: errors,
          contexts: contexts
        });
    };

}).call(LatexWorker.prototype);

var Tokenise = function (text) {
    var Tokens = [];
    var Comments = [];
    var pos = -1;
    var SPECIAL = /[\\\{\}\$\&\#\^\_\~\%]/g;  // match TeX special characters
    var NEXTCS = /[^a-zA-Z]/g;  // match characters which aren't part of a TeX control sequence
    var idx = 0;

    var lineNumber = 0;   // current line number when parsing tokens (zero-based)
    var linePosition = [];  // mapping from line number to absolute offset of line in text[]
    linePosition[0] = 0;

    var checkingDisabled = false;
    var count = 0;  // number of tokens parses
    var MAX_TOKENS = 100000;

    while (true) {
        count++;
        if (count > MAX_TOKENS) {
            throw new Error("exceed max token count of " + MAX_TOKENS);
            break;
        };
        var result = SPECIAL.exec(text);
        if (result == null) {
            if (idx < text.length) {
                Tokens.push([lineNumber, "Text", idx, text.length]);
            }
            break;
        }
        if (result && result.index <= pos) {
            throw new Error("infinite loop in parsing");
            break;
        };
        pos = result.index;
        if (pos > idx) {
            Tokens.push([lineNumber, "Text", idx, pos]);
        }
        for (var i = idx; i < pos; i++) {
            if (text[i] === "\n") {
                lineNumber++;
                linePosition[lineNumber] = i+1;
            }
        }

        var newIdx = SPECIAL.lastIndex;
        idx = newIdx;
        var code = result[0];
        if (code === "%") { // comment character
            var newLinePos = text.indexOf("\n", idx);
            if (newLinePos === -1) {
                newLinePos = text.length;
            };
            var commentString = text.substring(idx, newLinePos);
            if (commentString.indexOf("%novalidate") === 0) {
                return [];
            } else if(!checkingDisabled && commentString.indexOf("%begin novalidate") === 0) {
                checkingDisabled = true;
            } else if (checkingDisabled && commentString.indexOf("%end novalidate") === 0) {
                checkingDisabled = false;
            };
            idx = SPECIAL.lastIndex = newLinePos + 1;
            Comments.push([lineNumber, idx, newLinePos]);
            lineNumber++;
            linePosition[lineNumber] = idx;
        } else if (checkingDisabled) {
            continue;
        } else if (code === '\\') { // escape character
            NEXTCS.lastIndex = idx;
            var controlSequence = NEXTCS.exec(text);
            var nextSpecialPos = controlSequence === null ? idx : controlSequence.index;
            if (nextSpecialPos === idx) {
                Tokens.push([lineNumber, code, pos, idx + 1, text[idx], "control-symbol"]);
                idx = SPECIAL.lastIndex = idx + 1;
                char = text[nextSpecialPos];
                if (char === '\n') { lineNumber++; linePosition[lineNumber] = nextSpecialPos;};
            } else {
                Tokens.push([lineNumber, code, pos, nextSpecialPos, text.slice(idx, nextSpecialPos)]);
                var char;
                while ((char = text[nextSpecialPos]) === ' ' || char === '\t' || char  === '\r' || char === '\n') {
                    nextSpecialPos++;
                    if (char === '\n') { lineNumber++; linePosition[lineNumber] = nextSpecialPos;};
                }
                idx = SPECIAL.lastIndex = nextSpecialPos;
            }
        } else if (["{", "}", "$", "&", "#", "^", "_", "~"].indexOf(code) > -1) {  // special characters
            Tokens.push([lineNumber, code, pos, pos+1]);
        } else {
            throw "unrecognised character " + code;
        }
    }

    return {tokens: Tokens, comments: Comments, linePosition: linePosition, lineNumber: lineNumber, text: text};
};

var read1arg = function (TokeniseResult, k, options) {
    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;
    if (options && options.allowStar) {
        var optional = Tokens[k+1];
        if (optional && optional[1] === "Text") {
            var optionalstr = text.substring(optional[2], optional[3]);
            if (optionalstr === "*") { k++;}
        };
    };

    var open = Tokens[k+1];
    var delimiter = Tokens[k+2];
    var close = Tokens[k+3];
    var delimiterName;

    if(open && open[1] === "\\") {
        delimiterName = open[4]; // array element 4 is command sequence
        return k + 1;
    } else if(open && open[1] === "{" && delimiter && delimiter[1] === "\\" && close && close[1] === "}") {
        delimiterName = delimiter[4]; // NOTE: if we were actually using this, keep track of * above
        return k + 3; // array element 4 is command sequence
    } else {
        return null;
    }
};

var readLetDefinition = function (TokeniseResult, k) {

    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    var first = Tokens[k+1];
    var second = Tokens[k+2];
    var third = Tokens[k+3];

    if(first && first[1] === "\\" && second && second[1] === "\\") {
        return k + 2;
    } else if(first && first[1] === "\\" &&
              second && second[1] === "Text" && text.substring(second[2], second[3]) === "=" &&
              third && third[1] === "\\") {
        return k + 3;
    } else {
        return null;
    }
};

var read1name = function (TokeniseResult, k) {
    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    var open = Tokens[k+1];
    var delimiter = Tokens[k+2];
    var close = Tokens[k+3];

    if(open && open[1] === "{" && delimiter && delimiter[1] === "Text" && close && close[1] === "}") {
        var delimiterName = text.substring(delimiter[2], delimiter[3]);
        return k + 3;
    } else if (open && open[1] === "{" && delimiter && delimiter[1] === "Text") {
        delimiterName = "";
        for (var j = k + 2, tok; (tok = Tokens[j]); j++) {
            if (tok[1] === "Text") {
                var str = text.substring(tok[2], tok[3]);
                if (!str.match(/^\S*$/)) { break; }
                delimiterName = delimiterName + str;
            } else if (tok[1] === "_") {
                delimiterName = delimiterName + "_";
            } else {
                break;
            }
        }
        if (tok && tok[1] === "}") {
            return  j; // advance past these tokens
        } else {
            return null;
        }
    } else {
        return null;
    }
};

var read1filename = function (TokeniseResult, k) {
    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    var fileName = "";
    for (var j = k + 1, tok; (tok = Tokens[j]); j++) {
        if (tok[1] === "Text") {
            var str = text.substring(tok[2], tok[3]);
            if (!str.match(/^\S*$/)) { break; }
            fileName = fileName + str;
        } else if (tok[1] === "_") {
            fileName = fileName + "_";
        } else {
            break;
        }
    }
    if (fileName.length > 0) {
        return  j; // advance past these tokens
    } else {
        return null;
    }
};

var readOptionalParams = function(TokeniseResult, k) {
    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    var params = Tokens[k+1];
    if(params && params[1] === "Text") {
        var paramNum = text.substring(params[2], params[3]);
        if (paramNum.match(/^\[\d+\](\[[^\]]*\])*\s*$/)) {
            return k + 1; // got it
        };
    };
    var count = 0;
    var nextToken = Tokens[k+1];
    if (!nextToken) { return null };
    var pos = nextToken[2];

    for (var i = pos, end = text.length; i < end; i++) {
        var char = text[i];
        if (nextToken && i >= nextToken[2]) { k++; nextToken = Tokens[k+1];};
        if (char === "[") { count++; }
        if (char === "]") { count--; }
        if (count === 0 && char === "{") { return k - 1; }
        if (count > 0 && (char  === '\r' || char === '\n')) { return null; }
    };
    return null;
};

var readOptionalGeneric = function(TokeniseResult, k) {
    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    var params = Tokens[k+1];

    if(params && params[1] === "Text") {
        var paramNum = text.substring(params[2], params[3]);
        if (paramNum.match(/^(\[[^\]]*\])+\s*$/)) {
            return k + 1; // got it
        };
    };
    return null;
};

var readOptionalStar = function(TokeniseResult, k) {
  var Tokens = TokeniseResult.tokens;
  var text = TokeniseResult.text;

  var params = Tokens[k + 1];

  if (params && params[1] === "Text") {
    var paramNum = text.substring(params[2], params[3]);
    if (paramNum.match(/^(\*)+\s*$/)) {
      return k + 1; // got it
    }
  }
  return null;
};

var readOptionalDef = function (TokeniseResult, k) {
    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    var defToken = Tokens[k];
    var pos = defToken[3];

    var openBrace = "{";
    var nextToken = Tokens[k+1];
    for (var i = pos, end = text.length; i < end; i++) {
        var char = text[i];
        if (nextToken && i >= nextToken[2]) { k++; nextToken = Tokens[k+1];};
        if (char === openBrace) { return k - 1; }; // move back to the last token of the optional arguments
        if (char  === '\r' || char === '\n') { return null; }
    };

    return null;

};

var readDefinition = function(TokeniseResult, k) {
    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    k = k + 1;
    var count = 0;
    var nextToken = Tokens[k];
    while (nextToken && nextToken[1] === "Text") {
        var start = nextToken[2], end = nextToken[3];
        for (var i = start; i < end; i++) {
            var char = text[i];
            if (char === ' ' || char === '\t' || char  === '\r' || char === '\n') { continue; }
            return null; // bail out, should begin with a {
        }
        k++;
        nextToken = Tokens[k];
    }
    if (nextToken && nextToken[1] === "{") {
        count++;
        while (count>0) {
            k++;
            nextToken = Tokens[k];
            if(!nextToken) { break; };
            if (nextToken[1] === "}") { count--; }
            if (nextToken[1] === "{") { count++; }
        }
        return k;
    }

    return null;
};

var readVerb = function(TokeniseResult, k) {

    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    var verbToken = Tokens[k];
    var verbStr = text.substring(verbToken[2], verbToken[3]);
    var pos = verbToken[3];
    if (text[pos] === "*") { pos++; } // \verb* form of command
    var delimiter = text[pos];
    pos++;

    var nextToken = Tokens[k+1];
    for (var i = pos, end = text.length; i < end; i++) {
        var char = text[i];
        if (nextToken && i >= nextToken[2]) { k++; nextToken = Tokens[k+1];};
        if (char === delimiter) { return k; };
        if (char  === '\r' || char === '\n') { return null; }
    };

    return null;
};

var readUrl = function(TokeniseResult, k) {

    var Tokens = TokeniseResult.tokens;
    var text = TokeniseResult.text;

    var urlToken = Tokens[k];
    var urlStr = text.substring(urlToken[2], urlToken[3]);
    var pos = urlToken[3];
    var openDelimiter = text[pos];
    var closeDelimiter =  (openDelimiter === "{") ? "}" : openDelimiter;
    var nextToken = Tokens[k+1];
    if (nextToken && pos === nextToken[2]) {
        k++;
        nextToken = Tokens[k+1];
    };
    pos++;

    var count = 1;
    for (var i = pos, end = text.length; count > 0 && i < end; i++) {
        var char = text[i];
        if (nextToken && i >= nextToken[2]) { k++; nextToken = Tokens[k+1];};
        if (char === closeDelimiter) {
            count--;
        } else if (char === openDelimiter) {
            count++;
        };
        if (count === 0) { return k; };
        if (char  === '\r' || char === '\n') { return null; }
    };

    return null;
};

var InterpretTokens = function (TokeniseResult, ErrorReporter) {
    var Tokens = TokeniseResult.tokens;
    var linePosition = TokeniseResult.linePosition;
    var lineNumber = TokeniseResult.lineNumber;
    var text = TokeniseResult.text;

    var TokenErrorFromTo = ErrorReporter.TokenErrorFromTo;
    var TokenError = ErrorReporter.TokenError;
    var Environments = new EnvHandler(TokeniseResult, ErrorReporter);

    var nextGroupMathMode = null; // if the next group should have
    var nextGroupMathModeStack = [] ; // tracking all nextGroupMathModes
    var seenUserDefinedBeginEquation = false; // if we have seen macros like \beq
    var seenUserDefinedEndEquation = false; // if we have seen macros like \eeq

    for (var i = 0, len = Tokens.length; i < len; i++) {
        var token = Tokens[i];
        var line = token[0], type = token[1], start = token[2], end = token[3], seq = token[4];

        if (type === "{") {
            Environments.push({command:"{", token:token, mathMode: nextGroupMathMode});
            nextGroupMathModeStack.push(nextGroupMathMode);
            nextGroupMathMode = null;
            continue;
        } else if (type === "}") {
            Environments.push({command:"}", token:token});
            nextGroupMathMode = nextGroupMathModeStack.pop();
            continue;
        } else {
            nextGroupMathMode = null;
        };

        if (type === "\\") {
            if (seq === "begin" || seq === "end") {
                var open = Tokens[i+1];
                var delimiter = Tokens[i+2];
                var close = Tokens[i+3];
                if(open && open[1] === "{" && delimiter && delimiter[1] === "Text" && close && close[1] === "}") {
                    var delimiterName = text.substring(delimiter[2], delimiter[3]);
                    Environments.push({command: seq, name: delimiterName, token: token, closeToken: close});
                    i = i + 3; // advance past these tokens
                } else {
                    if (open && open[1] === "{" && delimiter && delimiter[1] === "Text") {
                        delimiterName = "";
                        for (var j = i + 2, tok; (tok = Tokens[j]); j++) {
                            if (tok[1] === "Text") {
                                var str = text.substring(tok[2], tok[3]);
                                if (!str.match(/^\S*$/)) { break; }
                                delimiterName = delimiterName + str;
                            } else if (tok[1] === "_") {
                                delimiterName = delimiterName + "_";
                            } else {
                                break;
                            }
                        }
                        if (tok && tok[1] === "}") {
                            Environments.push({command: seq, name: delimiterName, token: token, closeToken: close});
                            i = j; // advance past these tokens
                            continue;
                        }
                    }
                    var endToken = null;
                    if (open && open[1] === "{") {
                        endToken = open; // we've got a {
                        if (delimiter && delimiter[1] === "Text") {
                            endToken = delimiter.slice(); // we've got some text following the {
                            start = endToken[2]; end = endToken[3];
                            for (j = start; j < end; j++) {
                                var char = text[j];
                                if (char === ' ' || char === '\t' || char  === '\r' || char === '\n') { break; }
                            }
                            endToken[3] = j; // the end of partial token is as far as we got looking ahead
                        };
                    };

                    if (endToken) {
                        TokenErrorFromTo(token, endToken, "invalid environment command " + text.substring(token[2], endToken[3] || endToken[2]));
                    } else {
                        TokenError(token, "invalid environment command");
                    };
                }
            } else if (typeof seq === "string" && seq.match(/^(be|beq|beqa|bea)$/i)) {
                seenUserDefinedBeginEquation = true;
            } else if (typeof seq === "string" && seq.match(/^(ee|eeq|eeqn|eeqa|eeqan|eea)$/i)) {
                seenUserDefinedEndEquation = true;
            } else if (seq === "newcommand" || seq === "renewcommand" || seq === "DeclareRobustCommand") {
                var newPos = read1arg(TokeniseResult, i, {allowStar: true});
                if (newPos === null) { continue; } else {i = newPos;};
                newPos = readOptionalParams(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};

            } else if (seq === "def") {
                newPos = read1arg(TokeniseResult, i);
                if (newPos === null) { continue; } else {i = newPos;};
                newPos = readOptionalDef(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};

            } else if (seq === "let") {
                newPos = readLetDefinition(TokeniseResult, i);
                if (newPos === null) { continue; } else {i = newPos;};

            } else if (seq === "newcolumntype") {
                newPos = read1name(TokeniseResult, i);
                if (newPos === null) { continue; } else {i = newPos;};
                newPos = readOptionalParams(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};

            } else if (seq === "newenvironment" || seq === "renewenvironment") {
                newPos = read1name(TokeniseResult, i);
                if (newPos === null) { continue; } else {i = newPos;};
                newPos = readOptionalParams(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
            } else if (seq === "verb") {
                newPos = readVerb(TokeniseResult, i);
                if (newPos === null) { TokenError(token, "invalid verbatim command"); } else {i = newPos;};
            } else if (seq === "url") {
                newPos = readUrl(TokeniseResult, i);
                if (newPos === null) { TokenError(token, "invalid url command"); } else {i = newPos;};
            } else if (seq === "left" || seq === "right") {
                var nextToken = Tokens[i+1];
                char = "";
                if (nextToken && nextToken[1] === "Text") {
                    char = text.substring(nextToken[2], nextToken[2] + 1);
                } else if (nextToken && nextToken[1] === "\\" && nextToken[5] == "control-symbol") {
                    char = nextToken[4];
                } else if (nextToken && nextToken[1] === "\\") {
                    char = "unknown";
                }
                if (char === "" || (char !== "unknown" && "(){}[]<>/|\\.".indexOf(char) === -1)) {
                    TokenError(token, "invalid bracket command");
                } else {
                    i = i + 1;
                    Environments.push({command:seq, token:token});
                };
            } else if (seq === "(" || seq === ")" || seq === "[" || seq === "]") {
                Environments.push({command:seq, token:token});
            } else if (seq === "input") {
                newPos = read1filename(TokeniseResult, i);
                if (newPos === null) { continue; } else {i = newPos;};
            } else if (seq === "hbox" || seq === "text" || seq === "mbox" || seq === "footnote" || seq === "intertext" || seq === "shortintertext" || seq === "textnormal" || seq === "reflectbox" || seq === "textrm") {
                nextGroupMathMode = false;
            } else if (seq === "tag") {
                newPos = readOptionalStar(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                nextGroupMathMode = false;
            } else if (seq === "rotatebox" || seq === "scalebox"  || seq == "feynmandiagram" || seq === "tikz") {
                newPos = readOptionalGeneric(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                nextGroupMathMode = false;
            } else if (seq === "resizebox") {
                newPos = readOptionalGeneric(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};

                nextGroupMathMode = false;
            } else if (seq === "DeclareMathOperator") {
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
            } else if (seq === "DeclarePairedDelimiter") {
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
                newPos = readDefinition(TokeniseResult, i);
                if (newPos === null) { /* do nothing */ } else {i = newPos;};
            } else if (typeof seq === "string" && seq.match(/^(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)$/)) {
                var currentMathMode = Environments.getMathMode() ; // returns null / $(inline) / $$(display)
                if (currentMathMode === null) {
                    TokenError(token, type + seq + " must be inside math mode", {mathMode:true});
                };
            } else if (typeof seq === "string" && seq.match(/^(chapter|section|subsection|subsubsection)$/)) {
                currentMathMode = Environments.getMathMode() ; // returns null / $(inline) / $$(display)
                if (currentMathMode) {
                    TokenError(token, type + seq + " used inside math mode", {mathMode:true});
                    Environments.resetMathMode();
                };
            } else if (typeof seq === "string" && seq.match(/^[a-z]+$/)) {
                nextGroupMathMode = undefined;
            };

        } else if (type === "$") {
            var lookAhead = Tokens[i+1];
            var nextIsDollar = lookAhead && lookAhead[1] === "$";
            currentMathMode = Environments.getMathMode() ; // returns null / $(inline) / $$(display)
            if (nextIsDollar && (!currentMathMode || currentMathMode.command == "$$")) {
                if (currentMathMode && currentMathMode.command == "$$") {
                    var delimiterToken = lookAhead;
                } else {
                    var delimiterToken = token;
                }
                Environments.push({command:"$$", token:delimiterToken});
                i = i + 1;
            } else {
                Environments.push({command:"$", token:token});
            }
        } else if (type === "^" || type === "_") {
            currentMathMode = Environments.getMathMode() ; // returns null / $(inline) / $$(display)
            var insideGroup = Environments.insideGroup();  // true if inside {....}
            if (currentMathMode === null && !insideGroup) {
                TokenError(token, type + " must be inside math mode", {mathMode:true});
            };
        }
    };

    if (seenUserDefinedBeginEquation && seenUserDefinedEndEquation) {
        ErrorReporter.filterMath = true;
    };

    return Environments;
};

var DocumentTree = function(TokeniseResult) {
    var tree = {
      children: []
    };
    var stack = [tree];
    
    this.openEnv = function(startDelimiter) {
        var currentNode = this.getCurrentNode();
        var newNode = {
            startDelimiter: startDelimiter,
            children: []
        };
        currentNode.children.push(newNode);
        stack.push(newNode);
    };
    
    this.closeEnv = function(endDelimiter) {
        if (stack.length == 1) {
            return null
        }
        var currentNode = stack.pop();
        currentNode.endDelimiter = endDelimiter;
        return currentNode.startDelimiter;
    };
    
    this.getNthPreviousNode = function(n) {
        var offset = stack.length - n - 1;
        if (offset < 0)
            return null;
        return stack[offset];
    }
    
    this.getCurrentNode = function() {
        return this.getNthPreviousNode(0);
    }
    
    this.getCurrentDelimiter = function() {
        return this.getCurrentNode().startDelimiter;
    };

    this.getPreviousDelimiter = function() {
        var node = this.getNthPreviousNode(1);
        if (!node)
            return null
        return node.startDelimiter;
    }
    
    this.getDepth = function() {
        return (stack.length - 1) // Root node doesn't count
    }
    
    this.getContexts = function() {
        var linePosition = TokeniseResult.linePosition;

        function tokenToRange(token) {
            var line = token[0], start = token[2], end = token[3];
            var start_col = start - linePosition[line];
            if (!end) { end = start + 1; } ;
            var end_col = end - linePosition[line];
            return {
                start: {
                    row: line,
                    column: start_col
                },
                end: {
                    row: line,
                    column: end_col
                }
            }
        };
        
        function getContextsFromNode(node) {
            if (node.startDelimiter && node.startDelimiter.mathMode) {
                var context = {
                    type: "math",
                    range: {
                        start: tokenToRange(node.startDelimiter.token).start
                    }
                };
                if (node.endDelimiter) {
                    var closeToken = node.endDelimiter.closeToken || node.endDelimiter.token;
                    context.range.end = tokenToRange(closeToken).end;
                };
                return [context];
            } else {
                var contexts = [];
                for (var i = 0; i < node.children.length; i++) {
                    var child = node.children[i];
                    contexts = contexts.concat(getContextsFromNode(child));
                }
                return contexts;
            }
        };
        
        return getContextsFromNode(tree);
    }
}

var EnvHandler = function (TokeniseResult, ErrorReporter) {
    var ErrorTo = ErrorReporter.EnvErrorTo;
    var ErrorFromTo = ErrorReporter.EnvErrorFromTo;
    var ErrorFrom = ErrorReporter.EnvErrorFrom;

    var delimiters = [];

    var document = new DocumentTree(TokeniseResult);
    var documentClosed = null;
    var inVerbatim = false;
    var verbatimRanges = [];
    
    this.getDocument = function() {
        return document;
    };

    this.push = function (newDelimiter) {
        this.setDelimiterProps(newDelimiter);
        this.checkAndUpdateState(newDelimiter);
        delimiters.push(newDelimiter);
    };

    this._endVerbatim = function (thisDelimiter) {
        var lastDelimiter = document.getCurrentDelimiter();
        if (lastDelimiter && lastDelimiter.name === thisDelimiter.name) {
            inVerbatim = false;
            document.closeEnv(thisDelimiter);
            verbatimRanges.push({start: lastDelimiter.token[2], end: thisDelimiter.token[2]});
        }
    };

    var invalidEnvs = [];

    this._end = function (thisDelimiter) {
        do {
            var lastDelimiter = document.getCurrentDelimiter();
            var retry = false;
            var i;

            if (closedBy(lastDelimiter, thisDelimiter)) {
                document.closeEnv(thisDelimiter);
                if (thisDelimiter.command === "end" && thisDelimiter.name === "document" && !documentClosed) {
                    documentClosed = thisDelimiter;
                };
                return;
            } else if (!lastDelimiter) {
                if (documentClosed) {
                    ErrorFromTo(documentClosed, thisDelimiter, "\\end{" + documentClosed.name + "} is followed by unexpected content",{errorAtStart: true, type: "info"});
                } else {
                    ErrorTo(thisDelimiter, "unexpected " + getName(thisDelimiter));
                }
            } else if (invalidEnvs.length > 0 && (i = indexOfClosingEnvInArray(invalidEnvs, thisDelimiter) > -1)) {
                invalidEnvs.splice(i, 1);
                return;
            } else {
                var status = reportError(lastDelimiter, thisDelimiter);
                if (delimiterPrecedence(lastDelimiter) < delimiterPrecedence(thisDelimiter)) {
                    document.closeEnv();
                    invalidEnvs.push(lastDelimiter);
                    retry = true;
                } else {
                    var prevDelimiter = document.getPreviousDelimiter();
                    if(prevDelimiter) {
                        if (thisDelimiter.name === prevDelimiter.name) {
                            document.closeEnv() // Close current env
                            document.closeEnv(thisDelimiter) // Close previous env
                            return;
                        }
                    }
                    invalidEnvs.push(lastDelimiter);
                }

            }
        } while (retry === true);
    };

    var CLOSING_DELIMITER = {
        "{" : "}",
        "left" : "right",
        "[" : "]",
        "(" : ")",
        "$" : "$",
        "$$": "$$"
    };

    var closedBy = function (lastDelimiter, thisDelimiter) {
        if (!lastDelimiter) {
            return false ;
        } else if (thisDelimiter.command === "end") {
            return lastDelimiter.command === "begin" && lastDelimiter.name === thisDelimiter.name;
        } else if (thisDelimiter.command === CLOSING_DELIMITER[lastDelimiter.command]) {
            return true;
        } else {
            return false;
        }
    };

    var indexOfClosingEnvInArray = function (delimiters, thisDelimiter) {
        for (var i = 0, n = delimiters.length; i < n ; i++) {
            if (closedBy(delimiters[i], thisDelimiter)) {
                return i;
            }
        }
        return -1;
    };

    var delimiterPrecedence = function (delimiter) {
        var openScore = {
            "{" : 1,
            "left" : 2,
            "$" : 3,
            "$$" : 4,
            "begin": 4
        };
        var closeScore = {
            "}" : 1,
            "right" : 2,
            "$" : 3,
            "$$" : 5,
            "end": 4
        };
        if (delimiter.command) {
            return openScore[delimiter.command] || closeScore[delimiter.command];
        } else {
            return 0;
        }
    };

    var getName = function(delimiter) {
        var description = {
            "{" : "open group {",
            "}" : "close group }",
            "[" : "open display math \\[",
            "]" : "close display math \\]",
            "(" : "open inline math \\(",
            ")" : "close inline math \\)",
            "$" : "$",
            "$$" : "$$",
            "left" : "\\left",
            "right" : "\\right"
        };
        if (delimiter.command === "begin" || delimiter.command === "end") {
            return "\\" + delimiter.command + "{" + delimiter.name + "}";
        } else if (delimiter.command in description) {
            return description[delimiter.command];
        } else {
            return delimiter.command;
        }
    };

    var EXTRA_CLOSE = 1;
    var UNCLOSED_GROUP = 2;
    var UNCLOSED_ENV = 3;

    var reportError = function(lastDelimiter, thisDelimiter) {
        if (!lastDelimiter) { // unexpected close, nothing was open!
            if (documentClosed) {
                ErrorFromTo(documentClosed, thisDelimiter, "\\end{" + documentClosed.name + "} is followed by unexpected end group }",{errorAtStart: true, type: "info"});
            } else {
                ErrorTo(thisDelimiter, "unexpected " + getName(thisDelimiter));
            };
            return EXTRA_CLOSE;
        } else if (lastDelimiter.command === "{" && thisDelimiter.command === "end") {
            ErrorFromTo(lastDelimiter, thisDelimiter, "unclosed " + getName(lastDelimiter) + " found at " + getName(thisDelimiter),
                        {suppressIfEditing:true, errorAtStart: true, type:"warning"});
            return UNCLOSED_GROUP;
        } else {
            var pLast = delimiterPrecedence(lastDelimiter);
            var pThis = delimiterPrecedence(thisDelimiter);
            if (pThis > pLast) {
                ErrorFromTo(lastDelimiter, thisDelimiter, "unclosed " + getName(lastDelimiter) + " found at " + getName(thisDelimiter),
                           {suppressIfEditing:true, errorAtStart: true});
            } else {
                ErrorFromTo(lastDelimiter, thisDelimiter, "unexpected " + getName(thisDelimiter) + " after " + getName(lastDelimiter));
            }
            return UNCLOSED_ENV;
        };
    };

    this._beginMathMode = function (thisDelimiter) {
        var currentMathMode = this.getMathMode(); // undefined, null, $, $$, name of mathmode env
        if (currentMathMode) {
            ErrorFrom(thisDelimiter, getName(thisDelimiter) + " used inside existing math mode " + getName(currentMathMode),
                      {suppressIfEditing:true, errorAtStart: true, mathMode:true});
        };
        thisDelimiter.mathMode = thisDelimiter;
        document.openEnv(thisDelimiter);
    };

    this._toggleMathMode = function (thisDelimiter) {
        var lastDelimiter = document.getCurrentDelimiter();
        if (closedBy(lastDelimiter, thisDelimiter)) {
            document.closeEnv(thisDelimiter)
            return;
        } else {
            if (lastDelimiter && lastDelimiter.mathMode) {
                this._end(thisDelimiter);
            } else {
                thisDelimiter.mathMode = thisDelimiter;
                document.openEnv(thisDelimiter);
            }
        };
    };

    this.getMathMode = function () {
        var currentDelimiter = document.getCurrentDelimiter();
        if (currentDelimiter) {
            return currentDelimiter.mathMode;
        } else {
            return null;
        }
    };

    this.insideGroup = function () {
        var currentDelimiter = document.getCurrentDelimiter();
        if (currentDelimiter) {
            return (currentDelimiter.command === "{");
        } else {
            return null;
        }
    };

    var resetMathMode = function () {
        var currentDelimiter = document.getCurrentDelimiter();
        if (currentDelimiter) {
            var lastMathMode = currentDelimiter.mathMode;
            do {
                var lastDelimiter = document.closeEnv();
            } while (lastDelimiter && lastDelimiter !== lastMathMode);
        } else {
            return;
        }
    };

    this.resetMathMode = resetMathMode;

    var getNewMathMode = function (currentMathMode, thisDelimiter) {
        var newMathMode = null;

        if (thisDelimiter.command === "{") {
            if (thisDelimiter.mathMode !== null) {
                newMathMode = thisDelimiter.mathMode;
            } else {
                newMathMode = currentMathMode;
            }
        } else if (thisDelimiter.command === "left") {
            if (currentMathMode === null) {
                ErrorFrom(thisDelimiter, "\\left can only be used in math mode", {mathMode: true});
            };
            newMathMode = currentMathMode;
        } else if (thisDelimiter.command === "begin") {
            var name = thisDelimiter.name;
            if (name) {
                if (name.match(/^(document|figure|center|enumerate|itemize|table|abstract|proof|lemma|theorem|definition|proposition|corollary|remark|notation|thebibliography)$/)) {
                    if (currentMathMode) {
                        ErrorFromTo(currentMathMode, thisDelimiter, thisDelimiter.name + " used inside " + getName(currentMathMode),
                                    {suppressIfEditing:true, errorAtStart: true, mathMode: true});
                        resetMathMode();
                    };
                    newMathMode = null;
                } else if (name.match(/^(array|gathered|split|aligned|alignedat)\*?$/)) {
                    if (currentMathMode === null) {
                        ErrorFrom(thisDelimiter, thisDelimiter.name + " not inside math mode", {mathMode: true});
                    };
                    newMathMode = currentMathMode;
                } else if (name.match(/^(math|displaymath|equation|eqnarray|multline|align|gather|flalign|alignat)\*?$/)) {
                    if (currentMathMode) {
                        ErrorFromTo(currentMathMode, thisDelimiter, thisDelimiter.name + " used inside " + getName(currentMathMode),
                                    {suppressIfEditing:true, errorAtStart: true, mathMode: true});
                        resetMathMode();
                    };
                    newMathMode = thisDelimiter;
                } else {
                    newMathMode = undefined;  // undefined means we don't know if we are in math mode or not
                }
            }
        };
        return newMathMode;
    };

    this.checkAndUpdateState = function (thisDelimiter) {
        if (inVerbatim) {
            if (thisDelimiter.command === "end") {
                this._endVerbatim(thisDelimiter);
            } else {
                return; // ignore anything in verbatim environments
            }
        } else if(thisDelimiter.command === "begin" || thisDelimiter.command === "{" || thisDelimiter.command === "left") {
            if (thisDelimiter.verbatim) {inVerbatim = true;};
            var currentMathMode = this.getMathMode(); // undefined, null, $, $$, name of mathmode env
            var newMathMode = getNewMathMode(currentMathMode, thisDelimiter);
            thisDelimiter.mathMode = newMathMode;
            document.openEnv(thisDelimiter);
        } else if (thisDelimiter.command === "end") {
            this._end(thisDelimiter);
        } else if (thisDelimiter.command === "(" || thisDelimiter.command === "[") {
            this._beginMathMode(thisDelimiter);
        } else if (thisDelimiter.command === ")" || thisDelimiter.command === "]") {
            this._end(thisDelimiter);
        } else if (thisDelimiter.command === "}") {
            this._end(thisDelimiter);
        } else if (thisDelimiter.command === "right") {
            this._end(thisDelimiter);
        } else if (thisDelimiter.command === "$" || thisDelimiter.command === "$$") {
            this._toggleMathMode(thisDelimiter);
        }
    };

    this.close = function () {
        while (document.getDepth() > 0) {
            var thisDelimiter = document.closeEnv();
            if (thisDelimiter.command === "{") {
                ErrorFrom(thisDelimiter, "unclosed group {", {type:"warning"});
            } else {
                ErrorFrom(thisDelimiter, "unclosed " + getName(thisDelimiter));
            }
        }
        var vlen = verbatimRanges.length;
        var len = ErrorReporter.tokenErrors.length;
        if (vlen >0 && len > 0) {
            for (var i = 0; i < len; i++) {
                var tokenError = ErrorReporter.tokenErrors[i];
                var startPos = tokenError.startPos;
                var endPos = tokenError.endPos;
                for (var j = 0; j < vlen; j++) {
                    if (startPos > verbatimRanges[j].start && startPos < verbatimRanges[j].end) {
                        tokenError.ignore = true;
                        break;
                    }
                }
            }
        }
    };

    this.setDelimiterProps = function (delimiter) {
        var name = delimiter.name ;
        if (name && name.match(/^(verbatim|boxedverbatim|lstlisting|minted|Verbatim)$/)) {
            delimiter.verbatim = true;
        }
    };
};
var ErrorReporter = function (TokeniseResult) {
    var text = TokeniseResult.text;
    var linePosition = TokeniseResult.linePosition;
    var lineNumber = TokeniseResult.lineNumber;

    var errors = [], tokenErrors = [];
    this.errors = errors;
    this.tokenErrors = tokenErrors;
    this.filterMath = false;

    this.getErrors = function () {
        var returnedErrors = [];
        for (var i = 0, len = tokenErrors.length; i < len; i++) {
            if (!tokenErrors[i].ignore) { returnedErrors.push(tokenErrors[i]); }
        }
        var allErrors = returnedErrors.concat(errors);
        var result = [];
        var mathErrorCount = 0;
        for (i = 0, len = allErrors.length; i < len; i++) {
            if (allErrors[i].mathMode) {
                mathErrorCount++;
            }
            if (mathErrorCount > 10) {
                return [];
            }
        }
        if (this.filterMath && mathErrorCount > 0) {
            for (i = 0, len = allErrors.length; i < len; i++) {
                if (!allErrors[i].mathMode) {
                    result.push(allErrors[i]);
                }
            }
            return result;
        } else {
            return allErrors;
        }
    };

    this.TokenError = function (token, message, options) {
        if(!options) { options = { suppressIfEditing:true } ; };
        var line = token[0], type = token[1], start = token[2], end = token[3];
        var start_col = start - linePosition[line];
        if (!end) { end = start + 1; } ;
        var end_col = end - linePosition[line];
        tokenErrors.push({row: line,
                          column: start_col,
                          start_row:line,
                          start_col: start_col,
                          end_row:line,
                          end_col: end_col,
                          type:"error",
                          text:message,
                          startPos: start,
                          endPos: end,
                          suppressIfEditing:options.suppressIfEditing,
                          mathMode: options.mathMode});
    };

    this.TokenErrorFromTo = function (fromToken, toToken, message, options) {
        if(!options) { options = {suppressIfEditing:true } ; };
        var fromLine = fromToken[0], fromStart = fromToken[2], fromEnd = fromToken[3];
        var toLine = toToken[0], toStart = toToken[2], toEnd = toToken[3];
        if (!toEnd) { toEnd = toStart + 1;};
        var start_col = fromStart - linePosition[fromLine];
        var end_col = toEnd - linePosition[toLine];

        tokenErrors.push({row: fromLine,
                          column: start_col,
                          start_row: fromLine,
                          start_col: start_col,
                          end_row: toLine,
                          end_col: end_col,
                          type:"error",
                          text:message,
                          startPos: fromStart,
                          endPos: toEnd,
                          suppressIfEditing:options.suppressIfEditing,
                          mathMode: options.mathMode});
    };


    this.EnvErrorFromTo = function (fromEnv, toEnv, message, options) {
        if(!options) { options = {} ; };
        var fromToken = fromEnv.token, toToken = toEnv.closeToken || toEnv.token;
        var fromLine = fromToken[0], fromStart = fromToken[2], fromEnd = fromToken[3];
        if (!toToken) {toToken = fromToken;};
        var toLine = toToken[0], toStart = toToken[2], toEnd = toToken[3];
        if (!toEnd) { toEnd = toStart + 1;};
        var start_col = fromStart - linePosition[fromLine];
        var end_col = toEnd - linePosition[toLine];
        errors.push({row: options.errorAtStart ? fromLine : toLine,
                     column: options.errorAtStart ? start_col: end_col,
                     start_row:fromLine,
                     start_col: start_col,
                     end_row:toLine,
                     end_col: end_col,
                     type: options.type ? options.type : "error",
                     text:message,
                     suppressIfEditing:options.suppressIfEditing,
                     mathMode: options.mathMode});
    };

    this.EnvErrorTo = function (toEnv, message, options) {
        if(!options) { options = {} ; };
        var token = toEnv.closeToken || toEnv.token;
        var line = token[0], type = token[1], start = token[2], end = token[3];
        if (!end) { end = start + 1; };
        var end_col = end - linePosition[line];
        var err = {row: line,
                   column: end_col,
                   start_row:0,
                   start_col: 0,
                   end_row: line,
                   end_col: end_col,
                   type: options.type ? options.type : "error",
                   text:message,
                   mathMode: options.mathMode};
        errors.push(err);
    };

    this.EnvErrorFrom = function (delimiter, message, options) {
        if(!options) { options = {} ; };
        var token = delimiter.token;
        var line = token[0], type = token[1], start = token[2], end = token[3];
        var start_col = start - linePosition[line];
        var end_col = Infinity;
        errors.push({row: line,
                     column: start_col,
                     start_row:line,
                     start_col: start_col,
                     end_row: lineNumber,
                     end_col: end_col,
                     type: options.type ? options.type : "error",
                     text:message,
                     mathMode: options.mathMode});
    };
};

var Parse = function (text) {
    var TokeniseResult = Tokenise(text);
    var Reporter = new ErrorReporter(TokeniseResult);
    var Environments = InterpretTokens(TokeniseResult, Reporter);
    Environments.close();
    return {
      errors: Reporter.getErrors(),
      contexts: Environments.getDocument().getContexts()
    }
};
});

ace.define("ace/lib/es5-shim",[], function(require, exports, module) {

function Empty() {}

if (!Function.prototype.bind) {
    Function.prototype.bind = function bind(that) { // .length is 1
        var target = this;
        if (typeof target != "function") {
            throw new TypeError("Function.prototype.bind called on incompatible " + target);
        }
        var args = slice.call(arguments, 1); // for normal call
        var bound = function () {

            if (this instanceof bound) {

                var result = target.apply(
                    this,
                    args.concat(slice.call(arguments))
                );
                if (Object(result) === result) {
                    return result;
                }
                return this;

            } else {
                return target.apply(
                    that,
                    args.concat(slice.call(arguments))
                );

            }

        };
        if(target.prototype) {
            Empty.prototype = target.prototype;
            bound.prototype = new Empty();
            Empty.prototype = null;
        }
        return bound;
    };
}
var call = Function.prototype.call;
var prototypeOfArray = Array.prototype;
var prototypeOfObject = Object.prototype;
var slice = prototypeOfArray.slice;
var _toString = call.bind(prototypeOfObject.toString);
var owns = call.bind(prototypeOfObject.hasOwnProperty);
var defineGetter;
var defineSetter;
var lookupGetter;
var lookupSetter;
var supportsAccessors;
if ((supportsAccessors = owns(prototypeOfObject, "__defineGetter__"))) {
    defineGetter = call.bind(prototypeOfObject.__defineGetter__);
    defineSetter = call.bind(prototypeOfObject.__defineSetter__);
    lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
    lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
}
if ([1,2].splice(0).length != 2) {
    if(function() { // test IE < 9 to splice bug - see issue #138
        function makeArray(l) {
            var a = new Array(l+2);
            a[0] = a[1] = 0;
            return a;
        }
        var array = [], lengthBefore;
        
        array.splice.apply(array, makeArray(20));
        array.splice.apply(array, makeArray(26));

        lengthBefore = array.length; //46
        array.splice(5, 0, "XXX"); // add one element

        lengthBefore + 1 == array.length

        if (lengthBefore + 1 == array.length) {
            return true;// has right splice implementation without bugs
        }
    }()) {//IE 6/7
        var array_splice = Array.prototype.splice;
        Array.prototype.splice = function(start, deleteCount) {
            if (!arguments.length) {
                return [];
            } else {
                return array_splice.apply(this, [
                    start === void 0 ? 0 : start,
                    deleteCount === void 0 ? (this.length - start) : deleteCount
                ].concat(slice.call(arguments, 2)))
            }
        };
    } else {//IE8
        Array.prototype.splice = function(pos, removeCount){
            var length = this.length;
            if (pos > 0) {
                if (pos > length)
                    pos = length;
            } else if (pos == void 0) {
                pos = 0;
            } else if (pos < 0) {
                pos = Math.max(length + pos, 0);
            }

            if (!(pos+removeCount < length))
                removeCount = length - pos;

            var removed = this.slice(pos, pos+removeCount);
            var insert = slice.call(arguments, 2);
            var add = insert.length;            
            if (pos === length) {
                if (add) {
                    this.push.apply(this, insert);
                }
            } else {
                var remove = Math.min(removeCount, length - pos);
                var tailOldPos = pos + remove;
                var tailNewPos = tailOldPos + add - remove;
                var tailCount = length - tailOldPos;
                var lengthAfterRemove = length - remove;

                if (tailNewPos < tailOldPos) { // case A
                    for (var i = 0; i < tailCount; ++i) {
                        this[tailNewPos+i] = this[tailOldPos+i];
                    }
                } else if (tailNewPos > tailOldPos) { // case B
                    for (i = tailCount; i--; ) {
                        this[tailNewPos+i] = this[tailOldPos+i];
                    }
                } // else, add == remove (nothing to do)

                if (add && pos === lengthAfterRemove) {
                    this.length = lengthAfterRemove; // truncate array
                    this.push.apply(this, insert);
                } else {
                    this.length = lengthAfterRemove + add; // reserves space
                    for (i = 0; i < add; ++i) {
                        this[pos+i] = insert[i];
                    }
                }
            }
            return removed;
        };
    }
}
if (!Array.isArray) {
    Array.isArray = function isArray(obj) {
        return _toString(obj) == "[object Array]";
    };
}
var boxedString = Object("a"),
    splitString = boxedString[0] != "a" || !(0 in boxedString);

if (!Array.prototype.forEach) {
    Array.prototype.forEach = function forEach(fun /*, thisp*/) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            thisp = arguments[1],
            i = -1,
            length = self.length >>> 0;
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(); // TODO message
        }

        while (++i < length) {
            if (i in self) {
                fun.call(thisp, self[i], i, object);
            }
        }
    };
}
if (!Array.prototype.map) {
    Array.prototype.map = function map(fun /*, thisp*/) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0,
            result = Array(length),
            thisp = arguments[1];
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self)
                result[i] = fun.call(thisp, self[i], i, object);
        }
        return result;
    };
}
if (!Array.prototype.filter) {
    Array.prototype.filter = function filter(fun /*, thisp */) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                    object,
            length = self.length >>> 0,
            result = [],
            value,
            thisp = arguments[1];
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self) {
                value = self[i];
                if (fun.call(thisp, value, i, object)) {
                    result.push(value);
                }
            }
        }
        return result;
    };
}
if (!Array.prototype.every) {
    Array.prototype.every = function every(fun /*, thisp */) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0,
            thisp = arguments[1];
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self && !fun.call(thisp, self[i], i, object)) {
                return false;
            }
        }
        return true;
    };
}
if (!Array.prototype.some) {
    Array.prototype.some = function some(fun /*, thisp */) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0,
            thisp = arguments[1];
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self && fun.call(thisp, self[i], i, object)) {
                return true;
            }
        }
        return false;
    };
}
if (!Array.prototype.reduce) {
    Array.prototype.reduce = function reduce(fun /*, initial*/) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0;
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }
        if (!length && arguments.length == 1) {
            throw new TypeError("reduce of empty array with no initial value");
        }

        var i = 0;
        var result;
        if (arguments.length >= 2) {
            result = arguments[1];
        } else {
            do {
                if (i in self) {
                    result = self[i++];
                    break;
                }
                if (++i >= length) {
                    throw new TypeError("reduce of empty array with no initial value");
                }
            } while (true);
        }

        for (; i < length; i++) {
            if (i in self) {
                result = fun.call(void 0, result, self[i], i, object);
            }
        }

        return result;
    };
}
if (!Array.prototype.reduceRight) {
    Array.prototype.reduceRight = function reduceRight(fun /*, initial*/) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0;
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }
        if (!length && arguments.length == 1) {
            throw new TypeError("reduceRight of empty array with no initial value");
        }

        var result, i = length - 1;
        if (arguments.length >= 2) {
            result = arguments[1];
        } else {
            do {
                if (i in self) {
                    result = self[i--];
                    break;
                }
                if (--i < 0) {
                    throw new TypeError("reduceRight of empty array with no initial value");
                }
            } while (true);
        }

        do {
            if (i in this) {
                result = fun.call(void 0, result, self[i], i, object);
            }
        } while (i--);

        return result;
    };
}
if (!Array.prototype.indexOf || ([0, 1].indexOf(1, 2) != -1)) {
    Array.prototype.indexOf = function indexOf(sought /*, fromIndex */ ) {
        var self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                toObject(this),
            length = self.length >>> 0;

        if (!length) {
            return -1;
        }

        var i = 0;
        if (arguments.length > 1) {
            i = toInteger(arguments[1]);
        }
        i = i >= 0 ? i : Math.max(0, length + i);
        for (; i < length; i++) {
            if (i in self && self[i] === sought) {
                return i;
            }
        }
        return -1;
    };
}
if (!Array.prototype.lastIndexOf || ([0, 1].lastIndexOf(0, -3) != -1)) {
    Array.prototype.lastIndexOf = function lastIndexOf(sought /*, fromIndex */) {
        var self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                toObject(this),
            length = self.length >>> 0;

        if (!length) {
            return -1;
        }
        var i = length - 1;
        if (arguments.length > 1) {
            i = Math.min(i, toInteger(arguments[1]));
        }
        i = i >= 0 ? i : length - Math.abs(i);
        for (; i >= 0; i--) {
            if (i in self && sought === self[i]) {
                return i;
            }
        }
        return -1;
    };
}
if (!Object.getPrototypeOf) {
    Object.getPrototypeOf = function getPrototypeOf(object) {
        return object.__proto__ || (
            object.constructor ?
            object.constructor.prototype :
            prototypeOfObject
        );
    };
}
if (!Object.getOwnPropertyDescriptor) {
    var ERR_NON_OBJECT = "Object.getOwnPropertyDescriptor called on a " +
                         "non-object: ";
    Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(object, property) {
        if ((typeof object != "object" && typeof object != "function") || object === null)
            throw new TypeError(ERR_NON_OBJECT + object);
        if (!owns(object, property))
            return;

        var descriptor, getter, setter;
        descriptor =  { enumerable: true, configurable: true };
        if (supportsAccessors) {
            var prototype = object.__proto__;
            object.__proto__ = prototypeOfObject;

            var getter = lookupGetter(object, property);
            var setter = lookupSetter(object, property);
            object.__proto__ = prototype;

            if (getter || setter) {
                if (getter) descriptor.get = getter;
                if (setter) descriptor.set = setter;
                return descriptor;
            }
        }
        descriptor.value = object[property];
        return descriptor;
    };
}
if (!Object.getOwnPropertyNames) {
    Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
        return Object.keys(object);
    };
}
if (!Object.create) {
    var createEmpty;
    if (Object.prototype.__proto__ === null) {
        createEmpty = function () {
            return { "__proto__": null };
        };
    } else {
        createEmpty = function () {
            var empty = {};
            for (var i in empty)
                empty[i] = null;
            empty.constructor =
            empty.hasOwnProperty =
            empty.propertyIsEnumerable =
            empty.isPrototypeOf =
            empty.toLocaleString =
            empty.toString =
            empty.valueOf =
            empty.__proto__ = null;
            return empty;
        }
    }

    Object.create = function create(prototype, properties) {
        var object;
        if (prototype === null) {
            object = createEmpty();
        } else {
            if (typeof prototype != "object")
                throw new TypeError("typeof prototype["+(typeof prototype)+"] != 'object'");
            var Type = function () {};
            Type.prototype = prototype;
            object = new Type();
            object.__proto__ = prototype;
        }
        if (properties !== void 0)
            Object.defineProperties(object, properties);
        return object;
    };
}

function doesDefinePropertyWork(object) {
    try {
        Object.defineProperty(object, "sentinel", {});
        return "sentinel" in object;
    } catch (exception) {
    }
}
if (Object.defineProperty) {
    var definePropertyWorksOnObject = doesDefinePropertyWork({});
    var definePropertyWorksOnDom = typeof document == "undefined" ||
        doesDefinePropertyWork(document.createElement("div"));
    if (!definePropertyWorksOnObject || !definePropertyWorksOnDom) {
        var definePropertyFallback = Object.defineProperty;
    }
}

if (!Object.defineProperty || definePropertyFallback) {
    var ERR_NON_OBJECT_DESCRIPTOR = "Property description must be an object: ";
    var ERR_NON_OBJECT_TARGET = "Object.defineProperty called on non-object: "
    var ERR_ACCESSORS_NOT_SUPPORTED = "getters & setters can not be defined " +
                                      "on this javascript engine";

    Object.defineProperty = function defineProperty(object, property, descriptor) {
        if ((typeof object != "object" && typeof object != "function") || object === null)
            throw new TypeError(ERR_NON_OBJECT_TARGET + object);
        if ((typeof descriptor != "object" && typeof descriptor != "function") || descriptor === null)
            throw new TypeError(ERR_NON_OBJECT_DESCRIPTOR + descriptor);
        if (definePropertyFallback) {
            try {
                return definePropertyFallback.call(Object, object, property, descriptor);
            } catch (exception) {
            }
        }
        if (owns(descriptor, "value")) {

            if (supportsAccessors && (lookupGetter(object, property) ||
                                      lookupSetter(object, property)))
            {
                var prototype = object.__proto__;
                object.__proto__ = prototypeOfObject;
                delete object[property];
                object[property] = descriptor.value;
                object.__proto__ = prototype;
            } else {
                object[property] = descriptor.value;
            }
        } else {
            if (!supportsAccessors)
                throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
            if (owns(descriptor, "get"))
                defineGetter(object, property, descriptor.get);
            if (owns(descriptor, "set"))
                defineSetter(object, property, descriptor.set);
        }

        return object;
    };
}
if (!Object.defineProperties) {
    Object.defineProperties = function defineProperties(object, properties) {
        for (var property in properties) {
            if (owns(properties, property))
                Object.defineProperty(object, property, properties[property]);
        }
        return object;
    };
}
if (!Object.seal) {
    Object.seal = function seal(object) {
        return object;
    };
}
if (!Object.freeze) {
    Object.freeze = function freeze(object) {
        return object;
    };
}
try {
    Object.freeze(function () {});
} catch (exception) {
    Object.freeze = (function freeze(freezeObject) {
        return function freeze(object) {
            if (typeof object == "function") {
                return object;
            } else {
                return freezeObject(object);
            }
        };
    })(Object.freeze);
}
if (!Object.preventExtensions) {
    Object.preventExtensions = function preventExtensions(object) {
        return object;
    };
}
if (!Object.isSealed) {
    Object.isSealed = function isSealed(object) {
        return false;
    };
}
if (!Object.isFrozen) {
    Object.isFrozen = function isFrozen(object) {
        return false;
    };
}
if (!Object.isExtensible) {
    Object.isExtensible = function isExtensible(object) {
        if (Object(object) === object) {
            throw new TypeError(); // TODO message
        }
        var name = '';
        while (owns(object, name)) {
            name += '?';
        }
        object[name] = true;
        var returnValue = owns(object, name);
        delete object[name];
        return returnValue;
    };
}
if (!Object.keys) {
    var hasDontEnumBug = true,
        dontEnums = [
            "toString",
            "toLocaleString",
            "valueOf",
            "hasOwnProperty",
            "isPrototypeOf",
            "propertyIsEnumerable",
            "constructor"
        ],
        dontEnumsLength = dontEnums.length;

    for (var key in {"toString": null}) {
        hasDontEnumBug = false;
    }

    Object.keys = function keys(object) {

        if (
            (typeof object != "object" && typeof object != "function") ||
            object === null
        ) {
            throw new TypeError("Object.keys called on a non-object");
        }

        var keys = [];
        for (var name in object) {
            if (owns(object, name)) {
                keys.push(name);
            }
        }

        if (hasDontEnumBug) {
            for (var i = 0, ii = dontEnumsLength; i < ii; i++) {
                var dontEnum = dontEnums[i];
                if (owns(object, dontEnum)) {
                    keys.push(dontEnum);
                }
            }
        }
        return keys;
    };

}
if (!Date.now) {
    Date.now = function now() {
        return new Date().getTime();
    };
}
var ws = "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003" +
    "\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028" +
    "\u2029\uFEFF";
if (!String.prototype.trim || ws.trim()) {
    ws = "[" + ws + "]";
    var trimBeginRegexp = new RegExp("^" + ws + ws + "*"),
        trimEndRegexp = new RegExp(ws + ws + "*$");
    String.prototype.trim = function trim() {
        return String(this).replace(trimBeginRegexp, "").replace(trimEndRegexp, "");
    };
}

function toInteger(n) {
    n = +n;
    if (n !== n) { // isNaN
        n = 0;
    } else if (n !== 0 && n !== (1/0) && n !== -(1/0)) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
    }
    return n;
}

function isPrimitive(input) {
    var type = typeof input;
    return (
        input === null ||
        type === "undefined" ||
        type === "boolean" ||
        type === "number" ||
        type === "string"
    );
}

function toPrimitive(input) {
    var val, valueOf, toString;
    if (isPrimitive(input)) {
        return input;
    }
    valueOf = input.valueOf;
    if (typeof valueOf === "function") {
        val = valueOf.call(input);
        if (isPrimitive(val)) {
            return val;
        }
    }
    toString = input.toString;
    if (typeof toString === "function") {
        val = toString.call(input);
        if (isPrimitive(val)) {
            return val;
        }
    }
    throw new TypeError();
}
var toObject = function (o) {
    if (o == null) { // this matches both null and undefined
        throw new TypeError("can't convert "+o+" to object");
    }
    return Object(o);
};

});
