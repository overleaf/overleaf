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
    this.on(eventName, function newCallback() {
        _self.off(eventName, newCallback);
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
    if (!eventName) this._eventRegistry = this._defaultHandlers = undefined;
    if (this._eventRegistry) this._eventRegistry[eventName] = undefined;
    if (this._defaultHandlers) this._defaultHandlers[eventName] = undefined;
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
        this.document.off("change", this.$onChange);
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
    
    this.$safeApplyDelta = function(delta) {
        var docLength = this.$lines.length;
        if (
            delta.action == "remove" && delta.start.row < docLength && delta.end.row < docLength
            || delta.action == "insert" && delta.start.row <= docLength
        ) {
            this.applyDelta(delta);
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
        this.$safeApplyDelta({
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

ace.define("ace/mode/php/php",[], function(require, exports, module) {

var PHP = {Constants:{}};

PHP.Constants.T_INCLUDE = 259
PHP.Constants.T_INCLUDE_ONCE = 260
PHP.Constants.T_EVAL = 318
PHP.Constants.T_REQUIRE = 261
PHP.Constants.T_REQUIRE_ONCE = 262
PHP.Constants.T_LOGICAL_OR = 263
PHP.Constants.T_LOGICAL_XOR = 264
PHP.Constants.T_LOGICAL_AND = 265
PHP.Constants.T_PRINT = 266
PHP.Constants.T_YIELD = 267
PHP.Constants.T_DOUBLE_ARROW = 268
PHP.Constants.T_YIELD_FROM = 269
PHP.Constants.T_PLUS_EQUAL = 270
PHP.Constants.T_MINUS_EQUAL = 271
PHP.Constants.T_MUL_EQUAL = 272
PHP.Constants.T_DIV_EQUAL = 273
PHP.Constants.T_CONCAT_EQUAL = 274
PHP.Constants.T_MOD_EQUAL = 275
PHP.Constants.T_AND_EQUAL = 276
PHP.Constants.T_OR_EQUAL = 277
PHP.Constants.T_XOR_EQUAL = 278
PHP.Constants.T_SL_EQUAL = 279
PHP.Constants.T_SR_EQUAL = 280
PHP.Constants.T_POW_EQUAL = 281
PHP.Constants.T_COALESCE_EQUAL = 282
PHP.Constants.T_COALESCE = 283
PHP.Constants.T_BOOLEAN_OR = 284
PHP.Constants.T_BOOLEAN_AND = 285
PHP.Constants.T_IS_EQUAL = 286
PHP.Constants.T_IS_NOT_EQUAL = 287
PHP.Constants.T_IS_IDENTICAL = 288
PHP.Constants.T_IS_NOT_IDENTICAL = 289
PHP.Constants.T_SPACESHIP = 290
PHP.Constants.T_IS_SMALLER_OR_EQUAL = 291
PHP.Constants.T_IS_GREATER_OR_EQUAL = 292
PHP.Constants.T_SL = 293
PHP.Constants.T_SR = 294
PHP.Constants.T_INSTANCEOF = 295
PHP.Constants.T_INC = 319
PHP.Constants.T_DEC = 320
PHP.Constants.T_INT_CAST = 296
PHP.Constants.T_DOUBLE_CAST = 297
PHP.Constants.T_STRING_CAST = 298
PHP.Constants.T_ARRAY_CAST = 299
PHP.Constants.T_OBJECT_CAST = 300
PHP.Constants.T_BOOL_CAST = 301
PHP.Constants.T_UNSET_CAST = 302
PHP.Constants.T_POW = 303
PHP.Constants.T_NEW = 304
PHP.Constants.T_CLONE = 305
PHP.Constants.T_EXIT = 321
PHP.Constants.T_IF = 322
PHP.Constants.T_ELSEIF = 307
PHP.Constants.T_ELSE = 308
PHP.Constants.T_ENDIF = 323
PHP.Constants.T_LNUMBER = 309
PHP.Constants.T_DNUMBER = 310
PHP.Constants.T_STRING = 311
PHP.Constants.T_STRING_VARNAME = 316
PHP.Constants.T_VARIABLE = 312
PHP.Constants.T_NUM_STRING = 317
PHP.Constants.T_INLINE_HTML = 313
PHP.Constants.T_BAD_CHARACTER = 395
PHP.Constants.T_ENCAPSED_AND_WHITESPACE = 314
PHP.Constants.T_CONSTANT_ENCAPSED_STRING = 315
PHP.Constants.T_ECHO = 324
PHP.Constants.T_DO = 325
PHP.Constants.T_WHILE = 326
PHP.Constants.T_ENDWHILE = 327
PHP.Constants.T_FOR = 328
PHP.Constants.T_ENDFOR = 329
PHP.Constants.T_FOREACH = 330
PHP.Constants.T_ENDFOREACH = 331
PHP.Constants.T_DECLARE = 332
PHP.Constants.T_ENDDECLARE = 333
PHP.Constants.T_AS = 334
PHP.Constants.T_SWITCH = 335
PHP.Constants.T_ENDSWITCH = 336
PHP.Constants.T_CASE = 337
PHP.Constants.T_DEFAULT = 338
PHP.Constants.T_BREAK = 339
PHP.Constants.T_CONTINUE = 340
PHP.Constants.T_GOTO = 341
PHP.Constants.T_FUNCTION = 342
PHP.Constants.T_FN = 343
PHP.Constants.T_CONST = 344
PHP.Constants.T_RETURN = 345
PHP.Constants.T_TRY = 346
PHP.Constants.T_CATCH = 347
PHP.Constants.T_FINALLY = 348
PHP.Constants.T_THROW = 349
PHP.Constants.T_USE = 350
PHP.Constants.T_INSTEADOF = 351
PHP.Constants.T_GLOBAL = 352
PHP.Constants.T_STATIC = 353
PHP.Constants.T_ABSTRACT = 354
PHP.Constants.T_FINAL = 355
PHP.Constants.T_PRIVATE = 356
PHP.Constants.T_PROTECTED = 357
PHP.Constants.T_PUBLIC = 358
PHP.Constants.T_VAR = 359
PHP.Constants.T_UNSET = 360
PHP.Constants.T_ISSET = 361
PHP.Constants.T_EMPTY = 362
PHP.Constants.T_HALT_COMPILER = 363
PHP.Constants.T_CLASS = 364
PHP.Constants.T_TRAIT = 365
PHP.Constants.T_INTERFACE = 366
PHP.Constants.T_EXTENDS = 367
PHP.Constants.T_IMPLEMENTS = 368
PHP.Constants.T_OBJECT_OPERATOR = 369
PHP.Constants.T_DOUBLE_ARROW = 268
PHP.Constants.T_LIST = 370
PHP.Constants.T_ARRAY = 371
PHP.Constants.T_CALLABLE = 372
PHP.Constants.T_CLASS_C = 376
PHP.Constants.T_TRAIT_C = 377
PHP.Constants.T_METHOD_C = 378
PHP.Constants.T_FUNC_C = 379
PHP.Constants.T_LINE = 373
PHP.Constants.T_FILE = 374
PHP.Constants.T_COMMENT = 380
PHP.Constants.T_DOC_COMMENT = 381
PHP.Constants.T_OPEN_TAG = 382
PHP.Constants.T_OPEN_TAG_WITH_ECHO = 383
PHP.Constants.T_CLOSE_TAG = 384
PHP.Constants.T_WHITESPACE = 385
PHP.Constants.T_START_HEREDOC = 386
PHP.Constants.T_END_HEREDOC = 387
PHP.Constants.T_DOLLAR_OPEN_CURLY_BRACES = 388
PHP.Constants.T_CURLY_OPEN = 389
PHP.Constants.T_PAAMAYIM_NEKUDOTAYIM = 390
PHP.Constants.T_NAMESPACE = 391
PHP.Constants.T_NS_C = 392
PHP.Constants.T_DIR = 375
PHP.Constants.T_NS_SEPARATOR = 393
PHP.Constants.T_ELLIPSIS = 394

PHP.Lexer = function(src, ini) {
    var heredoc, heredocEndAllowed,

    stateStack = ['INITIAL'], stackPos = 0,
    swapState = function(state) {
        stateStack[stackPos] = state;
    },
    pushState = function(state) {
        stateStack[++stackPos] = state;
    },
    popState = function() {
        --stackPos;
    },

    shortOpenTag = ini === undefined || /^(on|true|1)$/i.test(ini.short_open_tag),
    openTag = shortOpenTag
        ? /^(\<\?php(?:\r\n|[ \t\r\n])|<\?|\<script language\=('|")?php('|")?\>)/i
        : /^(\<\?php(?:\r\n|[ \t\r\n])|\<script language\=('|")?php('|")?\>)/i,
    inlineHtml = shortOpenTag
        ? /[^<]*(?:<(?!\?|script language\=('|")?php('|")?\>)[^<]*)*/i
        : /[^<]*(?:<(?!\?=|\?php[ \t\r\n]|script language\=('|")?php('|")?\>)[^<]*)*/i,
    labelRegexPart = '[a-zA-Z_\\x7f-\\uffff][a-zA-Z0-9_\\x7f-\\uffff]*',
    stringRegexPart = function(quote) {
        return '[^' + quote + '\\\\${]*(?:(?:\\\\[\\s\\S]|\\$(?!\\{|[a-zA-Z_\\x7f-\\uffff])|\\{(?!\\$))[^' + quote + '\\\\${]*)*';
    },

    sharedStringTokens = [
        {
            value: PHP.Constants.T_VARIABLE,
            re: new RegExp('^\\$' + labelRegexPart + '(?=\\[)'),
            func: function() {
                pushState('VAR_OFFSET');
            }
        },
        {
            value: PHP.Constants.T_VARIABLE,
            re: new RegExp('^\\$' + labelRegexPart + '(?=->' + labelRegexPart + ')'),
            func: function() {
                pushState('LOOKING_FOR_PROPERTY');
            }
        },
        {
            value: PHP.Constants.T_DOLLAR_OPEN_CURLY_BRACES,
            re: new RegExp('^\\$\\{(?=' + labelRegexPart + '[\\[}])'),
            func: function() {
                pushState('LOOKING_FOR_VARNAME');
            }
        },
        {
            value: PHP.Constants.T_VARIABLE,
            re: new RegExp('^\\$' + labelRegexPart)
        },
        {
            value: PHP.Constants.T_DOLLAR_OPEN_CURLY_BRACES,
            re: /^\$\{/,
            func: function() {
                pushState('IN_SCRIPTING');
            }
        },
        {
            value: PHP.Constants.T_CURLY_OPEN,
            re: /^\{(?=\$)/,
            func: function() {
                pushState('IN_SCRIPTING');
            }
        }
    ],
    data = {
        'INITIAL': [
            {
                value: PHP.Constants.T_OPEN_TAG_WITH_ECHO,
                re: /^<\?=/i,
                func: function() {
                    swapState('IN_SCRIPTING');
                }
            },
            {
                value: PHP.Constants.T_OPEN_TAG,
                re: openTag,
                func: function() {
                    swapState('IN_SCRIPTING');
                }
            },
            {
                value: PHP.Constants.T_INLINE_HTML,
                re: inlineHtml
            },
        ],
        'IN_SCRIPTING': [
            {
                value: PHP.Constants.T_WHITESPACE,
                re: /^[ \n\r\t]+/
            },
            {
                value: PHP.Constants.T_ABSTRACT,
                re: /^abstract\b/i
            },
            {
                value: PHP.Constants.T_LOGICAL_AND,
                re: /^and\b/i
            },
            {
                value: PHP.Constants.T_ARRAY,
                re: /^array\b/i
            },
            {
                value: PHP.Constants.T_AS,
                re: /^as\b/i
            },
            {
                value: PHP.Constants.T_BREAK,
                re: /^break\b/i
            },
            {
                value: PHP.Constants.T_CALLABLE,
                re: /^callable\b/i
            },
            {
                value: PHP.Constants.T_CASE,
                re: /^case\b/i
            },
            {
                value: PHP.Constants.T_CATCH,
                re: /^catch\b/i
            },
            {
                value: PHP.Constants.T_CLASS,
                re: /^class\b/i,
            },
            {
                value: PHP.Constants.T_CLONE,
                re: /^clone\b/i
            },
            {
                value: PHP.Constants.T_CONST,
                re: /^const\b/i
            },
            {
                value: PHP.Constants.T_CONTINUE,
                re: /^continue\b/i
            },
            {
                value: PHP.Constants.T_DECLARE,
                re: /^declare\b/i
            },
            {
                value: PHP.Constants.T_DEFAULT,
                re: /^default\b/i
            },
            {
                value: PHP.Constants.T_DO,
                re: /^do\b/i
            },
            {
                value: PHP.Constants.T_ECHO,
                re: /^echo\b/i
            },
            {
                value: PHP.Constants.T_ELSE,
                re: /^else\b/i
            },
            {
                value: PHP.Constants.T_ELSEIF,
                re: /^elseif\b/i
            },
            {
                value: PHP.Constants.T_ENDDECLARE,
                re: /^enddeclare\b/i
            },
            {
                value: PHP.Constants.T_ENDFOR,
                re: /^endfor\b/i
            },
            {
                value: PHP.Constants.T_ENDFOREACH,
                re: /^endforeach\b/i
            },
            {
                value: PHP.Constants.T_ENDIF,
                re: /^endif\b/i
            },
            {
                value: PHP.Constants.T_ENDSWITCH,
                re: /^endswitch\b/i
            },
            {
                value: PHP.Constants.T_ENDWHILE,
                re: /^endwhile\b/i
            },
            {
                value: PHP.Constants.T_EMPTY,
                re: /^empty\b/i
            },
            {
                value: PHP.Constants.T_EVAL,
                re: /^eval\b/i
            },
            {
                value: PHP.Constants.T_EXIT,
                re: /^(?:exit|die)\b/i
            },
            {
                value: PHP.Constants.T_EXTENDS,
                re: /^extends\b/i
            },
            {
                value: PHP.Constants.T_FINAL,
                re: /^final\b/i
            },
            {
                value: PHP.Constants.T_FINALLY,
                re: /^finally\b/i
            },
            {
                value: PHP.Constants.T_FN,
                re: /^fn\b/i
            },
            {
                value: PHP.Constants.T_FOR,
                re: /^for\b/i
            },
            {
                value: PHP.Constants.T_FOREACH,
                re: /^foreach\b/i
            },
            {
                value: PHP.Constants.T_FUNCTION,
                re: /^function\b/i
            },
            {
                value: PHP.Constants.T_GLOBAL,
                re: /^global\b/i
            },
            {
                value: PHP.Constants.T_GOTO,
                re: /^goto\b/i
            },
            {
                value: PHP.Constants.T_IF,
                re: /^if\b/i
            },
            {
                value: PHP.Constants.T_IMPLEMENTS,
                re: /^implements\b/i
            },
            {
                value: PHP.Constants.T_INCLUDE,
                re: /^include\b/i
            },
            {
                value: PHP.Constants.T_INCLUDE_ONCE,
                re: /^include_once\b/i
            },
            {
                value: PHP.Constants.T_INSTANCEOF,
                re: /^instanceof\b/i
            },
            {
                value: PHP.Constants.T_INSTEADOF,
                re: /^insteadof\b/i
            },
            {
                value: PHP.Constants.T_INTERFACE,
                re: /^interface\b/i
            },
            {
                value: PHP.Constants.T_ISSET,
                re: /^isset\b/i
            },
            {
                value: PHP.Constants.T_LIST,
                re: /^list\b/i
            },
            {
                value: PHP.Constants.T_NAMESPACE,
                re: /^namespace\b/i
            },
            {
                value: PHP.Constants.T_NEW,
                re: /^new\b/i
            },
            {
                value: PHP.Constants.T_LOGICAL_OR,
                re: /^or\b/i
            },
            {
                value: PHP.Constants.T_PRINT,
                re: /^print\b/i
            },
            {
                value: PHP.Constants.T_PRIVATE,
                re: /^private\b/i
            },
            {
                value: PHP.Constants.T_PROTECTED,
                re: /^protected\b/i
            },
            {
                value: PHP.Constants.T_PUBLIC,
                re: /^public\b/i
            },
            {
                value: PHP.Constants.T_REQUIRE,
                re: /^require\b/i
            },
            {
                value: PHP.Constants.T_REQUIRE_ONCE,
                re: /^require_once\b/i
            },
            {
                value: PHP.Constants.T_STATIC,
                re: /^static\b/i
            },
            {
                value: PHP.Constants.T_SWITCH,
                re: /^switch\b/i
            },
            {
                value: PHP.Constants.T_THROW,
                re: /^throw\b/i
            },
            {
                value: PHP.Constants.T_TRAIT,
                re: /^trait\b/i,
            },
            {
                value: PHP.Constants.T_TRY,
                re: /^try\b/i
            },
            {
                value: PHP.Constants.T_UNSET,
                re: /^unset\b/i
            },
            {
                value: PHP.Constants.T_USE,
                re: /^use\b/i
            },
            {
                value: PHP.Constants.T_VAR,
                re: /^var\b/i
            },
            {
                value: PHP.Constants.T_WHILE,
                re: /^while\b/i
            },
            {
                value: PHP.Constants.T_LOGICAL_XOR,
                re: /^xor\b/i
            },
            {
                value: PHP.Constants.T_YIELD_FROM,
                re: /^yield\s+from\b/i
            },
            {
                value: PHP.Constants.T_YIELD,
                re: /^yield\b/i
            },
            {
                value: PHP.Constants.T_RETURN,
                re: /^return\b/i
            },
            {
                value: PHP.Constants.T_METHOD_C,
                re: /^__METHOD__\b/i
            },
            {
                value: PHP.Constants.T_LINE,
                re: /^__LINE__\b/i
            },
            {
                value: PHP.Constants.T_FILE,
                re: /^__FILE__\b/i
            },
            {
                value: PHP.Constants.T_FUNC_C,
                re: /^__FUNCTION__\b/i
            },
            {
                value: PHP.Constants.T_NS_C,
                re: /^__NAMESPACE__\b/i
            },
            {
                value: PHP.Constants.T_TRAIT_C,
                re: /^__TRAIT__\b/i
            },
            {
                value: PHP.Constants.T_DIR,
                re: /^__DIR__\b/i
            },
            {
                value: PHP.Constants.T_CLASS_C,
                re: /^__CLASS__\b/i
            },
            {
                value: PHP.Constants.T_AND_EQUAL,
                re: /^&=/
            },
            {
                value: PHP.Constants.T_ARRAY_CAST,
                re: /^\([ \t]*array[ \t]*\)/i
            },
            {
                value: PHP.Constants.T_BOOL_CAST,
                re: /^\([ \t]*(?:bool|boolean)[ \t]*\)/i
            },
            {
                value: PHP.Constants.T_DOUBLE_CAST,
                re: /^\([ \t]*(?:real|float|double)[ \t]*\)/i
            },
            {
                value: PHP.Constants.T_INT_CAST,
                re: /^\([ \t]*(?:int|integer)[ \t]*\)/i
            },
            {
                value: PHP.Constants.T_OBJECT_CAST,
                re: /^\([ \t]*object[ \t]*\)/i
            },
            {
                value: PHP.Constants.T_STRING_CAST,
                re: /^\([ \t]*(?:binary|string)[ \t]*\)/i
            },
            {
                value: PHP.Constants.T_UNSET_CAST,
                re: /^\([ \t]*unset[ \t]*\)/i
            },
            {
                value: PHP.Constants.T_BOOLEAN_AND,
                re: /^&&/
            },
            {
                value: PHP.Constants.T_BOOLEAN_OR,
                re: /^\|\|/
            },
            {
                value: PHP.Constants.T_CLOSE_TAG,
                re: /^(?:\?>|<\/script>)(\r\n|\r|\n)?/i,
                func: function() {
                    swapState('INITIAL');
                }
            },
            {
                value: PHP.Constants.T_DOUBLE_ARROW,
                re: /^=>/
            },
            {
                value: PHP.Constants.T_PAAMAYIM_NEKUDOTAYIM,
                re: /^::/
            },
            {
                value: PHP.Constants.T_INC,
                re: /^\+\+/
            },
            {
                value: PHP.Constants.T_DEC,
                re: /^--/
            },
            {
                value: PHP.Constants.T_CONCAT_EQUAL,
                re: /^\.=/
            },
            {
                value: PHP.Constants.T_DIV_EQUAL,
                re: /^\/=/
            },
            {
                value: PHP.Constants.T_XOR_EQUAL,
                re: /^\^=/
            },
            {
                value: PHP.Constants.T_MUL_EQUAL,
                re: /^\*=/
            },
            {
                value: PHP.Constants.T_MOD_EQUAL,
                re: /^%=/
            },
            {
                value: PHP.Constants.T_SL_EQUAL,
                re: /^<<=/
            },
            {
                value: PHP.Constants.T_START_HEREDOC,
                re: new RegExp('^[bB]?<<<[ \\t]*\'(' + labelRegexPart + ')\'(?:\\r\\n|\\r|\\n)'),
                func: function(result) {
                    heredoc = result[1];
                    swapState('NOWDOC');
                }
            },
            {
                value: PHP.Constants.T_START_HEREDOC,
                re: new RegExp('^[bB]?<<<[ \\t]*("?)(' + labelRegexPart + ')\\1(?:\\r\\n|\\r|\\n)'),
                func: function(result) {
                    heredoc = result[2];
                    heredocEndAllowed = true;
                    swapState('HEREDOC');
                }
            },
            {
                value: PHP.Constants.T_SL,
                re: /^<</
            },
            {
                value: PHP.Constants.T_SPACESHIP,
                re: /^<=>/
            },
            {
                value: PHP.Constants.T_IS_SMALLER_OR_EQUAL,
                re: /^<=/
            },
            {
                value: PHP.Constants.T_SR_EQUAL,
                re: /^>>=/
            },
            {
                value: PHP.Constants.T_SR,
                re: /^>>/
            },
            {
                value: PHP.Constants.T_IS_GREATER_OR_EQUAL,
                re: /^>=/
            },
            {
                value: PHP.Constants.T_OR_EQUAL,
                re: /^\|=/
            },
            {
                value: PHP.Constants.T_PLUS_EQUAL,
                re: /^\+=/
            },
            {
                value: PHP.Constants.T_MINUS_EQUAL,
                re: /^-=/
            },
            {
                value: PHP.Constants.T_OBJECT_OPERATOR,
                re: new RegExp('^->(?=[ \n\r\t]*' + labelRegexPart + ')'),
                func: function() {
                    pushState('LOOKING_FOR_PROPERTY');
                }
            },
            {
                value: PHP.Constants.T_OBJECT_OPERATOR,
                re: /^->/i
            },
            {
                value: PHP.Constants.T_ELLIPSIS,
                re: /^\.\.\./
            },
            {
                value: PHP.Constants.T_POW_EQUAL,
                re: /^\*\*=/
            },
            {
                value: PHP.Constants.T_POW,
                re: /^\*\*/
            },
            {
                value: PHP.Constants.T_COALESCE,
                re: /^\?\?/
            },
            {
                value: PHP.Constants.T_COMMENT,
                re: /^\/\*([\S\s]*?)(?:\*\/|$)/
            },
            {
                value: PHP.Constants.T_COMMENT,
                re: /^(?:\/\/|#)[^\r\n?]*(?:\?(?!>)[^\r\n?]*)*(?:\r\n|\r|\n)?/
            },
            {
                value: PHP.Constants.T_IS_IDENTICAL,
                re: /^===/
            },
            {
                value: PHP.Constants.T_IS_EQUAL,
                re: /^==/
            },
            {
                value: PHP.Constants.T_IS_NOT_IDENTICAL,
                re: /^!==/
            },
            {
                value: PHP.Constants.T_IS_NOT_EQUAL,
                re: /^(!=|<>)/
            },
            {
                value: PHP.Constants.T_DNUMBER,
                re: /^(?:[0-9]+\.[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/
            },
            {
                value: PHP.Constants.T_DNUMBER,
                re: /^[0-9]+[eE][+-]?[0-9]+/
            },
            {
                value: PHP.Constants.T_LNUMBER,
                re: /^(?:0x[0-9A-F]+|0b[01]+|[0-9]+)/i
            },
            {
                value: PHP.Constants.T_VARIABLE,
                re: new RegExp('^\\$' + labelRegexPart)
            },
            {
                value: PHP.Constants.T_CONSTANT_ENCAPSED_STRING,
                re: /^[bB]?'[^'\\]*(?:\\[\s\S][^'\\]*)*'/,
            },
            {
                value: PHP.Constants.T_CONSTANT_ENCAPSED_STRING,
                re: new RegExp('^[bB]?"' + stringRegexPart('"') + '"')
            },
            {
                value: -1,
                re: /^[bB]?"/,
                func: function() {
                    swapState('DOUBLE_QUOTES');
                }
            },
            {
                value: -1,
                re: /^`/,
                func: function() {
                    swapState('BACKTICKS');
                }
            },
            {
                value: PHP.Constants.T_NS_SEPARATOR,
                re: /^\\/
            },
            {
                value: PHP.Constants.T_STRING,
                re: /^[a-zA-Z_\x7f-\uffff][a-zA-Z0-9_\x7f-\uffff]*/
            },
            {
                value: -1,
                re: /^\{/,
                func: function() {
                    pushState('IN_SCRIPTING');
                }
            },
            {
                value: -1,
                re: /^\}/,
                func: function() {
                    if (stackPos > 0) {
                        popState();
                    }
                }
            },
            {
                value: -1,
                re: /^[\[\];:?()!.,><=+-/*|&@^%"'$~]/
            }
        ],
        'DOUBLE_QUOTES': sharedStringTokens.concat([
            {
                value: -1,
                re: /^"/,
                func: function() {
                    swapState('IN_SCRIPTING');
                }
            },
            {
                value: PHP.Constants.T_ENCAPSED_AND_WHITESPACE,
                re: new RegExp('^' + stringRegexPart('"'))
            }
        ]),
        'BACKTICKS': sharedStringTokens.concat([
            {
                value: -1,
                re: /^`/,
                func: function() {
                    swapState('IN_SCRIPTING');
                }
            },
            {
                value: PHP.Constants.T_ENCAPSED_AND_WHITESPACE,
                re: new RegExp('^' + stringRegexPart('`'))
            }
        ]),
        'VAR_OFFSET': [
            {
                value: -1,
                re: /^\]/,
                func: function() {
                    popState();
                }
            },
            {
                value: PHP.Constants.T_NUM_STRING,
                re: /^(?:0x[0-9A-F]+|0b[01]+|[0-9]+)/i
            },
            {
                value: PHP.Constants.T_VARIABLE,
                re: new RegExp('^\\$' + labelRegexPart)
            },
            {
                value: PHP.Constants.T_STRING,
                re: new RegExp('^' + labelRegexPart)
            },
            {
                value: -1,
                re: /^[;:,.\[()|^&+-/*=%!~$<>?@{}"`]/
            }
        ],
        'LOOKING_FOR_PROPERTY': [
            {
                value: PHP.Constants.T_OBJECT_OPERATOR,
                re: /^->/
            },
            {
                value: PHP.Constants.T_STRING,
                re: new RegExp('^' + labelRegexPart),
                func: function() {
                    popState();
                }
            },
            {
                value: PHP.Constants.T_WHITESPACE,
                re: /^[ \n\r\t]+/
            }
        ],
        'LOOKING_FOR_VARNAME': [
            {
                value: PHP.Constants.T_STRING_VARNAME,
                re: new RegExp('^' + labelRegexPart + '(?=[\\[}])'),
                func: function() {
                    swapState('IN_SCRIPTING');
                }
            }
        ],
        'NOWDOC': [
            {
                value: PHP.Constants.T_END_HEREDOC,
                matchFunc: function(src) {
                    var re = new RegExp('^' + heredoc + '(?=;?[\\r\\n])');
                    if (src.match(re)) {
                        return [src.substr(0, heredoc.length)];
                    } else {
                        return null;
                    }
                },
                func: function() {
                    swapState('IN_SCRIPTING');
                }
            },
            {
                value: PHP.Constants.T_ENCAPSED_AND_WHITESPACE,
                matchFunc: function(src) {
                    var re = new RegExp('[\\r\\n]' + heredoc + '(?=;?[\\r\\n])');
                    var result = re.exec(src);
                    var end = result ? result.index + 1 : src.length;
                    return [src.substring(0, end)];
                }
            }
        ],
        'HEREDOC': sharedStringTokens.concat([
            {
                value: PHP.Constants.T_END_HEREDOC,
                matchFunc: function(src) {
                    if (!heredocEndAllowed) {
                        return null;
                    }
                    var re = new RegExp('^' + heredoc + '(?=;?[\\r\\n])');
                    if (src.match(re)) {
                        return [src.substr(0, heredoc.length)];
                    } else {
                        return null;
                    }
                },
                func: function() {
                    swapState('IN_SCRIPTING');
                }
            },
            {
                value: PHP.Constants.T_ENCAPSED_AND_WHITESPACE,
                matchFunc: function(src) {
                    var end = src.length;
                    var re = new RegExp('^' + stringRegexPart(''));
                    var result = re.exec(src);
                    if (result) {
                        end = result[0].length;
                    }
                    re = new RegExp('([\\r\\n])' + heredoc + '(?=;?[\\r\\n])');
                    result = re.exec(src.substring(0, end));
                    if (result) {
                        end = result.index + 1;
                        heredocEndAllowed = true;
                    } else {
                        heredocEndAllowed = false;
                    }
                    if (end == 0) {
                        return null;
                    }
                    return [src.substring(0, end)];
                }
            }
        ])
    };

    var results = [],
    line = 1,
    cancel = true;

    if (src === null) {
        return results;
    }

    if (typeof src !== "string") {
        src = src.toString();
    }

    while (src.length > 0 && cancel === true) {
        var state = stateStack[stackPos];
        var tokens = data[state];
        cancel = tokens.some(function(token){
            var result = token.matchFunc !== undefined
                ? token.matchFunc(src)
                : src.match(token.re);
            if (result !== null) {
                if (result[0].length == 0) {
                    throw new Error("empty match");
                }

                if (token.func !== undefined) {
                    token.func(result);
                }

                if (token.value === -1) {
                    results.push(result[0]);
                } else {
                    var resultString = result[0];
                    results.push([
                        parseInt(token.value, 10),
                        resultString,
                        line
                        ]);
                    line += resultString.split('\n').length - 1;
                }

                src = src.substring(result[0].length);

                return true;
            }
            return false;
        });
    }

    return results;
};


PHP.Parser = function ( preprocessedTokens, evaluate ) {

    var yybase = this.yybase,
    yydefault = this.yydefault,
    yycheck = this.yycheck,
    yyaction = this.yyaction,
    yylen = this.yylen,
    yygbase = this.yygbase,
    yygcheck = this.yygcheck,
    yyp = this.yyp,
    yygoto = this.yygoto,
    yylhs = this.yylhs,
    terminals = this.terminals,
    translate = this.translate,
    yygdefault = this.yygdefault;


    this.pos = -1;
    this.line = 1;

    this.tokenMap = this.createTokenMap( );

    this.dropTokens = {};
    this.dropTokens[ PHP.Constants.T_WHITESPACE ] = 1;
    this.dropTokens[ PHP.Constants.T_OPEN_TAG ] = 1;
    var tokens = [];
    preprocessedTokens.forEach( function( token, index ) {
        if ( typeof token === "object" && token[ 0 ] === PHP.Constants.T_OPEN_TAG_WITH_ECHO) {
            tokens.push([
                PHP.Constants.T_OPEN_TAG,
                token[ 1 ],
                token[ 2 ]
                ]);
            tokens.push([
                PHP.Constants.T_ECHO,
                token[ 1 ],
                token[ 2 ]
                ]);
        } else {
            tokens.push( token );
        }
    });
    this.tokens = tokens;
    var tokenId = this.TOKEN_NONE;
    this.startAttributes = {
        'startLine': 1
    };

    this.endAttributes = {};
    var attributeStack = [ this.startAttributes ];
    var state = 0;
    var stateStack = [ state ];
    this.yyastk = [];
    this.stackPos  = 0;

    var yyn;

    var origTokenId;


    for (;;) {

        if ( yybase[ state ] === 0 ) {
            yyn = yydefault[ state ];
        } else {
            if (tokenId === this.TOKEN_NONE ) {
                origTokenId = this.getNextToken( );
                tokenId = (origTokenId >= 0 && origTokenId < this.TOKEN_MAP_SIZE) ? translate[ origTokenId ] : this.TOKEN_INVALID;

                attributeStack[ this.stackPos ] = this.startAttributes;
            }

            if (((yyn = yybase[ state ] + tokenId) >= 0
                && yyn < this.YYLAST && yycheck[ yyn ] === tokenId
                || (state < this.YY2TBLSTATE
                    && (yyn = yybase[state + this.YYNLSTATES] + tokenId) >= 0
                    && yyn < this.YYLAST
                    && yycheck[ yyn ] === tokenId))
            && (yyn = yyaction[ yyn ]) !== this.YYDEFAULT ) {
                if (yyn > 0) {
                    ++this.stackPos;

                    stateStack[ this.stackPos ] = state = yyn;
                    this.yyastk[ this.stackPos ] = this.tokenValue;
                    attributeStack[ this.stackPos ] = this.startAttributes;
                    tokenId = this.TOKEN_NONE;

                    if (yyn < this.YYNLSTATES)
                        continue;
                    yyn -= this.YYNLSTATES;
                } else {
                    yyn = -yyn;
                }
            } else {
                yyn = yydefault[ state ];
            }
        }

        for (;;) {

            if ( yyn === 0 ) {
                return this.yyval;
            } else if (yyn !== this.YYUNEXPECTED ) {
                for (var attr in this.endAttributes) {
                    attributeStack[ this.stackPos - yylen[ yyn ] ][ attr ] = this.endAttributes[ attr ];
                }
                this.stackPos -= yylen[ yyn ];
                yyn = yylhs[ yyn ];
                if ((yyp = yygbase[ yyn ] + stateStack[ this.stackPos ]) >= 0
                    && yyp < this.YYGLAST
                    && yygcheck[ yyp ] === yyn) {
                    state = yygoto[ yyp ];
                } else {
                    state = yygdefault[ yyn ];
                }

                ++this.stackPos;

                stateStack[ this.stackPos ] = state;
                this.yyastk[ this.stackPos ] = this.yyval;
                attributeStack[ this.stackPos ] = this.startAttributes;
            } else {
                if (evaluate !== true) {

                    var expected = [];

                    for (var i = 0; i < this.TOKEN_MAP_SIZE; ++i) {
                        if ((yyn = yybase[ state ] + i) >= 0 && yyn < this.YYLAST && yycheck[ yyn ] == i
                         || state < this.YY2TBLSTATE
                            && (yyn = yybase[ state + this.YYNLSTATES] + i)
                            && yyn < this.YYLAST && yycheck[ yyn ] == i
                        ) {
                            if (yyaction[ yyn ] != this.YYUNEXPECTED) {
                                if (expected.length == 4) {
                                    expected = [];
                                    break;
                                }

                                expected.push( this.terminals[ i ] );
                            }
                        }
                    }

                    var expectedString = '';
                    if (expected.length) {
                        expectedString = ', expecting ' + expected.join(' or ');
                    }
                    throw new PHP.ParseError('syntax error, unexpected ' + terminals[ tokenId ] + expectedString, this.startAttributes['startLine']);
                } else {
                    return this.startAttributes['startLine'];
                }

            }

            if (state < this.YYNLSTATES)
                break;
            yyn = state - this.YYNLSTATES;
        }
    }
};

PHP.ParseError = function( msg, line ) {
    this.message = msg;
    this.line = line;
};

PHP.Parser.prototype.getNextToken = function( ) {

    this.startAttributes = {};
    this.endAttributes = {};

    var token,
    tmp;

    while (this.tokens[++this.pos] !== undefined) {
        token = this.tokens[this.pos];

        if (typeof token === "string") {
            this.startAttributes['startLine'] = this.line;
            this.endAttributes['endLine'] = this.line;
            if ('b"' === token) {
                this.tokenValue = 'b"';
                return '"'.charCodeAt(0);
            } else {
                this.tokenValue = token;
                return token.charCodeAt(0);
            }
        } else {



            this.line += ((tmp = token[ 1 ].match(/\n/g)) === null) ? 0 : tmp.length;

            if (PHP.Constants.T_COMMENT === token[0]) {

                if (!Array.isArray(this.startAttributes['comments'])) {
                    this.startAttributes['comments'] = [];
                }

                this.startAttributes['comments'].push( {
                    type: "comment",
                    comment: token[1],
                    line: token[2]
                });

            } else if (PHP.Constants.T_DOC_COMMENT === token[0]) {
                this.startAttributes['comments'].push( new PHPParser_Comment_Doc(token[1], token[2]) );
            } else if (this.dropTokens[token[0]] === undefined) {
                this.tokenValue = token[1];
                this.startAttributes['startLine'] = token[2];
                this.endAttributes['endLine'] = this.line;

                return this.tokenMap[token[0]];
            }
        }
    }

    this.startAttributes['startLine'] = this.line;
    return 0;
};

PHP.Parser.prototype.tokenName = function( token ) {
    var constants = ["T_INCLUDE","T_INCLUDE_ONCE","T_EVAL","T_REQUIRE","T_REQUIRE_ONCE","T_LOGICAL_OR","T_LOGICAL_XOR","T_LOGICAL_AND","T_PRINT","T_YIELD","T_DOUBLE_ARROW","T_YIELD_FROM","T_PLUS_EQUAL","T_MINUS_EQUAL","T_MUL_EQUAL","T_DIV_EQUAL","T_CONCAT_EQUAL","T_MOD_EQUAL","T_AND_EQUAL","T_OR_EQUAL","T_XOR_EQUAL","T_SL_EQUAL","T_SR_EQUAL","T_POW_EQUAL","T_COALESCE_EQUAL","T_COALESCE","T_BOOLEAN_OR","T_BOOLEAN_AND","T_IS_EQUAL","T_IS_NOT_EQUAL","T_IS_IDENTICAL","T_IS_NOT_IDENTICAL","T_SPACESHIP","T_IS_SMALLER_OR_EQUAL","T_IS_GREATER_OR_EQUAL","T_SL","T_SR","T_INSTANCEOF","T_INC","T_DEC","T_INT_CAST","T_DOUBLE_CAST","T_STRING_CAST","T_ARRAY_CAST","T_OBJECT_CAST","T_BOOL_CAST","T_UNSET_CAST","T_POW","T_NEW","T_CLONE","T_EXIT","T_IF","T_ELSEIF","T_ELSE","T_ENDIF","T_LNUMBER","T_DNUMBER","T_STRING","T_STRING_VARNAME","T_VARIABLE","T_NUM_STRING","T_INLINE_HTML","T_CHARACTER","T_BAD_CHARACTER","T_ENCAPSED_AND_WHITESPACE","T_CONSTANT_ENCAPSED_STRING","T_ECHO","T_DO","T_WHILE","T_ENDWHILE","T_FOR","T_ENDFOR","T_FOREACH","T_ENDFOREACH","T_DECLARE","T_ENDDECLARE","T_AS","T_SWITCH","T_ENDSWITCH","T_CASE","T_DEFAULT","T_BREAK","T_CONTINUE","T_GOTO","T_FUNCTION","T_FN","T_CONST","T_RETURN","T_TRY","T_CATCH","T_FINALLY","T_THROW","T_USE","T_INSTEADOF","T_GLOBAL","T_STATIC","T_ABSTRACT","T_FINAL","T_PRIVATE","T_PROTECTED","T_PUBLIC","T_VAR","T_UNSET","T_ISSET","T_EMPTY","T_HALT_COMPILER","T_CLASS","T_TRAIT","T_INTERFACE","T_EXTENDS","T_IMPLEMENTS","T_OBJECT_OPERATOR","T_DOUBLE_ARROW","T_LIST","T_ARRAY","T_CALLABLE","T_CLASS_C","T_TRAIT_C","T_METHOD_C","T_FUNC_C","T_LINE","T_FILE","T_COMMENT","T_DOC_COMMENT","T_OPEN_TAG","T_OPEN_TAG_WITH_ECHO","T_CLOSE_TAG","T_WHITESPACE","T_START_HEREDOC","T_END_HEREDOC","T_DOLLAR_OPEN_CURLY_BRACES","T_CURLY_OPEN","T_PAAMAYIM_NEKUDOTAYIM","T_NAMESPACE","T_NS_C","T_DIR","T_NS_SEPARATOR","T_ELLIPSIS"];
    var current = "UNKNOWN";
    constants.some(function( constant ) {
        if (PHP.Constants[ constant ] === token) {
            current = constant;
            return true;
        } else {
            return false;
        }
    });

    return current;
};

PHP.Parser.prototype.createTokenMap = function() {
    var tokenMap = {},
    name,
    i;
    for ( i = 256; i < 1000; ++i ) {
        if( PHP.Constants.T_OPEN_TAG_WITH_ECHO === i ) {
            tokenMap[ i ] = PHP.Constants.T_ECHO;
        } else if( PHP.Constants.T_CLOSE_TAG === i ) {
            tokenMap[ i ] = 59;
        } else if ( 'UNKNOWN' !== (name = this.tokenName( i ) ) ) { 
            tokenMap[ i ] =  this[name];
        }
    }
    return tokenMap;
};

PHP.Parser.prototype.TOKEN_NONE    = -1;
PHP.Parser.prototype.TOKEN_INVALID = 159;

PHP.Parser.prototype.TOKEN_MAP_SIZE = 394;

PHP.Parser.prototype.YYLAST       = 964;
PHP.Parser.prototype.YY2TBLSTATE  = 348;
PHP.Parser.prototype.YYGLAST      = 508;
PHP.Parser.prototype.YYNLSTATES   = 602;
PHP.Parser.prototype.YYUNEXPECTED = 32767;
PHP.Parser.prototype.YYDEFAULT    = -32766;
PHP.Parser.prototype.YYERRTOK = 256;
PHP.Parser.prototype.T_INCLUDE = 257;
PHP.Parser.prototype.T_INCLUDE_ONCE = 258;
PHP.Parser.prototype.T_EVAL = 259;
PHP.Parser.prototype.T_REQUIRE = 260;
PHP.Parser.prototype.T_REQUIRE_ONCE = 261;
PHP.Parser.prototype.T_LOGICAL_OR = 262;
PHP.Parser.prototype.T_LOGICAL_XOR = 263;
PHP.Parser.prototype.T_LOGICAL_AND = 264;
PHP.Parser.prototype.T_PRINT = 265;
PHP.Parser.prototype.T_YIELD = 266;
PHP.Parser.prototype.T_DOUBLE_ARROW = 267;
PHP.Parser.prototype.T_YIELD_FROM = 268;
PHP.Parser.prototype.T_PLUS_EQUAL = 269;
PHP.Parser.prototype.T_MINUS_EQUAL = 270;
PHP.Parser.prototype.T_MUL_EQUAL = 271;
PHP.Parser.prototype.T_DIV_EQUAL = 272;
PHP.Parser.prototype.T_CONCAT_EQUAL = 273;
PHP.Parser.prototype.T_MOD_EQUAL = 274;
PHP.Parser.prototype.T_AND_EQUAL = 275;
PHP.Parser.prototype.T_OR_EQUAL = 276;
PHP.Parser.prototype.T_XOR_EQUAL = 277;
PHP.Parser.prototype.T_SL_EQUAL = 278;
PHP.Parser.prototype.T_SR_EQUAL = 279;
PHP.Parser.prototype.T_POW_EQUAL = 280;
PHP.Parser.prototype.T_COALESCE_EQUAL = 281;
PHP.Parser.prototype.T_COALESCE = 282;
PHP.Parser.prototype.T_BOOLEAN_OR = 283;
PHP.Parser.prototype.T_BOOLEAN_AND = 284;
PHP.Parser.prototype.T_IS_EQUAL = 285;
PHP.Parser.prototype.T_IS_NOT_EQUAL = 286;
PHP.Parser.prototype.T_IS_IDENTICAL = 287;
PHP.Parser.prototype.T_IS_NOT_IDENTICAL = 288;
PHP.Parser.prototype.T_SPACESHIP = 289;
PHP.Parser.prototype.T_IS_SMALLER_OR_EQUAL = 290;
PHP.Parser.prototype.T_IS_GREATER_OR_EQUAL = 291;
PHP.Parser.prototype.T_SL = 292;
PHP.Parser.prototype.T_SR = 293;
PHP.Parser.prototype.T_INSTANCEOF = 294;
PHP.Parser.prototype.T_INC = 295;
PHP.Parser.prototype.T_DEC = 296;
PHP.Parser.prototype.T_INT_CAST = 297;
PHP.Parser.prototype.T_DOUBLE_CAST = 298;
PHP.Parser.prototype.T_STRING_CAST = 299;
PHP.Parser.prototype.T_ARRAY_CAST = 300;
PHP.Parser.prototype.T_OBJECT_CAST = 301;
PHP.Parser.prototype.T_BOOL_CAST = 302;
PHP.Parser.prototype.T_UNSET_CAST = 303;
PHP.Parser.prototype.T_POW = 304;
PHP.Parser.prototype.T_NEW = 305;
PHP.Parser.prototype.T_CLONE = 306;
PHP.Parser.prototype.T_EXIT = 307;
PHP.Parser.prototype.T_IF = 308;
PHP.Parser.prototype.T_ELSEIF = 309;
PHP.Parser.prototype.T_ELSE = 310;
PHP.Parser.prototype.T_ENDIF = 311;
PHP.Parser.prototype.T_LNUMBER = 312;
PHP.Parser.prototype.T_DNUMBER = 313;
PHP.Parser.prototype.T_STRING = 314;
PHP.Parser.prototype.T_STRING_VARNAME = 315;
PHP.Parser.prototype.T_VARIABLE = 316;
PHP.Parser.prototype.T_NUM_STRING = 317;
PHP.Parser.prototype.T_INLINE_HTML = 318;
PHP.Parser.prototype.T_CHARACTER = 319;
PHP.Parser.prototype.T_BAD_CHARACTER = 320;
PHP.Parser.prototype.T_ENCAPSED_AND_WHITESPACE = 321;
PHP.Parser.prototype.T_CONSTANT_ENCAPSED_STRING = 322;
PHP.Parser.prototype.T_ECHO = 323;
PHP.Parser.prototype.T_DO = 324;
PHP.Parser.prototype.T_WHILE = 325;
PHP.Parser.prototype.T_ENDWHILE = 326;
PHP.Parser.prototype.T_FOR = 327;
PHP.Parser.prototype.T_ENDFOR = 328;
PHP.Parser.prototype.T_FOREACH = 329;
PHP.Parser.prototype.T_ENDFOREACH = 330;
PHP.Parser.prototype.T_DECLARE = 331;
PHP.Parser.prototype.T_ENDDECLARE = 332;
PHP.Parser.prototype.T_AS = 333;
PHP.Parser.prototype.T_SWITCH = 334;
PHP.Parser.prototype.T_ENDSWITCH = 335;
PHP.Parser.prototype.T_CASE = 336;
PHP.Parser.prototype.T_DEFAULT = 337;
PHP.Parser.prototype.T_BREAK = 338;
PHP.Parser.prototype.T_CONTINUE = 339;
PHP.Parser.prototype.T_GOTO = 340;
PHP.Parser.prototype.T_FUNCTION = 341;
PHP.Parser.prototype.T_FN = 342;
PHP.Parser.prototype.T_CONST = 343;
PHP.Parser.prototype.T_RETURN = 344;
PHP.Parser.prototype.T_TRY = 345;
PHP.Parser.prototype.T_CATCH = 346;
PHP.Parser.prototype.T_FINALLY = 347;
PHP.Parser.prototype.T_THROW = 348;
PHP.Parser.prototype.T_USE = 349;
PHP.Parser.prototype.T_INSTEADOF = 350;
PHP.Parser.prototype.T_GLOBAL = 351;
PHP.Parser.prototype.T_STATIC = 352;
PHP.Parser.prototype.T_ABSTRACT = 353;
PHP.Parser.prototype.T_FINAL = 354;
PHP.Parser.prototype.T_PRIVATE = 355;
PHP.Parser.prototype.T_PROTECTED = 356;
PHP.Parser.prototype.T_PUBLIC = 357;
PHP.Parser.prototype.T_VAR = 358;
PHP.Parser.prototype.T_UNSET = 359;
PHP.Parser.prototype.T_ISSET = 360;
PHP.Parser.prototype.T_EMPTY = 361;
PHP.Parser.prototype.T_HALT_COMPILER = 362;
PHP.Parser.prototype.T_CLASS = 363;
PHP.Parser.prototype.T_TRAIT = 364;
PHP.Parser.prototype.T_INTERFACE = 365;
PHP.Parser.prototype.T_EXTENDS = 366;
PHP.Parser.prototype.T_IMPLEMENTS = 367;
PHP.Parser.prototype.T_OBJECT_OPERATOR = 368;
PHP.Parser.prototype.T_LIST = 369;
PHP.Parser.prototype.T_ARRAY = 370;
PHP.Parser.prototype.T_CALLABLE = 371;
PHP.Parser.prototype.T_CLASS_C = 372;
PHP.Parser.prototype.T_TRAIT_C = 373;
PHP.Parser.prototype.T_METHOD_C = 374;
PHP.Parser.prototype.T_FUNC_C = 375;
PHP.Parser.prototype.T_LINE = 376;
PHP.Parser.prototype.T_FILE = 377;
PHP.Parser.prototype.T_COMMENT = 378;
PHP.Parser.prototype.T_DOC_COMMENT = 379;
PHP.Parser.prototype.T_OPEN_TAG = 380;
PHP.Parser.prototype.T_OPEN_TAG_WITH_ECHO = 381;
PHP.Parser.prototype.T_CLOSE_TAG = 382;
PHP.Parser.prototype.T_WHITESPACE = 383;
PHP.Parser.prototype.T_START_HEREDOC = 384;
PHP.Parser.prototype.T_END_HEREDOC = 385;
PHP.Parser.prototype.T_DOLLAR_OPEN_CURLY_BRACES = 386;
PHP.Parser.prototype.T_CURLY_OPEN = 387;
PHP.Parser.prototype.T_PAAMAYIM_NEKUDOTAYIM = 388;
PHP.Parser.prototype.T_NAMESPACE = 389;
PHP.Parser.prototype.T_NS_C = 390;
PHP.Parser.prototype.T_DIR = 391;
PHP.Parser.prototype.T_NS_SEPARATOR = 392;
PHP.Parser.prototype.T_ELLIPSIS = 393;
PHP.Parser.prototype.terminals = [
    "EOF",
    "error",
    "T_INCLUDE",
    "T_INCLUDE_ONCE",
    "T_EVAL",
    "T_REQUIRE",
    "T_REQUIRE_ONCE",
    "','",
    "T_LOGICAL_OR",
    "T_LOGICAL_XOR",
    "T_LOGICAL_AND",
    "T_PRINT",
    "T_YIELD",
    "T_DOUBLE_ARROW",
    "T_YIELD_FROM",
    "'='",
    "T_PLUS_EQUAL",
    "T_MINUS_EQUAL",
    "T_MUL_EQUAL",
    "T_DIV_EQUAL",
    "T_CONCAT_EQUAL",
    "T_MOD_EQUAL",
    "T_AND_EQUAL",
    "T_OR_EQUAL",
    "T_XOR_EQUAL",
    "T_SL_EQUAL",
    "T_SR_EQUAL",
    "T_POW_EQUAL",
    "T_COALESCE_EQUAL",
    "'?'",
    "':'",
    "T_COALESCE",
    "T_BOOLEAN_OR",
    "T_BOOLEAN_AND",
    "'|'",
    "'^'",
    "'&'",
    "T_IS_EQUAL",
    "T_IS_NOT_EQUAL",
    "T_IS_IDENTICAL",
    "T_IS_NOT_IDENTICAL",
    "T_SPACESHIP",
    "'<'",
    "T_IS_SMALLER_OR_EQUAL",
    "'>'",
    "T_IS_GREATER_OR_EQUAL",
    "T_SL",
    "T_SR",
    "'+'",
    "'-'",
    "'.'",
    "'*'",
    "'/'",
    "'%'",
    "'!'",
    "T_INSTANCEOF",
    "'~'",
    "T_INC",
    "T_DEC",
    "T_INT_CAST",
    "T_DOUBLE_CAST",
    "T_STRING_CAST",
    "T_ARRAY_CAST",
    "T_OBJECT_CAST",
    "T_BOOL_CAST",
    "T_UNSET_CAST",
    "'@'",
    "T_POW",
    "'['",
    "T_NEW",
    "T_CLONE",
    "T_EXIT",
    "T_IF",
    "T_ELSEIF",
    "T_ELSE",
    "T_ENDIF",
    "T_LNUMBER",
    "T_DNUMBER",
    "T_STRING",
    "T_STRING_VARNAME",
    "T_VARIABLE",
    "T_NUM_STRING",
    "T_INLINE_HTML",
    "T_ENCAPSED_AND_WHITESPACE",
    "T_CONSTANT_ENCAPSED_STRING",
    "T_ECHO",
    "T_DO",
    "T_WHILE",
    "T_ENDWHILE",
    "T_FOR",
    "T_ENDFOR",
    "T_FOREACH",
    "T_ENDFOREACH",
    "T_DECLARE",
    "T_ENDDECLARE",
    "T_AS",
    "T_SWITCH",
    "T_ENDSWITCH",
    "T_CASE",
    "T_DEFAULT",
    "T_BREAK",
    "T_CONTINUE",
    "T_GOTO",
    "T_FUNCTION",
    "T_FN",
    "T_CONST",
    "T_RETURN",
    "T_TRY",
    "T_CATCH",
    "T_FINALLY",
    "T_THROW",
    "T_USE",
    "T_INSTEADOF",
    "T_GLOBAL",
    "T_STATIC",
    "T_ABSTRACT",
    "T_FINAL",
    "T_PRIVATE",
    "T_PROTECTED",
    "T_PUBLIC",
    "T_VAR",
    "T_UNSET",
    "T_ISSET",
    "T_EMPTY",
    "T_HALT_COMPILER",
    "T_CLASS",
    "T_TRAIT",
    "T_INTERFACE",
    "T_EXTENDS",
    "T_IMPLEMENTS",
    "T_OBJECT_OPERATOR",
    "T_LIST",
    "T_ARRAY",
    "T_CALLABLE",
    "T_CLASS_C",
    "T_TRAIT_C",
    "T_METHOD_C",
    "T_FUNC_C",
    "T_LINE",
    "T_FILE",
    "T_START_HEREDOC",
    "T_END_HEREDOC",
    "T_DOLLAR_OPEN_CURLY_BRACES",
    "T_CURLY_OPEN",
    "T_PAAMAYIM_NEKUDOTAYIM",
    "T_NAMESPACE",
    "T_NS_C",
    "T_DIR",
    "T_NS_SEPARATOR",
    "T_ELLIPSIS",
    "';'",
    "'{'",
    "'}'",
    "'('",
    "')'",
    "'`'",
    "']'",
    "'\"'",
    "'$'"
    , "???"
];
PHP.Parser.prototype.translate = [
        0,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,   54,  157,  159,  158,   53,   36,  159,
      153,  154,   51,   48,    7,   49,   50,   52,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,   30,  150,
       42,   15,   44,   29,   66,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,   68,  159,  156,   35,  159,  155,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  151,   34,  152,   56,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,  159,  159,  159,  159,
      159,  159,  159,  159,  159,  159,    1,    2,    3,    4,
        5,    6,    8,    9,   10,   11,   12,   13,   14,   16,
       17,   18,   19,   20,   21,   22,   23,   24,   25,   26,
       27,   28,   31,   32,   33,   37,   38,   39,   40,   41,
       43,   45,   46,   47,   55,   57,   58,   59,   60,   61,
       62,   63,   64,   65,   67,   69,   70,   71,   72,   73,
       74,   75,   76,   77,   78,   79,   80,   81,   82,  159,
      159,   83,   84,   85,   86,   87,   88,   89,   90,   91,
       92,   93,   94,   95,   96,   97,   98,   99,  100,  101,
      102,  103,  104,  105,  106,  107,  108,  109,  110,  111,
      112,  113,  114,  115,  116,  117,  118,  119,  120,  121,
      122,  123,  124,  125,  126,  127,  128,  129,  130,  131,
      132,  133,  134,  135,  136,  137,  138,  139,  159,  159,
      159,  159,  159,  159,  140,  141,  142,  143,  144,  145,
      146,  147,  148,  149
];

PHP.Parser.prototype.yyaction = [
      607,  608,  609,  610,  611,  685,  612,  613,  614,  650,
      651,    0,   32,  103,  104,  105,  106,  107,  108,  109,
      110,  111,  112,  113,  114,  115,-32767,-32767,-32767,-32767,
       94,   95,   96,   97,   98,-32766,-32766,-32766,  687,  491,
     -497,  904,  905,  906,  903,  902,  901,  904,  905,  906,
      903,  902,  901,  615,  938,  940,-32766,    9,-32766,-32766,
    -32766,-32766,-32766,-32766,-32766,-32766,-32766,  616,  617,  618,
      619,  620,  621,  622,  333, 1104,  683,-32766,-32766,-32766,
      846, 1103,  119,  623,  624,  625,  626,  627,  628,  629,
      630,  631,  632,  633,  653,  654,  655,  656,  657,  645,
      646,  647,  675,  648,  649,  634,  635,  636,  637,  638,
      639,  640,  677,  678,  679,  680,  681,  682,  641,  642,
      643,  644,  674,  665,  663,  664,  660,  661,  402,  652,
      658,  659,  666,  667,  669,  668,  670,  671,   45,   46,
      421,   47,   48,  662,  673,  672,   27,   49,   50,  233,
       51,-32766,-32766,-32766,   96,   97,   98,   24,-32766,-32766,
    -32766, -458,  261,  121, 1023,-32766,-32766,-32766, 1091, 1073,
    -32766,-32766,-32766, 1039,-32766,-32766,-32766,-32766,-32766,-32766,
     -496,-32766,-32766,-32766,   52,   53,-32766, -497,-32766,-32766,
       54,  687,   55,  231,  232,   56,   57,   58,   59,   60,
       61,   62,   63, 1016,   24,  242,   64,  369,-32766,-32766,
    -32766,  226, 1040, 1041,  423, 1076, 1073, -493,  880,  508,
     1039,  436, 1023, -458,  768, 1073,  239,  333, -500,-32766,
     -500,-32766,-32766,-32766,-32766,  856,  253, -458,  276,  378,
      372,  786,   68, 1073, -458,  685, -461,  278, 1126,  403,
      289, 1127,  288,   99,  100,  101,  303,  252,  433,  434,
      822,-32766,   69,  261,  237,  850,  851,  435,  436,  102,
     1045, 1046, 1047, 1048, 1042, 1043,  256, 1016, -456, -456,
      306,  444, 1049, 1044,  375,  133,  561, -239,  363,   66,
      237,  268,  692,  273,  278,  422, -137, -137, -137,   -4,
      768, 1073,  310,  278, 1035,  757,  687,  362,   37,   20,
      424, -137,  425, -137,  426, -137,  427, -137,  127,  428,
     -295,  278, -295,   38,   39,  370,  371, -496,  271,   40,
      429,  277,  687,   65,  261, 1016,  302,  896,  430,  431,
     -456, -456,  333, -494,  432,   44,   42,  743,  791,  373,
      374, -457, -234,  562, -456, -456,  375,-32766,-32766,-32766,
      882, -456, -456,  124, -493,   75,  850,  851,  333, -273,
     -260,  422,  768,  770,  576, -137,  261,  125,-32766,  278,
      823,  757,  857, 1073,   37,   20,  424,  240,  425, -178,
      426,  589,  427,  393,  503,  428,  687,  235,  241,   38,
       39,  370,  371,  125,  354,   40,  429,  260,  259,   65,
      267,  687,  302, -457,  430,  431, -296, -177, -296,   24,
      432,  305,  365,  700,  791,  373,  374, -457,  120,  118,
       24, 1073,   30,  366, -457, 1039, -460,  850,  851,  687,
      367,  691, 1073,  422,  291,  768, 1039,  333,  -83,  770,
      576,   -4,  467,  757,  126,  368,   37,   20,  424,  -92,
      425,  278,  426,  444,  427, 1016,  375,  428, -219, -219,
     -219,   38,   39,  370,  371,  333, 1016,   40,  429,  850,
      851,   65,  435,  436,  302,  236,  430,  431,  225,  708,
     -494,  709,  432,  435,  436,  743,  791,  373,  374,  690,
      387,  136, 1117,  578,   68,  413,  238,    8,   33,  278,
     1053,  227,  708,  687,  709,   68,  422, -260,  535,   21,
      278,  770,  576, -219,  550,  551,  757,  687,  116,   37,
       20,  424,  117,  425,  358,  426, -178,  427,  132,  328,
      428, -218, -218, -218,   38,   39,  370,  371,  687,  333,
       40,  429,  122,  768,   65,  383,  384,  302,  123,  430,
      431,   29,  234,  333, -177,  432,  528,  529,  743,  791,
      373,  374,  129,  850,  851,  135,   76,   77,   78, 1092,
      881,  599,  582,  254,  333,  137,  138,  782,  590,  593,
      293,  767,  131,  252,  770,  576, -218,   31,  102,   79,
       80,   81,   82,   83,   84,   85,   86,   87,   88,   89,
       90,   91,   92,   93,   94,   95,   96,   97,   98,   99,
      100,  101,   43,  252,  422,  558,  768,  687,  690,-32766,
      471,  130,  476,  685,  757,  102,  553,   37,   20,  424,
      526,  425,  688,  426,  272,  427,  910, 1016,  428,  792,
     1128,  793,   38,   39,  370,  583,  269,  570,   40,  429,
      536, 1052,   65,  275, 1055,  302, -415,  541,  270,  -81,
       10,  391,  768,  432,  542,  554,  784,  594,    5,    0,
       12,  577,    0,    0,  304,    0,    0,    0,    0,  336,
      342,    0,    0,    0,    0,    0,    0,  422,    0,    0,
        0,  584,  770,  576,    0,    0,    0,  757,    0,    0,
       37,   20,  424,  343,  425,    0,  426,    0,  427,  768,
        0,  428,    0,    0,    0,   38,   39,  370,  347,  387,
      473,   40,  429,  359,  360,   65,  744,   35,  302,   36,
      597,  598,  748,  422,  825,  809,  432,  816,  587,  876,
      877,  806,  817,  757,  746,  804,   37,   20,  424,  885,
      425,  888,  426,  889,  427,  768,  886,  428,  887,  893,
     -485,   38,   39,  370,  579,  770,  576,   40,  429,  581,
      585,   65,  586,  588,  302,  592,  286,  287,  352,  353,
      422,  580,  432, 1123,  591, 1125,  703,  790,  702,  712,
      757,  789,  713,   37,   20,  424,  710,  425, 1124,  426,
      788,  427,  768, 1004,  428,  711,  777,  785,   38,   39,
      370,  808,  576, -483,   40,  429,  775,  814,   65,  815,
     1122,  302, 1074, 1067, 1081, 1086,  422, 1089, -237,  432,
     -461, -460, -459,   23,   25,   28,  757,   34,   41,   37,
       20,  424,   67,  425,   70,  426,   71,  427,   72,   73,
      428,   74,  128,  134,   38,   39,  370,  139,  770,  576,
       40,  429,  229,  230,   65,  246,  247,  302,  248,  249,
      250,  251,  290,  422,  355,  432,  357, -427, -235, -234,
       14,   15,   16,  757,   17,   19,   37,   20,  424,  325,
      425,  404,  426,  406,  427,  409,  411,  428,  412,  419,
      567,   38,   39,  370,  770,  576, 1027,   40,  429,  977,
     1037,   65,  858, 1008,  302,-32766,-32766,-32766,  -92,   13,
       18,   22,  432,  263,  324,  501,  522,  569,  981,  978,
        0,  994,    0, 1036, 1065, 1066,-32766, 1080,-32766,-32766,
    -32766,-32766,-32766,-32766,-32767,-32767,-32767,-32767,-32767, 1120,
      532,  770,  576, 1054
];

PHP.Parser.prototype.yycheck = [
        2,    3,    4,    5,    6,   78,    8,    9,   10,   11,
       12,    0,   15,   16,   17,   18,   19,   20,   21,   22,
       23,   24,   25,   26,   27,   28,   42,   43,   44,   45,
       46,   47,   48,   49,   50,    8,    9,   10,   78,   79,
        7,  114,  115,  116,  117,  118,  119,  114,  115,  116,
      117,  118,  119,   55,   57,   58,   29,    7,   31,   32,
       33,   34,   35,   36,    8,    9,   10,   69,   70,   71,
       72,   73,   74,   75,  114,    1,   78,    8,    9,   10,
        1,    7,   13,   85,   86,   87,   88,   89,   90,   91,
       92,   93,   94,   95,   96,   97,   98,   99,  100,  101,
      102,  103,  104,  105,  106,  107,  108,  109,  110,  111,
      112,  113,  114,  115,  116,  117,  118,  119,  120,  121,
      122,  123,  124,  125,  126,  127,  128,  129,   30,  131,
      132,  133,  134,  135,  136,  137,  138,  139,    2,    3,
        4,    5,    6,  145,  146,  147,    7,   11,   12,   36,
       14,    8,    9,   10,   48,   49,   50,   68,    8,    9,
       10,   68,   29,    7,    1,    8,    9,   10,    1,   80,
        8,    9,   29,   84,   31,   32,   33,   34,   35,   29,
        7,   31,   32,   33,   48,   49,   29,  154,   31,   32,
       54,   78,   56,   57,   58,   59,   60,   61,   62,   63,
       64,   65,   66,  114,   68,   69,   70,   71,    8,    9,
       10,   13,   76,   77,   78,    1,   80,    7,    1,   49,
       84,  132,    1,  130,    1,   80,    7,  114,  154,   29,
      156,   31,   32,   33,   34,    1,    7,  144,    7,  103,
      104,    1,  153,   80,  151,   78,  153,  158,   78,  151,
      114,   81,    7,   51,   52,   53,    7,   55,  122,  123,
       30,    8,  149,   29,   36,  132,  133,  131,  132,   67,
      134,  135,  136,  137,  138,  139,  140,  114,   68,   68,
        7,  145,  146,  147,  148,   13,   78,  154,  125,  153,
       36,  155,    1,  157,  158,   72,   73,   74,   75,    0,
        1,   80,    7,  158,    1,   82,   78,    7,   85,   86,
       87,   88,   89,   90,   91,   92,   93,   94,  151,   96,
      103,  158,  105,  100,  101,  102,  103,  154,  111,  106,
      107,   68,   78,  110,   29,  114,  113,  120,  115,  116,
      130,  130,  114,    7,  121,   68,   68,  124,  125,  126,
      127,   68,  154,  145,  144,  144,  148,    8,    9,   10,
      152,  151,  151,   30,  154,  151,  132,  133,  114,  152,
        7,   72,    1,  150,  151,  152,   29,  149,   29,  158,
      150,   82,  154,   80,   85,   86,   87,   36,   89,    7,
       91,  151,   93,  130,    1,   96,   78,   36,   36,  100,
      101,  102,  103,  149,  105,  106,  107,  130,  130,  110,
      111,   78,  113,  130,  115,  116,  103,    7,  105,   68,
      121,  144,    7,  124,  125,  126,  127,  144,  151,  151,
       68,   80,    7,    7,  151,   84,  153,  132,  133,   78,
        7,  150,   80,   72,  145,    1,   84,  114,   30,  150,
      151,  152,   83,   82,  151,    7,   85,   86,   87,  154,
       89,  158,   91,  145,   93,  114,  148,   96,   97,   98,
       99,  100,  101,  102,  103,  114,  114,  106,  107,  132,
      133,  110,  131,  132,  113,   36,  115,  116,   95,  103,
      154,  105,  121,  131,  132,  124,  125,  126,  127,   80,
      148,   13,   83,  151,  153,  103,   36,  105,   13,  158,
      141,   13,  103,   78,  105,  153,   72,  154,   73,   74,
      158,  150,  151,  152,   73,   74,   82,   78,   15,   85,
       86,   87,   15,   89,  148,   91,  154,   93,   98,   99,
       96,   97,   98,   99,  100,  101,  102,  103,   78,  114,
      106,  107,   15,    1,  110,  103,  104,  113,   15,  115,
      116,  142,  143,  114,  154,  121,  108,  109,  124,  125,
      126,  127,   15,  132,  133,   15,    8,    9,   10,  154,
      150,  151,   30,   30,  114,   15,   15,   36,   30,   30,
       34,   30,   30,   55,  150,  151,  152,   29,   67,   31,
       32,   33,   34,   35,   36,   37,   38,   39,   40,   41,
       42,   43,   44,   45,   46,   47,   48,   49,   50,   51,
       52,   53,   68,   55,   72,   75,    1,   78,   80,   83,
       83,   68,   87,   78,   82,   67,   92,   85,   86,   87,
      111,   89,   78,   91,  112,   93,   80,  114,   96,  125,
       81,  125,  100,  101,  102,   30,  128,   90,  106,  107,
       88,  141,  110,  128,  141,  113,  144,   94,  129,   95,
       95,   95,    1,  121,   97,   97,  149,  152,  144,   -1,
      144,  151,   -1,   -1,  144,   -1,   -1,   -1,   -1,  148,
      148,   -1,   -1,   -1,   -1,   -1,   -1,   72,   -1,   -1,
       -1,   30,  150,  151,   -1,   -1,   -1,   82,   -1,   -1,
       85,   86,   87,  148,   89,   -1,   91,   -1,   93,    1,
       -1,   96,   -1,   -1,   -1,  100,  101,  102,  148,  148,
      148,  106,  107,  148,  148,  110,  152,  150,  113,  150,
      150,  150,  150,   72,  150,  150,  121,  150,   30,  150,
      150,  150,  150,   82,  150,  150,   85,   86,   87,  150,
       89,  150,   91,  150,   93,    1,  150,   96,  150,  150,
      153,  100,  101,  102,  151,  150,  151,  106,  107,  151,
      151,  110,  151,  151,  113,  151,  151,  151,  151,  151,
       72,  151,  121,  152,   30,  152,  152,  152,  152,  152,
       82,  152,  152,   85,   86,   87,  152,   89,  152,   91,
      152,   93,    1,  152,   96,  152,  152,  152,  100,  101,
      102,  150,  151,  153,  106,  107,  152,  152,  110,  152,
      152,  113,  152,  152,  152,  152,   72,  152,  154,  121,
      153,  153,  153,  153,  153,  153,   82,  153,  153,   85,
       86,   87,  153,   89,  153,   91,  153,   93,  153,  153,
       96,  153,  153,  153,  100,  101,  102,  153,  150,  151,
      106,  107,  153,  153,  110,  153,  153,  113,  153,  153,
      153,  153,  153,   72,  153,  121,  153,  155,  154,  154,
      154,  154,  154,   82,  154,  154,   85,   86,   87,  154,
       89,  154,   91,  154,   93,  154,  154,   96,  154,  154,
      154,  100,  101,  102,  150,  151,  154,  106,  107,  154,
      154,  110,  154,  154,  113,    8,    9,   10,  154,  154,
      154,  154,  121,  154,  154,  154,  154,  154,  154,  154,
       -1,  155,   -1,  156,  156,  156,   29,  156,   31,   32,
       33,   34,   35,   36,   37,   38,   39,   40,   41,  156,
      156,  150,  151,  157
];

PHP.Parser.prototype.yybase = [
        0,  223,  299,  371,  444,  303,  208,  618,   -2,   -2,
      -73,   -2,   -2,  625,  718,  718,  764,  718,  552,  671,
      811,  811,  811,  228,  113,  113,  113,  254,  361,  -40,
      361,  333,  449,  470,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      435,  435,  435,  435,  435,  435,  435,  435,  435,  435,
      291,  291,  230,  393,  495,  779,  784,  781,  776,  775,
      780,  785,  498,  678,  680,  562,  681,  682,  683,  685,
      782,  804,  777,  783,  568,  568,  568,  568,  568,  568,
      568,  568,  568,  568,  568,  568,  568,  568,  568,  568,
      568,  253,   69,  162,   56,   56,   56,   56,   56,   56,
       56,   56,   56,   56,   56,   56,   56,   56,   56,   56,
       56,   56,   56,   56,   56,   56,  349,  349,  349,  157,
      210,  150,  200,  211,  143,   27,  917,  917,  917,  917,
      917,  -16,  -16,  -16,  -16,  351,  351,  362,  217,   89,
       89,   89,   89,   89,   89,   89,   89,   89,   89,   89,
       89,   89,  163,  313,  106,  106,  133,  133,  133,  133,
      133,  133,  221,  305,  234,  347,  369,  523,  806,  167,
      167,  441,   93,  283,  202,  202,  202,  386,  547,  533,
      533,  533,  533,  419,  419,  533,  533,  170,  214,   74,
      211,  211,  277,  211,  211,  211,  409,  409,  409,  452,
      318,  352,  546,  318,  619,  640,  577,  675,  578,  677,
      278,  585,  145,  586,  145,  145,  145,  458,  445,  451,
      774,  291,  522,  291,  291,  291,  291,  722,  291,  291,
      291,  291,  291,  291,   98,  291,   79,  430,  230,  240,
      240,  556,  240,  452,  538,  263,  635,  410,  425,  538,
      538,  538,  636,  637,  336,  363,  198,  638,  382,  402,
      173,   33,  549,  549,  555,  555,  566,  551,  549,  549,
      549,  549,  549,  690,  690,  555,  548,  555,  566,  695,
      555,  551,  551,  555,  555,  549,  555,  690,  551,  156,
      415,  249,  273,  551,  551,  426,  528,  549,  535,  535,
      433,  555,  219,  555,  139,  539,  690,  690,  539,  229,
      551,  231,  590,  591,  529,  527,  553,  245,  553,  553,
      300,  529,  553,  551,  553,  448,   50,  548,  295,  553,
       11,  699,  701,  418,  703,  694,  705,  731,  706,  530,
      524,  526,  719,  720,  708,  692,  691,  561,  582,  513,
      517,  534,  554,  689,  581,  531,  531,  531,  554,  687,
      531,  531,  531,  531,  531,  531,  531,  531,  787,  540,
      545,  723,  537,  541,  576,  543,  623,  520,  582,  582,
      584,  732,  786,  564,  722,  762,  709,  587,  557,  741,
      725,  525,  542,  565,  726,  727,  745,  765,  628,  513,
      766,  641,  563,  643,  582,  644,  531,  670,  617,  788,
      789,  688,  791,  736,  747,  749,  580,  645,  569,  803,
      646,  768,  629,  631,  589,  737,  684,  751,  647,  752,
      754,  649,  592,  572,  734,  573,  733,  272,  729,  632,
      650,  654,  656,  658,  661,  710,  594,  738,  544,  740,
      735,  595,  597,  560,  663,  488,  599,  570,  571,  600,
      714,  558,  550,  601,  602,  769,  664,  728,  604,  665,
      756,  574,  581,  536,  532,  575,  567,  634,  755,  559,
      605,  609,  611,  613,  674,  616,    0,    0,    0,    0,
        0,    0,    0,    0,    0,    0,    0,    0,    0,    0,
        0,    0,    0,    0,    0,    0,    0,    0,    0,    0,
        0,    0,    0,  136,  136,  136,  136,   -2,   -2,   -2,
        0,    0,   -2,    0,    0,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  136,  136,  136,  136,  136,  136,  136,  136,
      136,  136,  568,  568,  568,  568,  568,  568,  568,  568,
      568,  568,  568,  568,  568,  568,  568,  568,  568,  568,
      568,  568,  568,  568,  568,  568,    0,    0,    0,    0,
        0,    0,    0,    0,    0,    0,    0,    0,    0,    0,
        0,    0,    0,  568,  568,  568,  568,  568,  568,  568,
      568,  568,  568,  568,  568,  568,  568,  568,  568,  568,
      568,  568,  568,  568,  568,  568,  568,  568,  568,  568,
      568,  568,   -3,  568,  568,   -3,  568,  568,  568,  568,
      568,  568,  568,  202,  202,  202,  202,  318,  318,  318,
      -67,  318,  318,  318,  318,  318,  318,  318,  318,  318,
      318,  318,  318,  318,  318,  -67,  202,  202,  318,  318,
      318,  318,  318,  318,  318,  318,  318,  318,  419,  419,
      419,  145,  145,  318,    0,    0,    0,    0,    0,  549,
      419,  318,  318,  318,  318,    0,    0,  318,  318,  548,
      145,    0,    0,    0,    0,    0,    0,    0,  549,  549,
      549,  548,    0,  549,  419,    0,  240,  291,  440,  440,
      440,  440,    0,  549,    0,  549,    0,    0,    0,    0,
        0,    0,  551,    0,  690,    0,    0,    0,    0,  555,
        0,    0,    0,    0,    0,    0,    0,    0,  548,    0,
        0,    0,    0,  548,    0,    0,  531,    0,  564,    0,
        0,  531,  531,  531,  564,  564,    0,    0,    0,  564
];

PHP.Parser.prototype.yydefault = [
        3,32767,32767,32767,32767,32767,32767,32767,32767,   92,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,  510,  510,  510,   94,  499,32767,
      499,32767,32767,32767,  314,  314,  314,32767,  454,  454,
      454,  454,  454,  454,  454,32767,32767,32767,32767,32767,
      394,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,   92,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,  506,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,  377,  378,  380,  381,  313,  455,
      509,  259,  505,  312,  130,  270,  261,  211,  243,  310,
      134,  342,  395,  344,  393,  397,  343,  319,  323,  324,
      325,  326,  327,  328,  329,  330,  331,  332,  333,  334,
      335,  317,  318,  396,  398,  399,  374,  373,  372,  340,
      316,  341,  345,  316,  347,  346,  363,  364,  361,  362,
      365,  366,  367,  368,  369,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,   94,
    32767,32767,32767,  293,  354,  355,  250,  250,  250,  250,
      250,  250,32767,  250,32767,  250,32767,32767,32767,32767,
    32767,32767,  448,  371,  349,  350,  348,32767,  426,32767,
    32767,32767,32767,32767,  428,32767,   92,32767,32767,32767,
      337,  339,  420,  508,  320,  507,32767,32767,   94,  414,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
      423,32767,32767,   92,32767,32767,   92,  174,  230,  232,
      179,32767,  431,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,  414,  359,  517,32767,  456,32767,  351,
      352,  353,32767,32767,  456,  456,  456,32767,  456,32767,
      456,  456,32767,32767,32767,32767,32767,  179,32767,32767,
    32767,32767,   94,  429,  429,   92,   92,   92,   92,  424,
    32767,  179,  179,32767,32767,32767,32767,32767,  179,   91,
       91,   91,   91,  179,  179,   91,  194,32767,  192,  192,
       91,32767,   93,32767,   93,  196,32767,  470,  196,   91,
      179,   91,  216,  216,  405,  181,  252,   93,  252,  252,
       93,  405,  252,  179,  252,   91,   91,32767,   91,  252,
    32767,32767,32767,   85,32767,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,  416,32767,
      436,32767,  449,  468,32767,  357,  358,  360,32767,  458,
      382,  383,  384,  385,  386,  387,  388,  390,32767,  419,
    32767,32767,32767,   87,  121,  269,32767,  515,   87,  417,
    32767,  515,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,32767,   87,   87,32767,32767,32767,32767,32767,  495,
    32767,  516,32767,  456,  418,32767,  356,  432,  475,32767,
    32767,  457,32767,32767,32767,32767,   87,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,  436,32767,32767,32767,
    32767,32767,32767,32767,  456,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
      456,32767,32767,  242,32767,32767,32767,  309,32767,32767,
    32767,32767,32767,32767,32767,32767,32767,32767,32767,32767,
    32767,   85,   60,32767,  289,32767,32767,32767,32767,32767,
    32767,32767,32767,32767,32767,32767,  136,  136,    3,  272,
        3,  272,  136,  136,  136,  272,  272,  136,  136,  136,
      136,  136,  136,  136,  169,  224,  227,  216,  216,  281,
      136,  136
];

PHP.Parser.prototype.yygoto = [
      171,  144,  144,  144,  171,  152,  153,  152,  155,  187,
      172,  168,  168,  168,  168,  169,  169,  169,  169,  169,
      169,  169,  164,  165,  166,  167,  184,  182,  185,  445,
      446,  334,  447,  450,  451,  452,  453,  454,  455,  456,
      457,  924,  141,  145,  146,  147,  170,  148,  149,  143,
      150,  151,  154,  181,  183,  186,  206,  209,  211,  212,
      214,  215,  216,  217,  218,  219,  220,  221,  222,  223,
      224,  244,  245,  264,  265,  266,  339,  340,  341,  496,
      188,  189,  190,  191,  192,  193,  194,  195,  196,  197,
      198,  199,  200,  201,  202,  156,  203,  157,  173,  174,
      175,  207,  176,  158,  159,  160,  177,  161,  208,  142,
      204,  162,  178,  205,  179,  180,  163,  563,  210,  463,
      210,  516,  516, 1038,  572, 1038, 1038, 1038, 1038, 1038,
     1038, 1038, 1038, 1038, 1038, 1038, 1038, 1038,  468,  468,
      468,  514,  537,  468,  297,  489,  521,  489,  498,  274,
      533,  534,  698,  483,  258,  468,  448,  448,  448,  725,
      448,  448,  448,  448,  448,  448,  448,  448,  448,  448,
      448,  448,  448,  449,  449,  449,  699,  449,  449,  449,
      449,  449,  449,  449,  449,  449,  449,  449,  449,  449,
     1114, 1114,  734,  725,  899,  725,  315,  319,  475,  499,
      500,  502, 1083, 1084,  468,  468,  760, 1114,  761,  900,
      482,  506,  468,  468,  468,  329,  330,  686,  481,  545,
      495,  332,  510,  596,  523,  525,  294,  469,  538,  556,
      559,  835,  566,  574,  831,  765,  729,  717,  864,  494,
      807,  868,  490,  860,  716,  716,  810,  697, 1013, 1105,
      726,  726,  726,  728,  715,  840, 1093,  800,  824,  805,
      805,  803,  805,  595,  313,  460,  833,  828,  459,    3,
        4,  907,  733,  539, 1009,  487,  317,  461,  459,  497,
      892,  575,  972,  474,  843,  557,  890, 1129,  484,  485,
      505,  517,  519,  520,  568,  801,  801,  801,  801,  465,
      855,  795,  802, 1002,  787,  405, 1003,  799,  327,  571,
      356, 1082,  530, 1014,  848,  346,  540,  350,   11,  337,
      337,  280,  281,  283,  493,  344,  284,  345,  285,  348,
      524,  351, 1015, 1069, 1113, 1113,  543,  301,  298,  299,
      721,  560,  838,  838, 1100,  295,  865,  718,  600,  323,
      544, 1113, 1010, 1017,  511, 1005,  869,  849,  849,  849,
      849,  849,  849, 1017,  849,  849,  849,  720,  730, 1116,
      714,  812,  849, 1088, 1088,  909,  465,  398,  513,  414,
     1017, 1017, 1017, 1017,    0, 1079, 1017, 1017,    0,  701,
        0,    0,    0,    0,    0, 1079,    0,    0,    0,    0,
        0,  773, 1090, 1090,  774,  706,    0,  756,  751,  752,
      766,    0,  707,  753,  704,  754,  755,  705,    0,  759,
        0, 1075,    0,    0,    0,    0,    0, 1012,    0,    0,
        0,  480,    0,    0,    0,    0,    0,    0,    0,    0,
        0,    0,    0,    0,    0,  867,    0, 1077, 1077,  867,
        0,    0,    0,    0,    0,    0,    0,    0,    0,    0,
        0,    0,    0,    0,    0,    0,    0,    0,  462,  478,
        0,    0,    0,    0,    0,    0,    0,    0,    0,  462,
        0,  478,    0,    0,  316,    0,    0,  466,  386,    0,
      388,    0,    0,    0,    0,    0,    0,    0,    0,    0,
        0,    0,    0,    0,    0,  724,    0, 1121
];

PHP.Parser.prototype.yygcheck = [
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   63,   56,   10,
       56,   86,   86,   86,    8,   86,   86,   86,   86,   86,
       86,   86,   86,   86,   86,   86,   86,   86,   10,   10,
       10,   46,   46,   10,   80,   85,   73,   85,   97,  134,
       73,   73,   17,   10,  134,   10,  135,  135,  135,   26,
      135,  135,  135,  135,  135,  135,  135,  135,  135,  135,
      135,  135,  135,  137,  137,  137,   18,  137,  137,  137,
      137,  137,  137,  137,  137,  137,  137,  137,  137,  137,
      148,  148,   36,   26,  111,   26,   49,   49,   49,   49,
       49,   49,  141,  141,   10,   10,   55,  148,   55,  111,
       10,   10,   10,   10,   10,   69,   69,    5,   39,   69,
        2,   69,    2,   39,   39,   39,   69,   10,   39,   39,
       39,   39,   39,   39,   39,   13,   14,   14,   14,   10,
       40,   14,  136,   94,   26,   26,   14,   16,   92,  146,
       26,   26,   26,   26,   26,   14,  143,   14,   16,   16,
       16,   16,   16,   16,   52,   16,   16,   16,   75,   37,
       37,   14,   14,   54,   14,   53,   65,   65,   75,    7,
        7,    7,  118,   65,   88,    7,    7,   12,   65,   65,
       68,   68,   68,   68,   68,   75,   75,   75,   75,   12,
       90,   75,   75,   67,   67,   65,   67,   76,   76,   76,
       89,  139,   24,   92,   91,   56,   56,   56,   65,   56,
       56,   56,   56,   56,   56,   56,   56,   56,   56,   56,
       56,   56,   92,   92,  147,  147,   12,   20,   80,   80,
       30,   12,   85,   85,   85,   11,   96,   28,   82,   19,
       23,  147,  127,   63,   15,  124,   99,   63,   63,   63,
       63,   63,   63,   63,   63,   63,   63,   15,   32,  147,
       15,   79,   63,    8,    8,  114,   12,   71,   72,  122,
       63,   63,   63,   63,   -1,   97,   63,   63,   -1,   13,
       -1,   -1,   -1,   -1,   -1,   97,   -1,   -1,   -1,   -1,
       -1,   63,   97,   97,   63,   13,   -1,   13,   13,   13,
       13,   -1,   13,   13,   13,   13,   13,   13,   -1,   13,
       -1,   97,   -1,   -1,   -1,   -1,   -1,   12,   -1,   -1,
       -1,    8,   -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,
       -1,   -1,   -1,   -1,   -1,   97,   -1,   97,   97,   97,
       -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,
       -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,    8,    8,
       -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,    8,
       -1,    8,   -1,   -1,    8,   -1,   -1,    8,    8,   -1,
        8,   -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,   -1,
       -1,   -1,   -1,   -1,   -1,    8,   -1,    8
];

PHP.Parser.prototype.yygbase = [
        0,    0, -358,    0,    0,  207,    0,  274,  114,    0,
     -148,   54,   10,   94, -144,  -40,  245,  150,  174,   48,
       70,    0,    0,   -3,   25,    0, -108,    0,   44,    0,
       52,    0,    3,  -23,    0,    0,  183, -331,    0, -359,
      221,    0,    0,    0,    0,    0,  106,    0,    0,  157,
        0,    0,  227,   45,   47,  191,   90,    0,    0,    0,
        0,    0,    0,  111,    0,  -95,    0,  -26,   43, -193,
        0,  -12,  -20, -435,    0,   26,   37,    0,    0,    4,
     -259,    0,   20,    0,    0,  117, -104,    0,   31,   55,
       46,   53,  -64,    0,  216,    0,   40,  143,    0,  -10,
        0,    0,    0,    0,    0,    0,    0,    0,    0,    0,
        0,  -34,    0,    0,    7,    0,    0,    0,   30,    0,
        0,    0,  -32,    0,   -9,    0,    0,   -5,    0,    0,
        0,    0,    0,    0, -119,  -69,  217,  -52,    0,   51,
        0, -102,    0,  226,    0,    0,  223,   77,  -67,    0,
        0
];

PHP.Parser.prototype.yygdefault = [
    -32768,  420,  603,    2,  604,  676,  684,  548,  437,  573,
      438,  464,  335,  758,  913,  778,  740,  741,  742,  320,
      361,  311,  318,  531,  518,  410,  727,  381,  719,  407,
      722,  380,  731,  140,  549,  416,  735,    1,  737,  470,
      769,  308,  745,  309,  552,  747,  477,  749,  750,  314,
      321,  322,  917,  486,  515,  762,  213,  479,  763,  307,
      764,  772,  331,  312,  392,  417,  326,  894,  504,  527,
      376,  395,  512,  507,  488, 1024,  797,  401,  390,  811,
      296,  819,  601,  827,  830,  439,  440,  399,  842,  400,
      853,  847, 1032,  394,  859,  382,  866, 1064,  385,  870,
      228,  873,  255,  546,  349,  878,  879,    6,  884,  564,
      565,    7,  243,  415,  908,  547,  379,  923,  364,  991,
      993,  472,  408, 1006,  389,  555,  418, 1011, 1068,  377,
      441,  396,  282,  300,  257,  442,  458,  262,  443,  397,
     1071, 1078,  338, 1094,  279,   26, 1106, 1115,  292,  492,
      509
];

PHP.Parser.prototype.yylhs = [
        0,    1,    3,    3,    2,    5,    5,    5,    5,    5,
        5,    5,    5,    5,    5,    5,    5,    5,    5,    5,
        5,    5,    5,    5,    5,    5,    5,    5,    5,    5,
        5,    5,    5,    5,    5,    5,    5,    5,    5,    5,
        5,    5,    5,    5,    5,    5,    5,    5,    5,    5,
        5,    5,    5,    5,    5,    5,    5,    5,    5,    5,
        5,    5,    5,    5,    5,    5,    5,    5,    5,    5,
        5,    5,    5,    5,    6,    6,    6,    6,    6,    6,
        6,    7,    7,    8,    9,   10,   10,   11,   12,   13,
       13,   14,   14,   15,   15,    4,    4,    4,    4,    4,
        4,    4,    4,    4,    4,    4,   20,   20,   21,   21,
       21,   21,   23,   25,   25,   19,   27,   27,   24,   29,
       29,   26,   26,   28,   28,   30,   30,   22,   31,   31,
       32,   34,   35,   35,   36,   37,   37,   39,   38,   38,
       38,   38,   40,   40,   40,   40,   40,   40,   40,   40,
       40,   40,   40,   40,   40,   40,   40,   40,   40,   40,
       40,   40,   40,   40,   40,   40,   40,   16,   16,   59,
       59,   62,   62,   61,   60,   60,   53,   64,   64,   65,
       65,   66,   66,   67,   67,   17,   18,   18,   18,   70,
       70,   70,   71,   71,   74,   74,   72,   72,   76,   77,
       77,   47,   47,   55,   55,   58,   58,   58,   57,   78,
       78,   79,   48,   48,   48,   48,   80,   80,   81,   81,
       82,   82,   45,   45,   41,   41,   83,   43,   43,   84,
       42,   42,   44,   44,   54,   54,   54,   54,   68,   68,
       87,   87,   88,   88,   88,   90,   90,   91,   91,   91,
       89,   89,   69,   69,   69,   92,   92,   93,   93,   94,
       94,   94,   50,   95,   95,   96,   51,   98,   98,   99,
       99,  100,  100,   73,  101,  101,  101,  101,  101,  106,
      106,  107,  107,  108,  108,  108,  108,  108,  109,  110,
      110,  105,  105,  102,  102,  104,  104,  112,  112,  111,
      111,  111,  111,  111,  111,  103,  113,  113,  115,  114,
      114,   52,  116,  116,   46,   46,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,   33,   33,   33,   33,   33,   33,   33,   33,
       33,   33,  123,  117,  117,  122,  122,  125,  126,  126,
      127,  128,  128,  128,   75,   75,   63,   63,   63,  118,
      118,  118,  130,  130,  119,  119,  121,  121,  121,  124,
      124,  135,  135,  135,   86,  137,  137,  137,  120,  120,
      120,  120,  120,  120,  120,  120,  120,  120,  120,  120,
      120,  120,  120,  120,   49,   49,  133,  133,  133,  129,
      129,  129,  138,  138,  138,  138,  138,  138,   56,   56,
       56,   97,   97,   97,   97,  141,  140,  132,  132,  132,
      132,  132,  132,  131,  131,  131,  139,  139,  139,  139,
       85,  142,  142,  143,  143,  143,  143,  143,  143,  143,
      136,  145,  145,  144,  144,  146,  146,  146,  146,  146,
      146,  134,  134,  134,  134,  148,  149,  147,  147,  147,
      147,  147,  147,  147,  150,  150,  150,  150
];

PHP.Parser.prototype.yylen = [
        1,    1,    2,    0,    1,    1,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    3,    1,    1,    1,
        1,    0,    1,    0,    1,    1,    1,    1,    1,    3,
        5,    4,    3,    4,    2,    3,    1,    1,    7,    8,
        6,    7,    2,    3,    1,    2,    3,    1,    2,    3,
        1,    1,    3,    1,    2,    1,    2,    2,    3,    1,
        3,    2,    3,    1,    3,    2,    0,    1,    1,    1,
        1,    1,    3,    7,   10,    5,    7,    9,    5,    3,
        3,    3,    3,    3,    3,    1,    2,    5,    7,    9,
        6,    5,    6,    3,    3,    2,    1,    1,    1,    0,
        2,    1,    3,    8,    0,    4,    2,    1,    3,    0,
        1,    0,    1,    3,    1,    8,    7,    6,    5,    1,
        2,    2,    0,    2,    0,    2,    0,    2,    2,    1,
        3,    1,    4,    1,    4,    1,    1,    4,    2,    1,
        3,    3,    3,    4,    4,    5,    0,    2,    4,    3,
        1,    1,    1,    4,    0,    2,    5,    0,    2,    6,
        0,    2,    0,    3,    1,    2,    1,    1,    2,    0,
        1,    3,    4,    6,    4,    1,    2,    1,    1,    1,
        0,    1,    0,    2,    2,    2,    4,    1,    3,    1,
        2,    2,    2,    3,    1,    1,    2,    3,    1,    1,
        3,    2,    0,    1,    4,    4,    9,    3,    1,    1,
        3,    0,    2,    4,    5,    4,    4,    4,    3,    1,
        1,    1,    1,    1,    1,    0,    1,    1,    2,    1,
        1,    1,    1,    1,    1,    2,    1,    3,    1,    1,
        3,    2,    3,    1,    0,    1,    1,    3,    3,    3,
        4,    1,    2,    3,    3,    3,    3,    3,    3,    3,
        3,    3,    3,    3,    3,    3,    2,    2,    2,    2,
        3,    3,    3,    3,    3,    3,    3,    3,    3,    3,
        3,    3,    3,    3,    3,    3,    3,    2,    2,    2,
        2,    3,    3,    3,    3,    3,    3,    3,    3,    3,
        3,    3,    5,    4,    3,    4,    4,    2,    2,    4,
        2,    2,    2,    2,    2,    2,    2,    2,    2,    2,
        2,    1,    3,    2,    1,    2,    4,    2,    8,    9,
        8,    9,    7,    3,    2,    0,    4,    2,    1,    3,
        2,    2,    2,    4,    1,    1,    1,    2,    3,    1,
        1,    1,    1,    1,    0,    3,    0,    1,    1,    0,
        1,    1,    3,    3,    3,    4,    1,    1,    1,    1,
        1,    1,    1,    1,    1,    1,    1,    1,    1,    1,
        3,    2,    3,    3,    0,    1,    1,    3,    1,    1,
        3,    1,    1,    4,    4,    4,    1,    4,    1,    1,
        3,    1,    4,    2,    2,    1,    3,    1,    4,    4,
        3,    3,    3,    1,    3,    1,    1,    3,    1,    1,
        4,    3,    1,    1,    2,    1,    3,    4,    3,    0,
        1,    1,    1,    3,    1,    3,    1,    4,    2,    2,
        0,    2,    2,    1,    2,    1,    1,    1,    4,    3,
        3,    3,    6,    3,    1,    1,    2,    1
];



exports.PHP = PHP;
});

ace.define("ace/mode/php_worker",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var Mirror = require("../worker/mirror").Mirror;
var PHP = require("./php/php").PHP;

var PhpWorker = exports.PhpWorker = function(sender) {
    Mirror.call(this, sender);
    this.setTimeout(500);
};

oop.inherits(PhpWorker, Mirror);

(function() {
    this.setOptions = function(opts) {
        this.inlinePhp = opts && opts.inline;
    };
    
    this.onUpdate = function() {
        var value = this.doc.getValue();
        var errors = [];
        if (this.inlinePhp)
            value = "<?" + value + "?>";

        var tokens = PHP.Lexer(value, {short_open_tag: 1});
        try {
            new PHP.Parser(tokens);
        } catch(e) {
            errors.push({
                row: e.line - 1,
                column: null,
                text: e.message.charAt(0).toUpperCase() + e.message.substring(1),
                type: "error"
            });
        }

        this.sender.emit("annotate", errors);
    };

}).call(PhpWorker.prototype);

});
