(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var addDataAttr = require("./utils").addDataAttr,
    browser = require("./browser");

module.exports = function(window, options) {

    // use options from the current script tag data attribues
    addDataAttr(options, browser.currentScript(window));

    if (options.isFileProtocol === undefined) {
        options.isFileProtocol = /^(file|(chrome|safari)(-extension)?|resource|qrc|app):/.test(window.location.protocol);
    }

    // Load styles asynchronously (default: false)
    //
    // This is set to `false` by default, so that the body
    // doesn't start loading before the stylesheets are parsed.
    // Setting this to `true` can result in flickering.
    //
    options.async = options.async || false;
    options.fileAsync = options.fileAsync || false;

    // Interval between watch polls
    options.poll = options.poll || (options.isFileProtocol ? 1000 : 1500);

    options.env = options.env || (window.location.hostname == '127.0.0.1' ||
        window.location.hostname == '0.0.0.0'   ||
        window.location.hostname == 'localhost' ||
        (window.location.port &&
            window.location.port.length > 0)      ||
        options.isFileProtocol                   ? 'development'
        : 'production');

    var dumpLineNumbers = /!dumpLineNumbers:(comments|mediaquery|all)/.exec(window.location.hash);
    if (dumpLineNumbers) {
        options.dumpLineNumbers = dumpLineNumbers[1];
    }

    if (options.useFileCache === undefined) {
        options.useFileCache = true;
    }

    if (options.onReady === undefined) {
        options.onReady = true;
    }

};

},{"./browser":3,"./utils":9}],2:[function(require,module,exports){
/**
 * Kicks off less and compiles any stylesheets
 * used in the browser distributed version of less
 * to kick-start less using the browser api
 */
/*global window */

// shim Promise if required
//require('promise/polyfill.js');

var options = window.jss || {};
require("./add-default-options")(window, options);

var jss = module.exports = require("./index")(window, options);

window.jss = jss;

if (options.onReady) {
    if (/!watch/.test(window.location.hash)) {
        jss.watch();
    }

    jss.registerStylesheetsImmediately();
    jss.pageLoadFinished = jss.refresh(jss.env === 'development');
}

},{"./add-default-options":1,"./index":7}],3:[function(require,module,exports){
var utils = require("./utils");
module.exports = {
    createCSS: function (document, styles, sheet) {
        // Strip the query-string
        var href = sheet.href || '';

        // If there is no title set, use the filename, minus the extension
        var id = 'jss:' + (sheet.title || utils.extractId(href));

        // If this has already been inserted into the DOM, we may need to replace it
        var oldStyleNode = document.getElementById(id);
        var keepOldStyleNode = false;

        // Create a new stylesheet node for insertion or (if necessary) replacement
        var styleNode = document.createElement('style');
        styleNode.setAttribute('type', 'text/css');
        if (sheet.media) {
            styleNode.setAttribute('media', sheet.media);
        }
        styleNode.id = id;

        if (!styleNode.styleSheet) {
            styleNode.appendChild(document.createTextNode(styles));

            // If new contents match contents of oldStyleNode, don't replace oldStyleNode
            keepOldStyleNode = (oldStyleNode !== null && oldStyleNode.childNodes.length > 0 && styleNode.childNodes.length > 0 &&
                oldStyleNode.firstChild.nodeValue === styleNode.firstChild.nodeValue);
        }

        var head = document.getElementsByTagName('head')[0];

        // If there is no oldStyleNode, just append; otherwise, only append if we need
        // to replace oldStyleNode with an updated stylesheet
        if (oldStyleNode === null || keepOldStyleNode === false) {
            var nextEl = sheet && sheet.nextSibling || null;
            if (nextEl) {
                nextEl.parentNode.insertBefore(styleNode, nextEl);
            } else {
                head.appendChild(styleNode);
            }
        }
        if (oldStyleNode && keepOldStyleNode === false) {
            oldStyleNode.parentNode.removeChild(oldStyleNode);
        }

        // For IE.
        // This needs to happen *after* the style element is added to the DOM, otherwise IE 7 and 8 may crash.
        // See http://social.msdn.microsoft.com/Forums/en-US/7e081b65-878a-4c22-8e68-c10d39c2ed32/internet-explorer-crashes-appending-style-element-to-head
        if (styleNode.styleSheet) {
            try {
                styleNode.styleSheet.cssText = styles;
            } catch (e) {
                throw new Error("Couldn't reassign styleSheet.cssText.");
            }
        }
    },
    currentScript: function(window) {
        var document = window.document;
        return document.currentScript || (function() {
            var scripts = document.getElementsByTagName("script");
            return scripts[scripts.length - 1];
        })();
    }
};

},{"./utils":9}],4:[function(require,module,exports){
// Cache system is a bit outdated and could do with work

module.exports = function(window, options, logger) {
    var cache = null;
    if (options.env !== 'development') {
        try {
            cache = (typeof window.localStorage === 'undefined') ? null : window.localStorage;
        } catch (_) {}
    }
    return {
        setCSS: function(path, lastModified, styles) {
            if (cache) {
                logger.info('saving ' + path + ' to cache.');
                try {
                    cache.setItem(path, styles);
                    cache.setItem(path + ':timestamp', lastModified);
                } catch(e) {
                    //TODO - could do with adding more robust error handling
                    logger.error('failed to save "' + path + '" to local storage for caching.');
                }
            }
        },
        getCSS: function(path, webInfo) {
            var css       = cache && cache.getItem(path),
                timestamp = cache && cache.getItem(path + ':timestamp');

            if (timestamp && webInfo.lastModified &&
                (new Date(webInfo.lastModified).valueOf() ===
                    new Date(timestamp).valueOf())) {
                // Use local copy
                return css;
            }
        }
    };
};

},{}],5:[function(require,module,exports){
var utils = require("./utils"),
    browser = require("./browser");

module.exports = function(window, jss, options) {

    function errorHTML(e, rootHref) {
        var id = 'jss-error-message:' + utils.extractId(rootHref || "");
        var template = '<li><label>{line}</label><pre class="{class}">{content}</pre></li>';
        var elem = window.document.createElement('div'), timer, content, errors = [];
        var filename = e.filename || rootHref;
        var filenameNoPath = filename.match(/([^\/]+(\?.*)?)$/)[1];

        elem.id        = id;
        elem.className = "jss-error-message";

        content = '<h3>'  + (e.type || "Syntax") + "Error: " + (e.message || 'There is an error in your .jss file') +
            '</h3>' + '<p>in <a href="' + filename   + '">' + filenameNoPath + "</a> ";

        var errorline = function (e, i, classname) {
            if (e.extract[i] !== undefined) {
                errors.push(template.replace(/\{line\}/, (parseInt(e.line, 10) || 0) + (i - 1))
                    .replace(/\{class\}/, classname)
                    .replace(/\{content\}/, e.extract[i]));
            }
        };

        if (e.extract) {
            errorline(e, 0, '');
            errorline(e, 1, 'line');
            errorline(e, 2, '');
            content += 'on line ' + e.line + ', column ' + (e.column + 1) + ':</p>' +
                '<ul>' + errors.join('') + '</ul>';
        }
        if (e.stack && (e.extract || options.logLevel >= 4)) {
            content += '<br/>Stack Trace</br />' + e.stack.split('\n').slice(1).join('<br/>');
        }
        elem.innerHTML = content;

        // CSS for error messages
        browser.createCSS(window.document, [
            '.jss-error-message ul, .jss-error-message li {',
            'list-style-type: none;',
            'margin-right: 15px;',
            'padding: 4px 0;',
            'margin: 0;',
            '}',
            '.jss-error-message label {',
            'font-size: 12px;',
            'margin-right: 15px;',
            'padding: 4px 0;',
            'color: #cc7777;',
            '}',
            '.jss-error-message pre {',
            'color: #dd6666;',
            'padding: 4px 0;',
            'margin: 0;',
            'display: inline-block;',
            '}',
            '.jss-error-message pre.line {',
            'color: #ff0000;',
            '}',
            '.jss-error-message h3 {',
            'font-size: 20px;',
            'font-weight: bold;',
            'padding: 15px 0 5px 0;',
            'margin: 0;',
            '}',
            '.jss-error-message a {',
            'color: #10a',
            '}',
            '.jss-error-message .error {',
            'color: red;',
            'font-weight: bold;',
            'padding-bottom: 2px;',
            'border-bottom: 1px dashed red;',
            '}'
        ].join('\n'), { title: 'error-message' });

        elem.style.cssText = [
            "font-family: Arial, sans-serif",
            "border: 1px solid #e00",
            "background-color: #eee",
            "border-radius: 5px",
            "-webkit-border-radius: 5px",
            "-moz-border-radius: 5px",
            "color: #e00",
            "padding: 15px",
            "margin-bottom: 15px"
        ].join(';');

        if (options.env === 'development') {
            timer = setInterval(function () {
                var document = window.document,
                    body = document.body;
                if (body) {
                    if (document.getElementById(id)) {
                        body.replaceChild(elem, document.getElementById(id));
                    } else {
                        body.insertBefore(elem, body.firstChild);
                    }
                    clearInterval(timer);
                }
            }, 10);
        }
    }

    function error(e, rootHref) {
        if (!options.errorReporting || options.errorReporting === "html") {
            errorHTML(e, rootHref);
        } else if (options.errorReporting === "console") {
            errorConsole(e, rootHref);
        } else if (typeof options.errorReporting === 'function') {
            options.errorReporting("add", e, rootHref);
        }
    }

    function removeErrorHTML(path) {
        var node = window.document.getElementById('jss-error-message:' + utils.extractId(path));
        if (node) {
            node.parentNode.removeChild(node);
        }
    }

    function removeErrorConsole(path) {
        //no action
    }

    function removeError(path) {
        if (!options.errorReporting || options.errorReporting === "html") {
            removeErrorHTML(path);
        } else if (options.errorReporting === "console") {
            removeErrorConsole(path);
        } else if (typeof options.errorReporting === 'function') {
            options.errorReporting("remove", path);
        }
    }

    function errorConsole(e, rootHref) {
        var template = '{line} {content}';
        var filename = e.filename || rootHref;
        var errors = [];
        var content = (e.type || "Syntax") + "Error: " + (e.message || 'There is an error in your .jss file') +
            " in " + filename + " ";

        var errorline = function (e, i, classname) {
            if (e.extract[i] !== undefined) {
                errors.push(template.replace(/\{line\}/, (parseInt(e.line, 10) || 0) + (i - 1))
                    .replace(/\{class\}/, classname)
                    .replace(/\{content\}/, e.extract[i]));
            }
        };

        if (e.extract) {
            errorline(e, 0, '');
            errorline(e, 1, 'line');
            errorline(e, 2, '');
            content += 'on line ' + e.line + ', column ' + (e.column + 1) + ':\n' +
                errors.join('\n');
        }
        if (e.stack && (e.extract || options.logLevel >= 4)) {
            content += '\nStack Trace\n' + e.stack;
        }
        jss.logger.error(content);
    }

    return {
        add: error,
        remove: removeError
    };
};

},{"./browser":3,"./utils":9}],6:[function(require,module,exports){
/*global window, XMLHttpRequest */

module.exports = function(options, logger) {

    var AbstractFileManager = require("../environment/abstract-file-manager.js");

    var fileCache = {};

    //TODOS - move log somewhere. pathDiff and doing something similar in node. use pathDiff in the other browser file for the initial load

    function getXMLHttpRequest() {
        if (window.XMLHttpRequest && (window.location.protocol !== "file:" || !("ActiveXObject" in window))) {
            return new XMLHttpRequest();
        } else {
            try {
                /*global ActiveXObject */
                return new ActiveXObject("Microsoft.XMLHTTP");
            } catch (e) {
                logger.error("browser doesn't support AJAX.");
                return null;
            }
        }
    }

    var FileManager = function() {
    };

    FileManager.prototype = new AbstractFileManager();

    FileManager.prototype.alwaysMakePathsAbsolute = function alwaysMakePathsAbsolute() {
        return true;
    };
    FileManager.prototype.join = function join(basePath, laterPath) {
        if (!basePath) {
            return laterPath;
        }
        return this.extractUrlParts(laterPath, basePath).path;
    };
    FileManager.prototype.doXHR = function doXHR(url, type, callback, errback) {

        var xhr = getXMLHttpRequest();
        var async = options.isFileProtocol ? options.fileAsync : options.async;

        if (typeof xhr.overrideMimeType === 'function') {
            xhr.overrideMimeType('text/css');
        }
        logger.debug("XHR: Getting '" + url + "'");
        xhr.open('GET', url, async);
        xhr.setRequestHeader('Accept', type || 'text/x-jss, text/css; q=0.9, */*; q=0.5');
        xhr.send(null);

        function handleResponse(xhr, callback, errback) {
            if (xhr.status >= 200 && xhr.status < 300) {
                callback(xhr.responseText,
                    xhr.getResponseHeader("Last-Modified"));
            } else if (typeof errback === 'function') {
                errback(xhr.status, url);
            }
        }

        if (options.isFileProtocol && !options.fileAsync) {
            if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
                callback(xhr.responseText);
            } else {
                errback(xhr.status, url);
            }
        } else if (async) {
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    handleResponse(xhr, callback, errback);
                }
            };
        } else {
            handleResponse(xhr, callback, errback);
        }
    };
    FileManager.prototype.supports = function(filename, currentDirectory, options, environment) {
        return true;
    };

    FileManager.prototype.clearFileCache = function() {
        fileCache = {};
    };

    FileManager.prototype.loadFile = function loadFile(filename, currentDirectory, options, environment, callback) {
        if (currentDirectory && !this.isPathAbsolute(filename)) {
            filename = currentDirectory + filename;
        }

        options = options || {};

        // sheet may be set to the stylesheet for the initial load or a collection of properties including
        // some context variables for imports
        var hrefParts = this.extractUrlParts(filename, window.location.href);
        var href      = hrefParts.url;

        if (options.useFileCache && fileCache[href]) {
            try {
                var jssText = fileCache[href];
                callback(null, { contents: jssText, filename: href, webInfo: { lastModified: new Date() }});
            } catch (e) {
                callback({filename: href, message: "Error loading file " + href + " error was " + e.message});
            }
            return;
        }

        this.doXHR(href, options.mime, function doXHRCallback(data, lastModified) {
            // per file cache
            fileCache[href] = data;

            // Use remote copy (re-parse)
            callback(null, { contents: data, filename: href, webInfo: { lastModified: lastModified }});
        }, function doXHRError(status, url) {
            callback({ type: 'File', message: "'" + url + "' wasn't found (" + status + ")", href: href });
        });
    };

    return FileManager;
};

},{"../environment/abstract-file-manager.js":10}],7:[function(require,module,exports){
//
// index.js
// Should expose the additional browser functions on to the jss object
//
var addDataAttr = require("./utils").addDataAttr,
    browser = require("./browser");

module.exports = function(window, options) {
    var document = window.document;

/*    var jss = {
        version: [2, 5, 1],
        // data: require('./data'),
        // tree: require('./tree'),
        Environment: (Environment = require("../environment/environment")),
        AbstractFileManager: require("../environment/abstract-file-manager"),
        environment: (environment = new Environment(environment, fileManagers)),
        // visitors: require('./visitors'),
        // Parser: require('./parser/parser'),
        // functions: require('./functions')(environment),
        // contexts: require("./contexts"),
        // SourceMapOutput: (SourceMapOutput = require('./source-map-output')(environment)),
        // SourceMapBuilder: (SourceMapBuilder = require('./source-map-builder')(SourceMapOutput, environment)),
        // ParseTree: (ParseTree = require('./parse-tree')(SourceMapBuilder)),
        // ImportManager: (ImportManager = require('./import-manager')(environment)),
        // render: require("./render")(environment, ParseTree, ImportManager),
        // parse: require("./parse")(environment, ParseTree, ImportManager),
        // LessError: require('./less-error'),
        // transformTree: require('./transform-tree'),
        // utils: require('./utils'),
        // PluginManager: require('./plugin-manager'),
        logger: require('./logger')
    };*/


    var jss = require('../index')();

    //module.exports = jss;
    jss.options = options;
    var environment = jss.environment,
        FileManager = require("./file-manager")(options, jss.logger),
        fileManager = new FileManager();
    environment.addFileManager(fileManager);
    jss.FileManager = FileManager;

    require("./log-listener")(jss, options);
    var errors = require("./error-reporting")(window, jss, options);
    var cache = jss.cache = options.cache || require("./cache")(window, options, jss.logger);

    //Setup user functions
    if (options.functions) {
        jss.functions.functionRegistry.addMultiple(options.functions);
    }

    var typePattern = /^text\/(x-)?jss$/;

    function postProcessCSS(styles) { // deprecated, use a plugin for postprocesstasks
        if (options.postProcessor && typeof options.postProcessor === 'function') {
            styles = options.postProcessor.call(styles, styles) || styles;
        }
        return styles;
    }

    function clone(obj) {
        var cloned = {};
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                cloned[prop] = obj[prop];
            }
        }
        return cloned;
    }

    // only really needed for phantom
    function bind(func, thisArg) {
        var curryArgs = Array.prototype.slice.call(arguments, 2);
        return function() {
            var args = curryArgs.concat(Array.prototype.slice.call(arguments, 0));
            return func.apply(thisArg, args);
        };
    }

    function loadStyles(modifyVars) {
        var styles = document.getElementsByTagName('style'),
            style;

        for (var i = 0; i < styles.length; i++) {
            style = styles[i];
            if (style.type.match(typePattern)) {
                var instanceOptions = clone(options);
                instanceOptions.modifyVars = modifyVars;
                var jssText = style.innerHTML || '';
                instanceOptions.filename = document.location.href.replace(/#.*$/, '');

                /*jshint loopfunc:true */
                // use closure to store current style
                jss.render(jssText, instanceOptions,
                        bind(function(style, e, result) {
                            if (e) {
                                errors.add(e, "inline");
                            } else {
                                style.type = 'text/css';
                                if (style.styleSheet) {
                                    style.styleSheet.cssText = result.css;
                                } else {
                                    style.innerHTML = result.css;
                                }
                            }
                        }, null, style));
            }
        }
    }

    function loadStyleSheet(sheet, callback, reload, remaining, modifyVars) {

        var instanceOptions = clone(options);
        addDataAttr(instanceOptions, sheet);
        instanceOptions.mime = sheet.type;

        if (modifyVars) {
            instanceOptions.modifyVars = modifyVars;
        }

        function loadInitialFileCallback(loadedFile) {

            var data = loadedFile.contents,
                path = loadedFile.filename,
                webInfo = loadedFile.webInfo;

            var newFileInfo = {
                currentDirectory: fileManager.getPath(path),
                filename: path,
                rootFilename: path,
                relativeUrls: instanceOptions.relativeUrls};

            newFileInfo.entryPath = newFileInfo.currentDirectory;
            newFileInfo.rootpath = instanceOptions.rootpath || newFileInfo.currentDirectory;

            if (webInfo) {
                webInfo.remaining = remaining;

                if (!instanceOptions.modifyVars) {
                    var css = cache.getCSS(path, webInfo);
                    if (!reload && css) {
                        webInfo.local = true;
                        callback(null, css, data, sheet, webInfo, path);
                        return;
                    }
                }
            }

            //TODO add tests around how this behaves when reloading
            errors.remove(path);

            instanceOptions.rootFileInfo = newFileInfo;
            jss.render(data, instanceOptions, function(e, result) {
                if (e) {
                    e.href = path;
                    callback(e);
                } else {
                    result.css = postProcessCSS(result.css);
                    if (!instanceOptions.modifyVars) {
                        cache.setCSS(sheet.href, webInfo.lastModified, result.css);
                    }
                    callback(null, result.css, data, sheet, webInfo, path);
                }
            });
        }

        fileManager.loadFile(sheet.href, null, instanceOptions, environment, function(e, loadedFile) {
            if (e) {
                callback(e);
                return;
            }
            loadInitialFileCallback(loadedFile);
        });
    }

    function loadStyleSheets(callback, reload, modifyVars) {
        for (var i = 0; i < jss.sheets.length; i++) {
            loadStyleSheet(jss.sheets[i], callback, reload, jss.sheets.length - (i + 1), modifyVars);
        }
    }

    function initRunningMode() {
        if (jss.env === 'development') {
            jss.watchTimer = setInterval(function () {
                if (jss.watchMode) {
                    fileManager.clearFileCache();
                    loadStyleSheets(function (e, css, _, sheet, webInfo) {
                        if (e) {
                            errors.add(e, e.href || sheet.href);
                        } else if (css) {
                            browser.createCSS(window.document, css, sheet);
                        }
                    });
                }
            }, options.poll);
        }
    }

    //
    // Watch mode
    //
    jss.watch   = function () {
        if (!jss.watchMode ) {
            jss.env = 'development';
            initRunningMode();
        }
        this.watchMode = true;
        return true;
    };

    jss.unwatch = function () {clearInterval(jss.watchTimer); this.watchMode = false; return false; };

    //
    // Synchronously get all <link> tags with the 'rel' attribute set to
    // "stylesheet/jss".
    //
    jss.registerStylesheetsImmediately = function() {
        var links = document.getElementsByTagName('link');
        jss.sheets = [];

        for (var i = 0; i < links.length; i++) {
            if (links[i].rel === 'stylesheet/jss' || (links[i].rel.match(/stylesheet/) &&
                (links[i].type.match(typePattern)))) {
                jss.sheets.push(links[i]);
            }
        }
    };

    //
    // Asynchronously get all <link> tags with the 'rel' attribute set to
    // "stylesheet/jss", returning a Promise.
    //
    jss.registerStylesheets = function() {
        return new Promise(function(resolve, reject) {
            jss.registerStylesheetsImmediately();
            resolve();
        });
    };

    //
    // With this function, it's possible to alter variables and re-render
    // CSS without reloading jss-files
    //
    jss.modifyVars = function(record) {
        return jss.refresh(true, record, false);
    };

    jss.refresh = function (reload, modifyVars, clearFileCache) {
        if ((reload || clearFileCache) && clearFileCache !== false) {
            fileManager.clearFileCache();
        }
        return new Promise(function (resolve, reject) {
            var startTime, endTime, totalMilliseconds;
            startTime = endTime = new Date();

            loadStyleSheets(function (e, css, _, sheet, webInfo) {
                if (e) {
                    errors.add(e, e.href || sheet.href);
                    reject(e);
                    return;
                }
                if (webInfo.local) {
                    jss.logger.info("loading " + sheet.href + " from cache.");
                } else {
                    jss.logger.info("rendered " + sheet.href + " successfully.");
                }
                browser.createCSS(window.document, css, sheet);
                jss.logger.info("css for " + sheet.href + " generated in " + (new Date() - endTime) + 'ms');
                if (webInfo.remaining === 0) {
                    totalMilliseconds = new Date() - startTime;
                    jss.logger.info("jss has finished. css generated in " + totalMilliseconds + 'ms');
                    resolve({
                        startTime: startTime,
                        endTime: endTime,
                        totalMilliseconds: totalMilliseconds,
                        sheets: jss.sheets.length
                    });
                }
                endTime = new Date();
            }, reload, modifyVars);

            loadStyles(modifyVars);
        });
    };

    jss.refreshStyles = loadStyles;
    return jss;
};

},{"../index":12,"./browser":3,"./cache":4,"./error-reporting":5,"./file-manager":6,"./log-listener":8,"./utils":9}],8:[function(require,module,exports){
module.exports = function(jss, options) {

    var logLevel_debug = 4,
        logLevel_info = 3,
        logLevel_warn = 2,
        logLevel_error = 1;

    // The amount of logging in the javascript console.
    // 3 - Debug, information and errors
    // 2 - Information and errors
    // 1 - Errors
    // 0 - None
    // Defaults to 2
    options.logLevel = typeof options.logLevel !== 'undefined' ? options.logLevel : (options.env === 'development' ?  logLevel_info : logLevel_error);

    if (!options.loggers) {
        options.loggers = [{
            debug: function(msg) {
                if (options.logLevel >= logLevel_debug) {
                    console.log(msg);
                }
            },
            info: function(msg) {
                if (options.logLevel >= logLevel_info) {
                    console.log(msg);
                }
            },
            warn: function(msg) {
                if (options.logLevel >= logLevel_warn) {
                    console.warn(msg);
                }
            },
            error: function(msg) {
                if (options.logLevel >= logLevel_error) {
                    console.error(msg);
                }
            }
        }];
    }
    for (var i = 0; i < options.loggers.length; i++) {
        jss.logger.addListener(options.loggers[i]);
    }
};

},{}],9:[function(require,module,exports){
module.exports = {
    extractId: function(href) {
        return href.replace(/^[a-z-]+:\/+?[^\/]+/, '')  // Remove protocol & domain
            .replace(/[\?\&]livereload=\w+/, '')        // Remove LiveReload cachebuster
            .replace(/^\//, '')                         // Remove root /
            .replace(/\.[a-zA-Z]+$/, '')                // Remove simple extension
            .replace(/[^\.\w-]+/g, '-')                 // Replace illegal characters
            .replace(/\./g, ':');                       // Replace dots with colons(for valid id)
    },
    addDataAttr: function(options, tag) {
        for (var opt in tag.dataset) {
            if (tag.dataset.hasOwnProperty(opt)) {
                if (opt === "env" || opt === "dumpLineNumbers" || opt === "rootpath" || opt === "errorReporting") {
                    options[opt] = tag.dataset[opt];
                } else {
                    try {
                        options[opt] = JSON.parse(tag.dataset[opt]);
                    }
                    catch(_) {}
                }
            }
        }
    }
};

},{}],10:[function(require,module,exports){
var abstractFileManager = function() {
};

abstractFileManager.prototype.getPath = function (filename) {
    var j = filename.lastIndexOf('?');
    if (j > 0) {
        filename = filename.slice(0, j);
    }
    j = filename.lastIndexOf('/');
    if (j < 0) {
        j = filename.lastIndexOf('\\');
    }
    if (j < 0) {
        return "";
    }
    return filename.slice(0, j + 1);
};

abstractFileManager.prototype.tryAppendExtension = function(path, ext) {
    return /(\.[a-z]*$)|([\?;].*)$/.test(path) ? path : path + ext;
};

abstractFileManager.prototype.tryAppendLessExtension = function(path) {
    return this.tryAppendExtension(path, '.less');
};

abstractFileManager.prototype.supportsSync = function() {
    return false;
};

abstractFileManager.prototype.alwaysMakePathsAbsolute = function() {
    return false;
};

abstractFileManager.prototype.isPathAbsolute = function(filename) {
    return (/^(?:[a-z-]+:|\/|\\|#)/i).test(filename);
};

abstractFileManager.prototype.join = function(basePath, laterPath) {
    if (!basePath) {
        return laterPath;
    }
    return basePath + laterPath;
};
abstractFileManager.prototype.pathDiff = function pathDiff(url, baseUrl) {
    // diff between two paths to create a relative path

    var urlParts = this.extractUrlParts(url),
        baseUrlParts = this.extractUrlParts(baseUrl),
        i, max, urlDirectories, baseUrlDirectories, diff = "";
    if (urlParts.hostPart !== baseUrlParts.hostPart) {
        return "";
    }
    max = Math.max(baseUrlParts.directories.length, urlParts.directories.length);
    for (i = 0; i < max; i++) {
        if (baseUrlParts.directories[i] !== urlParts.directories[i]) { break; }
    }
    baseUrlDirectories = baseUrlParts.directories.slice(i);
    urlDirectories = urlParts.directories.slice(i);
    for (i = 0; i < baseUrlDirectories.length - 1; i++) {
        diff += "../";
    }
    for (i = 0; i < urlDirectories.length - 1; i++) {
        diff += urlDirectories[i] + "/";
    }
    return diff;
};
// helper function, not part of API
abstractFileManager.prototype.extractUrlParts = function extractUrlParts(url, baseUrl) {
    // urlParts[1] = protocol&hostname || /
    // urlParts[2] = / if path relative to host base
    // urlParts[3] = directories
    // urlParts[4] = filename
    // urlParts[5] = parameters

    var urlPartsRegex = /^((?:[a-z-]+:)?\/+?(?:[^\/\?#]*\/)|([\/\\]))?((?:[^\/\\\?#]*[\/\\])*)([^\/\\\?#]*)([#\?].*)?$/i,
        urlParts = url.match(urlPartsRegex),
        returner = {}, directories = [], i, baseUrlParts;

    if (!urlParts) {
        throw new Error("Could not parse sheet href - '" + url + "'");
    }

    // Stylesheets in IE don't always return the full path
    if (baseUrl && (!urlParts[1] || urlParts[2])) {
        baseUrlParts = baseUrl.match(urlPartsRegex);
        if (!baseUrlParts) {
            throw new Error("Could not parse page url - '" + baseUrl + "'");
        }
        urlParts[1] = urlParts[1] || baseUrlParts[1] || "";
        if (!urlParts[2]) {
            urlParts[3] = baseUrlParts[3] + urlParts[3];
        }
    }

    if (urlParts[3]) {
        directories = urlParts[3].replace(/\\/g, "/").split("/");

        // extract out . before .. so .. doesn't absorb a non-directory
        for (i = 0; i < directories.length; i++) {
            if (directories[i] === ".") {
                directories.splice(i, 1);
                i -= 1;
            }
        }

        for (i = 0; i < directories.length; i++) {
            if (directories[i] === ".." && i > 0) {
                directories.splice(i - 1, 2);
                i -= 2;
            }
        }
    }

    returner.hostPart = urlParts[1];
    returner.directories = directories;
    returner.path = (urlParts[1] || "") + directories.join("/");
    returner.fileUrl = returner.path + (urlParts[4] || "");
    returner.url = returner.fileUrl + (urlParts[5] || "");
    return returner;
};

module.exports = abstractFileManager;

},{}],11:[function(require,module,exports){
var logger = require("../logger");
var environment = function(externalEnvironment, fileManagers) {
    this.fileManagers = fileManagers || [];
    externalEnvironment = externalEnvironment || {};

    var optionalFunctions = ["encodeBase64", "mimeLookup", "charsetLookup", "getSourceMapGenerator"],
        requiredFunctions = [],
        functions = requiredFunctions.concat(optionalFunctions);

    for (var i = 0; i < functions.length; i++) {
        var propName = functions[i],
            environmentFunc = externalEnvironment[propName];
        if (environmentFunc) {
            this[propName] = environmentFunc.bind(externalEnvironment);
        } else if (i < requiredFunctions.length) {
            this.warn("missing required function in environment - " + propName);
        }
    }
};

environment.prototype.getFileManager = function (filename, currentDirectory, options, environment, isSync) {

    if (!filename) {
        logger.warn("getFileManager called with no filename.. Please report this issue. continuing.");
    }
    if (currentDirectory == null) {
        logger.warn("getFileManager called with null directory.. Please report this issue. continuing.");
    }

    var fileManagers = this.fileManagers;
    if (options.pluginManager) {
        fileManagers = [].concat(fileManagers).concat(options.pluginManager.getFileManagers());
    }
    for (var i = fileManagers.length - 1; i >= 0 ; i--) {
        var fileManager = fileManagers[i];
        if (fileManager[isSync ? "supportsSync" : "supports"](filename, currentDirectory, options, environment)) {
            return fileManager;
        }
    }
    return null;
};

environment.prototype.addFileManager = function (fileManager) {
    this.fileManagers.push(fileManager);
};

environment.prototype.clearFileManagers = function () {
    this.fileManagers = [];
};

module.exports = environment;

},{"../logger":13}],12:[function(require,module,exports){
module.exports = function(environment, fileManagers) {
    var SourceMapOutput, SourceMapBuilder, ParseTree, ImportManager, Environment;

    var jss = {
        version: [0, 0, 1],
        // data: require('./data'),
        // tree: require('./tree'),
        Environment: (Environment = require("./environment/environment")),
        AbstractFileManager: require("./environment/abstract-file-manager"),
        environment: (environment = new Environment(environment, fileManagers)),
        // visitors: require('./visitors'),
        // Parser: require('./parser/parser'),
        // functions: require('./functions')(environment),
        // contexts: require("./contexts"),
        // SourceMapOutput: (SourceMapOutput = require('./source-map-output')(environment)),
        // SourceMapBuilder: (SourceMapBuilder = require('./source-map-builder')(SourceMapOutput, environment)),
        // ParseTree: (ParseTree = require('./parse-tree')(SourceMapBuilder)),
        // ImportManager: (ImportManager = require('./import-manager')(environment)),
        // render: require("./render")(environment, ParseTree, ImportManager),
        // parse: require("./parse")(environment, ParseTree, ImportManager),
        // LessError: require('./less-error'),
        // transformTree: require('./transform-tree'),
        // utils: require('./utils'),
        // PluginManager: require('./plugin-manager'),
        logger: require('./logger')
    };

    return jss;
};

},{"./environment/abstract-file-manager":10,"./environment/environment":11,"./logger":13}],13:[function(require,module,exports){
module.exports = {
    error: function(msg) {
        this._fireEvent("error", msg);
    },
    warn: function(msg) {
        this._fireEvent("warn", msg);
    },
    info: function(msg) {
        this._fireEvent("info", msg);
    },
    debug: function(msg) {
        this._fireEvent("debug", msg);
    },
    addListener: function(listener) {
        this._listeners.push(listener);
    },
    removeListener: function(listener) {
        for (var i = 0; i < this._listeners.length; i++) {
            if (this._listeners[i] === listener) {
                this._listeners.splice(i, 1);
                return;
            }
        }
    },
    _fireEvent: function(type, msg) {
        for (var i = 0; i < this._listeners.length; i++) {
            var logFunction = this._listeners[i][type];
            if (logFunction) {
                logFunction(msg);
            }
        }
    },
    _listeners: []
};

},{}]},{},[2]);
