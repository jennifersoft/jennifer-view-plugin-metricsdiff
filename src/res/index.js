var targetInstance = null, startDate = null, endDate = null,
    metricsBox = null, metricsChart = null, metricsCombo = null, colorMap = null;

jui.ready([ "ui", "selectbox", "util.base", "chart.builder", "util.color" ], function(ui, select, _, builder, color) {
    colorMap = color.map["pink"](20);

    metricsCombo = ui.combo("#metric_combo", {
        index: 2,
        width: 120
    });

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
            top : 100,
            bottom : 10,
            right : 10
        },
        height : 2300,
        axis : [
            {
                x : {
                    type : "block",
                    domain : [],
                    line : "solid",
                    key : "xIndex",
                    orient : "top",
                    textRotate : function(elem) {
                        elem.attr({ "text-anchor": "start" });
                        return -90;
                    }
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

                var count = colorMap.length - 1,
                    value = Math.abs(d.value / 100);

                if(value > 1) value = 1;
                var index = Math.floor(value * count);

                return colorMap[count - index];
            },
            format : function(d) {
                if(d.value == 0) {
                    return "";
                } else {
                    if(metricsChart.axis(0).x.rangeBand() < 40) {
                        return (d.value < 0) ? "-" : "+";
                    }

                    return d.value.toFixed(2) + "%";
                }
            }
        },
        widget : {
            type : "tooltip",
            orient : "left",
            format : function(data, key) {
                return {
                    key: data.xLabel,
                    value: (data.value == 0) ? "0/0" : data.preValue.toFixed(2) + "/" + data.postValue.toFixed(2)
                }
            }
        },
        style : {
            heatmapBackgroundColor: "transparent",
            heatmapBackgroundOpacity: 1,
            heatmapHoverBackgroundOpacity: 0.2,
            heatmapBorderColor: "#000",
            heatmapBorderWidth: 0.5,
            heatmapBorderOpacity: 0.1,
            heatmapFontSize: 10,
            heatmapFontColor: "#dcdcdc",
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
            menu: [ "domain", "instance" ],
            tabCallback: function(type) {
                findMetricsGroup(type);
            }
        });
    }, 50);

    setTimeout(function() {
        renderMetricsChart(true);
    }, 1000);
});

function sigmoid(t) {
    return 1/(1+Math.pow(Math.E, -t));
}

function findMetricsGroup(group) {
    $.getJSON("/metrics/" + group, "format=json", function(data) {
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

function getParameters(sid, oid, time, dates, metrics) {
    var stime = time,
        etime = time + (1000 * 60 * 60 * 24);

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

    return 'sid=' + sid + '&startTime=' + stime + '&endTime=' + etime + '&intervalInMinute=' + metricsCombo.getValue() +
        '&otypeList=' + otypes + '&oidsList=' + oids + '&metricsList=' + metrics + '&functionsList=' + funcs +
        '&startIntervalIndex=' + 0 + '&intervalCountLimit=' + dates.length + "&format=json";

}

function updateMetricsData(xDomain, yDomain, yValues, callback) {
    if(startDate.getTime() >= endDate.getTime()) {
        alert(i18n.get("M0187"));
        return;
    }

    var sid = -1,
        oid = -1;

    if(targetInstance.getMenu() == "instance") {
        var $target = $("#oid_config").find("li.active a");

        sid = parseInt($target.data("sid"));
        oid = parseInt($target.attr("value"));
    } else {
        var $target = $("#oid_config").find("a.active");

        sid = parseInt($target.attr("value"));
        oid = 0;
    }

    if(isNaN(sid) || isNaN(oid)) {
        alert(i18n.get("M0015"));
        return;
    }

    var preParams = getParameters(sid, oid, startDate.getTime(), xDomain, yValues),
        postParams = getParameters(sid, oid, endDate.getTime(), xDomain, yValues);

    if(preParams != null & postParams != null) {
        $.getJSON('/db/metrics', preParams, function (preJson) {
            $.getJSON('/db/metrics', postParams, function (postJson) {
                var data = [];

                for(var y = 0; y < yDomain.length; y++) {
                    for(var x = 0; x < xDomain.length; x++) {
                        var preValue = preJson[x][y + 1],
                            postValue = postJson[x][y + 1];

                        var rate = (postValue - preValue) / preValue;
                        if(preValue == 0) {
                            rate = postValue;
                        } else {
                            rate *= 100;
                        }

                        data.push({
                            xIndex: x,
                            yIndex: y,
                            xLabel: xDomain[x],
                            yLabel: yDomain[y],
                            preValue: preValue,
                            postValue: postValue,
                            value: rate
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

    var xLen = (60 / metricsCombo.getValue()) * 24,
        yLen = metricsList.length,
        height = Math.max(metricsChart.axis(0).x.rangeBand(), metricsChart.axis(0).y.rangeBand()) * yLen,
        stime = startDate.getTime();

    for (var i = 0; i < xLen; i++) {
        var time = stime + (1000 * 60 * metricsCombo.getValue() * i),
            moment = getServerMoment(time);

        xDomain.push(moment.format("LT")); // MM:ss
    }

    for (var i = 0; i < yLen; i++) {
        yDomain.push(metricsList[i].text);
        yValues.push(metricsList[i].value);
    }

    metricsChart.axis(0).set("x", { domain: xDomain });
    metricsChart.axis(0).set("y", { domain: yDomain });
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

function captureMetricsChart() {
    var target = targetInstance.getName(),
        sdate = startDate.getDate().format("YYYYMMDD"),
        edate = endDate.getDate().format("YYYYMMDD");

    var name = (sdate == edate) ? sdate : sdate + "-" + edate;
    if(target.length > 0) {
        name = target[0] + "_" + name;
    }

    metricsChart.svg.downloadImage(name + ".png");
}