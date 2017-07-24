define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "models", "css", "uuidv1", "userColors", "./mechanicsObjects.js"], function(exports, pdfjs, m, models, css, uuidv1, userColors, mechanicsObjects) {
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
      connection: connection,
        group: params.group
    }));

    connection.addObserver(function(store) {
      if (store.scrollPositions) {
        ctrl.scrollPositions = store.scrollPositions || {};
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
        scrollPositions: {},
        scroll: m.prop("open"),

        pages: [],
        //pagesComplete: {},
        remotePages: m.prop({}),
        
        // TODO figure out what these were for
        currentPath: null,
        currentPage: null,
        
        // stores index of current document for each user
        pageNumbers: m.prop({}),

        addObserver: args.connection.addObserver.bind(args.connection),

        drawn: m.prop([]),
        pdfs: m.prop([]),
        tool: m.prop(0),
        color: {0: 0, 1: 0},
        size: m.prop(10),
        fireScrollEvent: true,
        lastX: 0,
        lastY: 0,
        curId: {},
        user: args.user,
        session: args.session,
        activity: m.prop(null),
        docs: m.prop({}),
        firstLoad: true,
        user: args.user,

        lastDrawn: m.prop({}),

        updateQueue: [],

        // make a canvas ID string from document and page numbers
        getCanvasId: function(docIdx, pageNum) {
            return "drawSurface-" + docIdx + "-" + pageNum;
        },

        // parse document and page numbers from a canvas ID string
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
                var contents = docs[docId].canvasContents[pn] = [];
                canvases[pn].forEachObject(function(obj) {
                    console.log("Here");
                    contents.push(obj.toObject(["name", "uuid"]));
                });
            }
            ctrl.docs(docs);
        },

        userList: m.prop([]),

        // for recording which document each user is looking at
        setPage: function(pageNum) {
            var canvases = ctrl.docs()[pageNum].canvas,
                queue = ctrl.updateQueue;
            for(var i = 0; i < queue.length; i++) {
                var update = queue[i];
                if(update) {
                    // If the update belongs on the current document, apply
                    // and delete the entry in the queue
                    if(update.meta.doc == pageNum) {
                        ctrl.applyUpdate(update.data, canvases[update.meta.page]);
                        delete queue[i];
                        i--;
                    }
                }
            }
            
            // Notify group
            args.connection.transaction([["setPage"]], function(userCurrentPages) {
                userCurrentPages.data = userCurrentPages.data || "{}";
                var pageNumData = JSON.parse(userCurrentPages.data);
                pageNumData[args.user] = pageNum;
                userCurrentPages.data = JSON.stringify(pageNumData);
                userCurrentPages.meta = ctrl.makeTransactionMetadata("setPage");
            });
        },

        dummycounter: 0,

        setScroll: function(pos) {
          //var scrollPositions = ctrl.scrollPositions();
          args.connection.transaction([["scrollPositions", args.user, ctrl.pageNumbers()[args.user]]], function(userScrollPositions) {
            userScrollPositions.pos = pos;

            // dumb
            if(!ctrl.scrollPositions) {
                ctrl.scrollPositions = {};
            }
            if(!ctrl.scrollPositions[args.user]) {
                ctrl.scrollPositions[args.user] = {};
            }
            ctrl.scrollPositions[args.user][ctrl.pageNumbers()[args.user]] = userScrollPositions;
          });
        },

        getScroll: function(userId, pageNumber) {
            return (ctrl.scrollPositions[userId]) 
            ? ((ctrl.scrollPositions[userId][pageNumber]) 
                ? ctrl.scrollPositions[userId][pageNumber].pos
                : 0)
            : 0;
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

          // Make a JSON string with default metadata and any additional properties to include
          makeTransactionMetadata: function(transactionType, optExtra) {
            optExtra = optExtra || {};
            return JSON.stringify(Object.assign({
                type: transactionType,
                u: args.user,
                g: args.group,
                s: args.session
            }, optExtra));
          },


          /* TODO selection boxes
          setSelectionBox: function(groupObj, doc, page) {
              // Send an update about the area we're selecting
              args.connection.transaction([["selectionBox", args.user]], function(selectionBox) {
                  if(groupObj) {
                      selectionBox.selecting = true;

                      // the box
                      selectionBox.left = groupObj.left;
                      selectionBox.top = groupObj.top;
                      selectionBox.width = groupObj.width;
                      selectionBox.height = groupObj.height;

                      // the page
                      selectionBox.doc = doc;
                      selectionBox.page = page;
                  } else {
                      selectionBox.selecting = false;
                  }
              });
          },
          */

          doObjectTransaction: function(obj, canvas, transactionType) {
            args.connection.transaction([["objects", obj.uuid]], function(objects) {
                ctrl.curId[obj.uuid] = objects._id || 0;

                // If obj is part of a selection group, its coordinates are for
                // some reason given relative to the selection. Here we calculate
                // selX and selY to find the object's position relative to the canvas.
                var selX = 0, selY = 0;
                if('group' in obj) {
                    selX = obj.group.left + (obj.group.width / 2);
                    selY = obj.group.top + (obj.group.height / 2);

                    // TODO selection box
                    //ctrl.setSelectionBox(obj.group);
                }

                var uuid = obj.uuid; // preserve uuid in case it's lost in toObject
                if(obj.name != "remove") {
                    obj = obj.toObject();
                }

                obj.left += selX;
                obj.top += selY;
                
                // Damn son that was easy!
                objects.data = JSON.stringify(obj);
                objects.meta = ctrl.makeTransactionMetadata(transactionType, {
                    page: canvas.page,
                    doc: canvas.doc,
                    uuid: uuid,
                    _id: ctrl.curId[uuid]
                });
            });
          },

        addObject: function(obj, canvas, doAdd, doTransaction, transactionType) {
            if(doAdd) {
                // Make
                if(obj.type == "path") {
                    obj = new fabric.Path(obj.path, obj);
                } else if(obj.type == "line" || obj.type == "Line") {
                    obj = mechanicsObjects.addControlledLine(null, obj);
                } else if(obj.type && obj.type != 'circle') {
                    console.log(obj.type);
                    obj = new mechanicsObjects[obj.type](obj);
                } else {
                    // Do nothing if obj.type isn't defined
                    return;
                }
                console.log(obj);

                // Add
                if(obj instanceof Array) {
                    canvas.add.apply(canvas, obj);
                } else {
                    canvas.add(obj);
                }
            }

            console.log("add object");

            // Generate UUID if none present for object
            if(!('uuid' in obj)) {
                obj.uuid = uuidv1();
            }

            // Store object with canvas by uuid
            canvas.objsByUUID[obj.uuid] = obj;
            
            // if it's a controlled line/curve, don't include the control handles
            if(obj instanceof Array) {
                 obj[0].uuid = obj.uuid;
                 obj[1].uuid = obj.uuid;
                 obj[2].uuid = obj.uuid;
                 obj = obj[0];
            }

            // Send the object
            if(doTransaction)
                ctrl.doObjectTransaction(obj, canvas, transactionType);
        },

        modifyObject: function(obj, canvas, transactionType) {
            ctrl.doObjectTransaction(obj, canvas, transactionType);
        },

        removeObject: function(obj, canvas, doRemove, doTransaction, transactionType) {
            if(doRemove)
                canvas.remove(obj);
            
            if(obj.uuid in canvas.objsByUUID)
                delete canvas.objsByUUID[obj.uuid];

            if(doTransaction)
                ctrl.doObjectTransaction({uuid: obj.uuid, name: "remove"}, canvas, transactionType);
        },
 
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
        },

          applyUpdate: function(updateObj, canvas) {
              console.log(updateObj);
              if(updateObj.uuid in canvas.objsByUUID) {
                  var canvasObj = canvas.objsByUUID[updateObj.uuid];
                  
                  if(updateObj.name == "remove") {
                      // Remove object
                      ctrl.removeObject(canvasObj, canvas, true, false);
                  } else {
                      // object exists so modify it
                      canvasObj.set(updateObj);
                  }
                  canvas.renderAll();
              } else {
                  // object does not exist so create (no transaction)
                  ctrl.addObject(updateObj, canvas, true, false);
              }
          },

          // TODO finish selection color
          /*
          drawSelectionBox: function(box, userId, canvas) {
            var ctx = canvas.getContext('2d');
            if(box.selecting) {
                // draw
                ctx.fillStyle = getUserColor(ctrl.userList(), args.user);
                ctx.fillRect(box.left, box.top, box.width, box.height);
            } else {
                // clear
                ctx.clearRect(box.left, box.top, box.width, box.height);
            }
          }
          */
      };

      args.connection.userList.addObserver(function(users) {
        ctrl.userList(users);
          // TODO get correct position!
        // Update users' page positions
          console.log("user list update");
        ctrl.userList().map(function(user) {
            if(!(user.id in ctrl.pageNumbers()))
                ctrl.pageNumbers()[user.id] = 0;
        });
        m.redraw(true);
      });

      // Set page number
      args.connection.addObserver(function(store) {
        if(store.setPage && store.setPage.data) {
            Object.assign(ctrl.pageNumbers(), JSON.parse(store.setPage.data));
        }
      });

      // Set selection box
        // TODO
      /*
      args.connection.addObserver(function(store) {
        for(var userId in store.selectionBox) {
            var box = store.selectionBox[userId];
            var currentDoc = ctrl.pageNumbers()[args.user];
            console.log(box);
            if(('doc' in box) && box.doc == currentDoc) {
                ctrl.drawSelectionBox(box, args.user, ctrl.docs()[currentDoc].canvas[box.page]);
            }
        }
      });
      */

      // Handle object updates
      ctrl.objectObserver = function(store) {
            for(var uuid in store.objects /*objmap*/) {
                var update = store.objects[uuid]; /*objmap[uuid];*/
                var updateObj = JSON.parse(update.data),
                    updateMeta = JSON.parse(update.meta);
                updateObj.uuid = updateMeta.uuid;
                if(!(uuid in ctrl.curId)) {
                    ctrl.curId[uuid] = updateMeta._id - 1;
                }

                if(updateMeta._id > ctrl.curId[uuid]) {
                    ctrl.curId[uuid] = updateMeta._id;

                    if(updateMeta.doc == ctrl.pageNumbers()[args.user]) {
                        ctrl.applyUpdate(updateObj, ctrl.docs()[updateMeta.doc].canvas[updateMeta.page]);
                    } else {
                        console.log("queued update");
                        ctrl.updateQueue.push({data: updateObj, meta: updateMeta});
                    }
                }
            }

          if(ctrl.firstLoad) {
              ctrl.firstLoad = false;
          }
      }

      args.connection.addObserver(ctrl.objectObserver);

      // Load all pdfs right away
      ClassroomSession.get(args.session).then(function(session) {
          // Retrieve activity info for the session
          Activity.get(session.activityId).then(ctrl.activity).then(function() {
              ctrl.activity().pages.map(function(activitypage) {

                  // Retrieve document
                  PDFJS.getDocument("/media/" + activitypage.filename).then(function(pdf) {
                    ctrl.numPages()[activitypage.pageNumber] = pdf.numPages;
                    ctrl.docs()[activitypage.pageNumber] = {
                        page: {},
                        canvas: {},
                        canvasWidth: {},
                        canvasHeight: {},
                        canvasContents: {},
                    };

                    for(var i = 0, len = pdf.numPages; i < len; i++) {
                        // Render page
                        (function(pn) {
                            var canvas = document.createElement('canvas');
                            pdf.getPage(pn + 1).then(function(page) {
                                var viewport = page.getViewport(1000 / page.getViewport(1).width * 1);
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                                canvasctx = canvas.getContext("2d");
                                
                                page.render({canvasContext: canvasctx, viewport: viewport}).then(function() {
                                    ctrl.docs()[activitypage.pageNumber].page[pn] = canvas.toDataURL();

                                    // Make sure objects are shown                                    
                                    ctrl.setPage(0);
                                    
                                });
                            });
                        })(i);
                    }

                    m.redraw(true);
                  });
              });
          });
      });
        ctrl.scrollPositions[args.user] = {};

      return ctrl;
    },
    view: function(ctrl, args) {
      var listener = function(e) {
      };
      return m("#main", {
          class: "scroll-" + ctrl.scroll(),
          config: function(el) {
            ctrl.fireScrollEvent = false;
            el.scrollTop = parseInt(ctrl.getScroll(args.user, ctrl.pageNumbers()[args.user]) * (el.scrollHeight - window.innerHeight));
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
                    args.setPage(doc);
                }
            },
            src: "/shared/icons/Icons_F_Left_W.png"
        }, "Prev"),
        // Specific page buttons
        (args.activity() ? 
        args.activity().pages.map(function(page) {
            var usersHere = [];
            // TODO fix user page icons
            /*
            args.userList().map(function(user) {
                if(args.pageNumbers()[user.id] == page.pageNumber)
                    usersHere.push(m("p", {style: "color: " + getUserColor(args.userList(), user.id)}, m.trust("&#9679;")));
            });
            */
            var samepage = (page.pageNumber == args.pageNumbers()[args.user]);
            return [m("img.tool-icon", {
                    onclick: function() {
                        if(args.pageNumbers()[args.user] != page.pageNumber) {
                            args.saveCanvases(args.pageNumbers()[args.user]);
                            $('.canvas-container').remove();
                            args.lastDrawn({});
                            args.pageNumbers()[args.user] = page.pageNumber;
                            m.redraw(true);
                            args.setPage(page.pageNumber);
                        }
                    },
                    // Use the filled-in circle if it's the current page
                    src: samepage
                        ? "/shared/icons/Icons_F_Selected Circle_W.png"
                        : "/shared/icons/Icons_F_Deselect Circle_W.png"
                }, page.pageNumber)/*,
                samepage ? "" : m("div.tiny-page-marker", {style: "display: inline-block"}, usersHere)*/];
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
                    args.setPage(doc);
                }
            },
            src: "/shared/icons/Icons_F_Right_W.png"
        }, "Next"),

        /* Disable clear-screen button for now 
        m("img.tool-right.pull-right#clear-screen", {
          onmousedown: args.clear,
          ontouchend: args.clear,
          src: "/shared/icons/Icons_F_Delete Pages_W.png"
        }),*/
        m("img.tool-right.pull-right#undo", {
          onmousedown: args.undo,
          //ontouchend: args.undo
          src: "/shared/icons/Icons_F_Undo_W.png"
        }),
          
          // Only show the objects menu if we're on the third page (the sketch page)
          (args.pageNumbers()[args.user] == 2) ? m.component(MechanicsObjectSelect, args) : "",
       
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

          },
          onclick: m.redraw
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
                    args.addObject(
                        {
                            type: "Arrow",
                            left: ctrl.left,  
                            top: ctrl.top, 
                            width: 2 * ctrl.arrowLength,
                            angle: angles[letters], 
                            //name: letters,
                            stroke: 'green',
                            strokeWidth: 2.5, 
				            originX:'center', 
                            originY: 'center', 
                            padding: 6
                        },
                        ctrl.canvas, true, true
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
                    args.addObject(
                        {
                            type: "DistUnifLoad",
                            left: ctrl.left, 
                            top: ctrl.top, 
                            range: ctrl.distURange, 
                            thickness: ctrl.arrowLength, 
                            arrowAngle: angles[letters], 
                            spacing: ctrl.gridsize / 2
                        },
                        ctrl.canvas, true, true
                    );
                }
           }, "Add DUU");
        }), ["DTUA", "DTUD", "DTDA", "DTDD"].map(function(letters) {
           return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                onclick: function() {
                    var angles = {DTUA: -90, DTUD: -90, DTDA: 90, DTDD: 90};
                    var flipped = {DTUA: false, DTUD: true, DTDA: false, DTDD: true};
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            type: "DistTrianLoad",
                            left: ctrl.left, 
                            top: ctrl.top, 
                            range: ctrl.distTRange, 
                            thickness: ctrl.arrowLength / 4, 
                            angle: 0, 
                            arrowAngle: angles[letters], 
                            spacing: ctrl.gridsize / 2,
                            flipped: flipped[letters],
                            minThickness: ctrl.minThickness,
                            maxThickness: ctrl.maxThickness
                        },
                        ctrl.canvas, true, true
                    );
                }
           }, "Add " + letters);
        })),
        
        m("strong", "FBD Moments"),
        m("p", ["MC", "MCC"].map(function(letters) {
            return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                onclick: function() {
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            type: "Arc",
                            left: ctrl.left, top: ctrl.top,    
                            originX: 'center', originY: 'center',                
                            width: 2 * ctrl.arrowLength, 
                            height: 2 * ctrl.arrowLength, 
                            radius: ctrl.arrowLength, 
                            startAngle: -110, endAngle: 110,    
                            strokeWidth: 2,  fill: 'magenta', stroke: 'magenta',
                            clockwise: (letters == "MC"),
                            angle: -20,
                        },
                        ctrl.canvas, true, true
                    );
                }    
            }, "Add " + letters);
        })),
        
        m("strong", "V and M lines"),
        m("p",
           m("button.btn.btn-info.mech-obj-button#addControlledLine", {
                onclick: function() {
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            type: "Line",
                            left: ctrl.left,
                            top: ctrl.top,
                            x1: ctrl.left,
                            y1: ctrl.top,
                            x2: ctrl.left + 50,
                            y2: ctrl.top + 50,
                            handleRadius: ctrl.handleRadius,
                            strokeWidth: ctrl.strokeWidth,
                            name: "controlledline"
                        },
                        ctrl.canvas, true, true
                    ); 
                }    
           }, "Add Controlled Line"),
           m("button.btn.btn-info.mech-obj-button#addQuadratic", {
                onclick: function() {
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            x1: ctrl.left,
                            y1: ctrl.top,
                            x2: ctrl.left + 100,
                            y2: ctrl.top + 50,
                            x3: ctrl.left + 100,
                            y3: ctrl.top + 100,
                            handleRadius: ctrl.handleRadius,
                            strokeWidth: ctrl.strokeWidth,
                            name: "controlledcurvedline"
                        },
                        ctrl.canvas, true, true
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
              scrollbarHeight: m.prop(null)
          };

          return ctrl;
      },
      view: function(ctrl, args) {
          return m("svg.scrollbar", {
              config: function(el) {
                  ctrl.scrollbarHeight(el.clientHeight);
              },
              onclick: function(e) {
                console.log(e);
                
                  // TODO set own scroll position to match click point
                  var scrollDest = e.offsetY / ctrl.scrollbarHeight();
                  console.log(scrollDest);
                  args.setScroll(scrollDest);
              }},
              args.userList().map(function(user) {
                  // Draw circle on scroll bar if the user is on our page.
                  if(args.pageNumbers()[user.id] == args.pageNumbers()[args.user]) {
                      return m.component(ScrollbarCircle, {
                          scrollPositions: args.scrollPositions,
                          setScroll: args.setScroll,
                          getScroll: args.getScroll,
                          user: user,
                          userList: args.userList,
                          pointerEvents: args.user === user.id,
                          scrollbarHeight: ctrl.scrollbarHeight,
                          pageNumber: args.pageNumbers()[args.user]
                      });
                  } else {
                      return "";
                  }
              }),
              "Scrollbar"
          );
      }
  };

  var ScrollbarCircle = {
    controller: function(args) {
        return {
            radius: 9
        };
    },
    view: function(ctrl, args) {
        // TODO 
        var scrollPosition = args.getScroll(args.user.id, args.pageNumber); 
        return m("circle.scrollbar-circle", {
            cx: "" + ctrl.radius + "px",
            //cy: "calc(1em + " + Math.round(89 * scrollPosition) + "vh)",
            //cy: "" + Math.round(scrollPosition * 100) + "%",
            cy: "" + (ctrl.radius + (args.scrollbarHeight() - 2 * ctrl.radius) * scrollPosition) + "px",
            r: "" + ctrl.radius + "px",
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
          startStrokeSimple: args.startStrokeSimple,
          user: args.user,
          docs: args.docs,
            tool: args.tool,
            addObserver: args.addObserver,

          lastDrawn: args.lastDrawn,
          pageNum: i,
            addObject: args.addObject,
            modifyObject: args.modifyObject,
            removeObject: args.removeObject,

            connection: args.connection,
            drawSelectionBox: args.drawSelectionBox,
            //setSelectionBox: args.setSelectionBox
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

            if(activeObject) {
                //ctrl.canvas.remove(activeObject);
                args.removeObject(activeObject, ctrl.canvas, true, true);
            }

            if(activeGroup) {
                var objects = activeGroup.getObjects();
                ctrl.canvas.discardActiveGroup(); // TODO find out if this is this doing remove?
                objects.forEach(function(obj) {
                    //ctrl.canvas.remove(obj);
                    args.removeObject(obj, ctrl.canvas, true, true);
                });
            }
        },
          // still necessary?
        addObject: function(newobj) {
            if(!ctrl.canvas)
                return;

            console.log(newobj);
            ctrl.canvas.add(newobj);
            ctrl.canvas.objsByUUID[newobj.uuid] = newobj;
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
        
        m("div.drawing-surface",
            m("canvas.drawing-surface", {
                config: function(el, isInit) {
                    if(isInit) {
                        ctrl.setTool();
                        return;
                    }
                    
                    var docs = args.docs();

                    ctrl.canvas = new fabric.Canvas(canvasId, {
                        isDrawingMode: ((args.tool() == 0) || (args.tool() == 1)),
                        allowTouchScrolling: true,
                        doc: currentDocument,
                        page: args.pageNum
                    });
                    docs[currentDocument].canvas[args.pageNum] = ctrl.canvas;

                    var w = docs[currentDocument].canvasWidth[args.pageNum];
                    var h = docs[currentDocument].canvasHeight[args.pageNum];
                    
                    // TODO handle better
                    // Set canvas dimensions
                    if(w)
                        ctrl.canvas.setWidth(w);
                    else
                        ctrl.canvas.setWidth(document.body.clientWidth);
                    ctrl.canvas.setHeight(document.body.clientWidth * 11 / 8.5);
                    
                    // Load canvas data if any
                    ctrl.canvas.objsByUUID = {};
                    var contents = docs[currentDocument].canvasContents[args.pageNum];
                    if(contents) {
                        for(var i = 0, len = contents.length; i < len; i++) {
                            var obj = contents[i];
                            if(obj.type == "path") {
                                ctrl.addObject(new fabric.Path(obj.path, obj));
                            } else {
                                ctrl.addObject(new mechanicsObjects[obj.type](obj));
                            }
                        }
                    }

                    // Draw any selections
                    if(args.connection && args.connection.store)
                        for(var userId in args.connection.store.selectionBox)
                            args.drawSelectionBox(args.connection.store.selectionBox[userId], userId, ctrl.canvas);


                    // Use the right tool
                    ctrl.setTool();

                    // Set up event handlers
                    // TODO finish
                    ctrl.canvas.on({
                        "object:modified": function(e) {
                            if(e.target.type == "circle") {
                                return;
                            }
                            if(e.target.type == "group") {
                                e.target.forEachObject(function(obj) {
                                    args.modifyObject(obj, ctrl.canvas);
                                });
                            } else if(e.target.type == "path") {
                                args.modifyObject(e.target, ctrl.canvas);
                            } else {
                                    args.modifyObject(e.target, ctrl.canvas);
                                
                            }
                        },
                        "path:created": function(e) {
                            args.addObject(e.path, ctrl.canvas, false, true, "addFreeDrawing");
                        },

                        /* TODO selection boxes
                        "selection:cleared": function(e) {
                            console.log("selection cleared");
                            console.log(e);
                            ctrl.currentSelection.selecting = false;
                            args.setSelectionBox(ctrl.currentSelection, currentDocument, args.pageNum);
                        },
                        */

                        // erasing
                        "object:selected": function(e) {
                            console.log("object selected");

                            if(ctrl.erasing) {
                                ctrl.deleteSelected();
                            }
                        },
                        "selection:created": function(e) {
                            console.log("selection created");
                            console.log(e);
                            
                            e.target.hasControls = false;
                            if(ctrl.erasing) {
                                ctrl.deleteSelected();
                            } else {
                                /* TODO selection boxes
                                ctrl.currentSelection = {
                                    selecting: true,
                                    left: e.target.left,
                                    top: e.target.top,
                                    width: e.target.width,
                                    height: e.target.height
                                };

                                args.setSelectionBox(ctrl.currentSelection, currentDocument, args.pageNum);
                                */
                            }
                        },

                    });

                    // save out data
                    args.docs(docs);
                },
                id: canvasId
            })
        )
      );
    }
  };
});
