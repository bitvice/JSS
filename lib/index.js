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
        render: require("./render")(environment, ParseTree, ImportManager),
        // render: function (environment, ParseTree, ImportManager) {
        //     return "body{background-color:red;}";
        // },
        // parse: require("./parse")(environment, ParseTree, ImportManager),
        parser: require("./parser"),
        // LessError: require('./less-error'),
        // transformTree: require('./transform-tree'),
        // utils: require('./utils'),
        // PluginManager: require('./plugin-manager'),
        logger: require('./logger')
    };

    return jss;
};
