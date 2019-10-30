ace.define("ace/mode/puppet_highlight_rules",[], function (require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
var PuppetHighlightRules = function () {
    this.$rules = {
        "start": [
            {
                token: ['keyword.type.puppet', 'constant.class.puppet', 'keyword.inherits.puppet', 'constant.class.puppet'],
                regex: "^\\s*(class)(\\s+(?:[-_A-Za-z0-9\".]+::)*[-_A-Za-z0-9\".]+\\s*)(?:(inherits\\s*)(\\s+(?:[-_A-Za-z0-9\".]+::)*[-_A-Za-z0-9\".]+\\s*))?"
            },
            {
                token: ['storage.function.puppet', 'name.function.puppet', 'punctuation.lpar'],
                regex: "(^\\s*define)(\\s+[a-zA-Z0-9_:]+\\s*)(\\()",
                push:
                    [{
                        token: 'punctuation.rpar.puppet',
                        regex: "\\)",
                        next: 'pop'
                    },
                        {include: "constants"},
                        {include: "variable"},
                        {include: "strings"},
                        {include: "operators"},
                        {defaultToken: 'string'}]
            },
            {
                token: ["language.support.class", "keyword.operator"],
                regex: "\\b([a-zA-Z_]+)(\\s+=>)"
            },
            {
                token: ["exported.resource.puppet", "keyword.name.resource.puppet", "paren.lparen"],
                regex: "(\\@\\@)?(\\s*[a-zA-Z_]*)(\\s*\\{)"
            },
            {
                token: "qualified.variable.puppet",
                regex: "(\\$([a-z][a-z0-9_]*)?(::[a-z][a-z0-9_]*)*::[a-z0-9_][a-zA-Z0-9_]*)"
            },

            {
                token: "singleline.comment.puppet",
                regex: '#(.)*$'
            },
            {
                token: "multiline.comment.begin.puppet",
                regex: '^\\s*\\/\\*\\s*$',
                push: "blockComment"
            },
            {
                token: "keyword.control.puppet",
                regex: "\\b(case|if|unless|else|elsif|in|default:|and|or)\\s+(?!::)"
            },
            {
                token: "keyword.control.puppet",
                regex: "\\b(import|default|inherits|include|require|contain|node|application|consumes|environment|site|function|produces)\\b"
            },
            {
                token: "support.function.puppet",
                regex: "\\b(lest|str2bool|escape|gsub|Timestamp|Timespan|with|alert|crit|debug|notice|sprintf|split|step|strftime|slice|shellquote|type|sha1|defined|scanf|reverse_each|regsubst|return|emerg|reduce|err|failed|fail|versioncmp|file|generate|then|info|realize|search|tag|tagged|template|epp|warning|hiera_include|each|assert_type|binary_file|create_resources|dig|digest|filter|lookup|find_file|fqdn_rand|hiera_array|hiera_hash|inline_epp|inline_template|map|match|md5|new|next)\\b"
            },
            {
                token: "constant.types.puppet",
                regex: "\\b(String|File|Package|Service|Class|Integer|Array|Catalogentry|Variant|Boolean|Undef|Number|Hash|Float|Numeric|NotUndef|Callable|Optional|Any|Regexp|Sensitive|Sensitive.new|Type|Resource|Default|Enum|Scalar|Collection|Data|Pattern|Tuple|Struct)\\b"
            },

            {
                token: "paren.lparen",
                regex: "[[({]"
            },
            {
                token: "paren.rparen",
                regex: "[\\])}]"
            },
            {include: "variable"},
            {include: "constants"},
            {include: "strings"},
            {include: "operators"},
            {
                token: "regexp.begin.string.puppet",
                regex: "\\s*(\\/(\\S)+)\\/"
            }
        ],
        blockComment: [{
            regex: "^\\s*\\/\\*\\s*$",
            token: "multiline.comment.begin.puppet",
            push: "blockComment"
        }, {
            regex: "^\\s*\\*\\/\\s*$",
            token: "multiline.comment.end.puppet",
            next: "pop"
        }, {
            defaultToken: "comment"
        }],
        "constants": [
            {
                token: "constant.language.puppet",
                regex: "\\b(false|true|running|stopped|installed|purged|latest|file|directory|held|undef|present|absent|link|mounted|unmounted)\\b"
            }
        ],
        "variable": [
            {
                token: "variable.puppet",
                regex: "(\\$[a-z0-9_\{][a-zA-Z0-9_]*)"
            }
        ],
        "strings": [
            {
                token: "punctuation.quote.puppet",
                regex: "'",
                push:
                    [{
                        token: 'punctuation.quote.puppet',
                        regex: "'",
                        next: 'pop'
                    },
                        {include: "escaped_chars"},
                        {defaultToken: 'string'}]
            },
            {
                token: "punctuation.quote.puppet",
                regex: '"',
                push:
                    [{
                        token: 'punctuation.quote.puppet',
                        regex: '"',
                        next: 'pop'
                    },
                        {include: "escaped_chars"},
                        {include: "variable"},
                        {defaultToken: 'string'}]
            }
        ],
        "escaped_chars": [
            {
                token: "constant.escaped_char.puppet",
                regex: "\\\\."
            }
        ],
        "operators": [
            {
                token: "keyword.operator",
                regex: "\\+\\.|\\-\\.|\\*\\.|\\/\\.|#|;;|\\+|\\-|\\*|\\*\\*\\/|\\/\\/|%|<<|>>|&|\\||\\^|~|<|>|<=|=>|==|!=|<>|<-|=|::|,"
            }
        ]
    };
    this.normalizeRules();
};


oop.inherits(PuppetHighlightRules, TextHighlightRules);

exports.PuppetHighlightRules = PuppetHighlightRules;
});

ace.define("ace/mode/folding/cstyle",[], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var Range = require("../../range").Range;
var BaseFoldMode = require("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function(commentRegex) {
    if (commentRegex) {
        this.foldingStartMarker = new RegExp(
            this.foldingStartMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.start)
        );
        this.foldingStopMarker = new RegExp(
            this.foldingStopMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.end)
        );
    }
};
oop.inherits(FoldMode, BaseFoldMode);

(function() {
    
    this.foldingStartMarker = /([\{\[\(])[^\}\]\)]*$|^\s*(\/\*)/;
    this.foldingStopMarker = /^[^\[\{\(]*([\}\]\)])|^[\s\*]*(\*\/)/;
    this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
    this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
    this.startRegionRe = /^\s*(\/\*|\/\/)#?region\b/;
    this._getFoldWidgetBase = this.getFoldWidget;
    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row);
    
        if (this.singleLineBlockCommentRe.test(line)) {
            if (!this.startRegionRe.test(line) && !this.tripleStarBlockCommentRe.test(line))
                return "";
        }
    
        var fw = this._getFoldWidgetBase(session, foldStyle, row);
    
        if (!fw && this.startRegionRe.test(line))
            return "start"; // lineCommentRegionStart
    
        return fw;
    };

    this.getFoldWidgetRange = function(session, foldStyle, row, forceMultiline) {
        var line = session.getLine(row);
        
        if (this.startRegionRe.test(line))
            return this.getCommentRegionBlock(session, line, row);
        
        var match = line.match(this.foldingStartMarker);
        if (match) {
            var i = match.index;

            if (match[1])
                return this.openingBracketBlock(session, match[1], row, i);
                
            var range = session.getCommentFoldRange(row, i + match[0].length, 1);
            
            if (range && !range.isMultiLine()) {
                if (forceMultiline) {
                    range = this.getSectionRange(session, row);
                } else if (foldStyle != "all")
                    range = null;
            }
            
            return range;
        }

        if (foldStyle === "markbegin")
            return;

        var match = line.match(this.foldingStopMarker);
        if (match) {
            var i = match.index + match[0].length;

            if (match[1])
                return this.closingBracketBlock(session, match[1], row, i);

            return session.getCommentFoldRange(row, i, -1);
        }
    };
    
    this.getSectionRange = function(session, row) {
        var line = session.getLine(row);
        var startIndent = line.search(/\S/);
        var startRow = row;
        var startColumn = line.length;
        row = row + 1;
        var endRow = row;
        var maxRow = session.getLength();
        while (++row < maxRow) {
            line = session.getLine(row);
            var indent = line.search(/\S/);
            if (indent === -1)
                continue;
            if  (startIndent > indent)
                break;
            var subRange = this.getFoldWidgetRange(session, "all", row);
            
            if (subRange) {
                if (subRange.start.row <= startRow) {
                    break;
                } else if (subRange.isMultiLine()) {
                    row = subRange.end.row;
                } else if (startIndent == indent) {
                    break;
                }
            }
            endRow = row;
        }
        
        return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
    };
    this.getCommentRegionBlock = function(session, line, row) {
        var startColumn = line.search(/\s*$/);
        var maxRow = session.getLength();
        var startRow = row;
        
        var re = /^\s*(?:\/\*|\/\/|--)#?(end)?region\b/;
        var depth = 1;
        while (++row < maxRow) {
            line = session.getLine(row);
            var m = re.exec(line);
            if (!m) continue;
            if (m[1]) depth--;
            else depth++;

            if (!depth) break;
        }

        var endRow = row;
        if (endRow > startRow) {
            return new Range(startRow, startColumn, endRow, line.length);
        }
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/matching_brace_outdent",[], function(require, exports, module) {
"use strict";

var Range = require("../range").Range;

var MatchingBraceOutdent = function() {};

(function() {

    this.checkOutdent = function(line, input) {
        if (! /^\s+$/.test(line))
            return false;

        return /^\s*\}/.test(input);
    };

    this.autoOutdent = function(doc, row) {
        var line = doc.getLine(row);
        var match = line.match(/^(\s*\})/);

        if (!match) return 0;

        var column = match[1].length;
        var openBracePos = doc.findMatchingBracket({row: row, column: column});

        if (!openBracePos || openBracePos.row == row) return 0;

        var indent = this.$getIndent(doc.getLine(openBracePos.row));
        doc.replace(new Range(row, 0, row, column-1), indent);
    };

    this.$getIndent = function(line) {
        return line.match(/^\s*/)[0];
    };

}).call(MatchingBraceOutdent.prototype);

exports.MatchingBraceOutdent = MatchingBraceOutdent;
});

ace.define("ace/mode/puppet",[], function (require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var PuppetHighlightRules = require("./puppet_highlight_rules").PuppetHighlightRules;
var CstyleBehaviour = require("./behaviour/cstyle").CstyleBehaviour;
var CStyleFoldMode = require("./folding/cstyle").FoldMode;
var MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;

var Mode = function () {
    TextMode.call(this);
    this.HighlightRules = PuppetHighlightRules;
    this.$outdent = new MatchingBraceOutdent();
    this.$behaviour = new CstyleBehaviour();
    this.foldingRules = new CStyleFoldMode();
};

oop.inherits(Mode, TextMode);


(function () {
    this.$id = "ace/mode/puppet";
}).call(Mode.prototype);

exports.Mode = Mode;
});
                (function() {
                    ace.require(["ace/mode/puppet"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            