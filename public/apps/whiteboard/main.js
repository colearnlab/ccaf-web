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
        logAcceleration = true;


    // Virtual pixel dimensions of PDF pages
    var virtualPageWidth = 2000,
        virtualPageHeight = virtualPageWidth * 11.0 / 8.5;

    // Limits on object scaling
    var minScale = 0.25,
        maxScale = 3.0;
    var minScaleX = minScale,
        minScaleY = minScale,
        maxScaleX = maxScale,
        maxScaleY = maxScale;

   var toolNames = [
       'pen',
       'highlighter',
       'eraser',
       'finger',
       'shapes'
   ];

   var penColors = [
       '#000000', // black
       '#ff0000', // red
       '#00ff00', // green
       '#0000ff', // blue
       '#ffff00', // yellow
       '#ff00ff', // purple
       '#00ffff' // teal
   ];

   var errmsg = null, errobj = null;
   var errorPrompt = function(msg, obj) {
        errmsg = msg;
        errobj = obj;
        m.redraw(true);
   };
                
   var makeRGBA = function(hexstring, alpha) {
        var hexR = hexstring.slice(1,3),
            hexG = hexstring.slice(3,5),
            hexB = hexstring.slice(5,7);
        return 'rgba(' + parseInt(hexR, 16) + ', '
                + parseInt(hexG, 16) + ', '
                + parseInt(hexB, 16) + ', '
                + alpha + ')';
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
        group: params.group,
        groupTitle: params.groupObject.title
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
        userColor: function(userId) {
            return (args.connection ?
                args.connection.store ?
                  args.connection.store.userColors ?
                      args.connection.store.userColors[userId]
                    : '#888888'
                  : '#888888'
                : '#888888');
        },
        allowUndo: m.prop({}),
        lastToModify: {},
        numPages: m.prop([]),
        scrollPositions: {},
        scroll: m.prop("open"),
        scrollDragging: m.prop(false),

        title: m.prop(args.groupTitle),

        // stores index of current document for each user
        pageNumbers: m.prop({}),

        connection: args.connection,
        addObserver: args.connection.addObserver.bind(args.connection),

        tool: m.prop(0),
        penColorIdx: m.prop(0),
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

        flushUpdateQueue: function(pageNum, canvNum) {    
            var canvases = ctrl.docs()[pageNum].canvas,
                queue = ctrl.updateQueue;

            
            //console.log(canvases);
            for(var i = 0; i < queue.length; i++) {
                var update = queue[i];
                if(update) {
                    // If the update belongs on the current document, apply
                    // and delete the entry in the queue
                    if(update.meta.doc == pageNum) {
                        if(((typeof canvNum) == "undefined") || (update.meta.page == canvNum)) {
                            //console.log(update.meta.page);
                            ctrl.applyUpdate(update.data, canvases[update.meta.page]);
                            delete queue[i];
                            i--;
                        }
                    }
                }
            }
        },

        // for recording which document each user is looking at
        setPage: function(pageNum) {
            //ctrl.flushUpdateQueue(pageNum);

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

        setPenColor: function(penColorIdx) {
            args.connection.transaction([["penColor", args.user]], function(color) {
                color.color = penColors[ctrl.penColorIdx(penColorIdx)];
            });
        },

        setColor: function(color) {
            args.connection.transaction([["userColors"]], function(colors) {
                colors[ctrl.user] = color;
                //console.log("set color " + color);
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
                    //console.log(undoEvent);
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


          setSelectionBox: function(groupObj, doc, page) {
              // Send an update about the area we're selecting
              args.connection.transaction([["selectionBox", args.user]], function(selectionBox) {
                  if(groupObj) {
                      selectionBox.visible = true;

                      // the box
                      selectionBox.left = groupObj.left;
                      selectionBox.top = groupObj.top;
                      selectionBox.width = groupObj.width;
                      selectionBox.height = groupObj.height;

                      // the contents
                      selectionBox.contents = [];
                      if(groupObj.objects) {
                          for(var i = 0, len = groupObj.objects.length; i < len; i++) {
                            selectionBox.contents.push(groupObj.objects[i].uuid);
                          }
                      } else {
                          selectionBox.contents.push(groupObj.uuid);
                      }

                      // the page
                      selectionBox.doc = doc;
                      selectionBox.page = page;
                  } else {
                      selectionBox.visible = false;
                  }
              });
          },

          serializeObject: function(obj) {
              if(!obj.toObject)
                  return obj;

              var frozen = obj.toObject(['uuid']);
              
              // If the object is in a group, save correct scaling and rotation
              if(obj.group) {
                  // Taken from Group:_setObjectPosition
                  var group = obj.group;
                  var center = group.getCenterPoint(),
                      rotated = group._getRotatedLeftTop(obj);

                  Object.assign(frozen, {
                      angle: obj.getAngle() + group.getAngle(),
                      left: center.x + rotated.left,
                      top: center.y + rotated.top,
                      scaleX: obj.get('scaleX') * group.get('scaleX'),
                      scaleY: obj.get('scaleY') * group.get('scaleY')
                  });
              }

              if(!frozen.uuid)
                  frozen.uuid = obj.uuid;

              return frozen;
          },

          doObjectTransaction: function(obj, canvas, transactionType) {
              if(!obj.uuid) {
                  console.warn("Missing uuid for transaction");
                  console.log(obj);
                  return;
              };

            args.connection.transaction([["objects", obj.uuid], ["latestObjects", "+"]], function(objects, latestObjects) {
                ctrl.curId[obj.uuid] = objects._id || 0;
                
                latestObjects[0] = obj.uuid;

                obj = ctrl.serializeObject(obj);

                // Damn son that was easy!
                objects.data = JSON.stringify(obj);
                objects.meta = ctrl.makeTransactionMetadata(transactionType, {
                    page: canvas.page,
                    doc: canvas.doc,
                    uuid: obj.uuid,
                    _id: ctrl.curId[obj.uuid]
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
                canvas.prevObjectState[obj.uuid] = ctrl.serializeObject(obj);
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
                          canvasObj.setCoords();
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
          }

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

      // Watch for selection changes
      args.connection.addObserver(function(store) {
        if(store.selectionBox) {
            var selectionBox = store.selectionBox;
            for(var userId in selectionBox) {
                var box = selectionBox[userId];
                if(ctrl.pageNumbers()[args.user] == box.doc && ctrl.docs()[box.doc]) {
                    var canvas = ctrl.docs()[box.doc].canvas[box.page];
                    if(canvas)
                        canvas.setSelectionBox(userId, box);
                }
            }
        }
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

    // Get dimensions for rendering PDF. We don't re-render the PDF when the size 
    // changes since it's expensive.
    var pdfWidth = document.body.clientWidth,
        pdfHeight = pdfWidth * 11.0 / 8.5;

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
                                var viewport = page.getViewport(pdfWidth / page.getViewport(1).width * 1);
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

        if(logAcceleration) {
            if(window.DeviceMotionEvent) {
                var accelcount = 0,
                    prevData = {};
                window.addEventListener("devicemotion", function(ev) {
                        var data = {
                            x: ev.accelerationIncludingGravity.x,
                            y: ev.accelerationIncludingGravity.y,
                            z: ev.accelerationIncludingGravity.z,
                            a: ev.rotationRate.alpha,
                            b: ev.rotationRate.beta,
                            g: ev.rotationRate.gamma
                        };

                        var absChange = {
                            x: (data.x - prevData.x < 0) ? (prevData.x - data.x) : (data.x - prevData.x),
                            y: (data.y - prevData.y < 0) ? (prevData.y - data.y) : (data.y - prevData.y),
                            z: (data.z - prevData.z < 0) ? (prevData.z - data.z) : (data.z - prevData.z),
                            a: (data.a - prevData.a < 0) ? (prevData.a - data.a) : (data.a - prevData.a),
                            b: (data.b - prevData.b < 0) ? (prevData.b - data.b) : (data.b - prevData.b),
                            g: (data.g - prevData.g < 0) ? (prevData.g - data.g) : (data.g - prevData.g)
                        };

                        // Only write to the log if the reading has changed significantly
                        if(absChange.x > 0
                                || absChange.y > 0
                                || absChange.z > 0
                                || absChange.a > 1 // threshold is one degree
                                || absChange.b > 1
                                || absChange.g > 1
                          ) {
                            args.connection.logOnly("accel." + args.user, data);
                            //console.log(++accelcount);
                        }
                            
                        prevData = data;
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

      var calcScroll = function(pageY) {
        var scrollbarElement = $('#scrollbar');
        var scrollDest = (pageY - scrollbarElement.offset().top) / scrollbarElement.height();
        if(scrollDest < 0)
            scrollDest = 0;
        else if(scrollDest > 1)
            scrollDest = 1;

        ctrl.setScroll(scrollDest);
      };
      return m("#main", {
          class: "errormodal-" + (errmsg ? "show" : "hide"),
          config: function(el) {
            ctrl.fireScrollEvent = false;
            el.scrollTop = parseInt(ctrl.getScroll(args.user, ctrl.pageNumbers()[args.user]) * (el.scrollHeight - window.innerHeight));
          
            document.addEventListener("mouseout", function(e) {
                if(!e.toElement && !e.relatedTarget)
                    if(ctrl.scrollDragging())
                        ctrl.scrollDragging(false);
            });
          },
          onscroll: function(e) {
            var el = e.target;
            if (!ctrl.fireScrollEvent) {
              ctrl.fireScrollEvent = true;
              m.redraw.strategy("none");
              return false;
            }
            ctrl.setScroll(el.scrollTop / (el.scrollHeight - window.innerHeight));
          },
          onmousemove: function(e) {
            if(ctrl.scrollDragging())
                calcScroll(e.clientY);
          },
          onmouseup: function(e) {
            if(ctrl.scrollDragging()) {
                ctrl.scrollDragging(false);
                calcScroll(e.clientY);
            }
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
      var changePage = function(doc, newDoc) {
          args.saveCanvases(doc);   // Save contents of all canvases
          $('.canvas-container').remove();  // Remove canvases from DOM
          args.lastDrawn({});   // Signal that we need to change PDFs
          args.pageNumbers()[args.user] = newDoc; // Set the local page number
          m.redraw();   // Rebuild canvases
          args.setPage(newDoc); // Notify group of page change
      };

      return m("#controls", {
          style: "background-color: " + args.myColor()
        },
        // Previous page button
        m("img.tool-icon", {
            onclick: function() {
                var doc = args.pageNumbers()[args.user];
                if(doc > 0)
                    changePage(doc, doc - 1);
            },
            draggable: false,
            src: "/shared/icons/Icons_F_Left_W.png"
        }, "Prev"),
        
        // Specific page buttons
        (args.activity() ? 
        args.activity().pages.map(function(page) {
            var usersHere = [];
            
            args.userList().map(function(user) {
                if(args.pageNumbers()[user.id] == page.pageNumber)
                    usersHere.push(m("p.user-dot", {style: "color: " + 
                          (args.connection ?
                              args.connection.store ?
                                args.connection.store.userColors ?
                                    args.connection.store.userColors[user.id]
                                  : '#888888'
                                : '#888888'
                              : '#888888')
                        }, m.trust("&#9679;")));
            });
            
            var samepage = (page.pageNumber == args.pageNumbers()[args.user]);
            return [m("img.tool-icon", {
                    onclick: function() {
                        if(args.pageNumbers()[args.user] != page.pageNumber)
                            changePage(args.pageNumbers()[args.user], page.pageNumber);
                    },
                    draggable: false,
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
                if(doc < (args.activity().pages.length - 1))
                    changePage(doc, doc + 1);
            },
            draggable: false,
            src: "/shared/icons/Icons_F_Right_W.png"
        }, "Next"),

        /*
          m("span", {
              style: "position: absolute; left: 45vw; color: white; font-size: large"
              }, 
              m.trust(args.title())
          ),
          */

            m.component(OptionsTray, args),
            
            m("img.tool-right.pull-right#undo", {
                onmousedown: args.undo,
                draggable: false,
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
                draggable: false,
                src: (args.tool() == 3) ? "/shared/icons/Icons_F_Pointer_W_Filled.png" : "/shared/icons/Icons_F_Pointer_W.png"
            }),


            m("img.tool-right.pull-right#eraser-tool", {
                onmousedown: function() {
                    args.setTool(2);
                },
                draggable: false,
                src: (args.tool() == 2) ? "/shared/icons/Icons_F_Erase_W_Filled.png" : "/shared/icons/Icons_F_Erase_W.png"
            }),
            
            // Draw a circle to indicate pen color
            m("p.tool-right.pull-right#pen-color-indicator", {
                    style: "color: " + penColors[args.penColorIdx()]
                },
                m.trust("&#9679;")
             ),
            
            m("img.tool-right.pull-right#pen-tool", {
                onclick: function() {
                    // If we're already using the pen tool, change the color
                    if(args.tool() == 0) {
                        args.setPenColor((args.penColorIdx() + 1) % penColors.length);
                    }
                    args.setTool(0);
                },
                draggable: false,
                src: (args.tool() == 0) ? "/shared/icons/Icons_F_Pen_W_Filled.png" : "/shared/icons/Icons_F_Pen_W.png"
            }),

          
          // Only show the objects menu if we're on a sketch page
          (args.activity() ? 
            (args.activity().pages[args.pageNumbers()[args.user]].metadata.hasFBD) ? 
                m.component(MechanicsObjectSelect, args) 
            : ""
          : "")
       
          /*
          m("h3.name-text.pull-right", {
              style: "color: " + getUserColor(args.userList(), args.user.id)
            },
            m.trust("&#9679;")
          ),*/

      );
    }
  };

  var OptionsTray = {
    controller: function(args) {
        return {
            open: m.prop(false)
        };
    },
    view: function(ctrl, args) {
        return m("div.tool-button.tool-right.pull-right", {
                style: "color: white; padding-right: 10px;",
                onclick: m.redraw
            },
            m("img", {
                    width: 32,
                    height: 32,
                    src: "/shared/icons/Icons_F_Dropdown_W.png",
                    draggable: false,
                    onmousedown: function(e) {
                        ctrl.open(!ctrl.open());
                    },
                    ontouchend: function() {
                        ctrl.open(!ctrl.open());
                    },
                }
            ),
            m("div#options-tray", {
                    style: "left: -5vw; width: 10vw; text-align: center", 
                    class: ctrl.open() ? "tray-open" : "tray-closed"
                },

                // Tray contents here!
                m("button.btn.btn-info.mech-obj-button", {
                        onclick: function() {
                            location.reload();
                        }
                    },
                    "Reload"
                )
            )
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

                // Randomly move a bit so that new objects aren't drawn exactly over each other
                var nudge = Math.random() * 100 - 50;
                ctrl.left += nudge;
                ctrl.top += nudge;
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
        },
        "Tools"
        ),
        m("div#mech-objs-tray", {
            style: "width: 25vw; left: -5vw",
          class: ctrl.open() ? "tray-open" : "tray-closed",
          onclick: function() {
              args.tool(3); // Use finger tool after adding object
          }
        },

        m("strong.mechitem", "Rod"),
        m("p.mechitem",
            m("button.btn.btn-info.mech-obj-button#addRod", {
                    title: "Add rod",
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
                }, 
                m("img", {
                    src: "/shared/icons/Rod.png",
                })
            )
        ),
            
        m("strong", "Concentrated Force"),
        m("p",
            m("button.btn.btn-info.mech-obj-button#addArrow", {
                    title: "Add concentrated force arrow",
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
                }, 
                m("img", {
                    src: "/shared/icons/FR.png"
                })
            )
        ),


        m("strong", "Distributed Load"),
        m("p", 
            ["DUU", "DUD"].map(function(letters) {
                    return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                            title: "Add uniform distributed load arrows",
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
                        }, 
                        m("img", {
                            src: "/shared/icons/" + letters + ".png"
                        })
                    );
                }
            )
        ),
        m("p", 
            ["DTUA", "DTDA", "DTUD", "DTDD"].map(function(letters) {
                    return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                            title: "Add triangular distributed load arrows",
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
                        }, 
                        m("img", {
                            src: "/shared/icons/" + letters + ".png"
                        })
                    );
                }
            )
        ),
        
        m("strong", "Moment"),
        m("p", 
            ["MC", "MCC"].map(function(letters) {
                    return m("button.btn.btn-info.mech-obj-button#add" + letters, {
                            title: "Add moment",
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
                        }, 
                        m("img", {
                            src: "/shared/icons/" + letters + ".png"
                        })
                    );
            })
        ),
        
        // Line and curve objects sometimes shouldn't be available
        showVMLines ? m("strong", "V and M Lines") : "",
        showVMLines ? m("p",
            m("button.btn.btn-info.mech-obj-button#addControlledLine", {
                    title: "Add line",
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
                }, 
                m("img", {
                    src: "/shared/icons/ControlledLine.png"
                })
            ),
            m("button.btn.btn-info.mech-obj-button#addQuadratic", {
                    title: "Add curve",
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
                }, 
                m("img", {
                    src: "/shared/icons/CurvedControlledLine.png"
                })
            )
        ) : ""
        
        )
      );
    }
  };

  var Scrollbar = {
      controller: function(args) {
          var ctrl = {
              scrollbarHeight: m.prop(null),
              dragging: m.prop(false),
              setScroll: function(e) {
                  var scrollDest = e.offsetY / ctrl.scrollbarHeight();
                  args.setScroll(scrollDest);
              }
          };

          return ctrl;
      },
      view: function(ctrl, args) {
          return m("svg.scrollbar#scrollbar", {
                  config: function(el) {
                      ctrl.scrollbarHeight(el.clientHeight);
                  },
                  onmousedown: function(e) {
                      args.scrollDragging(true);
                      ctrl.setScroll(e);
                  },
                  /*onmousemove: function(e) {
                      if(ctrl.dragging())
                          ctrl.setScroll(e);
                  },
                  onmouseup: function(e) {
                      ctrl.dragging(false);
                      ctrl.setScroll(e);
                  }*/
              },
              args.userList().map(function(user) {
                  // Draw circle on scroll bar if the user is on our page.
                  if(args.pageNumbers()[user.id] == args.pageNumbers()[args.user]) {
                      return m.component(ScrollbarCircle, {
                          scrollPositions: args.scrollPositions,
                          setScroll: args.setScroll,
                          getScroll: args.getScroll,
                          user: user,
                          dragging: ctrl.dragging,
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
                        penColorIdx: args.penColorIdx,
                        addObserver: args.addObserver,

                        setPage: args.setPage,
                        lastDrawn: args.lastDrawn,
                        pageNum: i,
                        addObject: args.addObject,
                        modifyObject: args.modifyObject,
                        removeObject: args.removeObject,

                        connection: args.connection,
                        drawSelectionBox: args.drawSelectionBox,
                        setSelectionBox: args.setSelectionBox,

                        userColor: args.userColor
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
        selecting: false,
        setPen: function() {
            if(!ctrl.canvas || ctrl.canvas._isCurrentlyDrawing)
                return;

            ctrl.canvas.isDrawingMode = true;
            ctrl.canvas.freeDrawingBrush = new fabric.PencilBrush(ctrl.canvas);
            ctrl.canvas.freeDrawingBrush.opacity = 1.0;
            ctrl.canvas.freeDrawingBrush.color = penColors[args.penColorIdx()];
            
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
        },

        setSelectionBox: function(userId, box) {
            if(userId != args.user) {
                var rect = ctrl.canvas.selectionBoxes[userId];
                if(rect) {
                    rect.set(box);
                } else {
                    var boxOptions = Object.assign(box, {
                        fill: makeRGBA(args.userColor(userId), 0.3),
                        selectable: false,
                        excludeFromExport: true
                    });
                    var newRect = new fabric.Rect(boxOptions);
                    ctrl.canvas.add(newRect);
                    ctrl.canvas.selectionBoxes[userId] = newRect;
                }

                // Prevent selecting an object someone else is selecting
                //console.log(box);
                for(var i = 0, len = box.contents.length; i < len; i++) {
                    var canvasObj = ctrl.canvas.objsByUUID[box.contents[i]];
                    if(canvasObj)
                        canvasObj.selectable = !(box.visible);
                }

                ctrl.canvas.renderAll();
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
                    args.docs()[currentDocument].canvas[args.pageNum] = ctrl.canvas;
                    //console.log("made canvas" + args.pageNum);

                    ctrl.canvas.pushUndo = function(undoObj) {
                        if(ctrl.canvas.undoStack) {
                            if(undoObj.toObject)
                                undoObj = undoObj.toObject(['uuid', 'groupID']);
                            undoObj.page = args.pageNum;
                            ctrl.canvas.undoStack.push(undoObj);
                        }
                    };
                    ctrl.canvas.prevObjectState = doc.prevObjectState;

                    // Use the same coordinate system as all other users but scale to 
                    // the size of the page.
                    ctrl.canvas.setWidth(virtualPageWidth);
                    ctrl.canvas.setHeight(virtualPageHeight);
                    ctrl.canvas.setDimensions({
                            width: "100%",
                            height: "100%"
                        }, {
                            cssOnly: true
                        }
                    );

                    // Load canvas data if any
                    ctrl.canvas.objsByUUID = {};
                    var contents = docs[currentDocument].canvasContents[args.pageNum];
                    if(contents) {
                        for(var i = 0, len = contents.length; i < len; i++)
                            args.addObject(contents[i], ctrl.canvas, true, false);
                    }

                    args.flushUpdateQueue(args.pageNumbers()[args.user], args.pageNum);
                    
                    // Set selections
                    ctrl.canvas.selectionBoxes = {};
                    ctrl.canvas.setSelectionBox = ctrl.setSelectionBox;
                    if(args.connection && args.connection.store) {
                        for(var userId in args.connection.store.selectionBox) {
                            var box = args.connection.store.selectionBox[userId];
                            if(box.doc == currentDocument && box.page == args.pageNum)
                                ctrl.setSelectionBox(userId, box);
                        }
                    }
                    

                    // Use the right tool
                    ctrl.setTool();

                    // Set up event handlers
                    ctrl.canvas.on({
                        /*
                        "mouse:down": function(e) {
                            if(!ctrl.canvas.isDrawingMode && !ctrl.selecting)
                                ctrl.selecting = true;
                        },
                        "mouse:move": function(e) {
                            if(ctrl.selecting) {
                                // set own selection box
                                var groupSelector = ctrl.canvas._groupSelector;
                                if(groupSelector) {
                                    var left = groupSelector.left,
                                        top = groupSelector.top;
                                
                                    args.setSelectionBox({
                                            selecting: true,
                                            left: groupSelector.ex - ((left > 0) ? 0 : -left),
                                            top: groupSelector.ey - ((top > 0) ? 0 : -top),
                                            width: (left < 0) ? -left : left, //abs(left),
                                            height: (top < 0) ? -top : top //abs(top);
                                        }, 
                                        currentDocument, 
                                        args.pageNum
                                    );

                                }
                            }
                        },
                        "mouse:up": function(e) {
                            if(!ctrl.canvas.isDrawingMode && ctrl.selecting) {
                                ctrl.selecting = false;
                                args.setSelectionBox(null, currentDocument, args.pageNum);
                            }
                        },

                        "mouse:dblclick": function(e) {
                            if(!ctrl.canvas.isDrawingMode)
                                args.setSelectionBox(null, currentDocument, args.pageNum);
                        },
                        */

                        // Enforce scaling limits
                        "object:scaling": function(e) {
                            var scaleX = e.target.scaleX,
                                scaleY = e.target.scaleY;
                            e.target.set({
                                scaleX: (scaleX < minScaleX) ? minScaleX
                                    : (scaleX > maxScaleX) ? maxScaleX
                                        : scaleX,
                                scaleY: (scaleY < minScaleY) ? minScaleY
                                    : (scaleY > maxScaleY) ? maxScaleY
                                        : scaleY
                            });
                        },

                        "object:modified": function(e) {
                            if(e.target.excludeFromExport)
                                e.target = e.target.target;
                                    
                            if(e.target.type == "circle") {
                                return;
                            }

                            if(e.target.type == "group") {
                                //console.log(e.target);
                                var groupID = uuidv1();
                                var objects = e.target.getObjects();

                                for(var i = 0, len = objects.length; i < len; i++) {
                                    objects[i].groupID = groupID;
                                    ctrl.canvas.trigger("object:modified", {target: objects[i], skipSelection: true});
                                }
                            //} else if(e.target.type == "path") {
                            //    args.modifyObject(e.target, ctrl.canvas, false, true, "modifyObject");
                            } else {
                                args.modifyObject(e.target, ctrl.canvas, false, true, "modifyObject");
                            }

                            // Update selection box if we haven't already
                            if(!e.skipSelection)
                                args.setSelectionBox(e.target.getBoundingRect(), currentDocument, args.pageNum);

                        },
                        "path:created": function(e) {
                            args.addObject(e.path, ctrl.canvas, false, true, "addFreeDrawing");
                        },

                        "selection:cleared": function(e) {
                            args.setSelectionBox(null, currentDocument, args.pageNum);
                        },

                        // erasing
                        "object:selected": function(e) {
                            if(ctrl.erasing) {
                                ctrl.deleteSelected();
                            } else {
                                var obj = e.target;
                                args.setSelectionBox({
                                        left: obj.left - (obj.width / 2),
                                        top: obj.top - (obj.height / 2),
                                        angle: obj.angle,
                                        width: obj.width,
                                        height: obj.height,
                                        uuid: obj.uuid
                                    },
                                    currentDocument, 
                                    args.pageNum
                                );
                                
                                e.target.on('mousedown', function(e) {
                                    if(ctrl.erasing)
                                        ctrl.deleteSelected();
                                });
                            }
                        },
                        "selection:created": function(e) {
                            //console.log(e);
                            //e.target.hasControls = false;
                            if(ctrl.erasing) {
                                ctrl.deleteSelected();
                            } else {

                                args.setSelectionBox({
                                        left: e.target.left,
                                        top: e.target.top,
                                        width: e.target.width,
                                        height: e.target.height,
                                        angle: e.target.angle,
                                        objects: e.target.getObjects()
                                    },
                                    currentDocument, 
                                    args.pageNum
                                );

                                e.target.on('mousedown', function(e) {
                                    if(ctrl.erasing)
                                        ctrl.deleteSelected();
                                });
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
