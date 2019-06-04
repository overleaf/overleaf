ace.define("ace/mode/latex_highlight_rules",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var LatexHighlightRules = function() {  

    this.$rules = {
        "start" : [{
            token : "comment",
            regex : "%.*$"
        }, {
            token : ["keyword", "lparen", "variable.parameter", "rparen", "lparen", "storage.type", "rparen"],
            regex : "(\\\\(?:documentclass|usepackage|input))(?:(\\[)([^\\]]*)(\\]))?({)([^}]*)(})"
        }, {
            token : ["keyword", "lparen", "variable.parameter", "rparen"],
            regex : "(\\\\(?:label|(?:eq|page|v|c|C)?ref|cite(?:[^{]*)))(?:({)([^}]*)(}))?"
        }, {
            token : ["storage.type", "lparen", "variable.parameter", "rparen"],
            regex : "(\\\\begin)({)(verbatim)(})",
            next : "verbatim"
        },  {
            token : ["storage.type", "lparen", "variable.parameter", "rparen"],
            regex : "(\\\\begin)({)(lstlisting)(})",
            next : "lstlisting"
        },  {
            token : ["storage.type", "lparen", "variable.parameter", "rparen"],
            regex : "(\\\\(?:begin|end))({)([\\w*]*)(})"
        }, {
            token : "storage.type",
            regex : /\\verb\b\*?/,
            next : [{
                token : ["keyword.operator", "string", "keyword.operator"],
                regex : "(.)(.*?)(\\1|$)|",
                next : "start"
            }]
        }, {
            token : "storage.type",
            regex : "\\\\[a-zA-Z]+"
        }, {
            token : "lparen",
            regex : "[[({]"
        }, {
            token : "rparen",
            regex : "[\\])}]"
        }, {
            token : "constant.character.escape",
            regex : "\\\\[^a-zA-Z]?"
        }, {
            token : "string",
            regex : "\\${1,2}",
            next  : "equation"
        }],
        "equation" : [{
            token : "comment",
            regex : "%.*$"
        }, {
            token : "string",
            regex : "\\${1,2}",
            next  : "start"
        }, {
            token : "constant.character.escape",
            regex : "\\\\(?:[^a-zA-Z]|[a-zA-Z]+)"
        }, {
            token : "error", 
            regex : "^\\s*$", 
            next : "start" 
        }, {
            defaultToken : "string"
        }],
        "verbatim": [{
            token : ["storage.type", "lparen", "variable.parameter", "rparen"],
            regex : "(\\\\end)({)(verbatim)(})",
            next : "start"
        }, {
            defaultToken : "text"
        }],
        "lstlisting": [{
            token : ["storage.type", "lparen", "variable.parameter", "rparen"],
            regex : "(\\\\end)({)(lstlisting)(})",
            next : "start"
        }, {
            defaultToken : "text"
        }]
    };
    
    this.normalizeRules();
};
oop.inherits(LatexHighlightRules, TextHighlightRules);

exports.LatexHighlightRules = LatexHighlightRules;

});

ace.define("ace/mode/folding/latex",[], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var BaseFoldMode = require("./fold_mode").FoldMode;
var Range = require("../../range").Range;
var TokenIterator = require("../../token_iterator").TokenIterator;
var keywordLevels = {
    "\\subparagraph": 1,
    "\\paragraph": 2,
    "\\subsubsubsection": 3,
    "\\subsubsection": 4,
    "\\subsection": 5,
    "\\section": 6,
    "\\chapter": 7,
    "\\part": 8,
    "\\begin": 9,
    "\\end": 10
};

var FoldMode = exports.FoldMode = function() {};

oop.inherits(FoldMode, BaseFoldMode);

(function() {

    this.foldingStartMarker = /^\s*\\(begin)|\s*\\(part|chapter|(?:sub)*(?:section|paragraph))\b|{\s*$/;
    this.foldingStopMarker = /^\s*\\(end)\b|^\s*}/;

    this.getFoldWidgetRange = function(session, foldStyle, row) {
        var line = session.doc.getLine(row);
        var match = this.foldingStartMarker.exec(line);
        if (match) {
            if (match[1])
                return this.latexBlock(session, row, match[0].length - 1);
            if (match[2])
                return this.latexSection(session, row, match[0].length - 1);

            return this.openingBracketBlock(session, "{", row, match.index);
        }

        var match = this.foldingStopMarker.exec(line);
        if (match) {
            if (match[1])
                return this.latexBlock(session, row, match[0].length - 1);

            return this.closingBracketBlock(session, "}", row, match.index + match[0].length);
        }
    };

    this.latexBlock = function(session, row, column, returnRange) {
        var keywords = {
            "\\begin": 1,
            "\\end": -1
        };

        var stream = new TokenIterator(session, row, column);
        var token = stream.getCurrentToken();
        if (!token || !(token.type == "storage.type" || token.type == "constant.character.escape"))
            return;

        var val = token.value;
        var dir = keywords[val];

        var getType = function() {
            var token = stream.stepForward();
            var type = token.type == "lparen" ?stream.stepForward().value : "";
            if (dir === -1) {
                stream.stepBackward();
                if (type)
                    stream.stepBackward();
            }
            return type;
        };
        var stack = [getType()];
        var startColumn = dir === -1 ? stream.getCurrentTokenColumn() : session.getLine(row).length;
        var startRow = row;

        stream.step = dir === -1 ? stream.stepBackward : stream.stepForward;
        while(token = stream.step()) {
            if (!token || !(token.type == "storage.type" || token.type == "constant.character.escape"))
                continue;
            var level = keywords[token.value];
            if (!level)
                continue;
            var type = getType();
            if (level === dir)
                stack.unshift(type);
            else if (stack.shift() !== type || !stack.length)
                break;
        }

        if (stack.length)
            return;
        
        if (dir == 1) {
            stream.stepBackward();
            stream.stepBackward();
        }
        
        if (returnRange)
            return stream.getCurrentTokenRange();

        var row = stream.getCurrentTokenRow();
        if (dir === -1)
            return new Range(row, session.getLine(row).length, startRow, startColumn);
        else
            return new Range(startRow, startColumn, row, stream.getCurrentTokenColumn());
    };

    this.latexSection = function(session, row, column) {
        var stream = new TokenIterator(session, row, column);
        var token = stream.getCurrentToken();
        if (!token || token.type != "storage.type")
            return;

        var startLevel = keywordLevels[token.value] || 0;
        var stackDepth = 0;
        var endRow = row;

        while(token = stream.stepForward()) {
            if (token.type !== "storage.type")
                continue;
            var level = keywordLevels[token.value] || 0;

            if (level >= 9) {
                if (!stackDepth)
                    endRow = stream.getCurrentTokenRow() - 1;
                stackDepth += level == 9 ? 1 : - 1;
                if (stackDepth < 0)
                    break;
            } else if (level >= startLevel)
                break;
        }

        if (!stackDepth)
            endRow = stream.getCurrentTokenRow() - 1;

        while (endRow > row && !/\S/.test(session.getLine(endRow)))
            endRow--;

        return new Range(
            row, session.getLine(row).length,
            endRow, session.getLine(endRow).length
        );
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/behaviour/latex",[], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var Behaviour = require("../behaviour").Behaviour;
var TokenIterator = require("../../token_iterator").TokenIterator;
var lang = require("../../lib/lang");

var SAFE_INSERT_IN_TOKENS =
    ["text", "paren.rparen", "punctuation.operator"];
var SAFE_INSERT_BEFORE_TOKENS =
    ["text", "paren.rparen", "punctuation.operator", "comment"];

var context;
var contextCache = {};
var initContext = function(editor) {
    var id = -1;
    if (editor.multiSelect) {
        id = editor.selection.index;
        if (contextCache.rangeCount != editor.multiSelect.rangeCount)
            contextCache = {rangeCount: editor.multiSelect.rangeCount};
    }
    if (contextCache[id])
        return context = contextCache[id];
    context = contextCache[id] = {
        autoInsertedBrackets: 0,
        autoInsertedRow: -1,
        autoInsertedLineEnd: "",
        maybeInsertedBrackets: 0,
        maybeInsertedRow: -1,
        maybeInsertedLineStart: "",
        maybeInsertedLineEnd: ""
    };
};

var getWrapped = function(selection, selected, opening, closing) {
    var rowDiff = selection.end.row - selection.start.row;
    return {
        text: opening + selected + closing,
        selection: [
                0,
                selection.start.column + 1,
                rowDiff,
                selection.end.column + (rowDiff ? 0 : 1)
            ]
    };
};

var LatexBehaviour = function() {
    this.add("braces", "insertion", function(state, action, editor, session, text) {
				if (editor.completer && editor.completer.popup && editor.completer.popup.isOpen) {
					return;
				}
        var cursor = editor.getCursorPosition();
        var line = session.doc.getLine(cursor.row);
        var lastChar = line[cursor.column-1];
        if (lastChar === '\\') {
          return;
        }
        if (text == '{') {
            initContext(editor);
            var selection = editor.getSelectionRange();
            var selected = session.doc.getTextRange(selection);
            if (selected !== "" && editor.getWrapBehavioursEnabled()) {
                return getWrapped(selection, selected, '{', '}');
            } else if (LatexBehaviour.isSaneInsertion(editor, session)) {
                LatexBehaviour.recordAutoInsert(editor, session, "}");
                return {
                    text: '{}',
                    selection: [1, 1]
                };
            }
        } else if (text == '}') {
            initContext(editor);
            var rightChar = line.substring(cursor.column, cursor.column + 1);
            if (rightChar == '}') {
                var matching = session.$findOpeningBracket('}', {column: cursor.column + 1, row: cursor.row});
                if (matching !== null && LatexBehaviour.isAutoInsertedClosing(cursor, line, text)) {
                    LatexBehaviour.popAutoInsertedClosing();
                    return {
                        text: '',
                        selection: [1, 1]
                    };
                }
            }
        }
    });

    this.add("braces", "deletion", function(state, action, editor, session, range) {
			if (editor.completer && editor.completer.popup && editor.completer.popup.isOpen) {
				return;
			}
      var selected = session.doc.getTextRange(range);
      if (!range.isMultiLine() && selected == '{') {
        initContext(editor);
        var line = session.doc.getLine(range.start.row);
        var rightChar = line.substring(range.start.column + 1, range.start.column + 2);
        if (rightChar == '}') {
          range.end.column++;
          return range;
        }
      }
    });

    this.add("brackets", "insertion", function(state, action, editor, session, text) {
				if (editor.completer && editor.completer.popup && editor.completer.popup.isOpen) {
					return;
				}
        var cursor = editor.getCursorPosition();
        var line = session.doc.getLine(cursor.row);
        var lastChar = line[cursor.column-1];
        if (lastChar === '\\') {
          return;
        }
        if (text == '[') {
            initContext(editor);
            var selection = editor.getSelectionRange();
            var selected = session.doc.getTextRange(selection);
            if (selected !== "" && editor.getWrapBehavioursEnabled()) {
                return getWrapped(selection, selected, '[', ']');
            } else if (LatexBehaviour.isSaneInsertion(editor, session)) {
                LatexBehaviour.recordAutoInsert(editor, session, "]");
                return {
                    text: '[]',
                    selection: [1, 1]
                };
            }
        } else if (text == ']') {
            initContext(editor);
            var rightChar = line.substring(cursor.column, cursor.column + 1);
            if (rightChar == ']') {
                var matching = session.$findOpeningBracket(']', {column: cursor.column + 1, row: cursor.row});
                if (matching !== null && LatexBehaviour.isAutoInsertedClosing(cursor, line, text)) {
                    LatexBehaviour.popAutoInsertedClosing();
                    return {
                        text: '',
                        selection: [1, 1]
                    };
                }
            }
        }
    });

    this.add("brackets", "deletion", function(state, action, editor, session, range) {
				if (editor.completer && editor.completer.popup && editor.completer.popup.isOpen) {
					return;
				}
        var selected = session.doc.getTextRange(range);
        if (!range.isMultiLine() && selected == '[') {
            initContext(editor);
            var line = session.doc.getLine(range.start.row);
            var rightChar = line.substring(range.start.column + 1, range.start.column + 2);
            if (rightChar == ']') {
                range.end.column++;
                return range;
            }
        }
    });

    this.add("dollars", "insertion", function(state, action, editor, session, text) {
        var cursor = editor.getCursorPosition();
        var line = session.doc.getLine(cursor.row);
        var lastChar = line[cursor.column-1];
        if (lastChar === '\\') {
          return;
        }
        if (text == '$') {
            if (this.lineCommentStart && this.lineCommentStart.indexOf(text) != -1)
                return;
            initContext(editor);
            var quote = text;
            var selection = editor.getSelectionRange();
            var selected = session.doc.getTextRange(selection);
            if (selected !== "" && selected !== "$" && editor.getWrapBehavioursEnabled()) {
                return getWrapped(selection, selected, quote, quote);
            } else if (!selected) {
                var leftChar = line.substring(cursor.column-1, cursor.column);
                var rightChar = line.substring(cursor.column, cursor.column + 1);

                var token = session.getTokenAt(cursor.row, cursor.column);
                var rightToken = session.getTokenAt(cursor.row, cursor.column + 1);

                var stringBefore = token && /string|escape/.test(token.type);
                var stringAfter = !rightToken || /string|escape/.test(rightToken.type);

                var pair;
                if (rightChar == quote) {
                    pair = stringBefore !== stringAfter;
                    if (pair && /string\.end/.test(rightToken.type))
                        pair = false;
                } else {
                    if (stringBefore && !stringAfter)
                        return null; // wrap string with different quote
                    if (stringBefore && stringAfter)
                        return null; // do not pair quotes inside strings
                    var wordRe = session.$mode.tokenRe;
                    wordRe.lastIndex = 0;
                    var isWordBefore = wordRe.test(leftChar);
                    wordRe.lastIndex = 0;
                    var isWordAfter = wordRe.test(leftChar);
                    if (isWordBefore || isWordAfter)
                        return null; // before or after alphanumeric
                    if (rightChar && !/[\s;,.})\]\\]/.test(rightChar))
                        return null; // there is rightChar and it isn't closing
                    pair = true;
                }
                return {
                    text: pair ? quote + quote : "",
                    selection: [1,1]
                };
            }
        }
    });

    this.add("dollars", "deletion", function(state, action, editor, session, range) {
        var selected = session.doc.getTextRange(range);
        if (!range.isMultiLine() && (selected == '$')) {
            initContext(editor);
            var line = session.doc.getLine(range.start.row);
            var rightChar = line.substring(range.start.column + 1, range.start.column + 2);
            if (rightChar == selected) {
                range.end.column++;
                return range;
            }
        }
    });

};


LatexBehaviour.isSaneInsertion = function(editor, session) {
    var cursor = editor.getCursorPosition();
    var iterator = new TokenIterator(session, cursor.row, cursor.column);
    if (!this.$matchTokenType(iterator.getCurrentToken() || "text", SAFE_INSERT_IN_TOKENS)) {
        var iterator2 = new TokenIterator(session, cursor.row, cursor.column + 1);
        if (!this.$matchTokenType(iterator2.getCurrentToken() || "text", SAFE_INSERT_IN_TOKENS))
            return false;
    }
    iterator.stepForward();
    return iterator.getCurrentTokenRow() !== cursor.row ||
        this.$matchTokenType(iterator.getCurrentToken() || "text", SAFE_INSERT_BEFORE_TOKENS);
};

LatexBehaviour.$matchTokenType = function(token, types) {
    return types.indexOf(token.type || token) > -1;
};

LatexBehaviour.recordAutoInsert = function(editor, session, bracket) {
    var cursor = editor.getCursorPosition();
    var line = session.doc.getLine(cursor.row);
    if (!this.isAutoInsertedClosing(cursor, line, context.autoInsertedLineEnd[0]))
        context.autoInsertedBrackets = 0;
    context.autoInsertedRow = cursor.row;
    context.autoInsertedLineEnd = bracket + line.substr(cursor.column);
    context.autoInsertedBrackets++;
};

LatexBehaviour.isAutoInsertedClosing = function(cursor, line, bracket) {
    return context.autoInsertedBrackets > 0 &&
        cursor.row === context.autoInsertedRow &&
        bracket === context.autoInsertedLineEnd[0] &&
        line.substr(cursor.column) === context.autoInsertedLineEnd;
};

LatexBehaviour.popAutoInsertedClosing = function() {
    context.autoInsertedLineEnd = context.autoInsertedLineEnd.substr(1);
    context.autoInsertedBrackets--;
};


oop.inherits(LatexBehaviour, Behaviour);

exports.LatexBehaviour = LatexBehaviour;
});

ace.define("ace/mode/latex",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var LatexHighlightRules = require("./latex_highlight_rules").LatexHighlightRules;
var LatexFoldMode = require("./folding/latex").FoldMode;
var Range = require("../range").Range;
var WorkerClient = require("ace/worker/worker_client").WorkerClient;
var LatexBehaviour = require("./behaviour/latex").LatexBehaviour;

var createLatexWorker = function (session) {
    var doc = session.getDocument();
    var selection = session.getSelection();
    var cursorAnchor = selection.lead;

    var savedRange = {};
    var suppressions = [];
    var hints = [];
    var changeHandler = null;
    var docChangePending = false;
    var firstPass = true;

    var worker = new WorkerClient(["ace"], "ace/mode/latex_worker", "LatexWorker");
    worker.attachToDocument(doc);
    var docChangeHandler = doc.on("change", function () {
        docChangePending = true;
        if(changeHandler) {
            clearTimeout(changeHandler);
            changeHandler = null;
        }
    });

    var cursorHandler = selection.on("changeCursor", function () {
        if (docChangePending) { return; } ;
        changeHandler = setTimeout(function () {
            updateMarkers({cursorMoveOnly:true});
            suppressions = [];
            changeHandler = null;
        }, 100);
    });

    var updateMarkers = function (options) {
        if (!options) { options = {};};
        var cursorMoveOnly = options.cursorMoveOnly;
        var annotations = [];
        var newRange = {};
        var cursor = selection.getCursor();
        var maxRow = session.getLength() - 1;
        var maxCol = (maxRow > 0) ? session.getLine(maxRow).length : 0;
        var cursorAtEndOfDocument = (cursor.row == maxRow) && (cursor.column === maxCol);

        suppressions = [];

        for (var i = 0, len = hints.length; i<len; i++) {
            var hint = hints[i];

            var suppressedChanges = 0;
            var hintRange = new Range(hint.start_row, hint.start_col, hint.end_row, hint.end_col);

            var cursorInRange = hintRange.insideEnd(cursor.row, cursor.column);
            var cursorAtStart = hintRange.isStart(cursor.row, cursor.column - 1); // cursor after start not before
            var cursorAtEnd = hintRange.isEnd(cursor.row, cursor.column);
            if (hint.suppressIfEditing && (cursorAtStart || cursorAtEnd)) {
                suppressions.push(hintRange);
                if (!hint.suppressed) { suppressedChanges++; };
                hint.suppressed = true;
                continue;
            }
            var isCascadeError = false;
            for (var j = 0, suplen = suppressions.length; j < suplen; j++) {
                var badRange = suppressions[j];
                if (badRange.intersects(hintRange)) {
                    isCascadeError = true;
                    break;
                }
            }
            if(isCascadeError) {
                if (!hint.suppressed) { suppressedChanges++; };
                hint.suppressed = true;
                continue;
            };

            if (hint.suppressed) { suppressedChanges++; };
            hint.suppressed = false;

            annotations.push(hint);
            if (hint.type === "info") {
                continue;
            };
            var key = hintRange.toString() + (cursorInRange ? "+cursor" : "");
            newRange[key] = {hint: hint, cursorInRange: cursorInRange, range: hintRange};
        }
        for (key in newRange) {
            if (!savedRange[key]) {  // doesn't exist in already displayed errors
                var new_range = newRange[key].range;
                cursorInRange = newRange[key].cursorInRange;
                hint = newRange[key].hint;
                var errorAtStart = (hint.row === hint.start_row && hint.column === hint.start_col);
                var movableStart = (cursorInRange && !errorAtStart) && !cursorAtEndOfDocument;
                var movableEnd = (cursorInRange && errorAtStart) && !cursorAtEndOfDocument;
                var a = movableStart ? cursorAnchor : doc.createAnchor(new_range.start);
                var b = movableEnd ? cursorAnchor : doc.createAnchor(new_range.end);
                var range = new Range();
                range.start = a;
                range.end = b;
                var cssClass = "ace_error-marker";
                if (hint.type === "warning") { cssClass = "ace_highlight-marker"; };
                range.id = session.addMarker(range, cssClass, "text");
                savedRange[key] = range;
            }
        }
        for (key in savedRange) {
            if (!newRange[key]) {  // no longer present in list of errors to display
                range = savedRange[key];
                if (range.start !== cursorAnchor) { range.start.detach(); }
                if (range.end !== cursorAnchor) { range.end.detach(); }
                session.removeMarker(range.id);
                delete savedRange[key];
            }
        }
        if (!cursorMoveOnly || suppressedChanges) {
            if (firstPass) {
                if (annotations.length > 0) {
                    var originalAnnotations = session.getAnnotations();
                    session.setAnnotations(originalAnnotations.concat(annotations));
                };
                firstPass = false;
            } else {
                session.setAnnotations(annotations);
            }
        };

    };
    worker.on("lint", function(results) {
        if(docChangePending) { docChangePending = false; };
        hints = results.data.errors;
        if (hints.length > 100) {
            hints = hints.slice(0, 100); // limit to 100 errors
        };
        updateMarkers();
    });
    worker.on("terminate", function() {
        if(changeHandler) {
            clearTimeout(changeHandler);
            changeHandler = null;
        }
        doc.off("change", docChangeHandler);
        selection.off("changeCursor", cursorHandler);
        for (var key in savedRange) {
            var range = savedRange[key];
            if (range.start !== cursorAnchor) { range.start.detach(); }
            if (range.end !== cursorAnchor) { range.end.detach(); }
            session.removeMarker(range.id);
        }
        savedRange = {};
        hints = [];
        suppressions = [];
        session.clearAnnotations();
    });

    return worker;
};

var Mode = function() {
    this.HighlightRules = LatexHighlightRules;
    this.foldingRules = new LatexFoldMode();
    this.$behaviour = new LatexBehaviour();
    this.createWorker = createLatexWorker;
};
oop.inherits(Mode, TextMode);

(function() {
    this.type = "text";

    this.lineCommentStart = "%";

    this.$id = "ace/mode/latex";
}).call(Mode.prototype);

exports.Mode = Mode;

});
                (function() {
                    ace.require(["ace/mode/latex"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            
