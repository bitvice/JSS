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
