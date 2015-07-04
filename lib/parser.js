// var _ = require('lodash');

var parser = module.exports;

var cssObjects = {
	background: ["color"],
	text: ["align"],
	font: ["weight"]
};

function parseCssObject (baseKey, cssObject, vars) {
	var response = "";
	for (var cssKey in cssObject) {
		var cssVal = cssObject[cssKey];
		if (cssVal[0] === "$") {
			cssVal = vars[cssVal];
		}
		response += baseKey + "-" + cssKey + ":" + cssVal + ";"
	}
	return response;
};

function parseRule (context) {
	var blockData = {
		vars: typeof(context.vars) === 'undefined' ? {} : context.vars,
		rules: {},
		rows: {},
		css: '',
		childCss: ''
	};

	for (key in context.jss) {
		var val = context.jss[key];
		if (typeof(val) == 'object') {
			blockData.rules[key] = val;

			// blockData.css = key + '{' + 'xxx' + '}';
			// result.css = css;
		} else {
			if (key[0] == "$") {
				blockData.vars[key] = val;
			} else {
				blockData.rows[key] = val;
			}
		}
	};

	for (var ruleKey in blockData.rules) {
		var rule = blockData.rules[ruleKey];

		if (typeof(cssObjects[ruleKey]) != "undefined") {
			blockData.css += parseCssObject(ruleKey, rule, blockData.vars);
		} else {
			var childContext = {
				jss: rule,
				level: 'rule',
				vars: blockData.vars,
				parentKey: ruleKey
			}
			var ruleBlock = parseRule(childContext);

			if (context.level === 'root') {
				blockData.css += ruleKey + '{' + ruleBlock.css + '}\n';
			} else {
				blockData.childCss += context.parentKey + " " + ruleKey + '{' + ruleBlock.css + '}\n';
			}

			blockData.css += ruleBlock.childCss;
		}
	}

	for (var varKey in blockData.rows) {
		var value = blockData.rows[varKey];
		blockData.css += varKey + ':';

		if (value[0] == '$') {
			blockData.css += blockData.vars[value];
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

	try {
		var jsonInput = JSON.parse(input);
	} catch (e) {
		result.css = e.stack;
		return result;
	}

	var context = {
		jss: jsonInput,
		level: 'root',
		parentKey: ''
	}

	result = parseRule(context);

	return result;
}