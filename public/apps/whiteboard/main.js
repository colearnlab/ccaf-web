define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "jquery", "bootstrap", "models", "css", "uuidv1", "userColors", "./mechanicsObjects.js"], function(exports, pdfjs, m, $, bootstrap, models, css, uuidv1, userColors, mechanicsObjects) {
 
    // Disable two-or-more finger touches to prevent pinch zooming
    document.addEventListener('touchstart', function(e){
        if( e.touches.length > 1) {   
            e.preventDefault();
        }
    }, {passive: false});
    
  var PDFJS = pdfjs.PDFJS;
  var Activity = models.Activity,
      ActivityPage = models.ActivityPage,
      ClassroomSession = models.ClassroomSession,
      Group = models.Group;
  var getUserColor = userColors.getColor;
  var array;
 
  // Flag to show ControlledLine and ControlledCurve in the mechanics objects menu
    var showVMLines = true,
        logOrientation = false;

   var toolNames = [
       'pen',
       'highlighter',
       'eraser',
       'finger',
       'shapes'
   ];

   var errmsg = null, errobj = null;
   var errorPrompt = function(msg, obj) {
        errmsg = msg;
        errobj = obj;
        m.redraw(true);
   };

  exports.load = function(connection, el, params) {
    array = connection.array;
    connection.errorCallback = errorPrompt;
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
      //ctrl.remotePages(store.pages || {});
      requestAnimationFrame(m.redraw);
    });

    window.addEventListener("resize", m.redraw.bind(null, true));
  };

  function dist(x1, y1, x2, y2) {
    var d = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    return d;
  }
    
  var Main = {
    controller: function(args) {
      var ctrl = {
        allowUndo: m.prop({}),
        lastToModify: {},
        numPages: m.prop([]),
        scrollPositions: {},
        scroll: m.prop("open"),
 
        // stores index of current document for each user
        pageNumbers: m.prop({}),

        connection: args.connection,
        addObserver: args.connection.addObserver.bind(args.connection),

        tool: m.prop(0),
        fireScrollEvent: true,
        curId: {},
        user: args.user,
        session: args.session,
        activity: m.prop(null),
        docs: m.prop({}),
        firstLoad: true,
        user: args.user,
        myColor: m.prop('#888888'),
        lastDrawn: m.prop({}),

        groupUsers: [],        
        userList: m.prop([]),
        updateQueue: [],

        nextObjectUpdateIdx: 0,

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
                    if(!obj.excludeFromExport) {
                        var frozen = obj.toObject(["name", "uuid", 'left', 'top', 'x1', 'y1', 'x2', 'y2']);
                        if(obj.group) {
                            frozen.left += obj.group.left + (obj.group.width / 2);
                            frozen.top += obj.group.top + (obj.group.height / 2);
                        }
                        contents.push(frozen);
                    }
                });
            }
            ctrl.docs(docs);
        },

        flushUpdateQueue: function(pageNum) {
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
        },

        // for recording which document each user is looking at
        setPage: function(pageNum) {
            ctrl.flushUpdateQueue(pageNum);

            // Notify group
            args.connection.transaction([["setPage"]], function(userCurrentPages) {
                userCurrentPages.data = userCurrentPages.data || "{}";
                var pageNumData = JSON.parse(userCurrentPages.data);
                pageNumData[args.user] = pageNum;
                userCurrentPages.data = JSON.stringify(pageNumData);
                userCurrentPages.meta = ctrl.makeTransactionMetadata("setPage");
            });
        },

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

        setTool: function(toolId) {
            args.connection.transaction([["tool", args.user]], function(tool) {
                tool.tool = ctrl.tool(toolId);
            });
        },

        setColor: function(color) {
            args.connection.transaction([["userColors"]], function(colors) {
                colors[ctrl.user] = color;
                console.log("set color " + color);
                ctrl.myColor(color);
            });
        },

        getScroll: function(userId, pageNumber) {
            return (ctrl.scrollPositions[userId]) 
            ? ((ctrl.scrollPositions[userId][pageNumber]) 
                ? ctrl.scrollPositions[userId][pageNumber].pos
                : 0)
            : 0;
        },

        undo: function() {
            // Get the undo stack
            var tabProps = ctrl.docs()[ctrl.pageNumbers()[args.user]];
            if(!tabProps)
                  return;
 
            var undoEvent, nextUndoEvent;
            do {
                undoEvent = tabProps.undoStack.pop();
                if(undoEvent) {
                    console.log(undoEvent);
                    var canvas = tabProps.canvas[undoEvent.page];
                    
                    // Clear the selection
                    canvas.deactivateAll();
                    
                    if(ctrl.lastToModify[undoEvent.uuid] != args.user) {
                        tabProps.undoStack = [];
                        break;
                    }

                    // Does the object exist on the canvas?
                    if(undoEvent.uuid in canvas.objsByUUID) {
                        if(undoEvent.name == 'remove') {
                            ctrl.removeObject(canvas.objsByUUID[undoEvent.uuid], canvas, true, true, "removeObject", true);
                        } else {
                            // Modify object
                            ctrl.modifyObject(undoEvent, canvas, true, true, "modifyObject", true);
                        }
                    } else {
                        if(undoEvent.name != 'remove')
                            ctrl.addObject(undoEvent, canvas, true, true, "addObject", true);
                    }

                    canvas.renderAll();
                } else {
                    break;
                }
                nextUndoEvent = tabProps.undoStack[tabProps.undoStack.length - 1];
            } while(undoEvent && undoEvent.groupID && nextUndoEvent && (undoEvent.groupID == nextUndoEvent.groupID));

            if(tabProps.undoStack.length == 0)
                ctrl.allowUndo()[ctrl.pageNumbers()[args.user]] = false;
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
              if(!obj.uuid) {
                  console.warn("Missing uuid for transaction");
                  console.log(obj);
                  return;
              };

              console.log(canvas.undoStack);

              // TODO add 
            args.connection.transaction([["objects", obj.uuid], ["latestObjects", "+"]], function(objects, latestObjects) {
                ctrl.curId[obj.uuid] = objects._id || 0;
                
                latestObjects[0] = obj.uuid;

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
                    if(obj.toObject)
                        obj = obj.toObject(['uuid']);
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

                ctrl.lastToModify[obj.uuid] = args.user;
            });

            m.redraw();
          },

        addObject: function(obj, canvas, doAdd, doTransaction, transactionType, skipUndo) {
            if(doAdd) {
                // Make
                if(obj.name == "controlCurvedLine") {
                    obj = mechanicsObjects.addControlledCurvedLine(null, obj);
                } else if(obj.type == "path") {
                    obj = new fabric.Path(obj.path, obj);
                } else if(obj.type == "line" || obj.type == "ControlledLine") {
                    obj = mechanicsObjects.addControlledLine(null, obj);
                } else if(obj.type && obj.type != 'circle') {
                    //console.log(obj.type);
                    obj = new mechanicsObjects[obj.type](obj);       
                } else {
                    // Do nothing if obj.type isn't defined
                    return;
                }

                // Add
                if(obj instanceof Array) {
                    canvas.add.apply(canvas, obj);
                //} else if((obj.type == "ControlledLine") || (obj.type == "ControlledCurve")) {
                    //canvas.add.apply(canvas, obj.objects);
                } else {
                    canvas.add(obj);
                }
            }
 
            // If there are control handles, they have been added to the canvas and can be ignored now.
            if(obj instanceof Array) {
                obj = obj[0];
            }

            // Generate UUID if none present for object
            if(!obj.uuid) {
                obj.uuid = uuidv1();
            }
             
            // Store object with canvas by uuid
            canvas.objsByUUID[obj.uuid] = obj;
            
            canvas.prevObjectState[obj.uuid] = Object.assign(obj.toObject(['uuid']), {uuid: obj.uuid});

            if(!skipUndo) {
                canvas.pushUndo({
                    name: "remove",
                    uuid: obj.uuid,
                });
                ctrl.allowUndo()[ctrl.pageNumbers()[args.user]] = true;
            }

            // Send the object
            if(doTransaction)
                ctrl.doObjectTransaction(obj, canvas, transactionType);
        },

        modifyObject: function(obj, canvas, doModify, doTransaction, transactionType, skipUndo) {
            if(doModify) {
                var canvasObj = canvas.objsByUUID[obj.uuid];
                if(obj.type == "path" || obj.type == "Arrow") {
                    // object exists so modify it
                    canvasObj.set(obj);
                    canvasObj.setCoords();
                } else {
                    // Some MechanicsObjects don't behave well when modified so for now we will
                    // tear down and remake the object
                    ctrl.removeObject(canvasObj, canvas, true, false, "modifyRemove", true);
                    ctrl.addObject(obj, canvas, true, false, "modifyAdd", true);
                }

                canvas.renderAll();
            }
                    
            if(!skipUndo) {
                // Add previous state of object to the undo stack
                var prevObjectState = canvas.prevObjectState[obj.uuid] || {name: "remove", uuid: obj.uuid};
                if(obj.groupID) {
                    prevObjectState.groupID = obj.groupID;
                    //delete obj.groupID;
                }
                canvas.pushUndo(prevObjectState);
                ctrl.allowUndo()[ctrl.pageNumbers()[args.user]] = true;
                //ctrl.allowUndo(true);
            }

            m.redraw();
              
            if(obj.toObject) {
                var frozen = obj.toObject(['uuid']);
                if(!frozen.uuid)
                    frozen.uuid = obj.uuid;
                if(obj.group) {
                    frozen.left += obj.group.left + (obj.group.width / 2);
                    frozen.top += obj.group.top + (obj.group.height / 2);
                }
                canvas.prevObjectState[obj.uuid] = frozen;
            } else {
                canvas.prevObjectState[obj.uuid] = obj;
            }

            if(doTransaction)
                ctrl.doObjectTransaction(obj, canvas, transactionType);
        },

        removeObject: function(obj, canvas, doRemove, doTransaction, transactionType, skipUndo) {
            if(obj.excludeFromExport && obj.target)
                obj = obj.target;

            if(doRemove)
                canvas.remove(obj);
            
            if(obj.uuid in canvas.objsByUUID)
                delete canvas.objsByUUID[obj.uuid];

            // Push onto undo stack
            if(!skipUndo) {
                if(obj.toObject)
                    obj = obj.toObject(['uuid', 'groupID']);
                canvas.pushUndo(obj);
                //ctrl.allowUndo(true);
                ctrl.allowUndo()[ctrl.pageNumbers()[args.user]] = true;
            }

            if(doTransaction)
                ctrl.doObjectTransaction({uuid: obj.uuid, name: "remove"}, canvas, transactionType);
        },
 
          applyUpdate: function(updateObj, canvas) {
              if(updateObj.uuid in canvas.objsByUUID) {
                  var canvasObj = canvas.objsByUUID[updateObj.uuid];
                  
                  if(updateObj.name == "remove") {
                      // Remove object
                      ctrl.removeObject(canvasObj, canvas, true, false);
                  } else {
                      if(updateObj.type == "path" || updateObj.type == "Arrow") {
                          // object exists so modify it
                          canvasObj.set(updateObj);
                      } else {
                          // Some MechanicsObjects don't behave well when modified so for now we will
                          // tear down and remake the object
                          ctrl.removeObject(canvasObj, canvas, true, false);
                          ctrl.addObject(updateObj, canvas, true, false);
                      }
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

      ctrl.pageNumbers()[args.user] = 0;

      var userGroup = Object.assign(new Group(), {id: args.group, title: "", classroom: -1});
      userGroup.users().then(function(userGroupList) {
          //console.log(userGroupList);
          for(var i = 0, len = userGroupList.length; i < len; i++) {
              if(ctrl.user == userGroupList[i].id)
                  ctrl.setColor(userColors.userColors[i]);
          }
      });


      args.connection.userList.addObserver(function(users) {
        ctrl.userList(users);
          // TODO get correct position!
        // Update users' page positions
          //console.log("user list update");
        ctrl.userList().map(function(user) {
            //if(!(user.id in ctrl.pageNumbers()))
                //ctrl.pageNumbers()[user.id] = 0;
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
        //console.log(store);

        if(!store.latestObjects)
            return;

        var newLength = Object.keys(store.latestObjects).length;
        for(var i = ctrl.nextObjectUpdateIdx; i < newLength; i++) {
            var uuid = store.latestObjects[i][0];
            if(!uuid)
                continue;


        //for(var uuid in store.objects /*objmap*/) {
            var update = store.objects[uuid]; /*objmap[uuid];*/
            var updateObj = JSON.parse(update.data),
                updateMeta = JSON.parse(update.meta);
            if(updateMeta.uuid)
                updateObj.uuid = updateMeta.uuid;
            
            ctrl.lastToModify[uuid] = updateMeta.u;
            
            if(!(uuid in ctrl.curId)) {
                ctrl.curId[uuid] = updateMeta._id - 1;
            }

            if(updateMeta._id > ctrl.curId[uuid]) {
                ctrl.curId[uuid] = updateMeta._id;

                var canvas = ctrl.docs()[updateMeta.doc] ? ctrl.docs()[updateMeta.doc].canvas[updateMeta.page] : null;
                if(canvas && (updateMeta.doc == ctrl.pageNumbers()[args.user])) {
                    ctrl.applyUpdate(updateObj, canvas);
                } else {
                    console.log("queued update");
                    ctrl.updateQueue.push({data: updateObj, meta: updateMeta});
                }
            }
        }

        ctrl.nextObjectUpdateIdx = newLength;

        if(ctrl.firstLoad) {
            ctrl.firstLoad = false;
        }
    };

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
                        prevObjectState: {},
                        undoStack: []
                    };

                    for(var i = 0, len = pdf.numPages; i < len; i++) {
                        // Render page
                        (function(pn) {
                            var canvas = document.createElement('canvas');
                            pdf.getPage(pn + 1).then(function(page) {

                                // TODO fix pdf resolution
                                var viewport = page.getViewport(1500 / page.getViewport(1).width * 1);
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                                canvasctx = canvas.getContext("2d");
                                
                                page.render({canvasContext: canvasctx, viewport: viewport}).then(function() {
                                    ctrl.docs()[activitypage.pageNumber].page[pn] = canvas.toDataURL();
                                    m.redraw(true);
                                });
                            });
                        })(i);
                    }
                  });
              });
          });
      });
        ctrl.scrollPositions[args.user] = {};

        // Reports accelerometer data to the server
        // Note: doesn't seem to work on Surface 3 + Chrome.

        if(logOrientation) {
            if(window.DeviceOrientationEvent) {
                window.addEventListener("deviceorientation", function(ev) {
                        /*args.connection.transaction([["orientation"]], function(orientation) {
                            orientation[args.user] = {
                                abs: ev.absolute,
                                a: ev.alpha,
                                b: ev.beta,
                                g: ev.gamma
                            };
                        });*/
                        console.log(ev);
                    },
                    true
                );
            } else {
                console.warn("Device orientation logging not supported!");
            }
        }

      return ctrl;
    },
    view: function(ctrl, args) {
      var listener = function(e) {
      };
      return m("#main", {
          class: "errormodal-" + (errmsg ? "show" : "hide"),
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

        errmsg ? m.component(ErrorModal, {message: errmsg}) : "",
        
        m.component(PDFViewer, ctrl),
        m.component(Scrollbar, ctrl),
        m.component(Controls, ctrl)
      );

    }
  };

    var ErrorModal = {
        controller: function(args) {
            return {
                showDetails: m.prop(false)
            };
        },
        view: function(ctrl, args) {
            var widthClasses = ".col-xs-8.col-xs-offset-2.col-sm-8.col-sm-offset-2.col-md-6.col-md-offset-3";
            return m(".modal.fade#error-modal", {
                    config: function(el) {
                        $("#error-modal").modal({
                            backdrop: "static"
                        });
                        $("#error-modal").modal("show");
                    }
                },
                m(".modal-content" + widthClasses,
                    m(".modal-header",
                        m("h4.modal-title", 
                            "Oops"
                        )
                    ),
                    m(".modal-body",
                        m('p', 'The application encountered a problem. Please let Ian know before reloading.'),
                        
                        ctrl.showDetails()
                            ? m('p', 'Cause: ' + errmsg)
                            : m('a', {onclick: function() { ctrl.showDetails(true); }}, 'Details')
                    ),
                    m(".modal-footer",
                        m("button.btn.btn-danger.pull-right", {
                                onclick: location.reload.bind(location),
                            },
                            "Reload"
                        )
                    )
                )
            );
        }
    };

  var Controls = {
    view: function(__, args) {
        //console.log(args.myColor());
      return m("#controls", {
          style: "background-color: " + args.myColor()
        },
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
            
            args.userList().map(function(user) {
                if(args.pageNumbers()[user.id] == page.pageNumber)
                    usersHere.push(m("p.user-dot", {style: "color: " + getUserColor(args.userList(), user.id)}, m.trust("&#9679;")));
            });
            

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
                }, page.pageNumber),
                samepage ? "" : m("div.tiny-page-marker-div", usersHere)];
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

            m("p.tool-right.pull-right#options", {
                onmousedown: function() {
                    location.reload();
                }},
                "Reload"
            ),
            
            m("img.tool-right.pull-right#undo", {
                onmousedown: args.undo,
                //ontouchend: args.undo
                // Gray out the icon if we can't undo
                src: args.allowUndo()[args.pageNumbers()[args.user]]
                    ? "/shared/icons/Icons_F_Undo_W.png"
                    : "/shared/icons/Icons_F_Undo.png"
            }),

          
            m("img.tool-right.pull-right#pointer-tool", {
                onmousedown: function() {
                    args.setTool(3);
                },
                src: (args.tool() == 3) ? "/shared/icons/Icons_F_Pointer_W_Filled.png" : "/shared/icons/Icons_F_Pointer_W.png"
            }),


            m("img.tool-right.pull-right#eraser-tool", {
                onmousedown: function() {
                    args.setTool(2);
                },
                src: (args.tool() == 2) ? "/shared/icons/Icons_F_Erase_W_Filled.png" : "/shared/icons/Icons_F_Erase_W.png"
            }),
            m("img.tool-right.pull-right#pen-tool", {
                onmousedown: function() {
                    args.setTool(0);
                },
                src: (args.tool() == 0) ? "/shared/icons/Icons_F_Pen_W_Filled.png" : "/shared/icons/Icons_F_Pen_W.png"
            }),
          
          // Only show the objects menu if we're on the third page (the sketch page)
          (args.pageNumbers()[args.user] == 2) ? m.component(MechanicsObjectSelect, args) : ""
       
          /*
          m("h3.name-text.pull-right", {
              style: "color: " + getUserColor(args.userList(), args.user.id)
            },
            m.trust("&#9679;")
          ),*/

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
                50,
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
          style: "color: white; padding-right: 10px;",
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
        
        m("p",
            m("button.btn.btn-info.mech-obj-button#addRod", {
                onclick: function() {
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            type: "Rod",
                            left: ctrl.left,  
                            top: ctrl.top, 
                            width: 2 * ctrl.arrowLength,
                            height: 20,
				            originX:'center', 
                            originY: 'center',
                            padding: 5 
                        },
                        ctrl.canvas, true, true
                    );
                }
           }, "Add rod")
        ),
            
        // TODO get icons!
        m("p",
            m("button.btn.btn-info.mech-obj-button#addArrow", {
                onclick: function() {
                    var angle = 0;
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            type: "Arrow",
                            left: ctrl.left,  
                            top: ctrl.top, 
                            width: 2 * ctrl.arrowLength,
                            angle: angle, 
                            //name: letters,
                            stroke: 'green',
                            strokeWidth: 2.5, 
				            originX:'left', 
                            originY: 'center',
                            padding: 5 
                        },
                        ctrl.canvas, true, true
                    );
                }
           }, "Add concentrated force arrow")
        ),


        m("strong", "FBD Distributed Load"),
        m("p", ["DUU", "DUD"].map(function(letters) {
            return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                onclick: function() {
                    var angles = {DUU: -90, DUD: 90};
                    //var angles = {DUU: 0, DUD: 180};
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            type: "DistUnifLoad",
                            left: ctrl.left, 
                            top: ctrl.top,
                            arrowAngle: angles[letters],
                            range: ctrl.distURange, 
                            thickness: ctrl.arrowLength,  
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
        
        // Line and curve objects sometimes shouldn't be available
        showVMLines ? m("strong", "V and M lines") : "",
        showVMLines ? m("p",
           m("button.btn.btn-info.mech-obj-button#addControlledLine", {
                onclick: function() {
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            type: "ControlledLine",
                            x1: ctrl.left,
                            y1: ctrl.top,
                            x2: ctrl.left + 50,
                            y2: ctrl.top + 50,
                            handleRadius: ctrl.handleRadius,
                            strokeWidth: ctrl.strokeWidth,
                        },
                        ctrl.canvas, true, true
                    ); 
                }    
           }, "Add Controlled Line (new)"),
           m("button.btn.btn-info.mech-obj-button#addQuadratic", {
                onclick: function() {
                    ctrl.recalcOffset();
                    args.addObject(
                        {
                            x1: ctrl.left,
                            y1: ctrl.top,
                            x2: ctrl.left + 50,
                            y2: ctrl.top + 50,
                            x3: ctrl.left + 100,
                            y3: ctrl.top + 100,
                            handleRadius: ctrl.handleRadius,
                            strokeWidth: ctrl.strokeWidth,
                            name: "controlCurvedLine"
                        },
                        ctrl.canvas, true, true
                    ); 
                }    
           }, "Add Quadratic")
        ) : ""
        
        )
      );
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
                //console.log(e);
                
                  // TODO set own scroll position to match click point
                  var scrollDest = e.offsetY / ctrl.scrollbarHeight();
                  //console.log(scrollDest);
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
                          color: args.connection ?
                              args.connection.store ?
                                args.connection.store.userColors ?
                                    args.connection.store.userColors[user.id]
                                  : '#888888'
                                : '#888888'
                              : '#888888',
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
            cy: "" + (ctrl.radius + (args.scrollbarHeight() - 2 * ctrl.radius) * scrollPosition) + "px",
            r: "" + ctrl.radius + "px",
            fill: args.color, //getUserColor(args.userList(), args.user.id),
            stroke: "none"
        }, "");
    }
  };
    
    var PDFViewer = {
        controller: function(args) {
            return {
                interactable: null
            };
        },
        view: function(ctrl, args) {
            //return m("#pdf-container", drawPDF(ctrl, args, 1));
            return m("#pdf-container", 
                Array.apply(null, {length: args.numPages()[args.pageNumbers()[args.user]]}).map(function(__, i) {
                    return m.component(PDFPageHolder, {
                        pageNumbers: args.pageNumbers,
                        getCanvasId: args.getCanvasId,
                        startStrokeSimple: args.startStrokeSimple,
                        user: args.user,
                        pageNumbers: args.pageNumbers,
                        flushUpdateQueue: args.flushUpdateQueue,
                        docs: args.docs,
                        tool: args.tool,
                        addObserver: args.addObserver,

                        setPage: args.setPage,
                        lastDrawn: args.lastDrawn,
                        pageNum: i,
                        addObject: args.addObject,
                        modifyObject: args.modifyObject,
                        removeObject: args.removeObject,

                        connection: args.connection,
                        drawSelectionBox: args.drawSelectionBox,
                        //setSelectionBox: args.setSelectionBox
                    });
                })    
            );
        }
    };
  
    var PDFPageHolder = {
    controller: function(args) {
      var ctrl = {
        canvas: null,
        erasing: false,
        fingerScrolling: m.prop(false),
        setPen: function() {
            if(!ctrl.canvas || ctrl.canvas._isCurrentlyDrawing)
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
                    ctrl.canvas.selectionColor = 'rgba(255, 0, 0, 0.3)';

                } else if(toolId == 3) {
                    // pointer tool
                    ctrl.canvas.selection = true;
                    ctrl.canvas.isDrawingMode = false;
                    ctrl.canvas.selectionColor = 'rgba(100, 100, 255, 0.3)';
                }

        },

        deleteSelected: function() {
            if(!ctrl.canvas)
                return;

            var activeObject = ctrl.canvas.getActiveObject(),
                activeGroup = ctrl.canvas.getActiveGroup();


            if(activeObject) {
                args.removeObject(activeObject, ctrl.canvas, true, true);
            }

            if(activeGroup) {
                var objects = activeGroup.getObjects();
                ctrl.canvas.discardActiveGroup();
                var groupID = uuidv1();
                objects.forEach(function(obj) {
                    obj.groupID = groupID;
                    args.removeObject(obj, ctrl.canvas, true, true);
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
                config: function(el, isInit) {
                    if(isInit)
                        return;

                    // We capture these touch events so that drawing mode can be turned off while 
                    // the user is finger-scrolling.
                    el.addEventListener(
                        "touchstart",
                        function() {
                            if(ctrl.canvas)
                                ctrl.canvas.isDrawingMode = false;
                        },
                        true
                    );
                    el.addEventListener(
                        "touchend",
                        function() {
                            if(ctrl.canvas) {
                                //ctrl.canvas.isDrawingMode = (args.tool() == 1);
                                ctrl.setTool();
                            }
                        },
                        true
                    );
                    
                }
            },
            m("canvas.drawing-surface", {
                config: function(el, isInit) {
                    if(ctrl.canvas)
                        ctrl.canvas.undoStack = doc.undoStack;
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

                    ctrl.canvas.pushUndo = function(undoObj) {
                        if(ctrl.canvas.undoStack) {
                            if(undoObj.toObject)
                                undoObj = undoObj.toObject(['uuid', 'groupID']);
                            undoObj.page = args.pageNum;
                            ctrl.canvas.undoStack.push(undoObj);
                        }
                    };
                    ctrl.canvas.prevObjectState = doc.prevObjectState;

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
                        for(var i = 0, len = contents.length; i < len; i++)
                            args.addObject(contents[i], ctrl.canvas, true, false);
                    }
                    
                    args.flushUpdateQueue(args.pageNumbers()[args.user]);

                    /*
                    // Draw any selections
                    if(args.connection && args.connection.store)
                        for(var userId in args.connection.store.selectionBox)
                            args.drawSelectionBox(args.connection.store.selectionBox[userId], userId, ctrl.canvas);
                    */

                    // Use the right tool
                    ctrl.setTool();

                    // Set up event handlers
                    ctrl.canvas.on({
                        "object:modified": function(e) {
                            if(e.target.excludeFromExport)
                                e.target = e.target.target;
                                    
                            if(e.target.type == "circle") {
                                return;
                            }

                            if(e.target.type == "group") {
                                console.log(e.target);
                                var groupID = uuidv1();
                                var objects = e.target.getObjects();
                                for(var i = 0, len = objects.length; i < len; i++) {
                                    objects[i].groupID = groupID;
                                    ctrl.canvas.trigger("object:modified", {target: objects[i]});
                                }
                            //} else if(e.target.type == "path") {
                            //    args.modifyObject(e.target, ctrl.canvas, false, true, "modifyObject");
                            } else {
                                args.modifyObject(e.target, ctrl.canvas, false, true, "modifyObject");
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
                        }

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
