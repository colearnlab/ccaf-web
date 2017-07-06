define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", /*"fabric",*/ "models", /*"interact",*/ "css", "userColors", "./mechanicsObjects.js"], function(exports, pdfjs, m, /*fabric,*/ models, /*interact,*/ css, userColors, mechanicsObjects) {
  var PDFJS = pdfjs.PDFJS;
  var Activity = models.Activity,
      ActivityPage = models.ActivityPage,
      ClassroomSession = models.ClassroomSession;
  var getUserColor = userColors.getColor; 
  var array;
  
  var colors = {
    0: "#000000",
    1: "#FF0000",
    2: "#00FF00",
    3: "#0000FF",
    4: "#FFFFFF"
  };

   var toolNames = [
       'pen',
       'highlighter',
       'eraser',
       'finger',
       'shapes'
   ];

  exports.load = function(connection, el, params) {
    array = connection.array;
    css.load("/apps/whiteboard/styles.css");
    var ctrl = m.mount(el, m.component(Main, {
      pdf: params.pdf,
      user: params.user.id,
      session: params.session.id,
      connection: connection
    }));

    connection.addObserver(function(store) {
      if (store.scrollPositions) {
        ctrl.scrollPositions(store.scrollPositions || {});
      }
      ctrl.remotePages(store.pages || {});
      requestAnimationFrame(m.redraw);
    });

    window.addEventListener("resize", m.redraw.bind(null, true));
  };

  function dist(x1, y1, x2, y2) {
    var d = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    return d;
  }
    
    /*
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
    */

  var Main = {
    controller: function(args) {
      var ctrl = {
        numPages: m.prop([]),
        scrollPositions: m.prop({}),
        scroll: m.prop("open"),

        pages: [],
        //pagesComplete: {},
        remotePages: m.prop({}),
        
        // TODO figure out what these were for
        currentPath: null,
        currentPage: null,
        
        // stores index of current document for each user
        pageNumbers: m.prop({}),

        drawn: m.prop([]),
        pdfs: m.prop([]),
        tool: m.prop(0),
        color: {0: 0, 1: 0},
        size: m.prop(10),
        fireScrollEvent: true,
        lastX: 0,
        lastY: 0,
        curId: 0,
        user: args.user,
        session: args.session,
        activity: m.prop(null),
        docs: m.prop({}),

        lastDrawn: m.prop({}),

        getCanvasId: function(docIdx, pageNum) {
            return "drawSurface-" + docIdx + "-" + pageNum;
        },
        parseCanvasId: function(canvasId) {
            var rest = canvasId.slice("drawSurface-".length);
            var hyphenIdx = rest.indexOf('-');
            return {
                doc: rest.slice(0, hyphenIdx),
                page: rest.slice(hyphenIdx + 1)
            };
        },

        saveCanvases: function(docId) {
            var docs = ctrl.docs();
            var canvases = docs[docId].canvas;

            for(var pn in canvases) {
                docs[docId].canvasContents[pn] = canvases[pn].toJSON();
            }

            ctrl.docs(docs);
        },

        userList: m.prop([]),

        // for recording which document each user is looking at
        setPage: function(pageNum) {
            args.connection.transaction([["setPage"]], function(userCurrentPages) {
                //console.log("page numbers");
                //console.log(userCurrentPages);
                /*
                pageNumbers()[args.user] = pageNum;
                pageNumbers().s = args.session;
                */
                userCurrentPages[args.user] = pageNum;
            });
        },

        dummycounter: 0,
        setScroll: function(pos) {
          args.connection.transaction([["scrollPositions"]], function(scrollPositions) {
            scrollPositions[args.user] = pos;
            scrollPositions.s = args.session;
            console.log(scrollPositions);
          });
        },
        startStroke: function(page, x, y) {
          if (ctrl.tool() === 0 || ctrl.tool() === 1 || ctrl.tool() === 2) {
            ctrl.currentPage = page;

            args.connection.transaction([["pages"]], function(pages) {
              ctrl.curId = pages._id || 0;
              args.connection.transaction([["pages", page, "paths", "+"]], function(path) {
                var currentPath = ctrl.currentPath = this.props[0].slice(-1)[0];
                var opacity = ctrl.tool() === 1 ? 0.5 : 1;
                path[0] = {eraser: ctrl.tool() === 2, opacity: opacity, color: colors[ctrl.color[ctrl.tool()]], size: ctrl.size(), currentlyDrawing: true};
                path[1] = {x: x, y: y};
                args.connection.transaction([["undoStack", args.user]], function(undoStack) {
                  var undoStackHeight = array.length(undoStack);
                  if (undoStackHeight > 25) {
                    array.splice(undoStack, undoStack.height - 25);
                  }

                  array.push(undoStack, {action: "add-path", page: page, path: currentPath});
                });
              });
              return false;
            });
          }
        },
        addPoint: function(x, y) {
          if (ctrl.tool() === 0 || ctrl.tool() === 1 || ctrl.tool() === 2) {
            if (ctrl.currentPath === null) return;

            if (dist(x, y, ctrl.lastX, ctrl.lastY) < 5)
              return;

            ctrl.lastX = x;
            ctrl.lastY = y;

            args.connection.transaction([["pages"]], function(pages) {
              console.log(pages._id, ctrl.curId);
              if ((pages._id || 0) !== ctrl.curId)
                return false;

              args.connection.transaction([["pages", ctrl.currentPage, "paths", ctrl.currentPath]], function(path) {
                if (!path[0])
                  return false;

                var i = args.connection.array.push(path, {x: parseInt(x), y: parseInt(y), u: args.user, s: args.session}) - 1;

                var toReturn = this.props[0].slice();
                toReturn.push(i);
                return [toReturn];
              });

              return false;
            });
          }
        },
        endStroke: function() {
          if (ctrl.tool() === 0 || ctrl.tool() === 1 || ctrl.tool() === 2) {
            if (ctrl.currentPath === null) return;

            args.connection.transaction([["pages", ctrl.currentPage, "paths", ctrl.currentPath]], function(path) {
              if (!path[0])
                return false;

              path[0].currentlyDrawing = false;
              var toReturn = this.props[0].slice();
              toReturn.push(0);
              return [toReturn];
            });
          }

          ctrl.currentPath = null;
          ctrl.currentPage = null;
        },
        clear: function() {
          args.connection.transaction([["pages"]], function(pages) {
            var savedPages = {};
            array.forEach(pages, function(__, i) {
              savedPages[i] = pages[i];
              pages[i] = {paths: {}};
            });
            args.connection.transaction([["undoStack"]], function(undoStack) {
              for (var p in undoStack) {
                if (!isNaN(parseInt(p))) {
                  undoStack[p] = {};
                }
              }
            });
          });
        },
        
        ///////////
        addDrawPath: function(pathObj) {
            /*args.connection.transaction([[]], function(p) {
                console.log(p);

            });*/
            //args.connection.transactionJSON(
        },
        ///////////
          
        undo: function() {
          args.connection.transaction([["undoStack", args.user]], function(undoStack) {
            var toUndo = array.pop(undoStack);

            if (typeof toUndo === "undefined")
              return;

            switch (toUndo.action) {
              case "add-path":
                args.connection.transaction([["pages", toUndo.page, "paths", toUndo.path]], function(path) {
                  path[0].hidden = true;
                });
              break;
            }
          });
        }
      };

      args.connection.userList.addObserver(function(users) {
        ctrl.userList(users);
          // TODO get correct position!
        // Update users' page positions
        ctrl.userList().map(function(user) {
            ctrl.pageNumbers()[user.id] = 0;
        });
        m.redraw(true);
      });

      // Load all pdfs right away
      ClassroomSession.get(args.session).then(function(session) {
          // Retrieve activity info for the session
          Activity.get(session.activityId).then(ctrl.activity).then(function() {
              ctrl.activity().pages.map(function(activitypage) {

                  // Retrieve document
                  PDFJS.getDocument("/media/" + activitypage.filename).then(function(pdf) {
                    ctrl.numPages()[activitypage.pageNumber] = pdf.numPages;
                    //ctrl.pdfs()[activitypage.pageNumber] = m.prop(pdf);
                    ctrl.docs()[activitypage.pageNumber] = {
                        page: {},
                        canvas: {},
                        canvasWidth: {},
                        canvasHeight: {},
                        canvasContents: {}
                    };

                    for(var i = 0, len = pdf.numPages; i < len; i++) {
                        // Render page
                        // TODO create canvas (same size as pdf image) for use with fabric!
                        (function(pn) {
                            var canvas = document.createElement('canvas');
                            pdf.getPage(pn + 1).then(function(page) {
                                var viewport = page.getViewport(1000 / page.getViewport(1).width * 1);
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                                canvasctx = canvas.getContext("2d");

                                page.render({canvasContext: canvasctx, viewport: viewport}).then(function() {
                                    ctrl.docs()[activitypage.pageNumber].page[pn] = canvas.toDataURL();
                                });
                            });
                        })(i);
                    }

                    m.redraw(true);
                  });
              });
          });
      });

      return ctrl;
    },
    view: function(ctrl, args) {
      var listener = function(e) {
      };
      return m("#main", {
          class: "scroll-" + ctrl.scroll(),
          config: function(el) {
            ctrl.fireScrollEvent = false;
            el.scrollTop = parseInt(ctrl.scrollPositions()[args.user] * (el.scrollHeight - window.innerHeight));
          },
          onscroll: function(e) {
            var el = e.target;
            if (!ctrl.fireScrollEvent) {
              ctrl.fireScrollEvent = true;
              m.redraw.strategy("none");
              return false;
            }
            ctrl.setScroll(el.scrollTop / (el.scrollHeight - window.innerHeight));
          }
        },
        
        m.component(PDFViewer, ctrl),
        m.component(Scrollbar, ctrl),
        m.component(Controls, ctrl)
      );

    }
  };

  var Controls = {
    view: function(__, args) {
      return m("#controls",
        // Previous page button
        m("img.tool-icon", {
            onclick: function() {
                var doc = args.pageNumbers()[args.user];
                if(doc > 0) {
                    args.saveCanvases(doc);
                    $('.canvas-container').remove();
                    doc--;
                    args.lastDrawn({});
                    args.pageNumbers()[args.user] = doc;
                    m.redraw(true);
                }
            },
            src: "/shared/icons/Icons_F_Left_W.png"
        }, "Prev"),
        // Specific page buttons
        (args.activity() ? 
        args.activity().pages.map(function(page) {
            return m("img.tool-icon", {
                onclick: function() {
                    if(args.pageNumbers()[args.user] != page.pageNumber) {
                        args.saveCanvases(args.pageNumbers()[args.user]);
                        $('.canvas-container').remove();
                        args.pageNumbers()[args.user] = page.pageNumber;
                        
                        args.setPage(page.pageNumber);
                        
                        args.lastDrawn({});
                        m.redraw(true);
                    }
                },
                // Use the filled-in circle if it's the current page
                src: ((page.pageNumber == args.pageNumbers()[args.user])
                    ? "/shared/icons/Icons_F_Selected Circle_W.png"
                    : "/shared/icons/Icons_F_Deselect Circle_W.png")
            }, page.pageNumber);
        })
        : ""),
        // Next page button
        m("img.tool-icon", {
            onclick: function() {
                var doc = args.pageNumbers()[args.user];
                if(doc < (args.activity().pages.length - 1)) {
                    args.saveCanvases(doc);
                    $('.canvas-container').remove();
                    doc++;
                    args.lastDrawn({});
                    args.pageNumbers()[args.user] = doc;
                    m.redraw(true);
                }
            },
            src: "/shared/icons/Icons_F_Right_W.png"
        }, "Next"),

        
        m("img.tool-right.pull-right#clear-screen", {
          onmousedown: args.clear,
          ontouchend: args.clear,
          src: "/shared/icons/Icons_F_Delete Pages_W.png"
        }),
        m("img.tool-right.pull-right#undo", {
          onmousedown: args.undo,
          //ontouchend: args.undo
          src: "/shared/icons/Icons_F_Undo_W.png"
        }),
          
          m.component(MechanicsObjectSelect, args),
       
            m("img.tool-right.pull-right#pointer-tool", {
                onmousedown: function() {
                    args.tool(3);
                },
                src: "/shared/icons/Icons_F_Pointer_W.png"
            }),


            m("img.tool-right.pull-right#eraser-tool", {
                onmousedown: function() {
                    args.tool(2);
                },
                src: "/shared/icons/Icons_F_Erase_W.png"
            }),
           /* 
          m("img.tool-right.pull-right#highlighter-tool", {
                onmousedown: function() {
                    args.tool(1);
                },
                src: "/shared/icons/Icons_F_Highlight_W.png"
            }),
            */
            m("img.tool-right.pull-right#pen-tool", {
                onmousedown: function() {
                    args.tool(0);
                },
                src: "/shared/icons/Icons_F_Pen_W.png"
            })

      );
    }
  };
  
    
  var MechanicsObjectSelect = {
    controller: function(args) {
      var ctrl = {
        open: m.prop(false),

          // this is dumb
        recalcOffset: function() {
            // The element at the center of the screen is the upper canvas, 
            // so the previousSibling is the lower canvas with id information
            var canvasElement = document.elementFromPoint(
                document.body.clientWidth / 2,
                document.body.clientHeight / 2
            ).previousSibling;

            // Get the fabric canvas based on the id
            var canvInfo = args.parseCanvasId(canvasElement.id);
            ctrl.canvas = args.docs()[canvInfo.doc].canvas[canvInfo.page];
            
            // Get the vertical offset so new objects will be created at the
            // center of the window
            if(ctrl.canvas) {
                var jqCanvasElement = $(canvasElement);
                ctrl.left = ctrl.canvas.width / 2;
                ctrl.top = document.body.clientHeight / 2 - jqCanvasElement.offset().top;
                // vertical scrolling only so don't bother with left offset
            }
        },
        addObject: function(drawObj) {
            // Add the object
            if(drawObj instanceof Array) {
                ctrl.canvas.add.apply(ctrl.canvas, drawObj);
            } else {
                ctrl.canvas.add(drawObj);
            }
        },

          canvas: null,

          // object properties (just guesses for now!)
          left: 0, // left and top to be set in recalcOffset
          top: 0,
          distURange: 100,
          distTRange: 100,
          gridsize: 30,
          arrowLength: 60,
          
          // triangular arrow lengths
          minThickness: 5,
          maxThickness: 50,
        
          strokeWidth: 4,
          handleRadius: 4
      };
      return ctrl;
    },
    view: function(ctrl, args) {
      return m("div.tool-button.tool-right.pull-right", {
          style: "color: white",
          config: function(el, isInit) {
            if (!isInit) {
                /*
              document.addEventListener("mousedown", ctrl.open.bind(null, false), true);
              document.addEventListener("touchstart", ctrl.open.bind(null, false), true);
            */
            }
          }
        },
        m("div.mechanics-objects-holder", {
          onmousedown: function(e) {
            ctrl.open(!ctrl.open());
          },
          ontouchend: function() {
            ctrl.open(!ctrl.open());
          },
          onclick: function() {
              // Choose pointer tool on open or close
              args.tool(3);
          }
        },
        "Objects"
        ),
        m("div#mech-objs-tray", {
          class: ctrl.open() ? "tray-open" : "tray-closed"
        },
            
        // TODO get icons!
        // Object buttons here!
        m("strong", "FBD Concentrated Forces"),
        m("p", ["FU", "FD", "FL", "FR"].map(function(letters) {
            return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                onclick: function() {
                    var angles = {FU: -90, FD: 90, FL: 180, FR: 0}; 
                    ctrl.recalcOffset();
                    ctrl.addObject(
                        new mechanicsObjects.Arrow({                   
                            left: ctrl.left,  
                            top: ctrl.top, 
                            width: 2 * ctrl.arrowLength,
                            angle: angles[letters], 
                            name: letters,
                            stroke: 'green',
                            strokeWidth: 2.5, 
				            originX:'center', 
                            originY: 'center', 
                            padding: 6
                        })
                    );
                }
           }, "Add " + letters);
        })),

        m("strong", "FBD Distributed Load"),
        m("p", ["DUU", "DUD"].map(function(letters) {
            return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                onclick: function() {
                    var angles = {DUU: -90, DUD: 90, };
                    ctrl.recalcOffset();
                    ctrl.addObject(
                        mechanicsObjects.makeDistUnifLoad({
                            left: ctrl.left, 
                            top: ctrl.top, 
                            range: ctrl.distURange, 
                            thickness: ctrl.arrowLength, 
                            angle: angles[letters], 
                            spacing: ctrl.gridsize / 2
                        })
                    );
                }
           }, "Add DUU");
        }), ["DTUA", "DTUD", "DTDA", "DTDD"].map(function(letters) {
           return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                onclick: function() {
                    var angles = {DTUA: -90, DTUD: -90, DTDA: 90, DTDD: 90};
                    var flipped = {DTUA: false, DTUD: true, DTDA: false, DTDD: true};
                    ctrl.recalcOffset();
                    ctrl.addObject(
                        mechanicsObjects.makeDistTrianLoad({
                            left: ctrl.left, 
                            top: ctrl.top, 
                            range: ctrl.distTRange, 
                            thickness: ctrl.arrowLength / 4, 
                            angle: angles[letters], 
                            spacing: ctrl.gridsize / 2,
                            flipped: flipped[letters],
                            minThickness: ctrl.minThickness,
                            maxThickness: ctrl.maxThickness
                        })
                    );
                }
           }, "Add " + letters);
        })),
        
        m("strong", "FBD Moments"),
        m("p", ["MC", "MCC"].map(function(letters) {
            return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                onclick: function() {
                    ctrl.recalcOffset();
                    ctrl.addObject(
                        new mechanicsObjects.Arc({                
                            left: ctrl.left, top: ctrl.top,    
                            originX: 'center', originY: 'center',                
                            width: 2 * ctrl.arrowLength, 
                            height: 2 * ctrl.arrowLength, 
                            radius: ctrl.arrowLength, 
                            startAngle: -110, endAngle: 110,    
                            strokeWidth: 2,  fill: 'magenta', stroke: 'magenta',
                            clockwise: (letters == "MC"),
                            angle: -20,
                            name: letters
                        })
                    );
                }    
            }, "Add " + letters);
        })),
        
        m("strong", "V and M lines"),
        m("p",
           m("button.btn.btn-info.mech-obj-button#addControlledLine", {
                onclick: function() {
                    ctrl.recalcOffset();
                    ctrl.addObject(
                        mechanicsObjects.addControlledLine(null, {
                            x1: ctrl.left,
                            y1: ctrl.top,
                            x2: ctrl.left + 50,
                            y2: ctrl.top + 50,
                            handleRadius: ctrl.handleRadius,
                            strokeWidth: ctrl.strokeWidth
                        })
                    ); 
                }    
           }, "Add Controlled Line"),
           m("button.btn.btn-info.mech-obj-button#addQuadratic", {
                onclick: function() {
                    ctrl.recalcOffset();
                    ctrl.addObject(
                        mechanicsObjects.addControlledCurvedLine(null, {
                            x1: ctrl.left,
                            y1: ctrl.top,
                            x2: ctrl.left + 100,
                            y2: ctrl.top + 50,
                            x3: ctrl.left + 100,
                            y3: ctrl.top + 100,
                            handleRadius: ctrl.handleRadius,
                            strokeWidth: ctrl.strokeWidth
                        })
                    ); 
                }    
           }, "Add Quadratic")
        )
        
        /*
        m("strong", "Help buttons (not graded):"),
        m("p",
            m("button.btn.btn-info.mech-obj-button#addHelpLine", {
                onclick: function() {
                    ctrl.recalcOffset();
                    ctrl.addObject(

                    );
                }
           
           }, "Add Help Line")
        )
        */

        )
      );
    }
  };

    /*
  var SizeSelect = {
    controller: function() {
      return {
        open: m.prop(false)
      };
    },
    view: function(ctrl, args) {
      return m("div.tool-button", {
          config: function(el, isInit) {
            if (!isInit) {
              document.addEventListener("mousedown", ctrl.open.bind(null, false));
              document.addEventListener("touchstart", ctrl.open.bind(null, false));
            }
          }
        },
        m("div.color-swatch-holder", {
          onmousedown: function(e) {
            ctrl.open(!ctrl.open());
          },
          ontouchend: function() {
            ctrl.open(!ctrl.open());
          }
        },
          m("div.pen-size", {
            style: "background-color: " + (colors[args.color[args.tool()]] || "black") + "; width: " + args.size() + "px; height:" + args.size() + "px; margin-top: " + (36 - args.size())/2 + "px; margin-left: " + (36 - args.size())/2 + "px;"
          })
        ),
        m("div#pen-tray", {
          class: ctrl.open() ? "tray-open" : "tray-closed"
        },
          [4, 8, 16, 24, 32].map(function(size) {
            var handler = function() {
              args.size(size);
              ctrl.open(false);
            };

            return m("div.color-swatch-holder", {
                onmousedown: handler,
                ontouchend: handler
              },
              m(".pen-size", {
                style: "background-color: " + (colors[args.color[args.tool()]] || "black") + "; width: " + size + "px; height:" + size + "px; margin-top: " + (36 - size)/2 + "px; margin-left: " + (36 - size)/2 + "px;",
              })
            );
          })
        )
      );
    }
  };
    */
/*
  var Tool = {
    controller: function() {
      return {
        open: m.prop(false)
      };
    },
    view: function(ctrl, args) {
      return m("div.tool-button", {
        config: function(el, isInit) {
            if (!isInit) {
              document.addEventListener("mousedown", ctrl.open.bind(null, false));
              document.addEventListener("touchstart", ctrl.open.bind(null, false));
            }
          }
        },
        m("div.color-swatch-holder", {
          class: (args.tool() === args.toolId ? "selected" : "")
        },
          m("div.color-swatch", {
            style: "background-color: " + colors[args.color[args.toolId]],
            onmousedown: function(e) {
              if (args.tool() !== args.toolId)
                args.tool(args.toolId);
              else
                ctrl.open(!ctrl.open());
            },
            ontouchend: function() {
              if (args.tool() !== args.toolId)
                args.tool(args.toolId);
              else
                ctrl.open(!ctrl.open());
            }
          })
        ),
        m("div#pen-tray", {
          class: ctrl.open() && args.hasTray ? "tray-open" : "tray-closed"
        },
          Object.keys(colors).map(function(colorId) {
            var handler = function() {
              args.color[args.toolId] = colorId;
              ctrl.open(false);
            };

            if (colorId == 4)
              return "";

            return m("div.color-swatch", {
              onmousedown: handler,
              ontouchend: handler,
              style: "background-color: " + colors[colorId] + "; " + (args.color[args.toolId] == colorId ? "display: none; " : ""),
            });
          })
        )
      );
    }
  };
*/
    var PDFViewer = {
      controller: function(args) {
        return {
          interactable: null
        };
      },
      view: function(ctrl, args) {
        return m("#pdf-container", drawPDF(ctrl, args, 1));
      }
    };

  var Scrollbar = {
      controller: function(args) {
          var ctrl = {
          };
          return ctrl;
      },
      view: function(ctrl, args) {
          return m("svg.scrollbar", 
              args.userList().map(function(user) {
                  return m.component(ScrollbarCircle, {
                      scrollPositions: args.scrollPositions,
                      setScroll: args.setScroll,
                      user: user,
                      userList: args.userList,
                      pointerEvents: args.user === user.id
                  });
              }),
              "Scrollbar here"
          );
      }
  };

  var ScrollbarCircle = {
    controller: function(args) {
        return {
        };
    },
    view: function(ctrl, args) {
        // TODO 
        var scrollPosition = args.scrollPositions()[args.user.id];
        return m("circle.scrollbar-circle", {
            cx: "calc(1em - 1px)",
            //cy: "calc(1em + " + Math.round(89 * scrollPosition) + "vh)",
            cy: "" + Math.round(scrollPosition * 100) + "%",
            r: "calc(1em - 2px)",
            fill: getUserColor(args.userList(), args.user.id),
            stroke: "none"
        }, "");
    }
  };

  function drawPDF(ctrl, args, scale) {
    return Array.apply(null, {length: args.numPages()[args.pageNumbers()[args.user]]}).map(function(__, i) {
        return m.component(PDFPageHolder, {
          size: args.size, 
          drawn: args.drawn, 
          startStroke: args.startStroke, 
          addPoint: args.addPoint, 
          endStroke: args.endStroke, 
          page: args.remotePages()[i], 
          currentPath: args.currentPath,
          pdf: args.pdfs()[args.pageNumbers()[args.user]], 
          //pdfs: args.pdfs,
          pageNumbers: args.pageNumbers,
          getCanvasId: args.getCanvasId,
          user: args.user,
          docs: args.docs,
            tool: args.tool,

          lastDrawn: args.lastDrawn,
          pageNum: i, 
      });
    });
  }

  var uniqueCode = 0;
  var PDFPageHolder = {
    controller: function(args) {
      var ctrl = {
        virtualWidth: 1000,
        virtualHeight: 1000 * 11 / 8.5,
        redrawing: false,
        target: null,
        localPenDown: false,
        uniqueId: uniqueCode++, 


        canvas: null,
        erasing: false,
        setPen: function() {
            if(!ctrl.canvas)
                return;

            // TODO would be cool to use custom cursors
            //ctrl.canvas.setCursor('url(/shared/icons/Cursor_F_Pen_B.png), auto');
            //console.log("set pen!");
            
            ctrl.canvas.isDrawingMode = true;
            ctrl.canvas.freeDrawingBrush = new fabric['PencilBrush'](ctrl.canvas);
            ctrl.canvas.freeDrawingBrush.opacity = 1.0;
            
            // Try to improve performance
            ctrl.canvas.selection = false;
        },
        setTool: function() {
            if(!ctrl.canvas)
                return;
            
            ctrl.erasing = false;

            var toolId = args.tool();
            if(toolId == 0) {
                // pen tool
                ctrl.setPen();
            } else if(toolId == 1) {
                // highlighter tool
                ctrl.setPen();
                ctrl.canvas.freeDrawingBrush.opacity = 0.5;
            } else if(toolId == 2) {
                // TODO implement eraser
                ctrl.canvas.isDrawingMode = false;
                ctrl.canvas.selection = true;
                ctrl.erasing = true;
            } else if(toolId == 3) {
                // pointer tool
                ctrl.canvas.selection = true;
                ctrl.canvas.isDrawingMode = false;
            }
        },

        deleteSelected: function() {
            if(!ctrl.canvas)
                return;

            var activeObject = ctrl.canvas.getActiveObject(),
                activeGroup = ctrl.canvas.getActiveGroup();

            if(activeObject)
                ctrl.canvas.remove(activeObject);

            if(activeGroup) {
                var objects = activeGroup.getObjects();
                ctrl.canvas.discardActiveGroup();
                objects.forEach(function(obj) {
                    ctrl.canvas.remove(obj);
                });
            }
        }
      };

      return ctrl;
    },
    view: function(ctrl, args) {

      var currentDocument = args.pageNumbers()[args.user];
      var canvasId = args.getCanvasId(currentDocument, args.pageNum);
      var doc = args.docs()[currentDocument];

      return m("div.pdf-page-holder",
        m("img.pdf-page", {
          onload: m.redraw,
          config: function(el, isInit) {
            /*if (isInit || ctrl.redrawing) {
                return;
            }*/
            if(doc && doc.page[args.pageNum] && ((typeof args.lastDrawn()[args.pageNum]) === "undefined")) {
                el.src = doc.page[args.pageNum];
                args.lastDrawn()[args.pageNum] = true;

                var docs = args.docs();
                docs[currentDocument].canvasWidth[args.pageNum] = el.clientWidth;
                docs[currentDocument].canvasHeight[args.pageNum] = el.clientHeight;
                args.docs(docs);
            }
          }
        }),
        
        m("div.drawing-surface", {
                /*
                config: function(el) {
                    el.addEventListener("touchstart", function(e) {
                        el.style = 'z-index: 4;';
                    }, true);
                    el.addEventListener("touchend", function(e) {
                        el.style = 'z-index: 0;';
                    }, true);
                },
 
                onmousedown: function() {
                    // Update tool?
                    console.log("mouse down");
                },
                onmouseup: function() {
                    console.log("mouse up");
                },
                ontouchstart: function() {
                    console.log("touch start");
                },
                ontouchend: function() {
                    console.log("touch end");
                }
                */
            },
            m("canvas.drawing-surface", {
                config: function(el, isInit) {
                    // set tool?

                    if(isInit) {
                        ctrl.setTool();
                        return;
                    }
                    
                    var docs = args.docs();
                    console.log("create canvas " + canvasId);

                    ctrl.canvas = new fabric.Canvas(canvasId, {
                        isDrawingMode: ((args.tool() == 0) || (args.tool() == 1)),
                        allowTouchScrolling: true
                    });
                    docs[currentDocument].canvas[args.pageNum] = ctrl.canvas;

                    var w = docs[currentDocument].canvasWidth[args.pageNum];
                    var h = docs[currentDocument].canvasHeight[args.pageNum];
                    
                    // TODO handle better
                    if(w)
                        ctrl.canvas.setWidth(w);
                    else
                        ctrl.canvas.setWidth(document.body.clientWidth);
                    ctrl.canvas.setHeight(document.body.clientWidth * 11 / 8.5);
                    

                    // Load canvas data if any
                    var contents = docs[currentDocument].canvasContents[args.pageNum];
                    if(contents) {
                        ctrl.canvas.loadFromJSON(contents);
                    }

                    // Use the right tool
                    ctrl.setTool();

                    // Set up event handlers
                    // TODO shared state things here
                    ctrl.canvas.on({
                        "object:added": function(e) {
                            console.log("object added");
                            console.log(e);
                        },
                        "object:modified": function(e) {
                            console.log("object modified");
                            console.log(e);
                        },
                        "object:removed": function(e) {
                            console.log("object removed");
                            console.log(e);
                        },

                        "path:created": function(e) {
                            console.log("path created");
                            console.log(e);

                            // path: e.path
                            //
                        },


                        // erasing
                        "object:selected": function() {
                            if(ctrl.erasing) {
                                //console.log("should erase! (object.selected)");
                                ctrl.deleteSelected();
                            }
                        },
                        "selection:created": function() {
                            if(ctrl.erasing) {
                                //console.log("should erase! (selection.created)");
                                ctrl.deleteSelected();
                            }
                        },

                    });

                    // save out data
                    args.docs(docs);
                },
                id: canvasId,
                
                onmousedown: function() {
                    // Update tool?
                    console.log("mouse down");
                },
                onmouseup: function() {
                    console.log("mouse up");
                },
                ontouchstart: function() {
                    console.log("touch start");
                },
                ontouchend: function() {
                    console.log("touch end");
                }
            })
        )


        /*
        m("svg.drawing-surface", {
          "color-rendering": "optimizeSpeed",
          config: function(el) {
            var h = el.parentNode.children[0].getBoundingClientRect().height;
            el.style.marginTop = (-h) + "px";
            el.style.transform = "scale(" + (h / ctrl.virtualHeight) + ")";
            ctrl.target = el;
          },
          onmousedown: function(e) {
            var targetRect = ctrl.target.getBoundingClientRect();
            var localX = ctrl.localX = (e.pageX - targetRect.left);
            var localY = ctrl.localY = (e.pageY - targetRect.top);
            var x = localX / targetRect.width * ctrl.virtualWidth;
            var y = localY / targetRect.height * ctrl.virtualHeight;

            console.log("down", x, y);
            requestAnimationFrame(args.startStroke.bind(null, args.pageNum, parseInt(x), parseInt(y)));
            ctrl.localPenDown = true;
            m.redraw.strategy("none");
          },
          onmousemove: function(e) {
            var targetRect = ctrl.target.getBoundingClientRect();
            var localX = ctrl.localX = (e.pageX - targetRect.left);
            var localY = ctrl.localY = (e.pageY - targetRect.top);
            var x = localX / targetRect.width * ctrl.virtualWidth;
            var y = localY / targetRect.height * ctrl.virtualHeight;
            //console.log("move", x, y);
            requestAnimationFrame(args.addPoint.bind(null, parseInt(x), parseInt(y)));
            m.redraw.strategy("none");
          },
          onmouseup: function(e) {
            var targetRect = ctrl.target.getBoundingClientRect();
            var x = (e.pageX - targetRect.left) / targetRect.width * ctrl.virtualWidth;
            var y = (e.pageY - targetRect.top) / targetRect.height * ctrl.virtualHeight;
            //console.log("up", x, y);
            requestAnimationFrame(args.endStroke);
            m.redraw.strategy("none");
            ctrl.localPenDown = false;
          },
          onmouseleave: function(e) {
            args.endStroke();
            m.redraw.strategy("none");
            ctrl.localPenDown = false;
          }
        },
        args.page ?

        bins.map(function(bin, i) {
          return m((i % 2 === 0 ? "g" : "mask"),
          {
            mask: (i % 2 === 0 ? "url(#collection" + ctrl.uniqueId + "" + (i+1) + ")": ""),
            id: "collection" + ctrl.uniqueId + "" + i
          },
            (i % 2 == 1 ? (m("rect", {height: "100%", width: "100%", fill: "white"})) : ""),
            bin.map(function(path) {
              if (!path[0])
                return "";
              return m.component(Path, path);
            })
          );
        })
         : ""
        ),
        m(".eraser", {
          style: !ctrl.localPenDown ? "display: none;" : "",
          config: function(el) {
            var h = el.parentNode.children[0].getBoundingClientRect().height;
            el.style.marginTop = (-h) + "px";

            var size = args.size() * h / ctrl.virtualHeight;
            el.style.height = size + "px";
            el.style.width = size + "px";
            el.style.transform = "translate(" + (ctrl.localX - size / 2) + "px, " + (ctrl.localY - size / 2) + "px";
          }
        }, " ")*/
      );
    }
  };

    var DrawingSurface = {
        controller: function(args) {

        },
        view: function(ctrl, args) {

        }
    };

      /*
  var Path = {
    controller: function() {
      return {
        drawn: false,
        lastErased: null,
        hidden: false
      };
    },
    view: function(ctrl, path) {
      if (ctrl.drawn && path[0].lastErased === ctrl.lastErased && path[0].hidden === ctrl.hidden)
        return {subtree: "retain"};
      else if (path[0].currentlyDrawing === false) {
        ctrl.drawn = true;
      }

      var xM = 1;
      var yM = 1;

      var dStr = "";

      if (!path[0].hidden) {
        var len = array.length(path);

        if (len < 3) {
          var tmp = [path[0], path[1], {x: path[1].x - 0.005, y: path[1].y}, path[1]];
          path = tmp;
          len = 4;
        }

        dStr += " M " + path[1].x * xM + " " + path[1].y * yM;

        for (var i = 2; i < len - 1; i++) {
          var xc = (path[i].x * xM + path[i + 1].x * xM) / 2;
          var yc = (path[i].y * yM + path[i + 1].y * yM) / 2;
          dStr += " Q " + (path[i].x * xM) + " " + (path[i].y * yM) + ", " + xc + " " + yc;
        }
      }

      ctrl.lastErased = path[0].lastErased;
      ctrl.hidden = path[0].hidden;

      return m("path", {
        "shape-rendering": (ctrl.drawn ? "auto" : "optimizeSpeed"),
        stroke: path[0].color || "black",
        "stroke-opacity": path[0].opacity,
        fill: "transparent",
        "stroke-width": path[0].size,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        d: dStr
      });
    }
  };
  */

/*
setTimeout(function() {
  var $ = function(id){return document.getElementById(id)};

  var canvas = this.__canvas = new fabric.Canvas('c', {
    isDrawingMode: true
  });

  fabric.Object.prototype.transparentCorners = false;


  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);

  canvas.freeDrawingBrush.color = 'black';
  canvas.freeDrawingBrush.width = 1;
  canvas.freeDrawingBrush.shadowBlur = 0;

}, 5000);
*/

});
