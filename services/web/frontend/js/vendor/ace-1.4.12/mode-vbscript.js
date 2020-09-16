ace.define("ace/mode/vbscript_highlight_rules",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var VBScriptHighlightRules = function() {

    var keywordMapper = this.createKeywordMapper({
        "keyword.control.asp":  "If|Then|Else|ElseIf|End|While|Wend|For|To|Each|Case|Select|Return"
            + "|Continue|Do|Until|Loop|Next|With|Exit|Function|Property|Type|Enum|Sub|IIf|Class",
        "storage.type.asp": "Dim|Call|Const|Redim|Set|Let|Get|New|Randomize|Option|Explicit|Preserve|Erase|Execute|ExecuteGlobal",
        "storage.modifier.asp": "Private|Public|Default",
        "keyword.operator.asp": "Mod|And|Not|Or|Xor|As|Eqv|Imp|Is",
        "constant.language.asp": "Empty|False|Nothing|Null|True",
        "variable.language.vb.asp": "Me",
        "support.class.vb.asp": "RegExp",
        "support.class.asp": "Application|ObjectContext|Request|Response|Server|Session",
        "support.class.collection.asp": "Contents|StaticObjects|ClientCertificate|Cookies|Form|QueryString|ServerVariables",
        "support.constant.asp": "TotalBytes|Buffer|CacheControl|Charset|ContentType|Expires|ExpiresAbsolute"
            + "|IsClientConnected|PICS|Status|ScriptTimeout|CodePage|LCID|SessionID|Timeout",
        "support.function.asp": "Lock|Unlock|SetAbort|SetComplete|BinaryRead|AddHeader|AppendToLog"
            + "|BinaryWrite|Clear|Flush|Redirect|Write|CreateObject|HTMLEncode|MapPath|URLEncode|Abandon|Convert|Regex",
        "support.function.event.asp": "Application_OnEnd|Application_OnStart"
            + "|OnTransactionAbort|OnTransactionCommit|Session_OnEnd|Session_OnStart",
        "support.function.vb.asp": "Array|Add|Asc|Atn|CBool|CByte|CCur|CDate|CDbl|Chr|CInt|CLng"
            + "|Conversions|Cos|CreateObject|CSng|CStr|Date|DateAdd|DateDiff|DatePart|DateSerial"
            + "|DateValue|Day|Derived|Math|Escape|Eval|Exists|Exp|Filter|FormatCurrency"
            + "|FormatDateTime|FormatNumber|FormatPercent|GetLocale|GetObject|GetRef|Hex"
            + "|Hour|InputBox|InStr|InStrRev|Int|Fix|IsArray|IsDate|IsEmpty|IsNull|IsNumeric"
            + "|IsObject|Item|Items|Join|Keys|LBound|LCase|Left|Len|LoadPicture|Log|LTrim|RTrim"
            + "|Trim|Maths|Mid|Minute|Month|MonthName|MsgBox|Now|Oct|Remove|RemoveAll|Replace"
            + "|RGB|Right|Rnd|Round|ScriptEngine|ScriptEngineBuildVersion|ScriptEngineMajorVersion"
            + "|ScriptEngineMinorVersion|Second|SetLocale|Sgn|Sin|Space|Split|Sqr|StrComp|String|StrReverse"
            + "|Tan|Time|Timer|TimeSerial|TimeValue|TypeName|UBound|UCase|Unescape|VarType|Weekday|WeekdayName|Year"
            + "|AscB|AscW|ChrB|ChrW|InStrB|LeftB|LenB|MidB|RightB|Abs|GetUILanguage",
        "support.type.vb.asp": "vbTrue|vbFalse|vbCr|vbCrLf|vbFormFeed|vbLf|vbNewLine|vbNullChar|vbNullString"
            + "|vbTab|vbVerticalTab|vbBinaryCompare|vbTextCompare|vbSunday|vbMonday|vbTuesday|vbWednesday"
            + "|vbThursday|vbFriday|vbSaturday|vbUseSystemDayOfWeek|vbFirstJan1|vbFirstFourDays|vbFirstFullWeek"
            + "|vbGeneralDate|vbLongDate|vbShortDate|vbLongTime|vbShortTime|vbObjectError|vbEmpty|vbNull|vbInteger"
            + "|vbLong|vbSingle|vbDouble|vbCurrency|vbDate|vbString|vbObject|vbError|vbBoolean|vbVariant"
            + "|vbDataObject|vbDecimal|vbByte|vbArray|vbOKOnly|vbOKCancel|vbAbortRetryIgnore|vbYesNoCancel|vbYesNo"
            + "|vbRetryCancel|vbCritical|vbQuestion|vbExclamation|vbInformation|vbDefaultButton1|vbDefaultButton2"
            + "|vbDefaultButton3|vbDefaultButton4|vbApplicationModal|vbSystemModal|vbOK|vbCancel|vbAbort|vbRetry|vbIgnore|vbYes|vbNo"
            + "|vbUseDefault"
    }, "identifier", true);

    this.$rules = {
    "start": [
        {
            token: [
                "meta.ending-space"
            ],
            regex: "$"
        },
        {
            token: [null],
            regex: "^(?=\\t)",
            next: "state_3"
        },
        {
            token: [null],
            regex: "^(?= )",
            next: "state_4"
        },
        {
            token: [
                "text",
                "storage.type.function.asp",
                "text",
                "entity.name.function.asp",
                "text",
                "punctuation.definition.parameters.asp",
                "variable.parameter.function.asp",
                "punctuation.definition.parameters.asp"
            ],
            regex: "^(\\s*)(Function|Sub)(\\s+)([a-zA-Z_]\\w*)(\\s*)(\\()([^)]*)(\\))"
        },
        {
            token: "punctuation.definition.comment.asp",
            regex: "'|REM(?=\\s|$)",
            next: "comment",
            caseInsensitive: true
        },
        {
            token: "storage.type.asp",
            regex: "On\\s+Error\\s+(?:Resume\\s+Next|GoTo)\\b",
            caseInsensitive: true
        },
        {
            token: "punctuation.definition.string.begin.asp",
            regex: '"',
            next: "string"
        },
        {
            token: [
                "punctuation.definition.variable.asp"
            ],
            regex: "(\\$)[a-zA-Z_x7f-xff][a-zA-Z0-9_x7f-xff]*?\\b\\s*"
        },
        {
            token: "constant.numeric.asp",
            regex: "-?\\b(?:(?:0(?:x|X)[0-9a-fA-F]*)|(?:(?:[0-9]+\\.?[0-9]*)|(?:\\.[0-9]+))(?:(?:e|E)(?:\\+|-)?[0-9]+)?)(?:L|l|UL|ul|u|U|F|f)?\\b"
        },
        {
            regex: "\\w+",
            token: keywordMapper
        },
        {
            token: ["entity.name.function.asp"],
            regex: "(?:(\\b[a-zA-Z_x7f-xff][a-zA-Z0-9_x7f-xff]*?\\b)(?=\\(\\)?))"
        },
        {
            token: ["keyword.operator.asp"],
            regex: "\\-|\\+|\\*|\\/|\\>|\\<|\\=|\\&|\\\\|\\^"
        }
    ],
    "state_3": [
        {
            token: [
                "meta.odd-tab.tabs",
                "meta.even-tab.tabs"
            ],
            regex: "(\\t)(\\t)?"
        },
        {
            token: "meta.leading-space",
            regex: "(?=[^\\t])",
            next: "start"
        },
        {
            token: "meta.leading-space",
            regex: ".",
            next: "state_3"
        }
    ],
    "state_4": [
        {
            token: ["meta.odd-tab.spaces", "meta.even-tab.spaces"],
            regex: "(  )(  )?"
        },
        {
            token: "meta.leading-space",
            regex: "(?=[^ ])",
            next: "start"
        },
        {
            defaultToken: "meta.leading-space"
        }
    ],
    "comment": [
        {
            token: "comment.line.apostrophe.asp",
            regex: "$",
            next: "start"
        },
        {
            defaultToken: "comment.line.apostrophe.asp"
        }
    ],
    "string": [
        {
            token: "constant.character.escape.apostrophe.asp",
            regex: '""'
        },
        {
            token: "string.quoted.double.asp",
            regex: '"',
            next: "start"
        },
        {
            defaultToken: "string.quoted.double.asp"
        }
    ]
};

};

oop.inherits(VBScriptHighlightRules, TextHighlightRules);

exports.VBScriptHighlightRules = VBScriptHighlightRules;
});

ace.define("ace/mode/folding/vbscript",[], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var BaseFoldMode = require("./fold_mode").FoldMode;
var Range = require("../../range").Range;
var TokenIterator = require("../../token_iterator").TokenIterator;


var FoldMode = exports.FoldMode = function() {};

oop.inherits(FoldMode, BaseFoldMode);

(function() {
    this.indentKeywords = {
        "class": 1,
        "function": 1,
        "sub": 1,
        "if": 1,
        "select": 1,
        "do": 1,
        "for": 1,
        "while": 1,
        "with": 1,
        "property": 1,
        "else": 1,
        "elseif": 1,
        "end": -1,
        "loop": -1,
        "next": -1,
        "wend": -1
    };

    this.foldingStartMarker = /(?:\s|^)(class|function|sub|if|select|do|for|while|with|property|else|elseif)\b/i;
    this.foldingStopMarker = /\b(end|loop|next|wend)\b/i;

    this.getFoldWidgetRange = function (session, foldStyle, row) {
        var line = session.getLine(row);
        var isStart = this.foldingStartMarker.test(line);
        var isEnd = this.foldingStopMarker.test(line);
        if (isStart || isEnd) {
            var match = (isEnd) ? this.foldingStopMarker.exec(line) : this.foldingStartMarker.exec(line);
            var keyword = match && match[1].toLowerCase();
            if (keyword) {
                var type = session.getTokenAt(row, match.index + 2).type;
                if (type === "keyword.control.asp" || type === "storage.type.function.asp")
                    return this.vbsBlock(session, row, match.index + 2);
            }
        }
    };
    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row);
        var isStart = this.foldingStartMarker.test(line);
        var isEnd = this.foldingStopMarker.test(line);
        if (isStart && !isEnd) {
            var match = this.foldingStartMarker.exec(line);
            var keyword = match && match[1].toLowerCase();
            if (keyword) {
                var type = session.getTokenAt(row, match.index + 2).type;
                if (type == "keyword.control.asp" || type == "storage.type.function.asp") {
                    if (keyword == "if" && !/then\s*('|$)/i.test(line))
                        return "";
                    return "start";
                }
            }
        }
        return "";
    };

    this.vbsBlock = function(session, row, column, tokenRange) {
        var stream = new TokenIterator(session, row, column);

        var endOpenings = {
            "class": 1,
            "function": 1,
            "sub": 1,
            "if": 1,
            "select": 1,
            "with": 1,
            "property": 1,
            "else": 1,
            "elseif": 1
        };

        var token = stream.getCurrentToken();
        if (!token || (token.type != "keyword.control.asp" && token.type != "storage.type.function.asp"))
            return;

        var startTokenValue = token.value.toLowerCase();
        var val = token.value.toLowerCase();

        var stack = [val];
        var dir = this.indentKeywords[val];

        if (!dir)
            return;

        var firstRange = stream.getCurrentTokenRange();
        switch (val) {
            case "property":
            case "sub":
            case "function":
            case "if":
            case "select":
            case "do":
            case "for":
            case "class":
            case "while":
            case "with":
                var line = session.getLine(row);
                var singleLineCondition = /^\s*If\s+.*\s+Then(?!')\s+(?!')\S/i.test(line);
                if (singleLineCondition)
                    return;
                var checkToken = new RegExp("(?:^|\\s)" + val, "i");
                var endTest = /^\s*End\s(If|Sub|Select|Function|Class|With|Property)\s*/i.test(line);
                if (!checkToken.test(line) && !endTest) {
                    return;
                }
                if (endTest) {
                    var tokenRange = stream.getCurrentTokenRange();
                    stream.step = stream.stepBackward;
                    stream.step();
                    stream.step();
                    token = stream.getCurrentToken();
                    if (token) {
                        val = token.value.toLowerCase();
                        if (val == "end") {
                            firstRange = stream.getCurrentTokenRange();
                            firstRange = new Range(firstRange.start.row, firstRange.start.column, tokenRange.start.row, tokenRange.end.column);
                        }
                    }
                    dir = -1;
                }
                break;
            case "end":
                var tokenPos = stream.getCurrentTokenPosition();
                firstRange = stream.getCurrentTokenRange();
                stream.step = stream.stepForward;
                stream.step();
                stream.step();
                token = stream.getCurrentToken();
                if (token) {
                    val = token.value.toLowerCase();
                    if (val in endOpenings) {
                        startTokenValue = val;
                        var nextTokenPos = stream.getCurrentTokenPosition();
                        var endColumn = nextTokenPos.column + val.length;
                        firstRange = new Range(tokenPos.row, tokenPos.column, nextTokenPos.row, endColumn);
                    }
                }
                stream.step = stream.stepBackward;
                stream.step();
                stream.step();
                break;
        }
        var startColumn = dir === -1 ? session.getLine(row - 1).length : session.getLine(row).length;
        var startRow = row;
        var ranges = [];
        ranges.push(firstRange);

        stream.step = dir === -1 ? stream.stepBackward : stream.stepForward;
        while(token = stream.step()) {
            var outputRange = null;
            var ignore = false;
            if (token.type != "keyword.control.asp" && token.type != "storage.type.function.asp")
                continue;
            val = token.value.toLowerCase();
            var level = dir * this.indentKeywords[val];

            switch (val) {
                case "property":
                case "sub":
                case "function":
                case "if":
                case "select":
                case "do":
                case "for":
                case "class":
                case "while":
                case "with":
                    var line = session.getLine(stream.getCurrentTokenRow());
                    var singleLineCondition = /^\s*If\s+.*\s+Then(?!')\s+(?!')\S/i.test(line);
                    if (singleLineCondition) {
                        level = 0;
                        ignore = true;
                    }
                    var checkToken = new RegExp("^\\s* end\\s+" + val, "i");
                    if (checkToken.test(line)) {
                        level = 0;
                        ignore = true;
                    }
                    break;
                case "elseif":
                case "else":
                    level = 0;
                    if (startTokenValue != "elseif") {
                        ignore = true;
                    }
                    break;
            }

            if (level > 0) {
                stack.unshift(val);
            } else if (level <= 0 && ignore === false) {
                stack.shift();
                if (!stack.length) {
                        switch (val) {
                            case "end":
                                var tokenPos = stream.getCurrentTokenPosition();
                                outputRange = stream.getCurrentTokenRange();
                                stream.step();
                                stream.step();
                                token = stream.getCurrentToken();
                                if (token) {
                                    val = token.value.toLowerCase();
                                    if (val in endOpenings) {
                                        if ((startTokenValue == "else" || startTokenValue == "elseif")) {
                                            if (val !== "if") {
                                                ranges.shift();
                                            }
                                        } else {
                                            if (val != startTokenValue)
                                                ranges.shift();
                                        }
                                        var nextTokenPos = stream.getCurrentTokenPosition();
                                        var endColumn = nextTokenPos.column + val.length;
                                        outputRange = new Range(tokenPos.row, tokenPos.column, nextTokenPos.row, endColumn);
                                    } else {
                                        ranges.shift();
                                    }
                                } else {
                                    ranges.shift();
                                }
                                stream.step = stream.stepBackward;
                                stream.step();
                                stream.step();
                                token = stream.getCurrentToken();
                                val = token.value.toLowerCase();
                                break;
                            case "select":
                            case "sub":
                            case "if":
                            case "function":
                            case "class":
                            case "with":
                            case "property":
                                if (val != startTokenValue)
                                    ranges.shift();
                                break;
                            case "do":
                                if (startTokenValue != "loop")
                                    ranges.shift();
                                break;
                            case "loop":
                                if (startTokenValue != "do")
                                    ranges.shift();
                                break;
                            case "for":
                                if (startTokenValue != "next")
                                    ranges.shift();
                                break;
                            case "next":
                                if (startTokenValue != "for")
                                    ranges.shift();
                                break;
                            case "while":
                                if (startTokenValue != "wend")
                                    ranges.shift();
                                break;
                            case "wend":
                                if (startTokenValue != "while")
                                    ranges.shift();
                                break;
                        }
                        break;
                }

                if (level === 0){
                    stack.unshift(val);
                }
            }
        }

        if (!token)
            return null;

        if (tokenRange) {
            if (!outputRange) {
                ranges.push(stream.getCurrentTokenRange());
            } else {
                ranges.push(outputRange);
            }
            return ranges;
        }

        var row = stream.getCurrentTokenRow();
        if (dir === -1) {
            var endColumn = session.getLine(row).length;
            return new Range(row, endColumn, startRow - 1, startColumn);
        } else
            return new Range(startRow, startColumn, row - 1, session.getLine(row - 1).length);
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/vbscript",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var VBScriptHighlightRules = require("./vbscript_highlight_rules").VBScriptHighlightRules;
var FoldMode = require("./folding/vbscript").FoldMode;
var Range = require("../range").Range;

var Mode = function() {
    this.HighlightRules = VBScriptHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
    this.indentKeywords = this.foldingRules.indentKeywords;
};
oop.inherits(Mode, TextMode);

(function() {

    this.lineCommentStart = ["'", "REM"];

    var outdentKeywords = [
        "else",
        "elseif",
        "end",
        "loop",
        "next",
        "wend"
    ];

    function getNetIndentLevel(tokens, line, indentKeywords) {
        var level = 0;
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (token.type == "keyword.control.asp" || token.type == "storage.type.function.asp") {
                var val = token.value.toLowerCase();
                if (val in indentKeywords) {
                    switch (val) {
                        case "property":
                        case "sub":
                        case "function":
                        case "select":
                        case "do":
                        case "for":
                        case "class":
                        case "while":
                        case "with":
                        case "if":
                            var checkToken = new RegExp("^\\s* end\\s+" + val, "i");
                            var singleLineCondition = /^\s*If\s+.*\s+Then(?!')\s+(?!')\S/i.test(line);
                            if (!singleLineCondition && !checkToken.test(line))
                                level += indentKeywords[val];
                            break;
                        default:
                            level += indentKeywords[val];
                            break;
                    }
                }
            }
        }
        if (level < 0) {
            return -1;
        } else if (level > 0) {
            return 1;
        } else {
            return 0;
        }
    }

    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);
        var level = 0;

        var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;

        if (state == "start") {
            level = getNetIndentLevel(tokens, line, this.indentKeywords);
        }
        if (level > 0) {
            return indent + tab;
        } else if (level < 0 && indent.substr(indent.length - tab.length) == tab) {
            if (!this.checkOutdent(state, line, "\n")) {
                return indent.substr(0, indent.length - tab.length);
            }
        }
        return indent;
    };

    this.checkOutdent = function(state, line, input) {
        if (input != "\n" && input != "\r" && input != "\r\n")
            return false;

        var tokens = this.getTokenizer().getLineTokens(line.trim(), state).tokens;

        if (!tokens || !tokens.length)
            return false;
        var val = tokens[0].value.toLowerCase();
        return ((tokens[0].type == "keyword.control.asp" || tokens[0].type == "storage.type.function.asp") && outdentKeywords.indexOf(val) != -1);
    };

    this.getMatching = function(session, row, column, tokenRange) {
        if (row == undefined) {
            var pos = session.selection.lead;
            column = pos.column;
            row = pos.row;
        }
        if (tokenRange == undefined)
            tokenRange = true;

        var startToken = session.getTokenAt(row, column);
        if (startToken) {
            var val = startToken.value.toLowerCase();
            if (val in this.indentKeywords)
                return this.foldingRules.vbsBlock(session, row, column, tokenRange);
        }
    };

    this.autoOutdent = function(state, session, row) {
        var line = session.getLine(row);
        var column = line.match(/^\s*/)[0].length;
        if (!column || !row) return;

        var startRange = this.getMatching(session, row, column + 1, false);
        if (!startRange || startRange.start.row == row)
            return;
        var indent = this.$getIndent(session.getLine(startRange.start.row));
        if (indent.length != column) {
            session.replace(new Range(row, 0, row, column), indent);
            session.outdentRows(new Range(row + 1, 0, row + 1, 0));
        }
    };

    this.$id = "ace/mode/vbscript";
}).call(Mode.prototype);

exports.Mode = Mode;
});                (function() {
                    ace.require(["ace/mode/vbscript"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            