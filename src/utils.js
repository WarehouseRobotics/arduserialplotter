const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const ini = require('ini');

let lastProjectDir = null;

const getProjectDir = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {        
      if (lastProjectDir) return lastProjectDir;
      return undefined;
    }
    const resource = editor.document.uri;
    if (resource.scheme !== 'file') {
      return undefined;
    }
    const folder = vscode.workspace.getWorkspaceFolder(resource);
    if (!folder) {
      // outside workspace
      return undefined;
    }
    lastProjectDir = folder.uri.fsPath;
    return folder.uri.fsPath;
}

const getConfig = (context) => {
	const projectDir = getProjectDir();
	console.log("projectDir", projectDir);
    const configFilePath = path.join(projectDir, 'serialplotter.ini');
    var config = ini.parse(fs.readFileSync(configFilePath, 'utf-8'));
    
    if (config.processing == null) config.processing = {};

    config.processing.line_separator = config.processing.line_separator || "LF";
    if (config.processing.line_separator == "LF") config.processing.line_separator = "\n";
    if (config.processing.line_separator == "CR") config.processing.line_separator = "\r";
    if (config.processing.line_separator == "CRLF") config.processing.line_separator = "\r\n";

    config.processing.column_separator = config.processing.column_separator || ";";
    config.processing.value_separator = config.processing.value_separator || "=";

	return config;
}

module.exports = {
	getProjectDir,
    getConfig
}