define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "models", "interact"], function(exports, pdfjs, m, models, interact) {
    var PDFJS = pdfjs.PDFJS;
    PDFJS.disableWorker = true;
    
    // for tuning the look of the group progress views
    var pageXOffset = 7;
    var pageYOffset = 11;
    var pageWidth = 100;
    var pageHeight = Math.round(100 * 11 / 8.5);
    var boxWidth = 43;
    var barWidth = 15;
    var barHeight = 43;
    var barStep = 7;

    /* TODO
     *
     * Draw the big per-group-relative-activity plot
     *  -   background
     *  -   axes
     *  -   points, lines, labels
     *  -   legend
     *  -   mouse events
     *
     *  Draw the per-group progress views
     *  -   background
     *  -   pdf page thumbnails
     *  -   box edges
     *  -   completion tokens
     *  -   per-student relative activity bars
     */


    // 
    var refreshProgressCanvas = function(ctx, pdfcanvas, data, npages) {
        // If the shared PDF render is available, draw it first
        if(pdfcanvas) {
            ctx.drawImage(pdfcanvas, pageXOffset, pageYOffset);
        }

        // Draw boxes
        ctx.imageSmoothingEnabled = false;
        ctx.translate(0.5, 0.5);
        for(var i = 0; i < npages; i++) {
            var pageBaseX = pageXOffset + i * pageWidth;
            var pageBaseY = pageYOffset;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;

            // Page outline
            ctx.strokeRect(pageBaseX, pageBaseY, pageWidth, pageHeight);

            // completion box
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(pageBaseX - pageXOffset, 0, boxWidth, boxWidth);

            // Draw student page completion markers
            var total = -1;
            var markernum = 0;
            var markermap = {};
            for(var studentId in data) {
                if(studentId == "total") {
                    total = data[studentId];
                } else {

                    // draw completion marker
                    // TODO handle case with more than four students in a group?
                    if(markernum == 0) {
                        ctx.fillStyle = '#ea6f2c';
                        ctx.fillRect(pageWidth * i, 0, boxWidth / 2, boxWidth / 2);
                    } else if(markernum == 1) {
                        ctx.fillStyle = '#6cb5b4';
                        ctx.fillRect(pageWidth * i + boxWidth / 2, 0, boxWidth / 2, boxWidth / 2);
                    } else if(markernum == 2) {
                        ctx.fillStyle = '#f7cc3b';
                        ctx.fillRect(pageWidth * i, boxWidth / 2, boxWidth / 2, boxWidth / 2);
                    } else if(markernum == 3) {
                        ctx.fillStyle = '#ab4aaa';
                        ctx.fillRect(pageWidth * i + boxWidth / 2, boxWidth / 2, boxWidth / 2, boxWidth / 2);
                    }

                    markermap[studentId] = markernum;

                    markernum++;
                }
            }
            // completion marker outline
            ctx.strokeStyle = '#000000';
            ctx.strokeRect(pageWidth * i, 0, boxWidth, boxWidth);

            // Draw student relative contribution bars
            // TODO check if student is currently on this page!
            var barBaseX = pageBaseX + barStep;
            var barBaseY = pageBaseY + pageHeight - 22;
            ctx.lineWidth = 2;
            for(var studentId in data) {
                if(studentId != "total") {
                    var studentRelativeContribution = data[studentId] / total;
                    var barFillHeight = studentRelativeContribution * barHeight;

                    if(markermap[studentId] == 0) {
                        ctx.fillStyle = 'white';
                        ctx.fillRect(barBaseX, barBaseY, barWidth, barHeight);
                        
                        ctx.strokeStyle = '#ea6f2c';
                        ctx.strokeRect(barBaseX, barBaseY, barWidth, barHeight);


                        ctx.fillStyle = '#ea6f2c';
                        ctx.fillRect(
                            barBaseX,
                            barBaseY + barHeight - barFillHeight,
                            barWidth,
                            barFillHeight
                        );
                    } else if(markermap[studentId] == 1) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(
                            barBaseX + barStep + barWidth,
                            barBaseY,
                            barWidth,
                            barHeight
                        );
                        
                        ctx.strokeStyle = '#6cb5b4';
                        ctx.strokeRect(
                            barBaseX + barStep + barWidth,
                            barBaseY,
                            barWidth,
                            barHeight
                        );

                        ctx.fillStyle = '#6cb5b4';
                        ctx.fillRect(
                            barBaseX + barStep + barWidth,
                            barBaseY + barHeight - barFillHeight,
                            barWidth,
                            barFillHeight
                        );
                    } else if(markermap[studentId] == 2) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(
                            barBaseX + 2 * (barStep + barWidth),
                            barBaseY,
                            barWidth,
                            barHeight
                        );
                        
                        ctx.strokeStyle = '#f7cc3b';
                        ctx.strokeRect(
                            barBaseX + 2 * (barWidth + barStep),
                            barBaseY,
                            barWidth,
                            barHeight
                        );
                        
                        ctx.fillStyle = '#f7cc3b';
                        ctx.fillRect(
                            barBaseX + 2 * (barStep + barWidth),
                            barBaseY + barHeight - barFillHeight,
                            barWidth,
                            barFillHeight
                        );
                    } else if(markermap[studentId] == 3) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(
                            barBaseX + 3 * (barStep + barWidth),
                            barBaseY,
                            barWidth,
                            barHeight
                        );
                        
                        ctx.strokeStyle = '#ab4aaa';
                        ctx.strokeRect(
                            barBaseX + 3 * (barWidth + barStep),
                            barBaseY,
                            barWidth,
                            barHeight
                        );

                        ctx.fillStyle = '#ab4aaa';
                        ctx.fillRect(
                            barBaseX + 3 * (barStep + barWidth),
                            barBaseY + barHeight - barFillHeight,
                            barWidth,
                            barFillHeight
                        );
                    }

                }
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

                /*
                for(var skey in oneGroup) {
                    if(!(skey === "total")) {
                        studentList.push(m("p", 
                            "student " + skey + ": " + oneGroup[skey]
                        ));
                    }
                }
                */

                groupViewList.push(m("div.group-progress-view", 
                    m("canvas.group-progress-canvas", 
                        {config: function(n) {
                            // refresh canvas
                            n.width = 100 * npages + 50;
                            n.height = 100 * 11 / 8.5 + 50;
                            refreshProgressCanvas(
                                n.getContext("2d"),
                                pdfcanvas,
                                oneGroup,
                                npages
                            );
                        }}, 
                        "canvas not supported"),
                    //"Group " + gkey + " (total: " + groupTotal + ")",
                    studentList
                ));
            }
        }

        return groupViewList;
    };


    var refreshVisualizations = function(ctrl) {
        var recreateView = function(data) {
            ctrl.summaryData = data;
            // TODO create graph

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
                
                // TODO remove hard-coded values
                // aim for 100px/page
                var targetwidth = 100;
                pdfcanvas.width = targetwidth * npages;
                pdfcanvas.height = targetwidth * 11 / 8.5;


                // Render all pages and lay out on pdfcanvas
                for(var i = 1; i <= npages; i++) {
                    pdf.getPage(i).then(function(page) {
                        // Render page onto temporary canvas
                        var tempcanvas = document.createElement("canvas");
                        tempcanvas.width = targetwidth;
                        tempcanvas.height = pdfcanvas.height;
                        var tempctx = tempcanvas.getContext('2d');

                        
                        // get viewport scaling width to the target width defined above
                        var viewport = page.getViewport(1);
                        viewport = page.getViewport(targetwidth / viewport.width);

                        // render to drawing context
                        page.render({viewport: viewport, canvasContext: tempctx}).then(function() {
                            // move the page over to proper location
                            pdfctx.drawImage(tempcanvas, page.pageIndex * targetwidth, 0);
                            
                            // trigger mithril redrawing DOM
                            refreshVisualizations(ctrl);
                        });
        
                    });
                }
                ctrl.pdfcanvas = pdfcanvas;

            });

            //refreshVisualizations(ctrl);
            setInterval(function() { refreshVisualizations(ctrl); }, 15000);

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
                    "Graph goes here"
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
