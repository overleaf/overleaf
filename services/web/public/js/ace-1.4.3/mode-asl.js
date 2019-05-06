ace.define("ace/mode/doc_comment_highlight_rules",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var DocCommentHighlightRules = function() {
    this.$rules = {
        "start" : [ {
            token : "comment.doc.tag",
            regex : "@[\\w\\d_]+" // TODO: fix email addresses
        }, 
        DocCommentHighlightRules.getTagRule(),
        {
            defaultToken : "comment.doc",
            caseInsensitive: true
        }]
    };
};

oop.inherits(DocCommentHighlightRules, TextHighlightRules);

DocCommentHighlightRules.getTagRule = function(start) {
    return {
        token : "comment.doc.tag.storage.type",
        regex : "\\b(?:TODO|FIXME|XXX|HACK)\\b"
    };
};

DocCommentHighlightRules.getStartRule = function(start) {
    return {
        token : "comment.doc", // doc comment
        regex : "\\/\\*(?=\\*)",
        next  : start
    };
};

DocCommentHighlightRules.getEndRule = function (start) {
    return {
        token : "comment.doc", // closing comment
        regex : "\\*\\/",
        next  : start
    };
};


exports.DocCommentHighlightRules = DocCommentHighlightRules;

});

ace.define("ace/mode/asl_highlight_rules",[], function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var DocCommentHighlightRules = require("./doc_comment_highlight_rules").DocCommentHighlightRules;
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    var ASLHighlightRules = function() {
        var keywords = (
            "Default|DefinitionBlock|Device|Method|Else|ElseIf|For|Function|If|Include|Method|Return|" +
            "Scope|Switch|Case|While|Break|BreakPoint|Continue|NoOp|Wait"
        );

        var keywordOperators = (
            "Add|And|Decrement|Divide|Increment|Index|LAnd|LEqual|LGreater|LGreaterEqual|" +
            "LLess|LLessEqual|LNot|LNotEqual|LOr|Mod|Multiply|NAnd|NOr|Not|Or|RefOf|Revision|" +
            "ShiftLeft|ShiftRight|Subtract|XOr|DerefOf"
        );

        var buildinFunctions = (
            "AccessAs|Acquire|Alias|BankField|Buffer|Concatenate|ConcatenateResTemplate|" +
            "CondRefOf|Connection|CopyObject|CreateBitField|CreateByteField|CreateDWordField|" +
            "CreateField|CreateQWordField|CreateWordField|DataTableRegion|Debug|" +
            "DMA|DWordIO|DWordMemory|DWordSpace|EisaId|EISAID|EndDependentFn|Event|ExtendedIO|" +
            "ExtendedMemory|ExtendedSpace|External|Fatal|Field|FindSetLeftBit|FindSetRightBit|" +
            "FixedDMA|FixedIO|Fprintf|FromBCD|GpioInt|GpioIo|I2CSerialBusV2|IndexField|" +
            "Interrupt|IO|IRQ|IRQNoFlags|Load|LoadTable|Match|Memory32|Memory32Fixed|" +
            "Mid|Mutex|Name|Notify|Offset|ObjectType|OperationRegion|Package|PowerResource|Printf|" +
            "QWordIO|QWordMemory|QWordSpace|RawDataBuffer|Register|Release|Reset|ResourceTemplate|" +
            "Signal|SizeOf|Sleep|SPISerialBusV2|Stall|StartDependentFn|StartDependentFnNoPri|" +
            "Store|ThermalZone|Timer|ToBCD|ToBuffer|ToDecimalString|ToInteger|ToPLD|ToString|" +
            "ToUUID|UARTSerialBusV2|Unicode|Unload|VendorLong|VendorShort|WordBusNumber|WordIO|" +
            "WordSpace"
        );

        var flags = (
            "AttribQuick|AttribSendReceive|AttribByte|AttribBytes|AttribRawBytes|" +
            "AttribRawProcessBytes|AttribWord|AttribBlock|AttribProcessCall|AttribBlockProcessCall|" +
            "AnyAcc|ByteAcc|WordAcc|DWordAcc|QWordAcc|BufferAcc|" +
            "AddressRangeMemory|AddressRangeReserved|AddressRangeNVS|AddressRangeACPI|" +
            "RegionSpaceKeyword|FFixedHW|PCC|" +
            "AddressingMode7Bit|AddressingMode10Bit|" +
            "DataBitsFive|DataBitsSix|DataBitsSeven|DataBitsEight|DataBitsNine|" +
            "BusMaster|NotBusMaster|" +
            "ClockPhaseFirst|ClockPhaseSecond|ClockPolarityLow|ClockPolarityHigh|" +
            "SubDecode|PosDecode|" +
            "BigEndianing|LittleEndian|" +
            "FlowControlNone|FlowControlXon|FlowControlHardware|" +
            "Edge|Level|ActiveHigh|ActiveLow|ActiveBoth|Decode16|Decode10|" +
            "IoRestrictionNone|IoRestrictionInputOnly|IoRestrictionOutputOnly|" +
            "IoRestrictionNoneAndPreserve|Lock|NoLock|MTR|MEQ|MLE|MLT|MGE|MGT|" +
            "MaxFixed|MaxNotFixed|Cacheable|WriteCombining|Prefetchable|NonCacheable|" +
            "MinFixed|MinNotFixed|" +
            "ParityTypeNone|ParityTypeSpace|ParityTypeMark|ParityTypeOdd|ParityTypeEven|" +
            "PullDefault|PullUp|PullDown|PullNone|PolarityHigh|PolarityLow|" +
            "ISAOnlyRanges|NonISAOnlyRanges|EntireRange|ReadWrite|ReadOnly|" +
            "UserDefRegionSpace|SystemIO|SystemMemory|PCI_Config|EmbeddedControl|" +
            "SMBus|SystemCMOS|PciBarTarget|IPMI|GeneralPurposeIO|GenericSerialBus|" +
            "ResourceConsumer|ResourceProducer|Serialized|NotSerialized|" +
            "Shared|Exclusive|SharedAndWake|ExclusiveAndWake|ControllerInitiated|DeviceInitiated|" +
            "StopBitsZero|StopBitsOne|StopBitsOnePlusHalf|StopBitsTwo|" +
            "Width8Bit|Width16Bit|Width32Bit|Width64Bit|Width128Bit|Width256Bit|" +
            "SparseTranslation|DenseTranslation|TypeTranslation|TypeStatic|" +
            "Preserve|WriteAsOnes|WriteAsZeros|Transfer8|Transfer16|Transfer8_16|" +
            "ThreeWireMode|FourWireMode"
        );

        var storageTypes = (
            "UnknownObj|IntObj|StrObj|BuffObj|PkgObj|FieldUnitObj|DeviceObj|" +
            "EventObj|MethodObj|MutexObj|OpRegionObj|PowerResObj|ProcessorObj|" +
            "ThermalZoneObj|BuffFieldObj|DDBHandleObj"
        );

        var buildinConstants = (
            "__FILE__|__PATH__|__LINE__|__DATE__|__IASL__"
        );

        var deprecated = (
            "Memory24|Processor"
        );

        var keywordMapper = this.createKeywordMapper({
            "keyword": keywords,
            "keyword.operator": keywordOperators,
            "function.buildin": buildinFunctions,
            "constant.language": buildinConstants,
            "storage.type": storageTypes,
            "constant.character": flags,
            "invalid.deprecated": deprecated
        }, "identifier");

        this.$rules = {
            "start" : [
                {
                    token : "comment",
                    regex : "\\/\\/.*$"
                },
                DocCommentHighlightRules.getStartRule("doc-start"),
                {
                    token : "comment", // multi line comment
                    regex : "\\/\\*",
                    next : "comment"
                },
                DocCommentHighlightRules.getStartRule("doc-start"),
                {
                    token : "comment", // ignored fields / comments
                    regex : "\\\[",
                    next : "ignoredfield"
                }, {
                    token : "variable",
                    regex : "\\Local[0-7]|\\Arg[0-6]"
                }, {
                    token : "keyword", // pre-compiler directives
                    regex : "#\\s*(?:define|elif|else|endif|error|if|ifdef|ifndef|include|includebuffer|line|pragma|undef|warning)\\b",
                    next  : "directive"
                }, {
                    token : "string", // single line
                    regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
                }, {
                    token : "constant.character", // single line
                    regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
                }, {
                    token : "constant.numeric", // hex
                    regex : /0[xX][0-9a-fA-F]+\b/
                }, {
                    token : "constant.numeric",
                    regex : /(One(s)?|Zero|True|False|[0-9]+)\b/
                }, {
                    token : keywordMapper,
                    regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
                }, {
                    token : "keyword.operator",
                    regex : "/|!|\\$|%|&|\\||\\*|\\-\\-|\\-|\\+\\+|\\+|~|==|=|!=|\\^|<=|>=|<<=|>>=|>>>=|<>|<|>|!|&&|\\|\\||\\?\\:|\\*=|%=|\\+=|\\-=|&=|\\^=|\\|="
                }, {
                    token : "lparen",
                    regex : "[[({]"
                }, {
                    token : "rparen",
                    regex : "[\\])}]"
                }, {
                    token : "text",
                    regex : "\\s+"
                }
            ],
            "comment" : [
                {
                    token : "comment", // closing comment
                    regex : "\\*\\/",
                    next : "start"
                }, {
                    defaultToken : "comment"
                }
            ],
            "ignoredfield" : [
                {
                    token : "comment", // closing ignored fields / comments
                    regex : "\\\]",
                    next : "start"
                }, {
                    defaultToken : "comment"
                }
            ],
            "directive" : [
                {
                    token : "constant.other.multiline",
                    regex : /\\/
                },
                {
                    token : "constant.other.multiline",
                    regex : /.*\\/
                },
                {
                    token : "constant.other",
                    regex : "\\s*<.+?>*s",
                    next : "start"
                },
                {
                    token : "constant.other", // single line
                    regex : '\\s*["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]*s',
                    next : "start"
                },
                {
                    token : "constant.other", // single line
                    regex : "\\s*['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']",
                    next : "start"
                },
                {
                    token : "constant.other",
                    regex : /[^\\\/]+/,
                    next : "start"
                }
            ]
        };

        this.embedRules(DocCommentHighlightRules, "doc-",
            [ DocCommentHighlightRules.getEndRule("start") ]);
    };

    oop.inherits(ASLHighlightRules, TextHighlightRules);

    exports.ASLHighlightRules = ASLHighlightRules;
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

ace.define("ace/mode/asl",[], function (require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var ASLHighlightRules = require("./asl_highlight_rules").ASLHighlightRules;
    var FoldMode = require("./folding/cstyle").FoldMode;

    var Mode = function () {
        this.HighlightRules = ASLHighlightRules;
        this.foldingRules = new FoldMode();
        this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);

    (function () {
        this.$id = "ace/mode/asl";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
                (function() {
                    ace.require(["ace/mode/asl"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            