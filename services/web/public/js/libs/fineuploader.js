/**
 * http://github.com/Valums-File-Uploader/file-uploader
 *
 * Multiple file upload component with progress-bar, drag-and-drop, support for all modern browsers.
 *
 * Original version: 1.0 © 2010 Andrew Valums ( andrew(at)valums.com )
 * Current Maintainer (2.0+): © 2012, Ray Nicholus ( fineuploader(at)garstasio.com )
 *
 * Licensed under MIT license, GNU GPL 2 or later, GNU LGPL 2 or later, see license.txt.
 */
/*globals window, navigator, document, FormData, File, HTMLInputElement, XMLHttpRequest, Blob*/
var qq = function(element) {
    "use strict";

    return {
        hide: function() {
            element.style.display = 'none';
            return this;
        },

        /** Returns the function which detaches attached event */
        attach: function(type, fn) {
            if (element.addEventListener){
                element.addEventListener(type, fn, false);
            } else if (element.attachEvent){
                element.attachEvent('on' + type, fn);
            }
            return function() {
                qq(element).detach(type, fn);
            };
        },

        detach: function(type, fn) {
            if (element.removeEventListener){
                element.removeEventListener(type, fn, false);
            } else if (element.attachEvent){
                element.detachEvent('on' + type, fn);
            }
            return this;
        },

        contains: function(descendant) {
            // compareposition returns false in this case
            if (element === descendant) {
                return true;
            }

            if (element.contains){
                return element.contains(descendant);
            } else {
                /*jslint bitwise: true*/
                return !!(descendant.compareDocumentPosition(element) & 8);
            }
        },

        /**
         * Insert this element before elementB.
         */
        insertBefore: function(elementB) {
            elementB.parentNode.insertBefore(element, elementB);
            return this;
        },

        remove: function() {
            element.parentNode.removeChild(element);
            return this;
        },

        /**
         * Sets styles for an element.
         * Fixes opacity in IE6-8.
         */
        css: function(styles) {
            if (styles.opacity !== null){
                if (typeof element.style.opacity !== 'string' && typeof(element.filters) !== 'undefined'){
                    styles.filter = 'alpha(opacity=' + Math.round(100 * styles.opacity) + ')';
                }
            }
            qq.extend(element.style, styles);

            return this;
        },

        hasClass: function(name) {
            var re = new RegExp('(^| )' + name + '( |$)');
            return re.test(element.className);
        },

        addClass: function(name) {
            if (!qq(element).hasClass(name)){
                element.className += ' ' + name;
            }
            return this;
        },

        removeClass: function(name) {
            var re = new RegExp('(^| )' + name + '( |$)');
            element.className = element.className.replace(re, ' ').replace(/^\s+|\s+$/g, "");
            return this;
        },

        getByClass: function(className) {
            var candidates,
                result = [];

            if (element.querySelectorAll){
                return element.querySelectorAll('.' + className);
            }

            candidates = element.getElementsByTagName("*");

            qq.each(candidates, function(idx, val) {
                if (qq(val).hasClass(className)){
                    result.push(val);
                }
            });
            return result;
        },

        children: function() {
            var children = [],
                child = element.firstChild;

            while (child){
                if (child.nodeType === 1){
                    children.push(child);
                }
                child = child.nextSibling;
            }

            return children;
        },

        setText: function(text) {
            element.innerText = text;
            element.textContent = text;
            return this;
        },

        clearText: function() {
            return qq(element).setText("");
        }
    };
};

qq.log = function(message, level) {
    "use strict";

    if (window.console) {
        if (!level || level === 'info') {
            window.console.log(message);
        }
        else
        {
            if (window.console[level]) {
                window.console[level](message);
            }
            else {
                window.console.log('<' + level + '> ' + message);
            }
        }
    }
};

qq.isObject = function(variable) {
    "use strict";
    return variable !== null && variable && typeof(variable) === "object" && variable.constructor === Object;
};

qq.isFunction = function(variable) {
    "use strict";
    return typeof(variable) === "function";
};

qq.trimStr = function(string) {
    if (String.prototype.trim) {
        return string.trim();
    }

    return string.replace(/^\s+|\s+$/g,'');
};

qq.isFileOrInput = function(maybeFileOrInput) {
    "use strict";
    if (qq.isBlob(maybeFileOrInput) && window.File && maybeFileOrInput instanceof File) {
        return true;
    }
    else if (window.HTMLInputElement) {
        if (maybeFileOrInput instanceof HTMLInputElement) {
            if (maybeFileOrInput.type && maybeFileOrInput.type.toLowerCase() === 'file') {
                return true;
            }
        }
    }
    else if (maybeFileOrInput.tagName) {
        if (maybeFileOrInput.tagName.toLowerCase() === 'input') {
            if (maybeFileOrInput.type && maybeFileOrInput.type.toLowerCase() === 'file') {
                return true;
            }
        }
    }

    return false;
};

qq.isBlob = function(maybeBlob) {
    "use strict";
    return window.Blob && maybeBlob instanceof Blob;
};

qq.isXhrUploadSupported = function() {
    "use strict";
    var input = document.createElement('input');
    input.type = 'file';

    return (
        input.multiple !== undefined &&
            typeof File !== "undefined" &&
            typeof FormData !== "undefined" &&
            typeof (new XMLHttpRequest()).upload !== "undefined" );
};

qq.isFolderDropSupported = function(dataTransfer) {
    "use strict";
    return (dataTransfer.items && dataTransfer.items[0].webkitGetAsEntry);
};

qq.isFileChunkingSupported = function() {
    "use strict";
    return !qq.android() && //android's impl of Blob.slice is broken
        qq.isXhrUploadSupported() &&
        (File.prototype.slice || File.prototype.webkitSlice || File.prototype.mozSlice);
};

qq.extend = function (first, second, extendNested) {
    "use strict";
    qq.each(second, function(prop, val) {
        if (extendNested && qq.isObject(val)) {
            if (first[prop] === undefined) {
                first[prop] = {};
            }
            qq.extend(first[prop], val, true);
        }
        else {
            first[prop] = val;
        }
    });
};

/**
 * Searches for a given element in the array, returns -1 if it is not present.
 * @param {Number} [from] The index at which to begin the search
 */
qq.indexOf = function(arr, elt, from){
    "use strict";

    if (arr.indexOf) {
        return arr.indexOf(elt, from);
    }

    from = from || 0;
    var len = arr.length;

    if (from < 0) {
        from += len;
    }

    for (; from < len; from+=1){
        if (arr.hasOwnProperty(from) && arr[from] === elt){
            return from;
        }
    }
    return -1;
};

//this is a version 4 UUID
qq.getUniqueId = function(){
    "use strict";

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        /*jslint eqeq: true, bitwise: true*/
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
};

//
// Browsers and platforms detection

qq.ie       = function(){
    "use strict";
    return navigator.userAgent.indexOf('MSIE') !== -1;
};
qq.ie10     = function(){
    "use strict";
    return navigator.userAgent.indexOf('MSIE 10') !== -1;
};
qq.safari   = function(){
    "use strict";
    return navigator.vendor !== undefined && navigator.vendor.indexOf("Apple") !== -1;
};
qq.chrome   = function(){
    "use strict";
    return navigator.vendor !== undefined && navigator.vendor.indexOf('Google') !== -1;
};
qq.firefox  = function(){
    "use strict";
    return (navigator.userAgent.indexOf('Mozilla') !== -1 && navigator.vendor !== undefined && navigator.vendor === '');
};
qq.windows  = function(){
    "use strict";
    return navigator.platform === "Win32";
};
qq.android = function(){
    "use strict";
    return navigator.userAgent.toLowerCase().indexOf('android') !== -1;
};

//
// Events

qq.preventDefault = function(e){
    "use strict";
    if (e.preventDefault){
        e.preventDefault();
    } else{
        e.returnValue = false;
    }
};

/**
 * Creates and returns element from html string
 * Uses innerHTML to create an element
 */
qq.toElement = (function(){
    "use strict";
    var div = document.createElement('div');
    return function(html){
        div.innerHTML = html;
        var element = div.firstChild;
        div.removeChild(element);
        return element;
    };
}());

//key and value are passed to callback for each item in the object or array
qq.each = function(obj, callback) {
    "use strict";
    var key, retVal;
    if (obj) {
        for (key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                retVal = callback(key, obj[key]);
                if (retVal === false) {
                    break;
                }
            }
        }
    }
};

/**
 * obj2url() takes a json-object as argument and generates
 * a querystring. pretty much like jQuery.param()
 *
 * how to use:
 *
 *    `qq.obj2url({a:'b',c:'d'},'http://any.url/upload?otherParam=value');`
 *
 * will result in:
 *
 *    `http://any.url/upload?otherParam=value&a=b&c=d`
 *
 * @param  Object JSON-Object
 * @param  String current querystring-part
 * @return String encoded querystring
 */
qq.obj2url = function(obj, temp, prefixDone){
    "use strict";
    /*jshint laxbreak: true*/
     var i, len,
         uristrings = [],
         prefix = '&',
         add = function(nextObj, i){
            var nextTemp = temp
                ? (/\[\]$/.test(temp)) // prevent double-encoding
                ? temp
                : temp+'['+i+']'
                : i;
            if ((nextTemp !== 'undefined') && (i !== 'undefined')) {
                uristrings.push(
                    (typeof nextObj === 'object')
                        ? qq.obj2url(nextObj, nextTemp, true)
                        : (Object.prototype.toString.call(nextObj) === '[object Function]')
                        ? encodeURIComponent(nextTemp) + '=' + encodeURIComponent(nextObj())
                        : encodeURIComponent(nextTemp) + '=' + encodeURIComponent(nextObj)
                );
            }
        };

    if (!prefixDone && temp) {
        prefix = (/\?/.test(temp)) ? (/\?$/.test(temp)) ? '' : '&' : '?';
        uristrings.push(temp);
        uristrings.push(qq.obj2url(obj));
    } else if ((Object.prototype.toString.call(obj) === '[object Array]') && (typeof obj !== 'undefined') ) {
        // we wont use a for-in-loop on an array (performance)
        for (i = -1, len = obj.length; i < len; i+=1){
            add(obj[i], i);
        }
    } else if ((typeof obj !== 'undefined') && (obj !== null) && (typeof obj === "object")){
        // for anything else but a scalar, we will use for-in-loop
        for (i in obj){
            if (obj.hasOwnProperty(i)) {
                add(obj[i], i);
            }
        }
    } else {
        uristrings.push(encodeURIComponent(temp) + '=' + encodeURIComponent(obj));
    }

    if (temp) {
        return uristrings.join(prefix);
    } else {
        return uristrings.join(prefix)
            .replace(/^&/, '')
            .replace(/%20/g, '+');
    }
};

qq.obj2FormData = function(obj, formData, arrayKeyName) {
    "use strict";
    if (!formData) {
        formData = new FormData();
    }

    qq.each(obj, function(key, val) {
        key = arrayKeyName ? arrayKeyName + '[' + key + ']' : key;

        if (qq.isObject(val)) {
            qq.obj2FormData(val, formData, key);
        }
        else if (qq.isFunction(val)) {
            formData.append(key, val());
        }
        else {
            formData.append(key, val);
        }
    });

    return formData;
};

qq.obj2Inputs = function(obj, form) {
    "use strict";
    var input;

    if (!form) {
        form = document.createElement('form');
    }

    qq.obj2FormData(obj, {
        append: function(key, val) {
            input = document.createElement('input');
            input.setAttribute('name', key);
            input.setAttribute('value', val);
            form.appendChild(input);
        }
    });

    return form;
};

qq.setCookie = function(name, value, days) {
    var date = new Date(),
        expires = "";

	if (days) {
		date.setTime(date.getTime()+(days*24*60*60*1000));
		expires = "; expires="+date.toGMTString();
	}

	document.cookie = name+"="+value+expires+"; path=/";
};

qq.getCookie = function(name) {
	var nameEQ = name + "=",
        ca = document.cookie.split(';'),
        c;

	for(var i=0;i < ca.length;i++) {
		c = ca[i];
		while (c.charAt(0)==' ') {
            c = c.substring(1,c.length);
        }
		if (c.indexOf(nameEQ) === 0) {
            return c.substring(nameEQ.length,c.length);
        }
	}
};

qq.getCookieNames = function(regexp) {
    var cookies = document.cookie.split(';'),
        cookieNames = [];

    qq.each(cookies, function(idx, cookie) {
        cookie = qq.trimStr(cookie);

        var equalsIdx = cookie.indexOf("=");

        if (cookie.match(regexp)) {
            cookieNames.push(cookie.substr(0, equalsIdx));
        }
    });

    return cookieNames;
};

qq.deleteCookie = function(name) {
	qq.setCookie(name, "", -1);
};

qq.areCookiesEnabled = function() {
    var randNum = Math.random() * 100000,
        name = "qqCookieTest:" + randNum;
    qq.setCookie(name, 1);

    if (qq.getCookie(name)) {
        qq.deleteCookie(name);
        return true;
    }
    return false;
};

/**
 * Not recommended for use outside of Fine Uploader since this falls back to an unchecked eval if JSON.parse is not
 * implemented.  For a more secure JSON.parse polyfill, use Douglas Crockford's json2.js.
 */
qq.parseJson = function(json) {
    /*jshint evil: true*/
    if (window.JSON && qq.isFunction(JSON.parse)) {
        return JSON.parse(json);
    } else {
        return eval("(" + json + ")");
    }
};

/**
 * A generic module which supports object disposing in dispose() method.
 * */
qq.DisposeSupport = function() {
    "use strict";
    var disposers = [];

    return {
        /** Run all registered disposers */
        dispose: function() {
            var disposer;
            do {
                disposer = disposers.shift();
                if (disposer) {
                    disposer();
                }
            }
            while (disposer);
        },

        /** Attach event handler and register de-attacher as a disposer */
        attach: function() {
            var args = arguments;
            /*jslint undef:true*/
            this.addDisposer(qq(args[0]).attach.apply(this, Array.prototype.slice.call(arguments, 1)));
        },

        /** Add disposer to the collection */
        addDisposer: function(disposeFunction) {
            disposers.push(disposeFunction);
        }
    };
};
qq.UploadButton = function(o){
    this._options = {
        element: null,
        // if set to true adds multiple attribute to file input
        multiple: false,
        acceptFiles: null,
        // name attribute of file input
        name: 'file',
        onChange: function(input){},
        hoverClass: 'qq-upload-button-hover',
        focusClass: 'qq-upload-button-focus'
    };

    qq.extend(this._options, o);
    this._disposeSupport = new qq.DisposeSupport();

    this._element = this._options.element;

    // make button suitable container for input
    qq(this._element).css({
        position: 'relative',
        overflow: 'hidden',
        // Make sure browse button is in the right side
        // in Internet Explorer
        direction: 'ltr'
    });

    this._input = this._createInput();
};

qq.UploadButton.prototype = {
    /* returns file input element */
    getInput: function(){
        return this._input;
    },
    /* cleans/recreates the file input */
    reset: function(){
        if (this._input.parentNode){
            qq(this._input).remove();
        }

        qq(this._element).removeClass(this._options.focusClass);
        this._input = this._createInput();
    },
    _createInput: function(){
        var input = document.createElement("input");

        if (this._options.multiple){
            input.setAttribute("multiple", "multiple");
        }

        if (this._options.acceptFiles) input.setAttribute("accept", this._options.acceptFiles);

        input.setAttribute("type", "file");
        input.setAttribute("name", this._options.name);

        qq(input).css({
            position: 'absolute',
            // in Opera only 'browse' button
            // is clickable and it is located at
            // the right side of the input
            right: 0,
            top: 0,
            fontFamily: 'Arial',
            // 4 persons reported this, the max values that worked for them were 243, 236, 236, 118
            fontSize: '118px',
            margin: 0,
            padding: 0,
            cursor: 'pointer',
            opacity: 0
        });

        this._element.appendChild(input);

        var self = this;
        this._disposeSupport.attach(input, 'change', function(){
            self._options.onChange(input);
        });

        this._disposeSupport.attach(input, 'mouseover', function(){
            qq(self._element).addClass(self._options.hoverClass);
        });
        this._disposeSupport.attach(input, 'mouseout', function(){
            qq(self._element).removeClass(self._options.hoverClass);
        });
        this._disposeSupport.attach(input, 'focus', function(){
            qq(self._element).addClass(self._options.focusClass);
        });
        this._disposeSupport.attach(input, 'blur', function(){
            qq(self._element).removeClass(self._options.focusClass);
        });

        // IE and Opera, unfortunately have 2 tab stops on file input
        // which is unacceptable in our case, disable keyboard access
        if (window.attachEvent){
            // it is IE or Opera
            input.setAttribute('tabIndex', "-1");
        }

        return input;
    }
};
qq.FineUploaderBasic = function(o){
    var that = this;
    this._options = {
        debug: false,
        button: null,
        multiple: true,
        maxConnections: 3,
        disableCancelForFormUploads: false,
        autoUpload: true,
        request: {
            endpoint: '/server/upload',
            params: {},
            paramsInBody: true,
            customHeaders: {},
            forceMultipart: true,
            inputName: 'qqfile',
            uuidName: 'qquuid',
            totalFileSizeName: 'qqtotalfilesize'
        },
        validation: {
            allowedExtensions: [],
            sizeLimit: 0,
            minSizeLimit: 0,
            stopOnFirstInvalidFile: true
        },
        callbacks: {
            onSubmit: function(id, name){},
            onComplete: function(id, name, responseJSON){},
            onCancel: function(id, name){},
            onUpload: function(id, name){},
            onUploadChunk: function(id, name, chunkData){},
            onResume: function(id, fileName, chunkData){},
            onProgress: function(id, name, loaded, total){},
            onError: function(id, name, reason) {},
            onAutoRetry: function(id, name, attemptNumber) {},
            onManualRetry: function(id, name) {},
            onValidateBatch: function(fileOrBlobData) {},
            onValidate: function(fileOrBlobData) {},
            onSubmitDelete: function(id) {},
            onDelete: function(id){},
            onDeleteComplete: function(id, xhr, isError){}
        },
        messages: {
            typeError: "{file} has an invalid extension. Valid extension(s): {extensions}.",
            sizeError: "{file} is too large, maximum file size is {sizeLimit}.",
            minSizeError: "{file} is too small, minimum file size is {minSizeLimit}.",
            emptyError: "{file} is empty, please select files again without it.",
            noFilesError: "No files to upload.",
            onLeave: "The files are being uploaded, if you leave now the upload will be cancelled."
        },
        retry: {
            enableAuto: false,
            maxAutoAttempts: 3,
            autoAttemptDelay: 5,
            preventRetryResponseProperty: 'preventRetry'
        },
        classes: {
            buttonHover: 'qq-upload-button-hover',
            buttonFocus: 'qq-upload-button-focus'
        },
        chunking: {
            enabled: false,
            partSize: 2000000,
            paramNames: {
                partIndex: 'qqpartindex',
                partByteOffset: 'qqpartbyteoffset',
                chunkSize: 'qqchunksize',
                totalFileSize: 'qqtotalfilesize',
                totalParts: 'qqtotalparts',
                filename: 'qqfilename'
            }
        },
        resume: {
            enabled: false,
            id: null,
            cookiesExpireIn: 7, //days
            paramNames: {
                resuming: "qqresume"
            }
        },
        formatFileName: function(fileOrBlobName) {
            if (fileOrBlobName.length > 33) {
                fileOrBlobName = fileOrBlobName.slice(0, 19) + '...' + fileOrBlobName.slice(-14);
            }
            return fileOrBlobName;
        },
        text: {
            sizeSymbols: ['kB', 'MB', 'GB', 'TB', 'PB', 'EB']
        },
        deleteFile : {
            enabled: false,
            endpoint: '/server/upload',
            customHeaders: {},
            params: {}
        },
        cors: {
            expected: false,
            sendCredentials: false
        },
        blobs: {
            defaultName: 'Misc data',
            paramNames: {
                name: 'qqblobname'
            }
        }
    };

    qq.extend(this._options, o, true);
    this._wrapCallbacks();
    this._disposeSupport =  new qq.DisposeSupport();

    // number of files being uploaded
    this._filesInProgress = [];

    this._storedIds = [];

    this._autoRetries = [];
    this._retryTimeouts = [];
    this._preventRetries = [];

    this._paramsStore = this._createParamsStore("request");
    this._deleteFileParamsStore = this._createParamsStore("deleteFile");

    this._endpointStore = this._createEndpointStore("request");
    this._deleteFileEndpointStore = this._createEndpointStore("deleteFile");

    this._handler = this._createUploadHandler();
    this._deleteHandler = this._createDeleteHandler();

    if (this._options.button){
        this._button = this._createUploadButton(this._options.button);
    }

    this._preventLeaveInProgress();
};

qq.FineUploaderBasic.prototype = {
    log: function(str, level) {
        if (this._options.debug && (!level || level === 'info')) {
            qq.log('[FineUploader] ' + str);
        }
        else if (level && level !== 'info') {
            qq.log('[FineUploader] ' + str, level);

        }
    },
    setParams: function(params, id) {
        /*jshint eqeqeq: true, eqnull: true*/
        if (id == null) {
            this._options.request.params = params;
        }
        else {
            this._paramsStore.setParams(params, id);
        }
    },
    setDeleteFileParams: function(params, id) {
        /*jshint eqeqeq: true, eqnull: true*/
        if (id == null) {
            this._options.deleteFile.params = params;
        }
        else {
            this._deleteFileParamsStore.setParams(params, id);
        }
    },
    setEndpoint: function(endpoint, id) {
        /*jshint eqeqeq: true, eqnull: true*/
        if (id == null) {
            this._options.request.endpoint = endpoint;
        }
        else {
            this._endpointStore.setEndpoint(endpoint, id);
        }
    },
    getInProgress: function(){
        return this._filesInProgress.length;
    },
    uploadStoredFiles: function(){
        "use strict";
        var idToUpload;

        while(this._storedIds.length) {
            idToUpload = this._storedIds.shift();
            this._filesInProgress.push(idToUpload);
            this._handler.upload(idToUpload);
        }
    },
    clearStoredFiles: function(){
        this._storedIds = [];
    },
    retry: function(id) {
        if (this._onBeforeManualRetry(id)) {
            this._handler.retry(id);
            return true;
        }
        else {
            return false;
        }
    },
    cancel: function(id) {
        this._handler.cancel(id);
    },
    cancelAll: function() {
        var storedIdsCopy = [],
            self = this;

        qq.extend(storedIdsCopy, this._storedIds);
        qq.each(storedIdsCopy, function(idx, storedFileId) {
            self.cancel(storedFileId);
        });

        this._handler.cancelAll();
    },
    reset: function() {
        this.log("Resetting uploader...");
        this._handler.reset();
        this._filesInProgress = [];
        this._storedIds = [];
        this._autoRetries = [];
        this._retryTimeouts = [];
        this._preventRetries = [];
        this._button.reset();
        this._paramsStore.reset();
        this._endpointStore.reset();
    },
    addFiles: function(filesBlobDataOrInputs) {
        var self = this,
            verifiedFilesOrInputs = [],
            index, fileOrInput;

        if (filesBlobDataOrInputs) {
            if (!window.FileList || !(filesBlobDataOrInputs instanceof FileList)) {
                filesBlobDataOrInputs = [].concat(filesBlobDataOrInputs);
            }

            for (index = 0; index < filesBlobDataOrInputs.length; index+=1) {
                fileOrInput = filesBlobDataOrInputs[index];

                if (qq.isFileOrInput(fileOrInput)) {
                    verifiedFilesOrInputs.push(fileOrInput);
                }
                else {
                    self.log(fileOrInput + ' is not a File or INPUT element!  Ignoring!', 'warn');
                }
            }

            this.log('Processing ' + verifiedFilesOrInputs.length + ' files or inputs...');
            this._uploadFileOrBlobDataList(verifiedFilesOrInputs);
        }
    },
    addBlobs: function(blobDataOrArray) {
        if (blobDataOrArray) {
            var blobDataArray = [].concat(blobDataOrArray),
                verifiedBlobDataList = [],
                self = this;

            qq.each(blobDataArray, function(idx, blobData) {
                if (qq.isBlob(blobData) && !qq.isFileOrInput(blobData)) {
                    verifiedBlobDataList.push({
                        blob: blobData,
                        name: self._options.blobs.defaultName
                    });
                }
                else if (qq.isObject(blobData) && blobData.blob && blobData.name) {
                    verifiedBlobDataList.push(blobData);
                }
                else {
                    self.log("addBlobs: entry at index " + idx + " is not a Blob or a BlobData object", "error");
                }
            });

            this._uploadFileOrBlobDataList(verifiedBlobDataList);
        }
        else {
            this.log("undefined or non-array parameter passed into addBlobs", "error");
        }
    },
    getUuid: function(id) {
        return this._handler.getUuid(id);
    },
    getResumableFilesData: function() {
        return this._handler.getResumableFilesData();
    },
    getSize: function(id) {
        return this._handler.getSize(id);
    },
    getFile: function(fileOrBlobId) {
        return this._handler.getFile(fileOrBlobId);
    },
    deleteFile: function(id) {
        this._onSubmitDelete(id);
    },
    setDeleteFileEndpoint: function(endpoint, id) {
        /*jshint eqeqeq: true, eqnull: true*/
        if (id == null) {
            this._options.deleteFile.endpoint = endpoint;
        }
        else {
            this._deleteFileEndpointStore.setEndpoint(endpoint, id);
        }
    },
    _createUploadButton: function(element){
        var self = this;

        var button = new qq.UploadButton({
            element: element,
            multiple: this._options.multiple && qq.isXhrUploadSupported(),
            acceptFiles: this._options.validation.acceptFiles,
            onChange: function(input){
                self._onInputChange(input);
            },
            hoverClass: this._options.classes.buttonHover,
            focusClass: this._options.classes.buttonFocus
        });

        this._disposeSupport.addDisposer(function() { button.dispose(); });
        return button;
    },
    _createUploadHandler: function(){
        var self = this;

        return new qq.UploadHandler({
            debug: this._options.debug,
            forceMultipart: this._options.request.forceMultipart,
            maxConnections: this._options.maxConnections,
            customHeaders: this._options.request.customHeaders,
            inputName: this._options.request.inputName,
            uuidParamName: this._options.request.uuidName,
            totalFileSizeParamName: this._options.request.totalFileSizeName,
            cors: this._options.cors,
            demoMode: this._options.demoMode,
            paramsInBody: this._options.request.paramsInBody,
            paramsStore: this._paramsStore,
            endpointStore: this._endpointStore,
            chunking: this._options.chunking,
            resume: this._options.resume,
            blobs: this._options.blobs,
            log: function(str, level) {
                self.log(str, level);
            },
            onProgress: function(id, name, loaded, total){
                self._onProgress(id, name, loaded, total);
                self._options.callbacks.onProgress(id, name, loaded, total);
            },
            onComplete: function(id, name, result, xhr){
                self._onComplete(id, name, result, xhr);
                self._options.callbacks.onComplete(id, name, result);
            },
            onCancel: function(id, name){
                self._onCancel(id, name);
                self._options.callbacks.onCancel(id, name);
            },
            onUpload: function(id, name){
                self._onUpload(id, name);
                self._options.callbacks.onUpload(id, name);
            },
            onUploadChunk: function(id, name, chunkData){
                self._options.callbacks.onUploadChunk(id, name, chunkData);
            },
            onResume: function(id, name, chunkData) {
                return self._options.callbacks.onResume(id, name, chunkData);
            },
            onAutoRetry: function(id, name, responseJSON, xhr) {
                self._preventRetries[id] = responseJSON[self._options.retry.preventRetryResponseProperty];

                if (self._shouldAutoRetry(id, name, responseJSON)) {
                    self._maybeParseAndSendUploadError(id, name, responseJSON, xhr);
                    self._options.callbacks.onAutoRetry(id, name, self._autoRetries[id] + 1);
                    self._onBeforeAutoRetry(id, name);

                    self._retryTimeouts[id] = setTimeout(function() {
                        self._onAutoRetry(id, name, responseJSON)
                    }, self._options.retry.autoAttemptDelay * 1000);

                    return true;
                }
                else {
                    return false;
                }
            }
        });
    },
    _createDeleteHandler: function() {
        var self = this;

        return new qq.DeleteFileAjaxRequestor({
            maxConnections: this._options.maxConnections,
            customHeaders: this._options.deleteFile.customHeaders,
            paramsStore: this._deleteFileParamsStore,
            endpointStore: this._deleteFileEndpointStore,
            demoMode: this._options.demoMode,
            cors: this._options.cors,
            log: function(str, level) {
                self.log(str, level);
            },
            onDelete: function(id) {
                self._onDelete(id);
                self._options.callbacks.onDelete(id);
            },
            onDeleteComplete: function(id, xhr, isError) {
                self._onDeleteComplete(id, xhr, isError);
                self._options.callbacks.onDeleteComplete(id, xhr, isError);
            }

        });
    },
    _preventLeaveInProgress: function(){
        var self = this;

        this._disposeSupport.attach(window, 'beforeunload', function(e){
            if (!self._filesInProgress.length){return;}

            var e = e || window.event;
            // for ie, ff
            e.returnValue = self._options.messages.onLeave;
            // for webkit
            return self._options.messages.onLeave;
        });
    },
    _onSubmit: function(id, name){
        if (this._options.autoUpload) {
            this._filesInProgress.push(id);
        }
    },
    _onProgress: function(id, name, loaded, total){
    },
    _onComplete: function(id, name, result, xhr){
        this._removeFromFilesInProgress(id);
        this._maybeParseAndSendUploadError(id, name, result, xhr);
    },
    _onCancel: function(id, name){
        this._removeFromFilesInProgress(id);

        clearTimeout(this._retryTimeouts[id]);

        var storedItemIndex = qq.indexOf(this._storedIds, id);
        if (!this._options.autoUpload && storedItemIndex >= 0) {
            this._storedIds.splice(storedItemIndex, 1);
        }
    },
    _isDeletePossible: function() {
        return (this._options.deleteFile.enabled &&
            (!this._options.cors.expected ||
                (this._options.cors.expected && (qq.ie10() || !qq.ie()))
                )
            );
    },
    _onSubmitDelete: function(id) {
        if (this._isDeletePossible()) {
            if (this._options.callbacks.onSubmitDelete(id)) {
                this._deleteHandler.sendDelete(id, this.getUuid(id));
            }
        }
        else {
            this.log("Delete request ignored for ID " + id + ", delete feature is disabled or request not possible " +
                "due to CORS on a user agent that does not support pre-flighting.", "warn");
            return false;
        }
    },
    _onDelete: function(fileId) {},
    _onDeleteComplete: function(id, xhr, isError) {
        var name = this._handler.getName(id);

        if (isError) {
            this.log("Delete request for '" + name + "' has failed.", "error");
            this._options.callbacks.onError(id, name, "Delete request failed with response code " + xhr.status);
        }
        else {
            this.log("Delete request for '" + name + "' has succeeded.");
        }
    },
    _removeFromFilesInProgress: function(id) {
        var index = qq.indexOf(this._filesInProgress, id);
        if (index >= 0) {
            this._filesInProgress.splice(index, 1);
        }
    },
    _onUpload: function(id, name){},
    _onInputChange: function(input){
        if (qq.isXhrUploadSupported()){
            this.addFiles(input.files);
        } else {
            this.addFiles(input);
        }
        this._button.reset();
    },
    _onBeforeAutoRetry: function(id, name) {
        this.log("Waiting " + this._options.retry.autoAttemptDelay + " seconds before retrying " + name + "...");
    },
    _onAutoRetry: function(id, name, responseJSON) {
        this.log("Retrying " + name + "...");
        this._autoRetries[id]++;
        this._handler.retry(id);
    },
    _shouldAutoRetry: function(id, name, responseJSON) {
        if (!this._preventRetries[id] && this._options.retry.enableAuto) {
            if (this._autoRetries[id] === undefined) {
                this._autoRetries[id] = 0;
            }

            return this._autoRetries[id] < this._options.retry.maxAutoAttempts
        }

        return false;
    },
    //return false if we should not attempt the requested retry
    _onBeforeManualRetry: function(id) {
        if (this._preventRetries[id]) {
            this.log("Retries are forbidden for id " + id, 'warn');
            return false;
        }
        else if (this._handler.isValid(id)) {
            var fileName = this._handler.getName(id);

            if (this._options.callbacks.onManualRetry(id, fileName) === false) {
                return false;
            }

            this.log("Retrying upload for '" + fileName + "' (id: " + id + ")...");
            this._filesInProgress.push(id);
            return true;
        }
        else {
            this.log("'" + id + "' is not a valid file ID", 'error');
            return false;
        }
    },
    _maybeParseAndSendUploadError: function(id, name, response, xhr) {
        //assuming no one will actually set the response code to something other than 200 and still set 'success' to true
        if (!response.success){
            if (xhr && xhr.status !== 200 && !response.error) {
                this._options.callbacks.onError(id, name, "XHR returned response code " + xhr.status);
            }
            else {
                var errorReason = response.error ? response.error : "Upload failure reason unknown";
                this._options.callbacks.onError(id, name, errorReason);
            }
        }
    },
    _uploadFileOrBlobDataList: function(fileOrBlobDataList){
        var validationDescriptors, index, batchInvalid;

        validationDescriptors = this._getValidationDescriptors(fileOrBlobDataList);
        batchInvalid = this._options.callbacks.onValidateBatch(validationDescriptors) === false;

        if (!batchInvalid) {
            if (fileOrBlobDataList.length > 0) {
                for (index = 0; index < fileOrBlobDataList.length; index++){
                    if (this._validateFileOrBlobData(fileOrBlobDataList[index])){
                        this._upload(fileOrBlobDataList[index]);
                    } else {
                        if (this._options.validation.stopOnFirstInvalidFile){
                            return;
                        }
                    }
                }
            }
            else {
                this._error('noFilesError', "");
            }
        }
    },
    _upload: function(blobOrFileContainer){
        var id = this._handler.add(blobOrFileContainer);
        var name = this._handler.getName(id);

        if (this._options.callbacks.onSubmit(id, name) !== false){
            this._onSubmit(id, name);
            if (this._options.autoUpload) {
                this._handler.upload(id);
            }
            else {
                this._storeForLater(id);
            }
        }
    },
    _storeForLater: function(id) {
        this._storedIds.push(id);
    },
    _validateFileOrBlobData: function(fileOrBlobData){
        var validationDescriptor, name, size;

        validationDescriptor = this._getValidationDescriptor(fileOrBlobData);
        name = validationDescriptor.name;
        size = validationDescriptor.size;

        if (this._options.callbacks.onValidate(validationDescriptor) === false) {
            return false;
        }

        if (qq.isFileOrInput(fileOrBlobData) && !this._isAllowedExtension(name)){
            this._error('typeError', name);
            return false;

        }
        else if (size === 0){
            this._error('emptyError', name);
            return false;

        }
        else if (size && this._options.validation.sizeLimit && size > this._options.validation.sizeLimit){
            this._error('sizeError', name);
            return false;

        }
        else if (size && size < this._options.validation.minSizeLimit){
            this._error('minSizeError', name);
            return false;
        }

        return true;
    },
    _error: function(code, name){
        var message = this._options.messages[code];
        function r(name, replacement){ message = message.replace(name, replacement); }

        var extensions = this._options.validation.allowedExtensions.join(', ').toLowerCase();

        r('{file}', this._options.formatFileName(name));
        r('{extensions}', extensions);
        r('{sizeLimit}', this._formatSize(this._options.validation.sizeLimit));
        r('{minSizeLimit}', this._formatSize(this._options.validation.minSizeLimit));

        this._options.callbacks.onError(null, name, message);

        return message;
    },
    _isAllowedExtension: function(fileName){
        var allowed = this._options.validation.allowedExtensions,
            valid = false;

        if (!allowed.length) {
            return true;
        }

        qq.each(allowed, function(idx, allowedExt) {
            /*jshint eqeqeq: true, eqnull: true*/
            var extRegex = new RegExp('\\.' + allowedExt + "$", 'i');

            if (fileName.match(extRegex) != null) {
                valid = true;
                return false;
            }
        });

        return valid;
    },
    _formatSize: function(bytes){
        var i = -1;
        do {
            bytes = bytes / 1024;
            i++;
        } while (bytes > 99);

        return Math.max(bytes, 0.1).toFixed(1) + this._options.text.sizeSymbols[i];
    },
    _wrapCallbacks: function() {
        var self, safeCallback;

        self = this;

        safeCallback = function(name, callback, args) {
            try {
                return callback.apply(self, args);
            }
            catch (exception) {
                self.log("Caught exception in '" + name + "' callback - " + exception.message, 'error');
            }
        }

        for (var prop in this._options.callbacks) {
            (function() {
                var callbackName, callbackFunc;
                callbackName = prop;
                callbackFunc = self._options.callbacks[callbackName];
                self._options.callbacks[callbackName] = function() {
                    return safeCallback(callbackName, callbackFunc, arguments);
                }
            }());
        }
    },
    _parseFileOrBlobDataName: function(fileOrBlobData) {
        var name;

        if (qq.isFileOrInput(fileOrBlobData)) {
            if (fileOrBlobData.value) {
                // it is a file input
                // get input value and remove path to normalize
                name = fileOrBlobData.value.replace(/.*(\/|\\)/, "");
            } else {
                // fix missing properties in Safari 4 and firefox 11.0a2
                name = (fileOrBlobData.fileName !== null && fileOrBlobData.fileName !== undefined) ? fileOrBlobData.fileName : fileOrBlobData.name;
            }
        }
        else {
            name = fileOrBlobData.name;
        }

        return name;
    },
    _parseFileOrBlobDataSize: function(fileOrBlobData) {
        var size;

        if (qq.isFileOrInput(fileOrBlobData)) {
            if (!fileOrBlobData.value){
                // fix missing properties in Safari 4 and firefox 11.0a2
                size = (fileOrBlobData.fileSize !== null && fileOrBlobData.fileSize !== undefined) ? fileOrBlobData.fileSize : fileOrBlobData.size;
            }
        }
        else {
            size = fileOrBlobData.blob.size;
        }

        return size;
    },
    _getValidationDescriptor: function(fileOrBlobData) {
        var name, size, fileDescriptor;

        fileDescriptor = {};
        name = this._parseFileOrBlobDataName(fileOrBlobData);
        size = this._parseFileOrBlobDataSize(fileOrBlobData);

        fileDescriptor.name = name;
        if (size) {
            fileDescriptor.size = size;
        }

        return fileDescriptor;
    },
    _getValidationDescriptors: function(files) {
        var self = this,
            fileDescriptors = [];

        qq.each(files, function(idx, file) {
            fileDescriptors.push(self._getValidationDescriptor(file));
        });

        return fileDescriptors;
    },
    _createParamsStore: function(type) {
        var paramsStore = {},
            self = this;

        return {
            setParams: function(params, id) {
                var paramsCopy = {};
                qq.extend(paramsCopy, params);
                paramsStore[id] = paramsCopy;
            },

            getParams: function(id) {
                /*jshint eqeqeq: true, eqnull: true*/
                var paramsCopy = {};

                if (id != null && paramsStore[id]) {
                    qq.extend(paramsCopy, paramsStore[id]);
                }
                else {
                    qq.extend(paramsCopy, self._options[type].params);
                }

                return paramsCopy;
            },

            remove: function(fileId) {
                return delete paramsStore[fileId];
            },

            reset: function() {
                paramsStore = {};
            }
        };
    },
    _createEndpointStore: function(type) {
        var endpointStore = {},
        self = this;

        return {
            setEndpoint: function(endpoint, id) {
                endpointStore[id] = endpoint;
            },

            getEndpoint: function(id) {
                /*jshint eqeqeq: true, eqnull: true*/
                if (id != null && endpointStore[id]) {
                    return endpointStore[id];
                }

                return self._options[type].endpoint;
            },

            remove: function(fileId) {
                return delete endpointStore[fileId];
            },

            reset: function() {
                endpointStore = {};
            }
        };
    }
};
/*globals qq, document*/
qq.DragAndDrop = function(o) {
    "use strict";

    var options, dz, dirPending,
        droppedFiles = [],
        droppedEntriesCount = 0,
        droppedEntriesParsedCount = 0,
        disposeSupport = new qq.DisposeSupport();

     options = {
        dropArea: null,
        extraDropzones: [],
        hideDropzones: true,
        multiple: true,
        classes: {
            dropActive: null
        },
        callbacks: {
            dropProcessing: function(isProcessing, files) {},
            error: function(code, filename) {},
            log: function(message, level) {}
        }
    };

    qq.extend(options, o);

    function maybeUploadDroppedFiles() {
        if (droppedEntriesCount === droppedEntriesParsedCount && !dirPending) {
            options.callbacks.log('Grabbed ' + droppedFiles.length + " files after tree traversal.");
            dz.dropDisabled(false);
            options.callbacks.dropProcessing(false, droppedFiles);
        }
    }
    function addDroppedFile(file) {
        droppedFiles.push(file);
        droppedEntriesParsedCount+=1;
        maybeUploadDroppedFiles();
    }

    function traverseFileTree(entry) {
        var dirReader, i;

        droppedEntriesCount+=1;

        if (entry.isFile) {
            entry.file(function(file) {
                addDroppedFile(file);
            });
        }
        else if (entry.isDirectory) {
            dirPending = true;
            dirReader = entry.createReader();
            dirReader.readEntries(function(entries) {
                droppedEntriesParsedCount+=1;
                for (i = 0; i < entries.length; i+=1) {
                    traverseFileTree(entries[i]);
                }

                dirPending = false;

                if (!entries.length) {
                    maybeUploadDroppedFiles();
                }
            });
        }
    }

    function handleDataTransfer(dataTransfer) {
        var i, items, entry;

        options.callbacks.dropProcessing(true);
        dz.dropDisabled(true);

        if (dataTransfer.files.length > 1 && !options.multiple) {
            options.callbacks.dropProcessing(false);
            options.callbacks.error('tooManyFilesError', "");
            dz.dropDisabled(false);
        }
        else {
            droppedFiles = [];
            droppedEntriesCount = 0;
            droppedEntriesParsedCount = 0;

            if (qq.isFolderDropSupported(dataTransfer)) {
                items = dataTransfer.items;

                for (i = 0; i < items.length; i+=1) {
                    entry = items[i].webkitGetAsEntry();
                    if (entry) {
                        //due to a bug in Chrome's File System API impl - #149735
                        if (entry.isFile) {
                            droppedFiles.push(items[i].getAsFile());
                            if (i === items.length-1) {
                                maybeUploadDroppedFiles();
                            }
                        }

                        else {
                            traverseFileTree(entry);
                        }
                    }
                }
            }
            else {
                options.callbacks.dropProcessing(false, dataTransfer.files);
                dz.dropDisabled(false);
            }
        }
    }

    function setupDropzone(dropArea){
        dz = new qq.UploadDropZone({
            element: dropArea,
            onEnter: function(e){
                qq(dropArea).addClass(options.classes.dropActive);
                e.stopPropagation();
            },
            onLeaveNotDescendants: function(e){
                qq(dropArea).removeClass(options.classes.dropActive);
            },
            onDrop: function(e){
                if (options.hideDropzones) {
                    qq(dropArea).hide();
                }
                qq(dropArea).removeClass(options.classes.dropActive);

                handleDataTransfer(e.dataTransfer);
            }
        });

        disposeSupport.addDisposer(function() {
            dz.dispose();
        });

        if (options.hideDropzones) {
            qq(dropArea).hide();
        }
    }

    function isFileDrag(dragEvent) {
        var fileDrag;

        qq.each(dragEvent.dataTransfer.types, function(key, val) {
            if (val === 'Files') {
                fileDrag = true;
                return false;
            }
        });

        return fileDrag;
    }

    function setupDragDrop(){
        if (options.dropArea) {
            options.extraDropzones.push(options.dropArea);
        }

        var i, dropzones = options.extraDropzones;

        for (i=0; i < dropzones.length; i+=1){
            setupDropzone(dropzones[i]);
        }

        // IE <= 9 does not support the File API used for drag+drop uploads
        if (options.dropArea && (!qq.ie() || qq.ie10())) {
            disposeSupport.attach(document, 'dragenter', function(e) {
                if (!dz.dropDisabled() && isFileDrag(e)) {
                    if (qq(options.dropArea).hasClass(options.classes.dropDisabled)) {
                        return;
                    }

                    options.dropArea.style.display = 'block';
                    for (i=0; i < dropzones.length; i+=1) {
                        dropzones[i].style.display = 'block';
                    }
                }
            });
        }
        disposeSupport.attach(document, 'dragleave', function(e){
            if (options.hideDropzones && qq.FineUploader.prototype._leaving_document_out(e)) {
                for (i=0; i < dropzones.length; i+=1) {
                    qq(dropzones[i]).hide();
                }
            }
        });
        disposeSupport.attach(document, 'drop', function(e){
            if (options.hideDropzones) {
                for (i=0; i < dropzones.length; i+=1) {
                    qq(dropzones[i]).hide();
                }
            }
            e.preventDefault();
        });
    }

    return {
        setup: function() {
            setupDragDrop();
        },

        setupExtraDropzone: function(element) {
            options.extraDropzones.push(element);
            setupDropzone(element);
        },

        removeExtraDropzone: function(element) {
            var i, dzs = options.extraDropzones;
            for(i in dzs) {
                if (dzs[i] === element) {
                    return dzs.splice(i, 1);
                }
            }
        },

        dispose: function() {
            disposeSupport.dispose();
            dz.dispose();
        }
    };
};


qq.UploadDropZone = function(o){
    "use strict";

    var options, element, preventDrop, dropOutsideDisabled, disposeSupport = new qq.DisposeSupport();

    options = {
        element: null,
        onEnter: function(e){},
        onLeave: function(e){},
        // is not fired when leaving element by hovering descendants
        onLeaveNotDescendants: function(e){},
        onDrop: function(e){}
    };

    qq.extend(options, o);
    element = options.element;

    function dragover_should_be_canceled(){
        return qq.safari() || (qq.firefox() && qq.windows());
    }

    function disableDropOutside(e){
        // run only once for all instances
        if (!dropOutsideDisabled ){

            // for these cases we need to catch onDrop to reset dropArea
            if (dragover_should_be_canceled){
               disposeSupport.attach(document, 'dragover', function(e){
                    e.preventDefault();
                });
            } else {
                disposeSupport.attach(document, 'dragover', function(e){
                    if (e.dataTransfer){
                        e.dataTransfer.dropEffect = 'none';
                        e.preventDefault();
                    }
                });
            }

            dropOutsideDisabled = true;
        }
    }

    function isValidFileDrag(e){
        // e.dataTransfer currently causing IE errors
        // IE9 does NOT support file API, so drag-and-drop is not possible
        if (qq.ie() && !qq.ie10()) {
            return false;
        }

        var effectTest, dt = e.dataTransfer,
        // do not check dt.types.contains in webkit, because it crashes safari 4
        isSafari = qq.safari();

        // dt.effectAllowed is none in Safari 5
        // dt.types.contains check is for firefox
        effectTest = qq.ie10() ? true : dt.effectAllowed !== 'none';
        return dt && effectTest && (dt.files || (!isSafari && dt.types.contains && dt.types.contains('Files')));
    }

    function isOrSetDropDisabled(isDisabled) {
        if (isDisabled !== undefined) {
            preventDrop = isDisabled;
        }
        return preventDrop;
    }

    function attachEvents(){
        disposeSupport.attach(element, 'dragover', function(e){
            if (!isValidFileDrag(e)) {
                return;
            }

            var effect = qq.ie() ? null : e.dataTransfer.effectAllowed;
            if (effect === 'move' || effect === 'linkMove'){
                e.dataTransfer.dropEffect = 'move'; // for FF (only move allowed)
            } else {
                e.dataTransfer.dropEffect = 'copy'; // for Chrome
            }

            e.stopPropagation();
            e.preventDefault();
        });

        disposeSupport.attach(element, 'dragenter', function(e){
            if (!isOrSetDropDisabled()) {
                if (!isValidFileDrag(e)) {
                    return;
                }
                options.onEnter(e);
            }
        });

        disposeSupport.attach(element, 'dragleave', function(e){
            if (!isValidFileDrag(e)) {
                return;
            }

            options.onLeave(e);

            var relatedTarget = document.elementFromPoint(e.clientX, e.clientY);
            // do not fire when moving a mouse over a descendant
            if (qq(this).contains(relatedTarget)) {
                return;
            }

            options.onLeaveNotDescendants(e);
        });

        disposeSupport.attach(element, 'drop', function(e){
            if (!isOrSetDropDisabled()) {
                if (!isValidFileDrag(e)) {
                    return;
                }

                e.preventDefault();
                options.onDrop(e);
            }
        });
    }

    disableDropOutside();
    attachEvents();

    return {
        dropDisabled: function(isDisabled) {
            return isOrSetDropDisabled(isDisabled);
        },

        dispose: function() {
            disposeSupport.dispose();
        }
    };
};
/**
 * Class that creates upload widget with drag-and-drop and file list
 * @inherits qq.FineUploaderBasic
 */
qq.FineUploader = function(o){
    // call parent constructor
    qq.FineUploaderBasic.apply(this, arguments);

    // additional options
    qq.extend(this._options, {
        element: null,
        listElement: null,
        dragAndDrop: {
            extraDropzones: [],
            hideDropzones: true,
            disableDefaultDropzone: false
        },
        text: {
            uploadButton: 'Upload a file',
            cancelButton: 'Cancel',
            retryButton: 'Retry',
            deleteButton: 'Delete',
            failUpload: 'Upload failed',
            dragZone: 'Drop files here to upload',
            dropProcessing: 'Processing dropped files...',
            formatProgress: "{percent}% of {total_size}",
            waitingForResponse: "Processing..."
        },
        template: '<div class="qq-uploader">' +
            ((!this._options.dragAndDrop || !this._options.dragAndDrop.disableDefaultDropzone) ? '<div class="qq-upload-drop-area"><span>{dragZoneText}</span></div>' : '') +
            (!this._options.button ? '<div class="qq-upload-button"><div>{uploadButtonText}</div></div>' : '') +
            '<span class="qq-drop-processing"><span>{dropProcessingText}</span><span class="qq-drop-processing-spinner"></span></span>' +
            (!this._options.listElement ? '<ul class="qq-upload-list"></ul>' : '') +
            '</div>',

        // template for one item in file list
        fileTemplate: '<li>' +
            '<div class="qq-progress-bar"></div>' +
            '<span class="qq-upload-spinner"></span>' +
            '<span class="qq-upload-finished"></span>' +
            '<span class="qq-upload-file"></span>' +
            '<span class="qq-upload-size"></span>' +
            '<a class="qq-upload-cancel" href="#">{cancelButtonText}</a>' +
            '<a class="qq-upload-retry" href="#">{retryButtonText}</a>' +
            '<a class="qq-upload-delete" href="#">{deleteButtonText}</a>' +
            '<span class="qq-upload-status-text">{statusText}</span>' +
            '</li>',
        classes: {
            button: 'qq-upload-button',
            drop: 'qq-upload-drop-area',
            dropActive: 'qq-upload-drop-area-active',
            dropDisabled: 'qq-upload-drop-area-disabled',
            list: 'qq-upload-list',
            progressBar: 'qq-progress-bar',
            file: 'qq-upload-file',
            spinner: 'qq-upload-spinner',
            finished: 'qq-upload-finished',
            retrying: 'qq-upload-retrying',
            retryable: 'qq-upload-retryable',
            size: 'qq-upload-size',
            cancel: 'qq-upload-cancel',
            deleteButton: 'qq-upload-delete',
            retry: 'qq-upload-retry',
            statusText: 'qq-upload-status-text',

            success: 'qq-upload-success',
            fail: 'qq-upload-fail',

            successIcon: null,
            failIcon: null,

            dropProcessing: 'qq-drop-processing',
            dropProcessingSpinner: 'qq-drop-processing-spinner'
        },
        failedUploadTextDisplay: {
            mode: 'default', //default, custom, or none
            maxChars: 50,
            responseProperty: 'error',
            enableTooltip: true
        },
        messages: {
            tooManyFilesError: "You may only drop one file"
        },
        retry: {
            showAutoRetryNote: true,
            autoRetryNote: "Retrying {retryNum}/{maxAuto}...",
            showButton: false
        },
        deleteFile: {
            forceConfirm: false,
            confirmMessage: "Are you sure you want to delete {filename}?",
            deletingStatusText: "Deleting...",
            deletingFailedText: "Delete failed"

        },
        display: {
            fileSizeOnSubmit: false
        },
        showMessage: function(message){
            setTimeout(function() {
                alert(message);
            }, 0);
        },
        showConfirm: function(message, okCallback, cancelCallback) {
            setTimeout(function() {
                var result = confirm(message);
                if (result) {
                    okCallback();
                }
                else if (cancelCallback) {
                    cancelCallback();
                }
            }, 0);
        }
    }, true);

    // overwrite options with user supplied
    qq.extend(this._options, o, true);
    this._wrapCallbacks();

    // overwrite the upload button text if any
    // same for the Cancel button and Fail message text
    this._options.template     = this._options.template.replace(/\{dragZoneText\}/g, this._options.text.dragZone);
    this._options.template     = this._options.template.replace(/\{uploadButtonText\}/g, this._options.text.uploadButton);
    this._options.template     = this._options.template.replace(/\{dropProcessingText\}/g, this._options.text.dropProcessing);
    this._options.fileTemplate = this._options.fileTemplate.replace(/\{cancelButtonText\}/g, this._options.text.cancelButton);
    this._options.fileTemplate = this._options.fileTemplate.replace(/\{retryButtonText\}/g, this._options.text.retryButton);
    this._options.fileTemplate = this._options.fileTemplate.replace(/\{deleteButtonText\}/g, this._options.text.deleteButton);
    this._options.fileTemplate = this._options.fileTemplate.replace(/\{statusText\}/g, "");

    this._element = this._options.element;
    this._element.innerHTML = this._options.template;
    this._listElement = this._options.listElement || this._find(this._element, 'list');

    this._classes = this._options.classes;

    if (!this._button) {
        this._button = this._createUploadButton(this._find(this._element, 'button'));
    }

    this._bindCancelAndRetryEvents();

    this._dnd = this._setupDragAndDrop();
};

// inherit from Basic Uploader
qq.extend(qq.FineUploader.prototype, qq.FineUploaderBasic.prototype);

qq.extend(qq.FineUploader.prototype, {
    clearStoredFiles: function() {
        qq.FineUploaderBasic.prototype.clearStoredFiles.apply(this, arguments);
        this._listElement.innerHTML = "";
    },
    addExtraDropzone: function(element){
        this._dnd.setupExtraDropzone(element);
    },
    removeExtraDropzone: function(element){
        return this._dnd.removeExtraDropzone(element);
    },
    getItemByFileId: function(id){
        var item = this._listElement.firstChild;

        // there can't be txt nodes in dynamically created list
        // and we can  use nextSibling
        while (item){
            if (item.qqFileId == id) return item;
            item = item.nextSibling;
        }
    },
    reset: function() {
        qq.FineUploaderBasic.prototype.reset.apply(this, arguments);
        this._element.innerHTML = this._options.template;
        this._listElement = this._options.listElement || this._find(this._element, 'list');
        if (!this._options.button) {
            this._button = this._createUploadButton(this._find(this._element, 'button'));
        }
        this._bindCancelAndRetryEvents();
        this._dnd.dispose();
        this._dnd = this._setupDragAndDrop();
    },
    _removeFileItem: function(fileId) {
        var item = this.getItemByFileId(fileId);
        qq(item).remove();
    },
    _setupDragAndDrop: function() {
        var self = this,
            dropProcessingEl = this._find(this._element, 'dropProcessing'),
            dnd, preventSelectFiles, defaultDropAreaEl;

        preventSelectFiles = function(event) {
            event.preventDefault();
        };

        if (!this._options.dragAndDrop.disableDefaultDropzone) {
            defaultDropAreaEl = this._find(this._options.element, 'drop');
        }

        dnd = new qq.DragAndDrop({
            dropArea: defaultDropAreaEl,
            extraDropzones: this._options.dragAndDrop.extraDropzones,
            hideDropzones: this._options.dragAndDrop.hideDropzones,
            multiple: this._options.multiple,
            classes: {
                dropActive: this._options.classes.dropActive
            },
            callbacks: {
                dropProcessing: function(isProcessing, files) {
                    var input = self._button.getInput();

                    if (isProcessing) {
                        qq(dropProcessingEl).css({display: 'block'});
                        qq(input).attach('click', preventSelectFiles);
                    }
                    else {
                        qq(dropProcessingEl).hide();
                        qq(input).detach('click', preventSelectFiles);
                    }

                    if (files) {
                        self.addFiles(files);
                    }
                },
                error: function(code, filename) {
                    self._error(code, filename);
                },
                log: function(message, level) {
                    self.log(message, level);
                }
            }
        });

        dnd.setup();

        return dnd;
    },
    _leaving_document_out: function(e){
        return ((qq.chrome() || (qq.safari() && qq.windows())) && e.clientX == 0 && e.clientY == 0) // null coords for Chrome and Safari Windows
            || (qq.firefox() && !e.relatedTarget); // null e.relatedTarget for Firefox
    },
    _storeForLater: function(id) {
        qq.FineUploaderBasic.prototype._storeForLater.apply(this, arguments);
        var item = this.getItemByFileId(id);
        qq(this._find(item, 'spinner')).hide();
    },
    /**
     * Gets one of the elements listed in this._options.classes
     **/
    _find: function(parent, type){
        var element = qq(parent).getByClass(this._options.classes[type])[0];
        if (!element){
            throw new Error('element not found ' + type);
        }

        return element;
    },
    _onSubmit: function(id, name){
        qq.FineUploaderBasic.prototype._onSubmit.apply(this, arguments);
        this._addToList(id, name);
    },
    // Update the progress bar & percentage as the file is uploaded
    _onProgress: function(id, name, loaded, total){
        qq.FineUploaderBasic.prototype._onProgress.apply(this, arguments);

        var item, progressBar, percent, cancelLink;

        item = this.getItemByFileId(id);
        progressBar = this._find(item, 'progressBar');
        percent = Math.round(loaded / total * 100);

        if (loaded === total) {
            cancelLink = this._find(item, 'cancel');
            qq(cancelLink).hide();

            qq(progressBar).hide();
            qq(this._find(item, 'statusText')).setText(this._options.text.waitingForResponse);

            // If last byte was sent, display total file size
            this._displayFileSize(id);
        }
        else {
            // If still uploading, display percentage - total size is actually the total request(s) size
            this._displayFileSize(id, loaded, total);

            qq(progressBar).css({display: 'block'});
        }

        // Update progress bar element
        qq(progressBar).css({width: percent + '%'});
    },
    _onComplete: function(id, name, result, xhr){
        qq.FineUploaderBasic.prototype._onComplete.apply(this, arguments);

        var item = this.getItemByFileId(id);

        qq(this._find(item, 'statusText')).clearText();

        qq(item).removeClass(this._classes.retrying);
        qq(this._find(item, 'progressBar')).hide();

        if (!this._options.disableCancelForFormUploads || qq.isXhrUploadSupported()) {
            qq(this._find(item, 'cancel')).hide();
        }
        qq(this._find(item, 'spinner')).hide();

        if (result.success) {
            if (this._isDeletePossible()) {
                this._showDeleteLink(id);
            }

            qq(item).addClass(this._classes.success);
            if (this._classes.successIcon) {
                this._find(item, 'finished').style.display = "inline-block";
                qq(item).addClass(this._classes.successIcon);
            }
        } else {
            qq(item).addClass(this._classes.fail);
            if (this._classes.failIcon) {
                this._find(item, 'finished').style.display = "inline-block";
                qq(item).addClass(this._classes.failIcon);
            }
            if (this._options.retry.showButton && !this._preventRetries[id]) {
                qq(item).addClass(this._classes.retryable);
            }
            this._controlFailureTextDisplay(item, result);
        }
    },
    _onUpload: function(id, name){
        qq.FineUploaderBasic.prototype._onUpload.apply(this, arguments);

        this._showSpinner(id);
    },
    _onCancel: function(id, name) {
        qq.FineUploaderBasic.prototype._onCancel.apply(this, arguments);
        this._removeFileItem(id);
    },
    _onBeforeAutoRetry: function(id) {
        var item, progressBar, failTextEl, retryNumForDisplay, maxAuto, retryNote;

        qq.FineUploaderBasic.prototype._onBeforeAutoRetry.apply(this, arguments);

        item = this.getItemByFileId(id);
        progressBar = this._find(item, 'progressBar');

        this._showCancelLink(item);
        progressBar.style.width = 0;
        qq(progressBar).hide();

        if (this._options.retry.showAutoRetryNote) {
            failTextEl = this._find(item, 'statusText');
            retryNumForDisplay = this._autoRetries[id] + 1;
            maxAuto = this._options.retry.maxAutoAttempts;

            retryNote = this._options.retry.autoRetryNote.replace(/\{retryNum\}/g, retryNumForDisplay);
            retryNote = retryNote.replace(/\{maxAuto\}/g, maxAuto);

            qq(failTextEl).setText(retryNote);
            if (retryNumForDisplay === 1) {
                qq(item).addClass(this._classes.retrying);
            }
        }
    },
    //return false if we should not attempt the requested retry
    _onBeforeManualRetry: function(id) {
        if (qq.FineUploaderBasic.prototype._onBeforeManualRetry.apply(this, arguments)) {
            var item = this.getItemByFileId(id);
            this._find(item, 'progressBar').style.width = 0;
            qq(item).removeClass(this._classes.fail);
            qq(this._find(item, 'statusText')).clearText();
            this._showSpinner(id);
            this._showCancelLink(item);
            return true;
        }
        return false;
    },
    _onSubmitDelete: function(id) {
        if (this._isDeletePossible()) {
            if (this._options.callbacks.onSubmitDelete(id) !== false) {
                if (this._options.deleteFile.forceConfirm) {
                    this._showDeleteConfirm(id);
                }
                else {
                    this._sendDeleteRequest(id);
                }
            }
        }
        else {
            this.log("Delete request ignored for file ID " + id + ", delete feature is disabled.", "warn");
            return false;
        }
    },
    _onDeleteComplete: function(id, xhr, isError) {
        qq.FineUploaderBasic.prototype._onDeleteComplete.apply(this, arguments);

        var item = this.getItemByFileId(id),
            spinnerEl = this._find(item, 'spinner'),
            statusTextEl = this._find(item, 'statusText');

        qq(spinnerEl).hide();

        if (isError) {
            qq(statusTextEl).setText(this._options.deleteFile.deletingFailedText);
            this._showDeleteLink(id);
        }
        else {
            this._removeFileItem(id);
        }
    },
    _sendDeleteRequest: function(id) {
        var item = this.getItemByFileId(id),
            deleteLink = this._find(item, 'deleteButton'),
            statusTextEl = this._find(item, 'statusText');

        qq(deleteLink).hide();
        this._showSpinner(id);
        qq(statusTextEl).setText(this._options.deleteFile.deletingStatusText);
        this._deleteHandler.sendDelete(id, this.getUuid(id));
    },
    _showDeleteConfirm: function(id) {
        var fileName = this._handler.getName(id),
            confirmMessage = this._options.deleteFile.confirmMessage.replace(/\{filename\}/g, fileName),
            uuid = this.getUuid(id),
            self = this;

        this._options.showConfirm(confirmMessage, function() {
            self._sendDeleteRequest(id);
        });
    },
    _addToList: function(id, name){
        var item = qq.toElement(this._options.fileTemplate);
        if (this._options.disableCancelForFormUploads && !qq.isXhrUploadSupported()) {
            var cancelLink = this._find(item, 'cancel');
            qq(cancelLink).remove();
        }

        item.qqFileId = id;

        var fileElement = this._find(item, 'file');
        qq(fileElement).setText(this._options.formatFileName(name));
        qq(this._find(item, 'size')).hide();
        if (!this._options.multiple) {
            this._handler.cancelAll();
            this._clearList();
        }

        this._listElement.appendChild(item);

        if (this._options.display.fileSizeOnSubmit && qq.isXhrUploadSupported()) {
            this._displayFileSize(id);
        }
    },
    _clearList: function(){
        this._listElement.innerHTML = '';
        this.clearStoredFiles();
    },
    _displayFileSize: function(id, loadedSize, totalSize) {
        var item = this.getItemByFileId(id),
            size = this.getSize(id),
            sizeForDisplay = this._formatSize(size),
            sizeEl = this._find(item, 'size');

        if (loadedSize !== undefined && totalSize !== undefined) {
            sizeForDisplay = this._formatProgress(loadedSize, totalSize);
        }

        qq(sizeEl).css({display: 'inline'});
        qq(sizeEl).setText(sizeForDisplay);
    },
    /**
     * delegate click event for cancel & retry links
     **/
    _bindCancelAndRetryEvents: function(){
        var self = this,
            list = this._listElement;

        this._disposeSupport.attach(list, 'click', function(e){
            e = e || window.event;
            var target = e.target || e.srcElement;

            if (qq(target).hasClass(self._classes.cancel) || qq(target).hasClass(self._classes.retry) || qq(target).hasClass(self._classes.deleteButton)){
                qq.preventDefault(e);

                var item = target.parentNode;
                while(item.qqFileId === undefined) {
                    item = target = target.parentNode;
                }

                if (qq(target).hasClass(self._classes.deleteButton)) {
                    self.deleteFile(item.qqFileId);
                }
                else if (qq(target).hasClass(self._classes.cancel)) {
                    self.cancel(item.qqFileId);
                }
                else {
                    qq(item).removeClass(self._classes.retryable);
                    self.retry(item.qqFileId);
                }
            }
        });
    },
    _formatProgress: function (uploadedSize, totalSize) {
        var message = this._options.text.formatProgress;
        function r(name, replacement) { message = message.replace(name, replacement); }

        r('{percent}', Math.round(uploadedSize / totalSize * 100));
        r('{total_size}', this._formatSize(totalSize));
        return message;
    },
    _controlFailureTextDisplay: function(item, response) {
        var mode, maxChars, responseProperty, failureReason, shortFailureReason;

        mode = this._options.failedUploadTextDisplay.mode;
        maxChars = this._options.failedUploadTextDisplay.maxChars;
        responseProperty = this._options.failedUploadTextDisplay.responseProperty;

        if (mode === 'custom') {
            failureReason = response[responseProperty];
            if (failureReason) {
                if (failureReason.length > maxChars) {
                    shortFailureReason = failureReason.substring(0, maxChars) + '...';
                }
            }
            else {
                failureReason = this._options.text.failUpload;
                this.log("'" + responseProperty + "' is not a valid property on the server response.", 'warn');
            }

            qq(this._find(item, 'statusText')).setText(shortFailureReason || failureReason);

            if (this._options.failedUploadTextDisplay.enableTooltip) {
                this._showTooltip(item, failureReason);
            }
        }
        else if (mode === 'default') {
            qq(this._find(item, 'statusText')).setText(this._options.text.failUpload);
        }
        else if (mode !== 'none') {
            this.log("failedUploadTextDisplay.mode value of '" + mode + "' is not valid", 'warn');
        }
    },
    _showTooltip: function(item, text) {
        item.title = text;
    },
    _showSpinner: function(id) {
        var item = this.getItemByFileId(id),
            spinnerEl = this._find(item, 'spinner');

        spinnerEl.style.display = "inline-block";
    },
    _showCancelLink: function(item) {
        if (!this._options.disableCancelForFormUploads || qq.isXhrUploadSupported()) {
            var cancelLink = this._find(item, 'cancel');

            qq(cancelLink).css({display: 'inline'});
        }
    },
    _showDeleteLink: function(id) {
        var item = this.getItemByFileId(id),
            deleteLink = this._find(item, 'deleteButton');

        qq(deleteLink).css({display: 'inline'});
    },
    _error: function(code, name){
        var message = qq.FineUploaderBasic.prototype._error.apply(this, arguments);
        this._options.showMessage(message);
    }
});
/** Generic class for sending non-upload ajax requests and handling the associated responses **/
//TODO Use XDomainRequest if expectCors = true.  Not necessary now since only DELETE requests are sent and XDR doesn't support pre-flighting.
/*globals qq, XMLHttpRequest*/
qq.AjaxRequestor = function(o) {
    "use strict";

    var log, shouldParamsBeInQueryString,
        queue = [],
        requestState = [],
        options = {
            method: 'POST',
            maxConnections: 3,
            customHeaders: {},
            endpointStore: {},
            paramsStore: {},
            successfulResponseCodes: [200],
            demoMode: false,
            cors: {
                expected: false,
                sendCredentials: false
            },
            log: function(str, level) {},
            onSend: function(id) {},
            onComplete: function(id, xhr, isError) {},
            onCancel: function(id) {}
        };

    qq.extend(options, o);
    log = options.log;
    shouldParamsBeInQueryString = getMethod() === 'GET' || getMethod() === 'DELETE';


    /**
     * Removes element from queue, sends next request
     */
    function dequeue(id) {
        var i = qq.indexOf(queue, id),
            max = options.maxConnections,
            nextId;

        delete requestState[id];
        queue.splice(i, 1);

        if (queue.length >= max && i < max){
            nextId = queue[max-1];
            sendRequest(nextId);
        }
    }

    function onComplete(id) {
        var xhr = requestState[id].xhr,
            method = getMethod(),
            isError = false;

        dequeue(id);

        if (!isResponseSuccessful(xhr.status)) {
            isError = true;
            log(method + " request for " + id + " has failed - response code " + xhr.status, "error");
        }

        options.onComplete(id, xhr, isError);
    }

    function sendRequest(id) {
        var xhr = new XMLHttpRequest(),
            method = getMethod(),
            params = {},
            url;

        options.onSend(id);

        if (options.paramsStore.getParams) {
            params = options.paramsStore.getParams(id);
        }

        url = createUrl(id, params);

        requestState[id].xhr = xhr;
        xhr.onreadystatechange = getReadyStateChangeHandler(id);
        xhr.open(method, url, true);

        if (options.cors.expected && options.cors.sendCredentials) {
            xhr.withCredentials = true;
        }

        setHeaders(id);

        log('Sending ' + method + " request for " + id);
        if (!shouldParamsBeInQueryString && params) {
            xhr.send(qq.obj2url(params, ""));
        }
        else {
            xhr.send();
        }
    }

    function createUrl(id, params) {
        var endpoint = options.endpointStore.getEndpoint(id),
            addToPath = requestState[id].addToPath;

        if (addToPath !== undefined) {
            endpoint += "/" + addToPath;
        }

        if (shouldParamsBeInQueryString && params) {
            return qq.obj2url(params, endpoint);
        }
        else {
            return endpoint;
        }
    }

    function getReadyStateChangeHandler(id) {
        var xhr = requestState[id].xhr;

        return function() {
            if (xhr.readyState === 4) {
                onComplete(id, xhr);
            }
        };
    }

    function setHeaders(id) {
        var xhr = requestState[id].xhr,
            customHeaders = options.customHeaders;

        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.setRequestHeader("Cache-Control", "no-cache");

        qq.each(customHeaders, function(name, val) {
            xhr.setRequestHeader(name, val);
        });
    }

    function cancelRequest(id) {
        var xhr = requestState[id].xhr,
            method = getMethod();

        if (xhr) {
            xhr.onreadystatechange = null;
            xhr.abort();
            dequeue(id);

            log('Cancelled ' + method + " for " + id);
            options.onCancel(id);

            return true;
        }

        return false;
    }

    function isResponseSuccessful(responseCode) {
        return qq.indexOf(options.successfulResponseCodes, responseCode) >= 0;
    }

    function getMethod() {
        if (options.demoMode) {
            return "GET";
        }

        return options.method;
    }


    return {
        send: function(id, addToPath) {
            requestState[id] = {
                addToPath: addToPath
            };

            var len = queue.push(id);

            // if too many active connections, wait...
            if (len <= options.maxConnections){
                sendRequest(id);
            }
        },
        cancel: function(id) {
            return cancelRequest(id);
        }
    };
};
/** Generic class for sending non-upload ajax requests and handling the associated responses **/
/*globals qq, XMLHttpRequest*/
qq.DeleteFileAjaxRequestor = function(o) {
    "use strict";

    var requestor,
        options = {
            endpointStore: {},
            maxConnections: 3,
            customHeaders: {},
            paramsStore: {},
            demoMode: false,
            cors: {
                expected: false,
                sendCredentials: false
            },
            log: function(str, level) {},
            onDelete: function(id) {},
            onDeleteComplete: function(id, xhr, isError) {}
        };

    qq.extend(options, o);

    requestor = new qq.AjaxRequestor({
        method: 'DELETE',
        endpointStore: options.endpointStore,
        paramsStore: options.paramsStore,
        maxConnections: options.maxConnections,
        customHeaders: options.customHeaders,
        successfulResponseCodes: [200, 202, 204],
        demoMode: options.demoMode,
        log: options.log,
        onSend: options.onDelete,
        onComplete: options.onDeleteComplete
    });


    return {
        sendDelete: function(id, uuid) {
            requestor.send(id, uuid);
            options.log("Submitted delete file request for " + id);
        }
    };
};
qq.WindowReceiveMessage = function(o) {
    var options = {
            log: function(message, level) {}
        },
        callbackWrapperDetachers = {};

    qq.extend(options, o);

    return {
        receiveMessage : function(id, callback) {
            var onMessageCallbackWrapper = function(event) {
                    callback(event.data);
                };

            if (window.postMessage) {
                callbackWrapperDetachers[id] = qq(window).attach("message", onMessageCallbackWrapper);
            }
            else {
                log("iframe message passing not supported in this browser!", "error");
            }
        },

        stopReceivingMessages : function(id) {
            if (window.postMessage) {
                var detacher = callbackWrapperDetachers[id];
                if (detacher) {
                    detacher();
                }
            }
        }
    };
};
/**
 * Class for uploading files, uploading itself is handled by child classes
 */
/*globals qq*/
qq.UploadHandler = function(o) {
    "use strict";

    var queue = [],
        options, log, dequeue, handlerImpl;

    // Default options, can be overridden by the user
    options = {
        debug: false,
        forceMultipart: true,
        paramsInBody: false,
        paramsStore: {},
        endpointStore: {},
        cors: {
            expected: false,
            sendCredentials: false
        },
        maxConnections: 3, // maximum number of concurrent uploads
        uuidParamName: 'qquuid',
        totalFileSizeParamName: 'qqtotalfilesize',
        chunking: {
            enabled: false,
            partSize: 2000000, //bytes
            paramNames: {
                partIndex: 'qqpartindex',
                partByteOffset: 'qqpartbyteoffset',
                chunkSize: 'qqchunksize',
                totalParts: 'qqtotalparts',
                filename: 'qqfilename'
            }
        },
        resume: {
            enabled: false,
            id: null,
            cookiesExpireIn: 7, //days
            paramNames: {
                resuming: "qqresume"
            }
        },
        blobs: {
            paramNames: {
                name: 'qqblobname'
            }
        },
        log: function(str, level) {},
        onProgress: function(id, fileName, loaded, total){},
        onComplete: function(id, fileName, response, xhr){},
        onCancel: function(id, fileName){},
        onUpload: function(id, fileName){},
        onUploadChunk: function(id, fileName, chunkData){},
        onAutoRetry: function(id, fileName, response, xhr){},
        onResume: function(id, fileName, chunkData){}

    };
    qq.extend(options, o);

    log = options.log;

    /**
     * Removes element from queue, starts upload of next
     */
    dequeue = function(id) {
        var i = qq.indexOf(queue, id),
            max = options.maxConnections,
            nextId;

        if (i >= 0) {
            queue.splice(i, 1);

            if (queue.length >= max && i < max){
                nextId = queue[max-1];
                handlerImpl.upload(nextId);
            }
        }
    };

    if (qq.isXhrUploadSupported()) {
        handlerImpl = new qq.UploadHandlerXhr(options, dequeue, log);
    }
    else {
        handlerImpl = new qq.UploadHandlerForm(options, dequeue, log);
    }


    return {
        /**
         * Adds file or file input to the queue
         * @returns id
         **/
        add: function(file){
            return handlerImpl.add(file);
        },
        /**
         * Sends the file identified by id
         */
        upload: function(id){
            var len = queue.push(id);

            // if too many active uploads, wait...
            if (len <= options.maxConnections){
                return handlerImpl.upload(id);
            }
        },
        retry: function(id) {
            var i = qq.indexOf(queue, id);
            if (i >= 0) {
                return handlerImpl.upload(id, true);
            }
            else {
                return this.upload(id);
            }
        },
        /**
         * Cancels file upload by id
         */
        cancel: function(id) {
            log('Cancelling ' + id);
            options.paramsStore.remove(id);
            handlerImpl.cancel(id);
            dequeue(id);
        },
        /**
         * Cancels all queued or in-progress uploads
         */
        cancelAll: function() {
            var self = this,
                queueCopy = [];

            qq.extend(queueCopy, queue);
            qq.each(queueCopy, function(idx, fileId) {
                self.cancel(fileId);
            });

            queue = [];
        },
        /**
         * Returns name of the file identified by id
         */
        getName: function(id){
            return handlerImpl.getName(id);
        },
        /**
         * Returns size of the file identified by id
         */
        getSize: function(id){
            if (handlerImpl.getSize) {
                return handlerImpl.getSize(id);
            }
        },
        getFile: function(id) {
            if (handlerImpl.getFile) {
                return handlerImpl.getFile(id);
            }
        },
        /**
         * Returns id of files being uploaded or
         * waiting for their turn
         */
        getQueue: function(){
            return queue;
        },
        reset: function() {
            log('Resetting upload handler');
            queue = [];
            handlerImpl.reset();
        },
        getUuid: function(id) {
            return handlerImpl.getUuid(id);
        },
        /**
         * Determine if the file exists.
         */
        isValid: function(id) {
            return handlerImpl.isValid(id);
        },
        getResumableFilesData: function() {
            if (handlerImpl.getResumableFilesData) {
                return handlerImpl.getResumableFilesData();
            }
            return [];
        }
    };
};
/*globals qq, document, setTimeout*/
/*globals clearTimeout*/
qq.UploadHandlerForm = function(o, uploadCompleteCallback, logCallback) {
    "use strict";

    var options = o,
        inputs = [],
        uuids = [],
        detachLoadEvents = {},
        postMessageCallbackTimers = {},
        uploadComplete = uploadCompleteCallback,
        log = logCallback,
        corsMessageReceiver = new qq.WindowReceiveMessage({log: log}),
        onloadCallbacks = {},
        api;


    function detachLoadEvent(id) {
        if (detachLoadEvents[id] !== undefined) {
            detachLoadEvents[id]();
            delete detachLoadEvents[id];
        }
    }

    function registerPostMessageCallback(iframe, callback) {
        var id = iframe.id;

        onloadCallbacks[uuids[id]] = callback;

        detachLoadEvents[id] = qq(iframe).attach('load', function() {
            if (inputs[id]) {
                log("Received iframe load event for CORS upload request (file id " + id + ")");

                postMessageCallbackTimers[id] = setTimeout(function() {
                    var errorMessage = "No valid message received from loaded iframe for file id " + id;
                    log(errorMessage, "error");
                    callback({
                        error: errorMessage
                    });
                }, 1000);
            }
        });

        corsMessageReceiver.receiveMessage(id, function(message) {
            log("Received the following window message: '" + message + "'");
            var response = qq.parseJson(message),
                uuid = response.uuid,
                onloadCallback;

            if (uuid && onloadCallbacks[uuid]) {
                clearTimeout(postMessageCallbackTimers[id]);
                delete postMessageCallbackTimers[id];

                detachLoadEvent(id);

                onloadCallback = onloadCallbacks[uuid];

                delete onloadCallbacks[uuid];
                corsMessageReceiver.stopReceivingMessages(id);
                onloadCallback(response);
            }
            else if (!uuid) {
                log("'" + message + "' does not contain a UUID - ignoring.");
            }
        });
    }

    function attachLoadEvent(iframe, callback) {
        /*jslint eqeq: true*/

        if (options.cors.expected) {
            registerPostMessageCallback(iframe, callback);
        }
        else {
            detachLoadEvents[iframe.id] = qq(iframe).attach('load', function(){
                log('Received response for ' + iframe.id);

                // when we remove iframe from dom
                // the request stops, but in IE load
                // event fires
                if (!iframe.parentNode){
                    return;
                }

                try {
                    // fixing Opera 10.53
                    if (iframe.contentDocument &&
                        iframe.contentDocument.body &&
                        iframe.contentDocument.body.innerHTML == "false"){
                        // In Opera event is fired second time
                        // when body.innerHTML changed from false
                        // to server response approx. after 1 sec
                        // when we upload file with iframe
                        return;
                    }
                }
                catch (error) {
                    //IE may throw an "access is denied" error when attempting to access contentDocument on the iframe in some cases
                    log('Error when attempting to access iframe during handling of upload response (' + error + ")", 'error');
                }

                callback();
            });
        }
    }

    /**
     * Returns json object received by iframe from server.
     */
    function getIframeContentJson(iframe) {
        /*jshint evil: true*/

        var response;

        //IE may throw an "access is denied" error when attempting to access contentDocument on the iframe in some cases
        try {
            // iframe.contentWindow.document - for IE<7
            var doc = iframe.contentDocument || iframe.contentWindow.document,
                innerHTML = doc.body.innerHTML;

            log("converting iframe's innerHTML to JSON");
            log("innerHTML = " + innerHTML);
            //plain text response may be wrapped in <pre> tag
            if (innerHTML && innerHTML.match(/^<pre/i)) {
                innerHTML = doc.body.firstChild.firstChild.nodeValue;
            }

            response = qq.parseJson(innerHTML);
        } catch(error){
            log('Error when attempting to parse form upload response (' + error + ")", 'error');
            response = {success: false};
        }

        return response;
    }

    /**
     * Creates iframe with unique name
     */
    function createIframe(id){
        // We can't use following code as the name attribute
        // won't be properly registered in IE6, and new window
        // on form submit will open
        // var iframe = document.createElement('iframe');
        // iframe.setAttribute('name', id);

        var iframe = qq.toElement('<iframe src="javascript:false;" name="' + id + '" />');

        iframe.setAttribute('id', id);

        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        return iframe;
    }

    /**
     * Creates form, that will be submitted to iframe
     */
    function createForm(id, iframe){
        var params = options.paramsStore.getParams(id),
            protocol = options.demoMode ? "GET" : "POST",
            form = qq.toElement('<form method="' + protocol + '" enctype="multipart/form-data"></form>'),
            endpoint = options.endpointStore.getEndpoint(id),
            url = endpoint;

        params[options.uuidParamName] = uuids[id];

        if (!options.paramsInBody) {
            url = qq.obj2url(params, endpoint);
        }
        else {
            qq.obj2Inputs(params, form);
        }

        form.setAttribute('action', url);
        form.setAttribute('target', iframe.name);
        form.style.display = 'none';
        document.body.appendChild(form);

        return form;
    }


    api = {
        add: function(fileInput) {
            fileInput.setAttribute('name', options.inputName);

            var id = inputs.push(fileInput) - 1;
            uuids[id] = qq.getUniqueId();

            // remove file input from DOM
            if (fileInput.parentNode){
                qq(fileInput).remove();
            }

            return id;
        },
        getName: function(id) {
            /*jslint regexp: true*/

            // get input value and remove path to normalize
            return inputs[id].value.replace(/.*(\/|\\)/, "");
        },
        isValid: function(id) {
            return inputs[id] !== undefined;
        },
        reset: function() {
            qq.UploadHandler.prototype.reset.apply(this, arguments);
            inputs = [];
            uuids = [];
            detachLoadEvents = {};
        },
        getUuid: function(id) {
            return uuids[id];
        },
        cancel: function(id) {
            options.onCancel(id, this.getName(id));

            delete inputs[id];
            delete uuids[id];
            delete detachLoadEvents[id];

            if (options.cors.expected) {
                clearTimeout(postMessageCallbackTimers[id]);
                delete postMessageCallbackTimers[id];
                corsMessageReceiver.stopReceivingMessages(id);
            }

            var iframe = document.getElementById(id);
            if (iframe) {
                // to cancel request set src to something else
                // we use src="javascript:false;" because it doesn't
                // trigger ie6 prompt on https
                iframe.setAttribute('src', 'java' + String.fromCharCode(115) + 'cript:false;'); //deal with "JSLint: javascript URL" warning, which apparently cannot be turned off

                qq(iframe).remove();
            }
        },
        upload: function(id){
            var input = inputs[id],
                fileName = api.getName(id),
                iframe = createIframe(id),
                form;

            if (!input){
                throw new Error('file with passed id was not added, or already uploaded or cancelled');
            }

            options.onUpload(id, this.getName(id));

            form = createForm(id, iframe);
            form.appendChild(input);

            attachLoadEvent(iframe, function(responseFromMessage){
                log('iframe loaded');

                var response = responseFromMessage ? responseFromMessage : getIframeContentJson(iframe);

                detachLoadEvent(id);

                //we can't remove an iframe if the iframe doesn't belong to the same domain
                if (!options.cors.expected) {
                    qq(iframe).remove();
                }

                if (!response.success) {
                    if (options.onAutoRetry(id, fileName, response)) {
                        return;
                    }
                }
                options.onComplete(id, fileName, response);
                uploadComplete(id);
            });

            log('Sending upload request for ' + id);
            form.submit();
            qq(form).remove();

            return id;
        }
    };

    return api;
};
/*globals qq, File, XMLHttpRequest, FormData, Blob*/
qq.UploadHandlerXhr = function(o, uploadCompleteCallback, logCallback) {
    "use strict";
    
    var options = o,
        uploadComplete = uploadCompleteCallback,
        log = logCallback,
        fileState = [],
        cookieItemDelimiter = "|",
        chunkFiles = options.chunking.enabled && qq.isFileChunkingSupported(),
        resumeEnabled = options.resume.enabled && chunkFiles && qq.areCookiesEnabled(),
        resumeId = getResumeId(),
        multipart = options.forceMultipart || options.paramsInBody,
        api;


     function addChunkingSpecificParams(id, params, chunkData) {
        var size = api.getSize(id),
            name = api.getName(id);

        params[options.chunking.paramNames.partIndex] = chunkData.part;
        params[options.chunking.paramNames.partByteOffset] = chunkData.start;
        params[options.chunking.paramNames.chunkSize] = chunkData.size;
        params[options.chunking.paramNames.totalParts] = chunkData.count;
        params[options.totalFileSizeParamName] = size;

        /**
         * When a Blob is sent in a multipart request, the filename value in the content-disposition header is either "blob"
         * or an empty string.  So, we will need to include the actual file name as a param in this case.
         */
        if (multipart) {
            params[options.chunking.paramNames.filename] = name;
        }
    }

    function addResumeSpecificParams(params) {
        params[options.resume.paramNames.resuming] = true;
    }

     function getChunk(fileOrBlob, startByte, endByte) {
        if (fileOrBlob.slice) {
            return fileOrBlob.slice(startByte, endByte);
        }
        else if (fileOrBlob.mozSlice) {
            return fileOrBlob.mozSlice(startByte, endByte);
        }
        else if (fileOrBlob.webkitSlice) {
            return fileOrBlob.webkitSlice(startByte, endByte);
        }
    }

    function getChunkData(id, chunkIndex) {
        var chunkSize = options.chunking.partSize,
            fileSize = api.getSize(id),
            fileOrBlob = fileState[id].file || fileState[id].blobData.blob,
            startBytes = chunkSize * chunkIndex,
            endBytes = startBytes+chunkSize >= fileSize ? fileSize : startBytes+chunkSize,
            totalChunks = getTotalChunks(id);

        return {
            part: chunkIndex,
            start: startBytes,
            end: endBytes,
            count: totalChunks,
            blob: getChunk(fileOrBlob, startBytes, endBytes),
            size: endBytes - startBytes
        };
    }

    function getTotalChunks(id) {
        var fileSize = api.getSize(id),
            chunkSize = options.chunking.partSize;

        return Math.ceil(fileSize / chunkSize);
    }

    function createXhr(id) {
        var xhr = new XMLHttpRequest();

        fileState[id].xhr = xhr;

        return xhr;
    }

    function setParamsAndGetEntityToSend(params, xhr, fileOrBlob, id) {
        var formData = new FormData(),
            method = options.demoMode ? "GET" : "POST",
            endpoint = options.endpointStore.getEndpoint(id),
            url = endpoint,
            name = api.getName(id),
            size = api.getSize(id),
            blobData = fileState[id].blobData;

        params[options.uuidParamName] = fileState[id].uuid;

        if (multipart) {
            params[options.totalFileSizeParamName] = size;

            if (blobData) {
                /**
                 * When a Blob is sent in a multipart request, the filename value in the content-disposition header is either "blob"
                 * or an empty string.  So, we will need to include the actual file name as a param in this case.
                 */
                params[options.blobs.paramNames.name] = blobData.name;
            }
        }

        //build query string
        if (!options.paramsInBody) {
            if (!multipart) {
                params[options.inputName] = name;
            }
            url = qq.obj2url(params, endpoint);
        }

        xhr.open(method, url, true);

        if (options.cors.expected && options.cors.sendCredentials) {
            xhr.withCredentials = true;
        }

        if (multipart) {
            if (options.paramsInBody) {
                qq.obj2FormData(params, formData);
            }

            formData.append(options.inputName, fileOrBlob);
            return formData;
        }

        return fileOrBlob;
    }

    function setHeaders(id, xhr) {
        var extraHeaders = options.customHeaders,
            fileOrBlob = fileState[id].file || fileState[id].blobData.blob;

        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.setRequestHeader("Cache-Control", "no-cache");

        if (!multipart) {
            xhr.setRequestHeader("Content-Type", "application/octet-stream");
            //NOTE: return mime type in xhr works on chrome 16.0.9 firefox 11.0a2
            xhr.setRequestHeader("X-Mime-Type", fileOrBlob.type);
        }

        qq.each(extraHeaders, function(name, val) {
            xhr.setRequestHeader(name, val);
        });
    }

    function handleCompletedItem(id, response, xhr) {
        var name = api.getName(id),
            size = api.getSize(id);

        fileState[id].attemptingResume = false;

        options.onProgress(id, name, size, size);

        options.onComplete(id, name, response, xhr);
        delete fileState[id].xhr;
        uploadComplete(id);
    }

    function uploadNextChunk(id) {
        var chunkIdx = fileState[id].remainingChunkIdxs[0],
            chunkData = getChunkData(id, chunkIdx),
            xhr = createXhr(id),
            size = api.getSize(id),
            name = api.getName(id),
            toSend, params;

        if (fileState[id].loaded === undefined) {
            fileState[id].loaded = 0;
        }

        if (resumeEnabled && fileState[id].file) {
            persistChunkData(id, chunkData);
        }

        xhr.onreadystatechange = getReadyStateChangeHandler(id, xhr);

        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                var totalLoaded = e.loaded + fileState[id].loaded,
                    estTotalRequestsSize = calcAllRequestsSizeForChunkedUpload(id, chunkIdx, e.total);

                options.onProgress(id, name, totalLoaded, estTotalRequestsSize);
            }
        };

        options.onUploadChunk(id, name, getChunkDataForCallback(chunkData));

        params = options.paramsStore.getParams(id);
        addChunkingSpecificParams(id, params, chunkData);

        if (fileState[id].attemptingResume) {
            addResumeSpecificParams(params);
        }

        toSend = setParamsAndGetEntityToSend(params, xhr, chunkData.blob, id);
        setHeaders(id, xhr);

        log('Sending chunked upload request for item ' + id + ": bytes " + (chunkData.start+1) + "-" + chunkData.end + " of " + size);
        xhr.send(toSend);
    }

    function calcAllRequestsSizeForChunkedUpload(id, chunkIdx, requestSize) {
        var chunkData = getChunkData(id, chunkIdx),
            blobSize = chunkData.size,
            overhead = requestSize - blobSize,
            size = api.getSize(id),
            chunkCount = chunkData.count,
            initialRequestOverhead = fileState[id].initialRequestOverhead,
            overheadDiff = overhead - initialRequestOverhead;

        fileState[id].lastRequestOverhead = overhead;

        if (chunkIdx === 0) {
            fileState[id].lastChunkIdxProgress = 0;
            fileState[id].initialRequestOverhead = overhead;
            fileState[id].estTotalRequestsSize = size + (chunkCount * overhead);
        }
        else if (fileState[id].lastChunkIdxProgress !== chunkIdx) {
            fileState[id].lastChunkIdxProgress = chunkIdx;
            fileState[id].estTotalRequestsSize += overheadDiff;
        }

        return fileState[id].estTotalRequestsSize;
    }

    function getLastRequestOverhead(id) {
        if (multipart) {
            return fileState[id].lastRequestOverhead;
        }
        else {
            return 0;
        }
    }

    function handleSuccessfullyCompletedChunk(id, response, xhr) {
        var chunkIdx = fileState[id].remainingChunkIdxs.shift(),
            chunkData = getChunkData(id, chunkIdx);

        fileState[id].attemptingResume = false;
        fileState[id].loaded += chunkData.size + getLastRequestOverhead(id);

        if (fileState[id].remainingChunkIdxs.length > 0) {
            uploadNextChunk(id);
        }
        else {
            if (resumeEnabled) {
                deletePersistedChunkData(id);
            }

            handleCompletedItem(id, response, xhr);
        }
    }

    function isErrorResponse(xhr, response) {
        return xhr.status !== 200 || !response.success || response.reset;
    }

    function parseResponse(xhr) {
        var response;

        try {
            response = qq.parseJson(xhr.responseText);
        }
        catch(error) {
            log('Error when attempting to parse xhr response text (' + error + ')', 'error');
            response = {};
        }

        return response;
    }

    function handleResetResponse(id) {
        log('Server has ordered chunking effort to be restarted on next attempt for item ID ' + id, 'error');

        if (resumeEnabled) {
            deletePersistedChunkData(id);
            fileState[id].attemptingResume = false;
        }

        fileState[id].remainingChunkIdxs = [];
        delete fileState[id].loaded;
        delete fileState[id].estTotalRequestsSize;
        delete fileState[id].initialRequestOverhead;
    }

    function handleResetResponseOnResumeAttempt(id) {
        fileState[id].attemptingResume = false;
        log("Server has declared that it cannot handle resume for item ID " + id + " - starting from the first chunk", 'error');
        handleResetResponse(id);
        api.upload(id, true);
    }

    function handleNonResetErrorResponse(id, response, xhr) {
        var name = api.getName(id);

        if (options.onAutoRetry(id, name, response, xhr)) {
            return;
        }
        else {
            handleCompletedItem(id, response, xhr);
        }
    }

    function onComplete(id, xhr) {
        var response;

        // the request was aborted/cancelled
        if (!fileState[id]) {
            return;
        }

        log("xhr - server response received for " + id);
        log("responseText = " + xhr.responseText);
        response = parseResponse(xhr);

        if (isErrorResponse(xhr, response)) {
            if (response.reset) {
                handleResetResponse(id);
            }

            if (fileState[id].attemptingResume && response.reset) {
                handleResetResponseOnResumeAttempt(id);
            }
            else {
                handleNonResetErrorResponse(id, response, xhr);
            }
        }
        else if (chunkFiles) {
            handleSuccessfullyCompletedChunk(id, response, xhr);
        }
        else {
            handleCompletedItem(id, response, xhr);
        }
    }

    function getChunkDataForCallback(chunkData) {
        return {
            partIndex: chunkData.part,
            startByte: chunkData.start + 1,
            endByte: chunkData.end,
            totalParts: chunkData.count
        };
    }

    function getReadyStateChangeHandler(id, xhr) {
        return function() {
            if (xhr.readyState === 4) {
                onComplete(id, xhr);
            }
        };
    }

    function persistChunkData(id, chunkData) {
        var fileUuid = api.getUuid(id),
            lastByteSent = fileState[id].loaded,
            initialRequestOverhead = fileState[id].initialRequestOverhead,
            estTotalRequestsSize = fileState[id].estTotalRequestsSize,
            cookieName = getChunkDataCookieName(id),
            cookieValue = fileUuid +
                cookieItemDelimiter + chunkData.part +
                cookieItemDelimiter + lastByteSent +
                cookieItemDelimiter + initialRequestOverhead +
                cookieItemDelimiter + estTotalRequestsSize,
            cookieExpDays = options.resume.cookiesExpireIn;

        qq.setCookie(cookieName, cookieValue, cookieExpDays);
    }

    function deletePersistedChunkData(id) {
        if (fileState[id].file) {
            var cookieName = getChunkDataCookieName(id);
            qq.deleteCookie(cookieName);
        }
    }

    function getPersistedChunkData(id) {
        var chunkCookieValue = qq.getCookie(getChunkDataCookieName(id)),
            filename = api.getName(id),
            sections, uuid, partIndex, lastByteSent, initialRequestOverhead, estTotalRequestsSize;

        if (chunkCookieValue) {
            sections = chunkCookieValue.split(cookieItemDelimiter);

            if (sections.length === 5) {
                uuid = sections[0];
                partIndex = parseInt(sections[1], 10);
                lastByteSent = parseInt(sections[2], 10);
                initialRequestOverhead = parseInt(sections[3], 10);
                estTotalRequestsSize = parseInt(sections[4], 10);

                return {
                    uuid: uuid,
                    part: partIndex,
                    lastByteSent: lastByteSent,
                    initialRequestOverhead: initialRequestOverhead,
                    estTotalRequestsSize: estTotalRequestsSize
                };
            }
            else {
                log('Ignoring previously stored resume/chunk cookie for ' + filename + " - old cookie format", "warn");
            }
        }
    }

    function getChunkDataCookieName(id) {
        var filename = api.getName(id),
            fileSize = api.getSize(id),
            maxChunkSize = options.chunking.partSize,
            cookieName;

        cookieName = "qqfilechunk" + cookieItemDelimiter + encodeURIComponent(filename) + cookieItemDelimiter + fileSize + cookieItemDelimiter + maxChunkSize;

        if (resumeId !== undefined) {
            cookieName += cookieItemDelimiter + resumeId;
        }

        return cookieName;
    }

    function getResumeId() {
        if (options.resume.id !== null &&
            options.resume.id !== undefined &&
            !qq.isFunction(options.resume.id) &&
            !qq.isObject(options.resume.id)) {

            return options.resume.id;
        }
    }

    function handleFileChunkingUpload(id, retry) {
        var name = api.getName(id),
            firstChunkIndex = 0,
            persistedChunkInfoForResume, firstChunkDataForResume, currentChunkIndex;

        if (!fileState[id].remainingChunkIdxs || fileState[id].remainingChunkIdxs.length === 0) {
            fileState[id].remainingChunkIdxs = [];

            if (resumeEnabled && !retry && fileState[id].file) {
                persistedChunkInfoForResume = getPersistedChunkData(id);
                if (persistedChunkInfoForResume) {
                    firstChunkDataForResume = getChunkData(id, persistedChunkInfoForResume.part);
                    if (options.onResume(id, name, getChunkDataForCallback(firstChunkDataForResume)) !== false) {
                        firstChunkIndex = persistedChunkInfoForResume.part;
                        fileState[id].uuid = persistedChunkInfoForResume.uuid;
                        fileState[id].loaded = persistedChunkInfoForResume.lastByteSent;
                        fileState[id].estTotalRequestsSize = persistedChunkInfoForResume.estTotalRequestsSize;
                        fileState[id].initialRequestOverhead = persistedChunkInfoForResume.initialRequestOverhead;
                        fileState[id].attemptingResume = true;
                        log('Resuming ' + name + " at partition index " + firstChunkIndex);
                    }
                }
            }

            for (currentChunkIndex = getTotalChunks(id)-1; currentChunkIndex >= firstChunkIndex; currentChunkIndex-=1) {
                fileState[id].remainingChunkIdxs.unshift(currentChunkIndex);
            }
        }

        uploadNextChunk(id);
    }

    function handleStandardFileUpload(id) {
        var fileOrBlob = fileState[id].file || fileState[id].blobData.blob,
            name = api.getName(id),
            xhr, params, toSend;

        fileState[id].loaded = 0;

        xhr = createXhr(id);

        xhr.upload.onprogress = function(e){
            if (e.lengthComputable){
                fileState[id].loaded = e.loaded;
                options.onProgress(id, name, e.loaded, e.total);
            }
        };

        xhr.onreadystatechange = getReadyStateChangeHandler(id, xhr);

        params = options.paramsStore.getParams(id);
        toSend = setParamsAndGetEntityToSend(params, xhr, fileOrBlob, id);
        setHeaders(id, xhr);

        log('Sending upload request for ' + id);
        xhr.send(toSend);
    }


    api = {
        /**
         * Adds File or Blob to the queue
         * Returns id to use with upload, cancel
         **/
        add: function(fileOrBlobData){
            var id;

            if (fileOrBlobData instanceof File) {
                id = fileState.push({file: fileOrBlobData}) - 1;
            }
            else if (fileOrBlobData.blob instanceof Blob) {
                id = fileState.push({blobData: fileOrBlobData}) - 1;
            }
            else {
                throw new Error('Passed obj in not a File or BlobData (in qq.UploadHandlerXhr)');
            }

            fileState[id].uuid = qq.getUniqueId();
            return id;
        },
        getName: function(id){
            var file = fileState[id].file,
                blobData = fileState[id].blobData;

            if (file) {
                // fix missing name in Safari 4
                //NOTE: fixed missing name firefox 11.0a2 file.fileName is actually undefined
                return (file.fileName !== null && file.fileName !== undefined) ? file.fileName : file.name;
            }
            else {
                return blobData.name;
            }
        },
        getSize: function(id){
            /*jshint eqnull: true*/
            var fileOrBlob = fileState[id].file || fileState[id].blobData.blob;

            if (qq.isFileOrInput(fileOrBlob)) {
                return fileOrBlob.fileSize != null ? fileOrBlob.fileSize : fileOrBlob.size;
            }
            else {
                return fileOrBlob.size;
            }
        },
        getFile: function(id) {
            if (fileState[id]) {
                return fileState[id].file || fileState[id].blobData.blob;
            }
        },
        /**
         * Returns uploaded bytes for file identified by id
         */
        getLoaded: function(id){
            return fileState[id].loaded || 0;
        },
        isValid: function(id) {
            return fileState[id] !== undefined;
        },
        reset: function() {
            fileState = [];
        },
        getUuid: function(id) {
            return fileState[id].uuid;
        },
        /**
         * Sends the file identified by id to the server
         */
        upload: function(id, retry){
            var name = this.getName(id);

            options.onUpload(id, name);

            if (chunkFiles) {
                handleFileChunkingUpload(id, retry);
            }
            else {
                handleStandardFileUpload(id);
            }
        },
        cancel: function(id){
            var xhr = fileState[id].xhr;

            options.onCancel(id, this.getName(id));

            if (xhr) {
                xhr.onreadystatechange = null;
                xhr.abort();
            }

            if (resumeEnabled) {
                deletePersistedChunkData(id);
            }

            delete fileState[id];
        },
        getResumableFilesData: function() {
            var matchingCookieNames = [],
                resumableFilesData = [];

            if (chunkFiles && resumeEnabled) {
                if (resumeId === undefined) {
                    matchingCookieNames = qq.getCookieNames(new RegExp("^qqfilechunk\\" + cookieItemDelimiter + ".+\\" +
                        cookieItemDelimiter + "\\d+\\" + cookieItemDelimiter + options.chunking.partSize + "="));
                }
                else {
                    matchingCookieNames = qq.getCookieNames(new RegExp("^qqfilechunk\\" + cookieItemDelimiter + ".+\\" +
                        cookieItemDelimiter + "\\d+\\" + cookieItemDelimiter + options.chunking.partSize + "\\" +
                        cookieItemDelimiter + resumeId + "="));
                }

                qq.each(matchingCookieNames, function(idx, cookieName) {
                    var cookiesNameParts = cookieName.split(cookieItemDelimiter);
                    var cookieValueParts = qq.getCookie(cookieName).split(cookieItemDelimiter);

                    resumableFilesData.push({
                        name: decodeURIComponent(cookiesNameParts[1]),
                        size: cookiesNameParts[2],
                        uuid: cookieValueParts[0],
                        partIdx: cookieValueParts[1]
                    });
                });

                return resumableFilesData;
            }
            return [];
        }
    };

    return api;
};
