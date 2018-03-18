/*
 * datavis.js - Visualization tools for teachers to monitor class activity.
 */

define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "models", "css","userColors", "synchronizedStateClient"], function(exports, pdfjs, m, models, css, userColors, synchronizedStateClient) {
    var PDFJS = pdfjs.PDFJS,
        getUserColor = userColors.getColor,

        Classroom = models.Classroom,
        Activity = models.Activity,
        ClassroomSession = models.ClassroomSession,
        User = models.User;
    var wsAddress = 'wss://' + window.location.host + "/ws";
    //var wsAddress = 'ws://' + window.location.host + "/ws";

    PDFJS.disableWorker = true; 

/*
      var userGroup = Object.assign(new Group(), {id: args.group, title: "", classroom: -1});
      userGroup.users().then(function(userGroupList) {
          //console.log(userGroupList);
          for(var i = 0, len = userGroupList.length; i < len; i++) {
              if(ctrl.user == userGroupList[i].id)
                  ctrl.setColor(userColors.userColors[i]);
          }
      });
*/

    /*
     * Various style and size parameters may be set here.
     */

    // for tuning the look of the group progress views
    var scaleDim = function(d) {
        return Math.floor(d * 0.9); // TODO change?
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
        outlineLineWidth = 1,
        outlineStrokeStyle = 'black',
        barYOffset = 30,
        barWidth = scaleDim(11),
        barHeight = scaleDim(40),
        barStep = scaleDim(5),
        barLineWidth = 3;

    // Main datavis component
    exports.DataVis = {
        controller: function(args) {
            var sessionId = m.route.param("sessionId");
            var ctrl = {
                sessionId: m.prop(m.route.param("sessionId")),
                
                session: m.prop(null),
                me: m.prop(null),
                groups: m.prop([]),
                studentsByGroup: m.prop({}),
                userColors: {},
                activity: m.prop(null),

                thumbnails: m.prop([]),

                summaryData: m.prop({}),
                groupHistoryMax: m.prop(null),

                selectedGroupNumber: m.prop(null),

                // Get summary data
                refreshData: function() {
                    m.request({
                        method: "GET",
                        url: "/api/v1/visualize/:sessionId",
                        data: {sessionId: sessionId}
                    }).then(ctrl.summaryData).then(function() {
                        // Find maximum history data point for scaling the graph.
                        var maxPoint = 0;
                        gh = ctrl.summaryData().groupHistory;
                        for(var i = 0, len = gh.length; i < len; i++) {
                            var historyItem = gh[i];

                            for(var groupidx = 0, grouplen = ctrl.groups().length; groupidx < grouplen; groupidx++) {
                            //for(var k in gh[i]) {
                                var groupId = ctrl.groups()[groupidx].id;
                                
                                // Fill in zeros for missing data
                                if(!historyItem[groupId])
                                    historyItem[groupId] = 0;
                                else if(historyItem[groupId] > maxPoint)
                                    maxPoint = historyItem[groupId]; // Set max point
                            }
                        }
                        ctrl.groupHistoryMax(maxPoint);
                    }).then(m.redraw);

                    // Also refresh studentsByGroup
                    ctrl.groups().map(function(group) {
                        group.users().then(function(students) {
                            ctrl.studentsByGroup()[group.id] = students;
                            for(var i = 0, len = students.length; i < len; i++)
                                ctrl.userColors[students[i].id] = userColors.userColors[i];

                            m.redraw();
                        });
                    });
                }
            };

            // Load PDFs and generate thumbnails
            ClassroomSession.get(sessionId).then(function(session) {
                ctrl.session(session);

                // show the session name in the bar at the top of the screen
                args.toolbarText(session.title);

                // get student groups
                Classroom.get(ctrl.session().classroom).then(function(classroom) {
                    
                    classroom.groups().then(function(groups) {
                        ctrl.groups(groups);

                        // get lists of students belonging to each group
                        var sbg = ctrl.studentsByGroup();
                        groups.map(function(group) {
                            group.users().then(function(students) {
                                sbg[group.id] = students;
                                
                                // Set colors for students in progress view
                                for(var i = 0, len = students.length; i < len; i++)
                                    ctrl.userColors[students[i].id] = userColors.userColors[i];
                            });
                        });
                        ctrl.studentsByGroup(sbg);

                        m.redraw();
                    });
                });

                // Download activity and documents
                Activity.get(session.activityId).then(function(activity) {
                    ctrl.activity(activity);
                    
                    // For each document in the activity, render a thumbnail
                    activity.pages.map(function(activitypage) {
                        PDFJS.getDocument("/media/" + activitypage.filename).then(function(pdf) {
                            // just the first page
                            pdf.getPage(1).then(function(page) {
                                var canvas = document.createElement('canvas'),
                                    viewport = page.getViewport(2 * pageWidth / page.getViewport(1).width);
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                                canvasctx = canvas.getContext("2d");
                                
                                // Do render and store as image data
                                page.render({canvasContext: canvasctx, viewport: viewport}).then(function() {
                                    var thumbs = ctrl.thumbnails();
                                    thumbs[activitypage.pageNumber] = canvas.toDataURL();
                                    ctrl.thumbnails(thumbs);
                                    m.redraw(true);
                                });
                            });
                        });
                    });

                }); // Activity.get
            }); // ClassroomSession.get

            // Load own user info
            User.me().then(ctrl.me);

            // Start repeatedly updating summary data
            ctrl.refreshData();
            ctrl.refreshInterval = setInterval(ctrl.refreshData, 10000);

            // Provide a way to kill the updates
            exports.DataVis.exitCallback = function() {
                clearInterval(ctrl.refreshInterval);
            };

            return ctrl;
        },
        view: function(ctrl, args) {
        
            // TODO move these to the beginning of the file with other params
            var chartXOffset = 20,
                chartYOffset = 20;
            var svgwidth = Math.floor(0.9 * document.body.clientWidth);
            var svgheight = Math.floor(0.25 * document.body.clientHeight);
            var chartWidth = svgwidth - chartXOffset,
                chartHeight = svgheight - chartYOffset;

            // By default, assume session is an hour long
            var sessionDuration = 60 * 60 * 1000;
            
            return m("div", {
                // config here?
                },
                m.component(GroupOptionsBar, ctrl),
                m("div.graph-view",
                    m("div.linechart-y-label", "Class Activity"),

                    // Line chart at the top shows relative activity of all groups.
                    m("svg.linechart", {
                            width: svgwidth, 
                            height: svgheight
                        }, 
                        m("line.xaxis", {
                            "stroke-width": 1, stroke: "black", 
                            x1: chartXOffset, 
                            y1: 0, 
                            x2: chartXOffset, 
                            y2: svgheight - chartYOffset
                        }),
                        m("line.yaxis", {
                            "stroke-width": 1, stroke: "black", 
                            x1: chartXOffset, 
                            y1: svgheight - chartYOffset, 
                            x2: svgwidth, 
                            y2: svgheight - chartYOffset
                        }),
                        
                        // Draw points and lines for each group
                        ctrl.groups().map(function(group, idx) {
                            var drawList = [],
                                historyData = ctrl.summaryData().groupHistory || [];
                            var numPoints = historyData.length;

                            var lineWidth, x, y, prevX, prevY, fillStyle, strokeStyle;
                            
                            // Style the line and points differently if we're drawing the
                            // selected group.
                            if(ctrl.selectedGroupNumber() == idx) {
                                strokeStyle = selectedStrokeStyle;
                                fillStyle = selectedFillStyle;
                                lineWidth = selectedLineWidth;
                            } else {
                                strokeStyle = normalStrokeStyle;
                                fillStyle = normalFillStyle;
                                lineWidth = normalLineWidth;
                            }

                            // First line starts at chart origin
                            prevX = chartXOffset;
                            prevY = chartHeight;
                            for(var i = 0; i < numPoints; i++) {
                                var elapsedTime = historyData[i].time - ctrl.session().startTime;
                                
                                // If a data point is missing for a group at this time, simply skip
                                if(!(group.id in historyData[i]))
                                    continue;

                                // Calculate new point location
                                x = (elapsedTime / sessionDuration) * chartWidth + chartXOffset;
                                if(ctrl.groupHistoryMax())
                                    y = svgheight - (chartHeight * historyData[i][group.id] / (ctrl.groupHistoryMax() * 1.05)) - chartYOffset;
                                else
                                    y = svgheight - chartYOffset;


                                // Draw line to connect to previous point
                                drawList.push(m("line", {
                                    "stroke-width": lineWidth,
                                    stroke: strokeStyle,
                                    x1: prevX, 
                                    y1: prevY, 
                                    x2: x, 
                                    y2: y,
                                    onclick: function() {
                                        ctrl.selectedGroupNumber(idx);
                                        m.redraw();
                                    }
                                }));
                                
                                // Make point
                                drawList.push(m("circle", {
                                    fill: fillStyle,
                                    stroke: strokeStyle,
                                    cx: x, 
                                    cy: y, 
                                    r: 4.0,
                                    onclick: function() {
                                        ctrl.selectedGroupNumber(idx);
                                        m.redraw();
                                    }
                                }));

                                // Draw a tick on the x axis
                                drawList.push(m("line", {
                                    "stroke-width": 1, 
                                    stroke: "black",
                                    x1: x, 
                                    y1: y - 4, 
                                    x2: x, 
                                    y2: y
                                }));

                                prevX = x;
                                prevY = y;
                            }
                            
                            return drawList;
                        })
                    )
                ),

                m("div.progress-view",
                    ctrl.groups().map(function(group, idx) {
                        var selectThisGroup = function() {
                            ctrl.selectedGroupNumber(idx);
                            m.redraw();
                        }

                        // Style the group progress box differently if selected
                        var groupSelector = "div.group-number";
                        if(idx == ctrl.selectedGroupNumber()) {
                            groupSelector += ".group-number-selected";
                        }

                        return m("div.group-progress-container",
                            m(groupSelector, {
                                    onclick: selectThisGroup
                                }, 
                                idx + 1
                            ),
                            m("div.group-progress-view", {
                                    onclick: selectThisGroup
                                }, 
                                ctrl.thumbnails().map(function(thumb, pageIdx) {
                                    return m("canvas", {
                                        width: pageWidth,
                                        height: pageHeight + 22, // TODO 
                                        config: function(el, isInit) {
                                            var ctx = el.getContext('2d'),
                                                img = new Image;

                                            // Fix blurry lines
                                            if(!isInit)
                                                ctx.translate(0.5, 0.5);

                                            // Draw pdf thumbnail
                                            ctx.fillStyle = '#ffffff';
                                            ctx.fillRect(0, 0, el.width, el.height);
                                            img.src = thumb;
                                            //console.log(thumb);
                                            ctx.drawImage(img, 0, 0, pageWidth, pageHeight, 0, 0, pageWidth, pageHeight);
                                            ctx.strokeStyle = '#000000';
                                            ctx.lineWidth = outlineLineWidth;
                                            ctx.strokeRect(0, 0, pageWidth, pageHeight);
                                            
                                            var contrib = ctrl.summaryData().contributionToGroup;
                                            if(typeof contrib != "undefined") {
                                                //console.log(ctrl.studentsByGroup());
                                                // Draw student bars
                                                ctrl.studentsByGroup()[group.id].map(function(student, studentIdx, students) {
                                                    if(ctrl.summaryData().pageNumber && ctrl.summaryData().pageNumber[student.id] == pageIdx) {

                    contrib[group.id] = contrib[group.id] || {};
                    contrib[group.id][student.id] = contrib[group.id][student.id] || 0;
                    var barFillHeight = contrib[group.id][student.id] / contrib[group.id].total * barHeight;

                    var barX = pageXOffset + studentIdx * (barStep + barWidth) + barStep;
                    var barY = pageYOffset + pageHeight - barYOffset;

                    // draw bar background
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(barX, barY, barWidth, barHeight);

                    // draw bar outline
                    //var barColor = getUserColor(students, student.id);
                    var barColor = ctrl.userColors[student.id];
                    ctx.strokeStyle = barColor;
                    ctx.lineWidth = barLineWidth;
                    ctx.strokeRect(barX, barY, barWidth, barHeight);

                    // draw bar fill
                    ctx.fillStyle = barColor;
                    ctx.fillRect(barX, barY + barHeight - barFillHeight, barWidth, barFillHeight);
                                                    }
                                                });
                                            }

                                        }
                                    }) // canvas
                                }))
                            ); // progress-container
                    })
                )

            );
        } // view
    };

    // TODO maybe do away with this entirely in future teacher UI redesign
    var GroupOptionsBar = {
        controller: function(args) {
            return {
                launchWhiteboardApp: function(group) {
                    // Add self to group and launch whiteboard
                    args.me().addGroup(group).then(function() {
                        m.mount(document.body, null);
                        
                        var session = args.session(),
                            me = args.me();
                        var metadata = (session.metadata ? JSON.parse(session.metadata) : {});
                        
                        session.getStoreId(group.id, me.id).then(function(storeId) {
                            group.users().then(function(userList) {

                                require(["/apps/" + metadata.app + "/main.js"], function(app) {
                                    var connection = synchronizedStateClient.connect(wsAddress, function() {
                                        connection.sync(storeId);
                                        var appReturn = {};
                                        app.load(connection, document.body, {
                                            user: me,
                                            group: group.id,
                                            groupObject: group,
                                            session: session,
                                            appReturn: appReturn,

                                            exitCallback: function(appCallback) {
                                                // Remove self from first group (dirty, but shouldn't be in more than one group)
                                                args.me().groups().then(function(groups) {
                                                    var group = groups[0];

                                                    // Remove self from group and then return to datavis
                                                    args.me().removeGroup(group).then(function() {
                                                        if(appCallback) {
                                                            appCallback(function() {
                                                                //m.mount(document.body, exports.DataVis);
                                                                location.reload();
                                                            });
                                                        } else {
                                                            //m.mount(document.body, exports.DataVis);
                                                            location.reload();
                                                        }
                                                    });
                                                });
                                            }
                                        }); // app.load
                
                                    }); // connect
                                });

                            }); // group.users

                        }); // getStoreId
                    });
                } // launchWhiteboardApp
            };
        },
        view: function(ctrl, args) {
            var selectedGroup = args.groups()[args.selectedGroupNumber()] || null;
            if(selectedGroup) {
                return m("div.group-options-bar",
                    m("div", {style: "display: inline-block; width: 7vw"}, selectedGroup.title),
                    m("div.group-options-buttons",
                        m("button.btn.btn-default.button1", {
                                onclick: function() {
                                    console.log("launching whiteboard app");
                                    ctrl.launchWhiteboardApp(selectedGroup);
                                }
                            },
                            "View document"
                        ),
                        m("button.btn.btn-default.button1", {
                                onclick: function() {
                                    // Go to group editor with current group selected
                                    console.log("clicked");
                                    exports.DataVis.exitCallback();
                                    var qs = m.route.buildQueryString({
                                        selected: selectedGroup.id
                                    });
                                    m.route("/session/" + args.sessionId() + "?" + qs);
                                }
                            },
                            "Edit group"
                        )
                        // others here?
                        // show group members
                        // edit roster
                    )
                );
            } else {
                return m("div", "");
            }
        }
    };

});

