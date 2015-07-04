// var _ = require('lodash');

var parser = module.exports;

function parseRule (jssFragment, context, vars) {
	var vars = typeof(vars) === 'undefined' ? {} : vars;

	var blockData = {
		vars: vars,
		rules: {},
		css: ''
	};

	for (key in jssFragment) {
		var val = jssFragment[key];
		if (typeof(val) == 'object') {
			blockData.rules[key] = val;

			// blockData.css = key + '{' + 'xxx' + '}';
			// result.css = css;
		} else {
			blockData.vars[key] = val;
		}
	};

	for (key in blockData.rules) {
		var rule = blockData.rules[key];

		ruleBlock = parseRule(rule, "rule", blockData.vars);
		blockData.css = key + '{' + ruleBlock.css + '}';
	}

	for (var varKey in blockData.vars) {
		var value = blockData.vars[varKey];
		blockData.css = varKey + ':';

		if (value[0] == '$') {
			blockData.css += vars[value];
		} else {
			blockData.css += value;
		}

		blockData.css += ';';
	}

	// blockData.css = proccess();

	return blockData
}


parser.parse = function (input) {
	var result = {
		css: ''
	};

	var jsonInput = JSON.parse(input);

	result = parseRule(jsonInput, "root");

	return result;
}