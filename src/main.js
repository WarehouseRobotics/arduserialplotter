// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const plotterUtils = require('./utils');
const SerialPort = require("serialport").SerialPort;

let panelDisposed = false;
let serialPort = null;

let serialDataBuffer = "";

function getPage(context, panel) {
	const onDiskPath = (file) => { 
		console.log("path", path);
		return vscode.Uri.file(path.join(context.extensionPath, file)) 
	};

	const config = plotterUtils.getConfig();

	let templateHtml = String(fs.readFileSync(path.join(context.extensionPath, 'assets/index.html')));
	templateHtml = templateHtml.replace("{jquery.js}", panel.webview.asWebviewUri(onDiskPath('./assets/jquery.slim.min.js')));
	templateHtml = templateHtml.replace("{bootstrap.js}", panel.webview.asWebviewUri(onDiskPath('./assets/bootstrap.bundle.min.js')));
	templateHtml = templateHtml.replace("{canvasjs.js}", panel.webview.asWebviewUri(onDiskPath('./assets/canvasjs.stock.min.js')));
	templateHtml = templateHtml.replace("{app.js}", panel.webview.asWebviewUri(onDiskPath('./assets/app.js')));	
	templateHtml = templateHtml.replace("{portName}", config.general.port);	
	

	const pageHtml = templateHtml;

	return pageHtml;
}

function initSerial(context, webview) {
	const config = plotterUtils.getConfig();	

	// '/dev/tty.usbserial-0001'
	if (config.general.baud_rate == null) {
		console.log("Assuming baud rate of 115200 for serial monitor. Override via serialplotter.ini");
		config.general.baud_rate = 115200;
	}

	if (config.general.port == null) {
		console.error("port must be set in serialplotter.ini");
	}

	if (serialPort != null && serialPort.isOpen) { // Close the previously open port, if any
		serialPort.close();
	}

	serialPort = new SerialPort({path: config.general.port, baudRate: parseInt(config.general.baud_rate)});	

	if (serialPort) {
		serialPort.on('data', function(data) { 
			const hasLineSeparators = data.indexOf(config.processing.line_separator) > -1;

			if (hasLineSeparators) {
				// Does it end with a separator?
				const expectedEndingLength = config.processing.line_separator.length;
				let dataEnding;

				if (data.length > expectedEndingLength.length) {
					const dataEnding = data.substring(data.length - expectedEndingLength, data.length - 1);
				} 

				if (dataEnding == config.processing.line_separator) {
					serialDataBuffer += data;
					processSerialData(context, config, webview, serialDataBuffer)		
					serialDataBuffer = "";
				} else { // If the last line has no terminator at the end, leave it in the buffer and don't process
					serialDataBuffer += data;
					let lines = serialDataBuffer.split(config.processing.line_separator);
					const lastLine = lines.splice(lines.length - 1, 1)				
					processSerialData(context, config, webview, lines.join(config.processing.line_separator))							
					serialDataBuffer = lastLine[0];
				}								
			} else {
				serialDataBuffer += data;
			}
		});

		serialPort.on('disconnected', function(data) { 
			if (!panelDisposed)
				tryReconnect(context, config, webview);
		});

		serialPort.on('error', function(data) { 
			if (!panelDisposed)
				tryReconnect(context, config, webview);
		});
	} else {
		console.log("Could not init serial");
	}

	return serialPort;
}

function tryReconnect(context, config, webview) {
	console.log("reconnecting...");
	try {
		initSerial(context, webview);
	} catch(e) {
		console.error(e);
		if (!panelDisposed)
			setTimeout(tryReconnect, 1000);
	}		
}

function onShowPlotterCommand(context) {		
	const config = plotterUtils.getConfig();

	// Display a message box to the user
	vscode.window.showInformationMessage('Hello World from ArduSerialPlotter!');

	const panel = vscode.window.createWebviewPanel(
		'catCoding',
		'Cat Coding',
		vscode.ViewColumn.One,
		{
			enableScripts: true
		}
	  );

	panel.title = "Serial Plotter";
	panel.webview.html = getPage(context, panel);

	// const demoInterval = setInterval(() => {
	// 	if (panel && panel.webview && panel.active) {
	// 		panel.webview.postMessage({ dataType: "ts", dataValue: Math.floor(Math.random() * 1000) });
	// 	}			
	// }, 1000);
	
	panelDisposed = false;
	const serialPort = initSerial(context, panel.webview);

	// const serialKeepAliveInterval = setInterval(() => {  
	// 	console.log("serialPort active?", serialPort.readable);
	// 	if (!serialPort.readable) {
	// 		tryReconnect();
	// 	}
	// }, 1000);

	panel.onDidDispose(
		() => {
			// Handle user closing panel before the 5sec have passed
			panelDisposed = true;

			// clearTimeout(timeout);
			// clearInterval(demoInterval);
			// clearInterval(serialKeepAliveInterval);
			if (serialPort && serialPort.isOpen) {
				serialPort.close();				
			}		
		},
		null,
		context.subscriptions
	);

	panel.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'reopenPort':
              initSerial(context, panel.webview);
              return;
          }
        },
        undefined,
        context.subscriptions
      );
}

function onCreateConfigCommand(context) {

}

function processSerialData(context, config, webview, data) {
	// Assume string format 
	const dataString = String(data);

	console.log("DATA:", dataString);

	const lines = dataString.split(config.processing.line_separator);
	const numLines = lines.length;

	// console.log(dataString);
	for(let i = 0; i < numLines; i++) {
		const line = lines[i];

		if (line == "" && i == numLines - 1) continue; // always skip the last empty line

		if (line[0] == ">") { // Process numerical series input
			// TODO: Split into lines
			const columns = line.substring(1, line.length - 1).split(config.processing.column_separator);
			const valueHash = columns.map(col => {
				return col.split(config.processing.value_separator);
			}).reduce(function(map, obj) {
				map[obj[0]] = parseFloat(obj[1]);
				return map;
			}, {});
			webview.postMessage({ dataType: "data", dataValue: valueHash });
		} else {
			webview.postMessage({ dataType: "text", dataValue: line });
		}
	}
	
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "arduserialplotter" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable1 = vscode.commands.registerCommand('arduserialplotter.showPlotter', () => onShowPlotterCommand(context));
	// let disposable2 = vscode.commands.registerCommand('arduserialplotter.createConfig', () => onShowPlotterCommand(context));

	context.subscriptions.push(disposable1);
	// context.subscriptions.push(disposable2);
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
