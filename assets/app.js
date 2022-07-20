let lastX = 0;
let mouseOverTextLog = false;
let recordingPaused = false;
let textLogLineNum = 0;

const vscode = acquireVsCodeApi();

function toogleDataSeries(e){
    const chart = window.mainChart;

    if (typeof(e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
        e.dataSeries.visible = false;
    } else{
        e.dataSeries.visible = true;
    }
    chart.render();
}

window.reopenPort = () => {
    vscode.postMessage({
        command: 'reopenPort'
    })
};

window.truncateData = () => {
    const chart = getChart();

    for(var i in chart.charts[0].data) {
        chart.charts[0].data[i].dataPoints.length = 0;
    }
};

window.pauseRecording = () => {
    recordingPaused = !recordingPaused

    if (recordingPaused) {
        window.document.getElementById('pauseButton').addClass('active');
    } else {
        window.document.getElementById('pauseButton').removeClass('active');
    }
};


const getChart = () => {
    return window.mainChart;
}

const renderChart = () => {
    getChart().render();
}

const clearData = () => {
    lastX = 0;
    window.mainChart.options.data = [];
};

const getCurrentSeriesNames = () => {
    return getChart().charts[0].data.map(d => d.name)
}

const addNewSeries = (name) => {
    const chart = getChart();

    var series = {
        type: "line",
        xValueFormatString: "MMM DD, YYYY HH:mm:ss",
        xValueType: "dateTime",
        name: name,
        // showInLegend: true,
        markerSize: 1,
        // yValueFormatString: "$#,###k",
        dataPoints: new Array()
    };

    chart.charts[0].data.push(series);

    return chart.charts[0].data.length - 1;
}

const reloadChart = () => {
    var chart = window.mainChart = new CanvasJS.StockChart  ("chartContainer", {
        title: false,
        theme: "dark1",
        charts: [
            {
                axisX: {             
                    crosshair: {
                        enabled: true,
                        snapToDataPoint: true
                    },
                    fontSize: 13
                },
                axisY: {
                    title: false,
                    fontSize: 13,
                    prefix: "",
                    suffix: "",
                    crosshair: {
                        enabled: true,
                        //snapToDataPoint: true
                    }
                },
                data: [{
                    type: "line",
                    markerSize: 0,
                    name: "stub",
                    showInLegend: true,
                    connectNullData: true,
                    dataPoints : new Array()
                  }, {
                    markerSize: 0,
                    type: "line",
                    name: "stub",
                    showInLegend: true,
                    connectNullData: true,
                    dataPoints : new Array()
                  }, {
                    markerSize: 0,
                    type: "line",
                    name: "stub",
                    showInLegend: true,
                    connectNullData: true,
                    dataPoints : new Array()
                  }, {
                    markerSize: 0,
                    type: "line",
                    name: "stub",
                    showInLegend: true,
                    connectNullData: true,
                    dataPoints : new Array()
                  }, {
                    markerSize: 0,
                    type: "line",
                    name: "stub",
                    showInLegend: true,
                    connectNullData: true,
                    dataPoints : new Array()
                  }, {
                    markerSize: 0,
                    type: "line",
                    name: "stub",
                    showInLegend: true,
                    connectNullData: true,
                    dataPoints : new Array()
                  }]
            }
        ],        
        toolTip: {
            shared: true
        },
        legend: {
            cursor:"pointer",
            verticalAlign: "top",
            fontSize: 13,
            // itemclick : toggleDataSeries
            fontColor: "dimGrey"  
        },            
        // navigator: {
        //     slider: {
        //       minimum: lastX
        //     },
        //     axisX: {
        //     //   labelFontColor: "white"
        //     }
        // },
        rangeSelector: {
            enabled: false
        }
    });
    chart.render();        

    return chart;
};

window.onload = function() {
    reloadChart();             
    
    const textLogElement = window.document.getElementById("textLog");

    textLogElement.addEventListener("mouseenter", (e) => { mouseOverTextLog = true })
    textLogElement.addEventListener("mouseleave", (e) => { mouseOverTextLog = false })
};

window.addEventListener("message", event => {
    const message = event.data;
    const chart = getChart();

    if (recordingPaused) return false;
    
    // console.log(message);

    if (chart) {
        if (message.dataType == "data") {
            const d = new Date();
            let ms = d.getMilliseconds();

            let x = lastX;

            if (message.dataValue.x) {
                x = parseInt(message.dataValue.x);
            } else {
                // x = (new Date()).getTime()
            }

            for(var item in message.dataValue) {
                let seriesIndex = getCurrentSeriesNames().findIndex(s => s == item); 

                if (seriesIndex == -1) {
                    seriesIndex = getCurrentSeriesNames().findIndex(s => s == "stub");                
                    if (seriesIndex == -1) {
                        console.warn("Ran out of parameter slots");
                    } else {
                        chart.charts[0].data[seriesIndex].name = item;
                        chart.charts[0].options.data[seriesIndex].name = item;
                    }
                    
                }
                // if (seriesIndex == -1) seriesIndex = addNewSeries(item);                
                const point = {x: x, y: message.dataValue[item], markerType: null};
                chart.charts[0].data[seriesIndex].dataPoints.push(point);                
            }

            lastX = x;
            lastX += 1;
        } else if (message.dataType == "text") { 
            const textLogElement = window.document.getElementById("textLog");
            if (textLogElement.innerHTML == null) textLogElement.innerHTML = "";
            textLogElement.innerHTML = message.dataValue + "\n" + textLogElement.innerHTML;
            
            // Advance the internal line counter for the textarea,
            // to enable jumps to a specific line upon click
            const lineSearchResults = message.dataValue.match(/\n/g);
            const innerLineCount = lineSearchResults ? lineSearchResults.length : 0;
            textLogLineNum += 1 + innerLineCount;
            if (!mouseOverTextLog) {
                textLogElement.scrollTop = 0;
            }

            // Add a flag to the first series
            if (chart.charts[0].data[0].dataPoints.length > 0) {
                const point = {
                    x: lastX, 
                    y: chart.charts[0].data[0].dataPoints[chart.charts[0].data[0].dataPoints.length - 1].y, 
                    indexLabel: message.dataValue.substring(0, 16) + "...",
                    indexLabelFontColor: "white",
                    indexLabelOrientation: "vertical",
                    lineNum: textLogLineNum
                };                
                chart.charts[0].data[0].dataPoints.push(point);                
                lastX += 1;
            }
            
        }
        
        chart.render();
    }
});