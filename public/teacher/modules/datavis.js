define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "models", "interact"], function(exports, pdfjs, m, models, interact) {
    var PDFJS = pdfjs.PDFJS;
    PDFJS.disableWorker = true;
    
    // for tuning the look of the group progress views
    var scaleDim = function(d) {
        return Math.floor(d * 0.75); // TODO change?
    }

    // line chart styles
    var normalStrokeStyle = '#555',
        normalFillStyle = 'transparent',
        normalLineWidth = 1,
        selectedStrokeStyle = 'purple',
        selectedFillStyle = 'purple',
        selectedLineWidth = 3;

    // progress view dimensions/styles
    var pageXOffset = scaleDim(7),
        pageYOffset = scaleDim(11),
        pageWidth = scaleDim(75),
        pageHeight = scaleDim(pageWidth * 48 / 33.5),
        boxWidth = scaleDim(pageWidth * 0.45),
        outlineLineWidth = 2,
        outlineStrokeStyle = 'black',
        barWidth = scaleDim(11),
        barHeight = scaleDim(43),
        barStep = scaleDim(5),
        barLineWidth = 2;

    // colors for each student in a group
    var colormap = {
        0: '#e98039',
        1: '#6ab1b6',
        2: '#face57',
        3: '#ac63a5',
        4: '#29e663',
        5: '#898989',
        6: '#000000',
    };

    var groupSelected = null;
    var doRefresh = null; // to keep refreshVisualizations later
    var gctrl = null;

    // The scroll position number reported by Whiteboard is a real number
    // in [0,1] representing the position of the student's view in the 
    // entire document. This function calculates the page number (with the
    // first page numbered 0).
    var getPageNumber = function(scrollPos, npages) { 
        // estimated fraction of a page the student can see
        // TODO have the whiteboard app report this? or just measure how it 
        // appears on the tablets and hard-code? The current value is from
        // my laptop
        var viewsize = 0.4;

        // The first and last pages are special cases because they have less
        // scrollable area than inner pages
        var p1bound = (1 - viewsize / 2) / (npages - viewsize);
        var pnbound = (npages - viewsize - (1 - viewsize / 2)) / (npages - viewsize);
        var onpage = -1;
        if(scrollPos < p1bound) {
            onpage = 0;
        } else if(scrollPos >= pnbound) {
            onpage = npages - 1;
        } else {
            onpage = Math.floor((npages - 2) * (scrollPos - p1bound) / (pnbound - p1bound)) + 1;
        }

        // zero-indexed
        return onpage;
    };

    // per group?
    var refreshProgressCanvas = function(ctx, pdfcanvas, data, npages) {
        // If the shared PDF render is available, draw it first
        if(pdfcanvas) {
            ctx.drawImage(pdfcanvas, pageXOffset, pageYOffset);
        }
        
        var markernum = 0;
        var markermap = {};

        // Draw boxes
        //ctx.imageSmoothingEnabled = false;
        ctx.translate(1, 1); // for crisper lines
        for(var i = 0; i < npages; i++) {
            var pageBaseX = pageXOffset + i * pageWidth;
            var pageBaseY = pageYOffset;

            // Page outline
            ctx.strokeStyle = outlineStrokeStyle;
            ctx.lineWidth = outlineLineWidth;
            ctx.strokeRect(pageBaseX, pageBaseY, pageWidth, pageHeight);

            /*
            // completion box
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(pageBaseX - pageXOffset, 0, boxWidth, boxWidth);
            */

            // Draw student page completion markers
            var total = -1;
            markernum = 0;
            for(var studentId in data) {
                if(studentId == "total") {
                    total = data[studentId];
                } else {

                    /*
                    // draw completion marker
                    if((i in data[studentId].complete) && data[studentId].complete[i]) {
                        ctx.fillStyle = colormap[markernum];
                        var markerX = pageBaseX - pageXOffset + (markernum % 2) * (boxWidth / 2),
                            markerY = pageBaseY - pageYOffset + Math.floor(markernum / 2) * (boxWidth / 2);
                        ctx.fillRect(markerX, markerY, boxWidth / 2, boxWidth / 2);
                    }
                    */


                    // keep track of which marker number we're using for each student
                    markermap[studentId] = markernum;
                    markernum++;
                }
            }
            /*
            // completion marker outline
            ctx.strokeStyle = outlineStrokeStyle;
            ctx.lineWidth = outlineLineWidth;
            ctx.strokeRect(pageWidth * i, 0, boxWidth, boxWidth);
            */
        }
        
        // Draw student relative contribution bars
        ctx.lineWidth = barLineWidth;
        var onPageCounts = {};
        for(var studentId in data) {
            if(studentId != "total") {
                var studentRelativeContribution = data[studentId].count / total;
                var barFillHeight = studentRelativeContribution * barHeight;

                // determine which page student is on and how many other students are on that page
                var _markernum = markermap[studentId];       
                var currentPage = getPageNumber(data[studentId].position, npages);
                if(!(currentPage in onPageCounts)) {
                    onPageCounts[currentPage] = 0;
                }

                var barX = currentPage * pageWidth + pageXOffset + onPageCounts[currentPage] * (barStep + barWidth) + barStep;
                var barY = pageYOffset + pageHeight - 22;
                onPageCounts[currentPage]++;

                // draw bar background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(barX, barY, barWidth, barHeight);

                // draw bar outline
                ctx.strokeStyle = colormap[_markernum];
                ctx.strokeRect(barX, barY, barWidth, barHeight);

                // draw bar fill
                ctx.fillStyle = colormap[_markernum];
                ctx.fillRect(barX, barY + barHeight - barFillHeight, barWidth, barFillHeight);
            }
        }
        //m.redraw();
    };

    var generateProgressView = function(data, pdfcanvas, npages) {
        var groupViewList = [], groupData = data.latest.groups;
        
        for(var gkey in groupData) {
            if(!(gkey === "total")) {
                var groupId = parseInt(gkey),
                    oneGroup = groupData[gkey],
                    groupTotal = oneGroup.total,
                    studentList = [];

                var progressviewClickHandler = function(gid) {
                    return function(_) {
                        
                        // Set the group selection and redraw everything
                        groupSelected = gid;
                        refreshVisualizations(gctrl);
                    };
                };

                var createGroupCanvas = function(gid) {
                    return function(canvas) {
                        // refresh canvas
                        var ctx = canvas.getContext("2d");
                        canvas.width = pageWidth * npages + 2 * pageXOffset;
                        canvas.height = pageHeight + pageYOffset + 25;
                        refreshProgressCanvas(
                            ctx,
                            pdfcanvas,
                            groupData[gid],
                            npages
                        );        
                    };
                };

                // Highlight the group number if the group is selected
                var groupSelector = "div.group-number";
                if(parseInt(gkey) == groupSelected) {
                    groupSelector += ".group-number-selected";
                }

                groupViewList.push(m("div.group-progress-container",
                    m(groupSelector, 
                        {onclick: progressviewClickHandler(gkey)},
                        gkey),
                    m("div.group-progress-view",
                        {onclick: progressviewClickHandler(gkey)},
                        m("canvas.group-progress-canvas", 
                            {config: createGroupCanvas(gkey)}, 
                            "canvas not supported"),
                        studentList
                    )
                ));
            }
        }

        return groupViewList;
    };

    var generateLineChartSVG = function(data) {
        var lcdata = data.old;
        if((typeof lcdata) === "undefined") {
            lcdata = [];
        }

        var chartXOffset = 20,
            chartYOffset = 20;
        var svgwidth = Math.floor(0.9 * document.body.clientWidth);
        var svgheight = Math.floor(0.15 * svgwidth);
        var chartWidth = svgwidth - chartXOffset,
            chartHeight = svgheight - chartYOffset;
        var sessionDuration = 60 * 60 * 1000,
            updateInterval = 1 * 60 * 1000;

        var drawlist = [];
        
        var drawPoint = function(time, count, prevtime, prevcount, isSelected, gkey) {
            var x = (time / sessionDuration) * chartWidth + chartXOffset,
                y = svgheight - (chartHeight * count / maxPoints) - chartYOffset,
                prevX = (prevtime / sessionDuration) * chartWidth + chartXOffset,
                prevY = svgheight - (chartHeight * prevcount / maxPoints) - chartYOffset;
            
            // Choose style based on whether the group is selected
            var strokeStyle, fillStyle, lineWidth;
            if(isSelected) {
                strokeStyle = selectedStrokeStyle;
                fillStyle = selectedFillStyle;
                lineWidth = selectedLineWidth;
            } else {
                strokeStyle = normalStrokeStyle;
                fillStyle = normalFillStyle;
                lineWidth = normalLineWidth;
            }
            
            // Draw a line from the old point to the new one
            drawlist.push(m("line", {
                "stroke-width": lineWidth,
                stroke: strokeStyle,
                x1: prevX, y1: prevY, x2: x, y2: y
            }));

            // Draw circle
            drawlist.push(m("circle", {
                fill: fillStyle,
                stroke: strokeStyle,
                cx: x, cy: y, r: 4.0,
                onclick: (function(gid) {
                    return function(ev) {
                        console.log(gid);
                        groupSelected = parseInt(gid);
                        refreshVisualizations(gctrl);
                    };
                })(gkey)
            }));    
        }; // drawPoint

        var drawTick = function(time) {
            var x = (time / sessionDuration) * chartWidth + chartXOffset,
                y = chartHeight;
            drawlist.push(m("line", {
                "stroke-width": 1, stroke: "black",
                x1: x, y1: y - 4, x2: x, y2: y
            }));
        };
        
        var timestamp, basetime;
        var prevTime = {}, prevCount = {};

        // Find max count to determine scale for y axis
        var maxPoints = -1;
        for(var i = 0, len = lcdata.length; i < len; i++) {
            for(var gkey in lcdata[i].groups) {
                if(gkey !== "total") {
                    var thistotal = lcdata[i].groups[gkey].total;
                    if(thistotal > maxPoints) {
                        maxPoints = thistotal;
                    }
                }
            }
        }
        // avoid cutting off tops of circles
        maxPoints *= 1.05;

        // Draw points and connecting lines
        for(var i = 0, len = lcdata.length; i < len; i++) {
            if(i == 0) {
                basetime = lcdata[i].time;
            }
            timestamp = lcdata[i].time - basetime;

            // Draw a point for each group
            for(var gkey in lcdata[i].groups) {
                if(gkey === "total") 
                    continue;
                
                // we are interested in per-group totals
                if(!(gkey in prevTime)) {
                    prevTime[gkey] = 0;
                }
                if(!(gkey in prevCount)) {
                    prevCount[gkey] = 0;
                }
                var count = lcdata[i].groups[gkey].total;
                drawPoint(
                    timestamp, 
                    count, 
                    prevTime[gkey], 
                    prevCount[gkey], 
                    (parseInt(gkey) == groupSelected),
                    gkey
                );
                
                prevTime[gkey] = timestamp;
                prevCount[gkey] = count;
            }

            // Draw the time marker on the x axis
            drawTick(timestamp);
        }

        // Draw axes and points
        return m("svg.linechart", {width: svgwidth, height: svgheight},
            m("line.xaxis", {
                "stroke-width": 1, stroke: "black", 
                x1: chartXOffset, y1: 0, x2: chartXOffset, y2: svgheight - chartYOffset
            }),
            m("line.yaxis", {
                "stroke-width": 1, stroke: "black", 
                x1: chartXOffset, y1: svgheight - chartYOffset, x2: svgwidth, y2: svgheight - chartYOffset
            }),
            drawlist
        );
    };


    // Make sure summary data is fresh and reload everything.
    var refreshVisualizations = function(ctrl) {
        var recreateView = function(data) {
            ctrl.summaryData = data;
            
            // Make chart tracking relative activity of groups
            //ctrl.linechartview = generateLineChart(data);
            ctrl.linechartview = generateLineChartSVG(data);

            // Make per-group progress views
            ctrl.progressview = generateProgressView(data, ctrl.pdfcanvas, ctrl.npages);
            m.redraw();
        };

        // Check if we just reloaded summary data recently
        if(ctrl.summaryDataLoaded && (ctrl.summaryDataLoaded > (Date.now() - 10000))) {
            recreateView(ctrl.summaryData);
        } else {
            // Fetch latest summary data for the session
            var ret = m.request({
                method: "GET",
                url: "/api/v1/visualize/:sessionId",
                data: {sessionId: m.route.param("sessionId")}
            }).then(function(result) {
                ctrl.summaryDataLoaded = Date.now();
                recreateView(result);
            });
        }

        //console.log(ret);
        return ret;
    };


    exports.dataVis = {
        controller: function(args) {
            //console.log(args);
            var ctrl = {
                session: args.sessions()[0],
                summaryData: "summary data hasn't loaded yet",
                summaryDataLoaded: null,
                pdfthumbs: null // to be filled in when we've downloaded and rendered
            };
            

            ctrl.session.metadata = JSON.parse(ctrl.session.metadata);
            var pdffile = ctrl.session.metadata.pdf.filename;

            // Get pdf and render thumbnails
            PDFJS.getDocument("/media/" + pdffile).then(function(pdf) {
                console.log("loaded pdf");
                var npages = pdf.numPages;
                ctrl.npages = npages;
                var pdfcanvas = document.createElement("canvas");
                var pdfctx = pdfcanvas.getContext("2d");
                
                // TODO finish removing hard-coded values
                pdfcanvas.width = pageWidth * npages;
                pdfcanvas.height = pageHeight;


                // Render all pages and lay out on pdfcanvas
                for(var i = 1; i <= npages; i++) {
                    pdf.getPage(i).then(function(page) {
                        // Render page onto temporary canvas
                        var tempcanvas = document.createElement("canvas");
                        tempcanvas.width = pageWidth * 2;
                        tempcanvas.height = pageHeight * 2;
                        var tempctx = tempcanvas.getContext('2d');

                        
                        // get viewport scaling width to the target width defined above
                        var viewport = page.getViewport(1);
                        viewport = page.getViewport(tempcanvas.width / viewport.width);

                        // render to drawing context
                        page.render({viewport: viewport, canvasContext: tempctx}).then(function() {
                            // move the page over to proper location
                            pdfctx.drawImage(tempcanvas, 
                                0, 0, pageWidth, pageHeight,
                                page.pageIndex * pageWidth, 0, pageWidth, pageHeight);
                            
                            // trigger mithril redrawing DOM
                            refreshVisualizations(ctrl);
                        });
        
                    });
                }
                ctrl.pdfcanvas = pdfcanvas;

            });

            //refreshVisualizations(ctrl);
            setInterval(function() { refreshVisualizations(ctrl); }, 15000);

            // TODO put this elsewhere?
            gctrl = ctrl;
            return ctrl;
        },
        
        view: function(ctrl, args) {
            //console.log("in view");
            // Page structure:
            // activity graph (canvas?)
            // grid with groups
            //  need: pdf thumbs

            //return m("div", "Hello session " + ctrl.sessionId);      

            //generateProgressView(null);
            return m("div",
                m("div.graph-view",
                    m("div.linechart-y-label", "Class Activity"),
                    ctrl.linechartview
                ),
                m("div.progress-view",
                    //getGroupList(ctrl.sessionId);
                    //generateProgressView(ctrl.summaryData, ctrl.pdfcanvas, ctrl.npages)
                    ctrl.progressview
                )
            );
        }
    };
});
