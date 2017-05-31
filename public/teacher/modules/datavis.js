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

    // colors for each student in a group
    var colormap = {
        0: '#ea6f2c',
        1: '#6cb5b4',
        2: '#f7cc3b',
        3: '#ab4aaa',
        4: '#29e663',
        5: '#898989'
    };


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
        ctx.imageSmoothingEnabled = false;
        ctx.translate(0.5, 0.5); // for crisper lines
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
            markernum = 0;
            for(var studentId in data) {
                if(studentId == "total") {
                    total = data[studentId];
                } else {
                    // draw completion marker
                    if((i in data[studentId].complete) && data[studentId].complete[i]) {
                        ctx.fillStyle = colormap[markernum];
                        var markerX = pageBaseX - pageXOffset + (markernum % 2) * (boxWidth / 2),
                            markerY = pageBaseY - pageYOffset + Math.floor(markernum / 2) * (boxWidth / 2);
                        ctx.fillRect(markerX, markerY, boxWidth / 2, boxWidth / 2);
                    }


                    // keep track of which marker number we're using for each student
                    markermap[studentId] = markernum;
                    markernum++;
                }
            }
            // completion marker outline
            ctx.strokeStyle = '#000000';
            ctx.strokeRect(pageWidth * i, 0, boxWidth, boxWidth);
        }
        
        // Draw student relative contribution bars
        ctx.lineWidth = 2;
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


    // Make sure summary data is fresh and reload everything.
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
