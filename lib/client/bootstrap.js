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
