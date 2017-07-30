var targetInstance = null, startDate = null, endDate = null, metricsBox = null, metricsChart = null;

jui.ready([ "ui", "selectbox", "util.base", "chart.builder", "util.color" ], function(ui, select, _, builder, color) {
    endDate = ui.timezonepicker("#end_date", {
        event: {
            select: function(date) {
                targetInstance.setTime(startDate.getTime(), this.getTime());
            }
        },
        tpl: {
            dates: $("#tpl_dates").html()
        }
    });

    var ldate = endDate.getDate().clone();
    startDate = ui.timezonepicker("#start_date", {
        date: ldate.add(-1, "days"),
        event: {
            select: function(date) {
                targetInstance.setTime(this.getTime(), endDate.getTime());
            }
        },
        tpl: {
            dates: $("#tpl_dates").html()
        }
    });

    metricsBox = select("#metric_box", {
        title: "Metrics",
        type: "multi",
        width: 300,
        tooltip: true
    });

    metricsChart = builder("#metric_chart", {
        theme : $("input[name=theme]").val(),
        padding : {
            left : 200,
            top : 10,
            bottom : 25,
            right : 10
        },
        height : 2300,
        axis : [
            {
                x : {
                    type : "block",
                    domain : [],
                    line : "solid",
                    key : "xIndex"
                },
                y : {
                    type : "block",
                    domain : [],
                    line : "solid",
                    key : "yIndex"

                }
            }

        ],
        brush : {
            type : "heatmap",
            target : "value",
            colors : function(d) {
                if(d.value == 0) {
                    return "transparent";
                }

                var value = (d.value > 1) ? 1 : d.value,
                    h = (1.0 - value) * 240;

                return "hsl(" + h + ", 100%, 50%)";
            },
            format : function(d) {
                if(d.value > 0) {
                    return d.value.toFixed(2);
                }

                return "";
            }
        },
        widget : {
            type : "tooltip",
            format : function(data, key) {
                if(data.value == 0) {
                    return "0/0";
                }

                return data.preValue.toFixed(2) + "/" + data.postValue.toFixed(2);
            }
        },
        style : {
            heatmapBackgroundColor: "transparent",
            heatmapBackgroundOpacity: 1,
            heatmapHoverBackgroundOpacity: 0.2,
            heatmapBorderColor: "#000",
            heatmapBorderWidth: 0.5,
            heatmapBorderOpacity: 0.1,
            heatmapFontSize: 11,
            heatmapFontColor: "#000",
            gridTickBorderSize: 0,
            gridXAxisBorderWidth: 1,
            gridYAxisBorderWidth: 1
        },
        render : false
    });

    setTimeout(function() {
        var domainNodes = domainTree.listAll(),
            domainIds = [];

        for(var i = 0; i < domainNodes.length; i++) {
            var data = domainNodes[i].data;

            if(data.sid != -1) {
                domainIds.push(data.sid);
            }
        }

        targetInstance = createOidConfig(domainIds, "#oid_config", {
            type: "single",
            domainGroup: true,
            activeMenu: "instance",
            menu: [ "instance" ],
            tabCallback: function(type) {
                findMetricsGroup(type);
            }
        });
    }, 50);

    setTimeout(function() {
        renderMetricsChart(true);
    }, 1000);
});

function findMetricsGroup(group) {
    $.getJSON("/metrics/avg_max/" + group, "format=json", function(data) {
        var metricsList = [];

        $.each(data, function(idx, value) {
            var code = "ui.mx." + value[0],
                metrics = {
                    text: i18n.get(code),
                    value: value[1],
                    tooltip: i18n.get(code + ".tooltip")
                };

            metricsList.push(metrics)
        });

        metricsBox.update(metricsList);
        metricsBox.checkedAll(true);
    });
}

function getParameters(time, dates, metrics) {
    var $target = $("#oid_config").find("li.active a");

    var sid = parseInt($target.data("sid")),
        oid = parseInt($target.attr("value")),
        stime = time,
        etime = time + (1000 * 60 * 60 * 24),
        interval = 60;

    var funcs = [],
        otypes = [],
        oids = [];

    for(var i = 0; i < metrics.length; i++) {
        funcs.push(-1);
        otypes.push(OTypeDef.SYSTEM);
        oids.push(oid);
    }

    if(isNaN(oid)) {
        return null;
    }

    return 'sid=' + sid + '&startTime=' + stime + '&endTime=' + etime + '&intervalInMinute=' + interval +
        '&otypeList=' + otypes + '&oidsList=' + oids + '&metricsList=' + metrics + '&functionsList=' + funcs +
        '&startIntervalIndex=' + 0 + '&intervalCountLimit=' + dates.length + "&format=json";

}

function updateMetricsData(xDomain, yDomain, yValues, callback) {
    if(startDate.getTime() >= endDate.getTime()) {
        alert(i18n.get("M0187"));
        return;
    }

    var oid = parseInt($("#oid_config").find("li.active a").attr("value"));
    if(oid == -1 || !oid) {
        alert(i18n.get("M0026"));
        return;
    }

    var preParams = getParameters(startDate.getTime(), xDomain, yValues),
        postParams = getParameters(endDate.getTime(), xDomain, yValues);

    if(preParams != null & postParams != null) {
        $.getJSON('/db/metrics', preParams, function (preJson) {
            $.getJSON('/db/metrics', postParams, function (postJson) {
                var data = [];

                for(var y = 0; y < yDomain.length; y++) {
                    for(var x = 0; x < xDomain.length; x++) {
                        var preValue = preJson[x][y + 1],
                            postValue = postJson[x][y + 1],
                            value = preValue || postValue;

                        if(value != 0 && preValue != 0 && postValue != 0) {
                            value = preValue / postValue;
                        }

                        data.push({
                            xIndex: x,
                            yIndex: y,
                            xLabel: xDomain[x],
                            yLabel: yDomain[y],
                            preValue: preValue,
                            postValue: postValue,
                            value: value
                        });
                    }
                }

                callback(data);
            });
        });
    }
}

function renderMetricsChart(isInit) {
    var xDomain = [],
        yDomain = [],
        yValues = [],
        metricsList = metricsBox.getData();

    var xLen = 24,
        yLen = metricsList.length,
        height = metricsChart.axis(0).x.rangeBand() * yLen;

    for (var i = 0; i < xLen; i++) {
        xDomain.push(i + 1);
    }

    for (var i = 0; i < yLen; i++) {
        yDomain.push(metricsList[i].text);
        yValues.push(metricsList[i].value);
    }

    metricsChart.axis(0).set("x", {domain: xDomain});
    metricsChart.axis(0).set("y", {domain: yDomain});
    metricsChart.setSize("100%", height);

    if (isInit) {
        metricsChart.render();
    } else {
        updateMetricsData(xDomain, yDomain, yValues, function(data) {
            metricsChart.axis(0).update(data);
            metricsChart.render(true);
        });
    }
}