define(['clientUtil', 'exports', 'mithril', 'fileManager'], function(clientUtil, exports, m, fileManager) {
  var canvasHeight = 3000, canvasWidth = 1200;
  var canvas;
  var colors = ['#C72026', '#772787', '#20448E', '#499928', '#000000'];
  exports.load = function(el, action, store, params) {

    var deviceState, ctx, pen = {'strokeStyle': colors[0], 'lineWidth': 3};
    var pdfContainer;
    var hCanvas, hCtx;
    var curPath = {}, lastPath = [];
    var cursor;

    var frame = null;
    var drawPaths = function() {
      if (frame == null)
        return frame = setTimeout(function() { requestAnimationFrame(drawPaths); }, 50);

      var path;
      oldPaths = oldPaths || [];
      if (newPaths.filter(Boolean).length < oldPaths.filter(Boolean).length || newPaths.some(function(newPath, i) { return oldPaths[i] && oldPaths[i].length > newPaths[i].length; })) {
        oldPaths = [];
        curPath = {};
        clearScreen();
      }

      newPaths.forEach(function(newPath, i) {
        // NOTE: currently there is a bug in playback due to the behavior of the
        // diff/patch system. For some reason, when a point is added it creates a patch
        // that is "modified undefined" instead of creating a new object. Thus, when
        // the patch is reversed, instead of clearing that entry in the array completely
        // it still exists but is set to null. The check for newPath[0] to actually
        // exist as well as filtering empty entries in the old array below (filter(Boolean))
        // are temporary fixes to this problem.
        if (!newPath || newPath.length === 0 || !newPath[0])
          return;

        var curCtx;

        if (newPath[0].highlight)
          curCtx = hCtx;
        else
          curCtx = ctx;

        curCtx.shadowColor = curCtx.strokeStyle = newPath[0].strokeStyle;
        curCtx.lineCap = curCtx.lineJoin = "round";


        path = newPath;

        var j = oldPaths[i] ? oldPaths[i].length : 1;
        for (; j < newPaths[i].length; j++) {
          if (!path[j])
            continue;

          curCtx.beginPath();
          var threeAgo, twoAgo, oneAgo, cur = path[j];
          if (path[j-1] && path[j - 1].x)
            oneAgo = {x:path[j-1].x, y:path[j-1].y};
          else
            oneAgo = {x: path[j].x-1, y:path[j].y};

          if (path[j-2] && path[j-2].x) {
            twoAgo = {x:path[j-2].x, y:path[j-2].y};
            if(Math.sqrt((twoAgo.x-oneAgo.x)*(twoAgo.x-oneAgo.x) + (twoAgo.y-oneAgo.y)*(twoAgo.y-oneAgo.y)) > 10) {
              twoAgo.x = (twoAgo.x + oneAgo.x)/2;
              twoAgo.y = (twoAgo.y + oneAgo.y)/2;
            }
          }

          if (path[j-3] && path[j-3].x) {
            threeAgo = {x:path[j-3].x, y:path[j-3].y};
            if(Math.sqrt((threeAgo.x-twoAgo.x)*(threeAgo.x-twoAgo.x) + (threeAgo.y-twoAgo.y)*(threeAgo.y-twoAgo.y)) > 5) {
              threeAgo.x = (threeAgo.x + twoAgo.x)/2;
              threeAgo.y = (threeAgo.y + twoAgo.y)/2;
            }
          }


          if (threeAgo)
            ctx.moveTo(threeAgo.x, threeAgo.y);
          else if (twoAgo)
            ctx.moveTo(twoAgo.x, twoAgo.y);
          else
            ctx.moveTo(oneAgo.x, oneAgo.y);

          //if (twoAgo)
          //  curCtx.lineWidth = 15/Math.sqrt((oneAgo.x - cur.x)*(oneAgo.x - cur.x) + (oneAgo.y - cur.y)*(oneAgo.y - cur.y)) * newPath[0].lineWidth;
          //else
            curCtx.lineWidth = newPath[0].lineWidth;

          if (curCtx.lineWidth < newPath[0].lineWidth - 1)
            curCtx.lineWidth = newPath[0].lineWidth - 1;

          if (curCtx.lineWidth > newPath[0].lineWidth + 3)
            curCtx.lineWidth = newPath[0].lineWidth + 3;

          if (threeAgo)
            curCtx.bezierCurveTo(twoAgo.x, twoAgo.y, oneAgo.x, oneAgo.y, cur.x, cur.y);
          if (twoAgo)
            curCtx.quadraticCurveTo(oneAgo.x, oneAgo.y, cur.x, cur.y);
          else
            curCtx.lineTo(cur.x, cur.y);

          curCtx.closePath();
          curCtx.stroke();
        }
      });
      notDrawn = false;
      frame = null;
    }

    createActions();
    initElements();
    initListeners();
    resizeCanvas();
    clearScreen();

    var newPaths, oldPaths, _oldPaths, notDrawn = false;
    var pathObserver = function(_newPaths) {
      newPaths = _newPaths;
      if (!notDrawn) {
        oldPaths = _oldPaths;
        notDrawn = true;
        drawPaths();
      }

      _oldPaths = [];
      for (var i = 0; i < _newPaths.length; i++) {
        if (newPaths[i])
          _oldPaths[i] = {'length': _newPaths[i].length};
      }

    };

    pathObserver.noOld = true;
    deviceState.paths.addObserver(pathObserver);

    deviceState.cursors.addObserver(function(cursors, oldCursors) {
      canvas.canvasTop = (canvasHeight - cursors[params.mode === 'student' ? params.student : -1]) * window.innerWidth/canvasWidth;
      document.getElementById('pointers').style.transform = pdfContainer.style.transform = hCanvas.style.transform = canvas.style.transform = 'translate(0px,-' + canvas.canvasTop + 'px)';

      if (_.isEqual(cursors, oldCursors))
        return;
      m.redraw(true);
    });

    deviceState.pointers.addObserver(function(pointers, oldPointers) {
      if (oldPointers === null)
        m.mount(document.getElementById('pointers'), m.component(Pointers, {pointers: pointers, cursor: cursor}));

      if (_.isEqual(pointers, oldPointers))
        return;
      m.render(document.getElementById('pointers'), m.component(Pointers, {'pointers': pointers, cursor: cursor}));
      m.redraw(true);
    });

    function initElements() {
      clientUtil.css('/apps/whiteboard/styles.css');

      pdfContainer = document.createElement('div');
      pdfContainer.id = 'pdf-container';
      el.appendChild(pdfContainer);

      canvas = document.createElement('canvas');
      el.appendChild(canvas);
      canvas.style.opacity = '0.9';

      hCanvas = document.createElement('canvas');
      hCanvas.style['pointer-events'] = 'none';
      hCanvas.style.opacity = '0.5';
      el.appendChild(hCanvas);

      var pointers = document.createElement('div');
      pointers.id = 'pointers';
      el.appendChild(pointers);

      if (params.mode === 'projector') {
        var pdfButton = document.createElement('input');
        pdfButton.type = "file";
        pdfButton.innerHTML = "Set PDF";
        pdfButton.id = "pdf-button";
        document.body.appendChild(pdfButton);

        pdfButton.addEventListener('change', function(e) {
          if (e.target.files.length > 0) {
            pdfButton.disabled = true;
            clearButton.disabled = true;
            var reader = new FileReader();
            reader.onload = function(evt) {
              var name = e.target.files[0].name.replace(/ /g, "+");
              fileManager.upload('/apps/whiteboard/media/' + name, Array.prototype.slice.call(new Uint8Array (evt.target.result)), function(err) {
                if (err)
                  return alert("File upload error.");

                pdfButton.disabled = false;
                clearButton.disabled = false;
                store.sendAction('set-pdf', '/apps/whiteboard/media/' + name);
                resizeCanvas();
              });
            };
            reader.readAsArrayBuffer(e.target.files[0]);
          }
        });

        var clearButton = document.createElement('button');
        clearButton.id = "clear-button";
        clearButton.innerHTML = "Clear PDF";
        document.body.appendChild(clearButton);
        clearButton.addEventListener('click', function() {
          store.sendAction('set-pdf', null);
          resizeCanvas();
        })
      }

      store.sendAction('wb-init');
      deviceState = store;

      var controls = document.createElement('div');
      m.mount(controls, m.component(Controls, {'pen': pen, 'deviceState': deviceState, 'canvas': canvas, 'cursor': params.mode === 'student' ? params.student : -1}));
      el.appendChild(controls);
    }

    var drawing = false;
    function resizeCanvas() {
      hCanvas.width = canvas.width = canvasWidth;
      hCanvas.height = canvas.height = canvasHeight * canvasWidth / window.innerWidth;
      hCanvas.style.height = canvas.style.height = canvasHeight + 'px';
      ctx = canvas.getContext('2d');
      ctx.translate(0.5, 0.5);
      hCtx = hCanvas.getContext('2d');
      hCtx.translate(0.5, 0.5);

      if (!drawing && !store.pdf) {
        while(pdfContainer.childNodes.length)
          pdfContainer.removeChild(pdfContainer.firstChild);
      }

      if (!drawing && store.pdf) {
        while(pdfContainer.childNodes.length)
          pdfContainer.removeChild(pdfContainer.firstChild);

        drawing = true;
        PDFJS.getDocument(store.pdf).then(function(pdf) {
          var pages = pdf.numPages;
          var container = document.getElementById('pdf-container');
          var curPage = 1;

          var processPage = function(page) {
            console.log(curPage);
            curPage++;
            var pdfCanvas = document.createElement('canvas');
            pdfCanvas.style = 'position: initial'
            pdfCanvas.width = hCanvas.width;

            var scale = 1.5;
            var viewport = page.getViewport(scale);

            pdfCanvas.height = viewport.height;

            var pdfCtx = pdfCanvas.getContext('2d');

            var renderContext = {
              'canvasContext': pdfCtx,
              'viewport': viewport
            };

            page.render(renderContext).then(function() {
              container.appendChild(pdfCanvas);
              if (curPage <= pages)
                pdf.getPage(curPage).then(processPage);
              else {
                drawing = false;
                curPage = 1;
                oldPaths = null;
                notDrawn = true;
                drawPaths();
              }

            });

          };

          pdf.getPage(curPage).then(processPage)
        });
      }
      oldPaths = null;
      notDrawn = true;
      drawPaths();
    }

    function createActions() {
      action('wb-init')
        .onReceive(function() {
          if (typeof this.paths === 'undefined')
            this.paths = [];
          if (typeof this.cursors === 'undefined')
            this.cursors = {};
          if (typeof this.pointers === 'undefined')
            this.pointers = {};

          cursor = params.mode === 'student' ? params.student : -1;

          if (typeof this.cursors[cursor] === 'undefined') {
            this.cursors[cursor] = canvasHeight;
          }
          canvas.canvasTop = (canvasHeight - this.cursors[cursor]);

          if (typeof this.pointers[cursor] === 'undefined') {
            this.pointers[cursor] = {x:-1, y:-1};
          }
        });

      action('set-pdf')
        .onReceive(function(a) {
          this.pdf = a;
        });

      action('clear-pdf')
        .onReceive(function() {
          this.pdf = undefined;
        });

      action('create-path')
        .onReceive(function(identifier) {
          if (typeof curPath[identifier] === 'undefined') {
            this.paths[this.paths.length] = [{'strokeStyle': pen.strokeStyle, 'lineWidth': pen.lineWidth, 'highlight': currentTool === tools.highlight}];
            lastPath.push(curPath[identifier] = this.paths.length - 1);
            return 'paths.' + curPath[identifier];
          } else if (curPath[identifier] >= 0) {
            return false;
          } else {
            curPath[identifier] *= -1;
            if (!this.paths[curPath[identifier]]) {
              this.paths[this.paths.length] = [{'strokeStyle': pen.strokeStyle, 'lineWidth': pen.lineWidth, 'highlight': currentTool === tools.highlight}];
              lastPath.push(curPath[identifier] = this.paths.length - 1);
            } else {
              this.paths[curPath[identifier]][0] = {'strokeStyle': pen.strokeStyle, 'lineWidth': pen.lineWidth, 'highlight': currentTool === tools.highlight};
              lastPath.push(curPath[identifier]);
              return 'paths.' + curPath[identifier] + '.0';
            }
            return 'paths.' + curPath[identifier];
          }
        }).onRevert(function(identifier) {
          console.log("reverted");
          lastPath = [];
          delete curPath[identifier];
        });

      action('add-point')
        .onReceive(function(identifier, x, y) {
          if (curPath[identifier] >= 0 && this.paths[curPath[identifier]] && !isNaN(parseInt(x)) && !isNaN(parseInt(y))) {
            this.paths[curPath[identifier]].push({'x': parseInt(x), 'y': parseInt(y) - 50});
            return 'paths.' + curPath[identifier] + '.' + (this.paths[curPath[identifier]].length - 1);
          }
          return false;
        });

      action('end-path')
        .onReceive(function(identifier) {
          if (curPath[identifier] >= 0) {
            this.paths[this.paths.length] = [];
            curPath[identifier] = -(this.paths.length - 1);

            return 'paths.' + (this.paths.length - 1);
          } else {
            return false;
          }
        })
        .onRevert(function(identifier) {
          console.log("reverted");
          delete curPath[identifier];
        });

      action('undo')
        .onReceive(function(path) {
          curPath = {};
          if (lastPath.length > 0)
            this.paths[lastPath.pop()] = null;
        });

      action('clear-screen')
        .onReceive(function() {
          curPath = {};
          lastPath = [];
          this.paths = [];
        });

      action('update-cursor')
        .onReceive(function(cursor, value) {
          this[cursor] = value;
        });

      action('update-pointer')
        .onReceive(function(x, y) {
          this.x = x;
          this.y = y + canvas.canvasTop;
        });
    }

    function initListeners() {
      canvas.addEventListener('mousedown', function(e) {
        deviceState.sendAction('create-path', 0);
        console.log(e)
        deviceState.sendAction('add-point', 0, e.offsetX * canvasWidth / window.innerWidth, (e.offsetY) * canvas.height / canvasHeight + 50);
      });

      canvas.addEventListener('mousemove', function(e) {
        deviceState.sendAction('add-point', 0, e.offsetX * canvasWidth / window.innerWidth, (e.offsetY) * canvas.height / canvasHeight + 50);
      });

      canvas.addEventListener('mouseup', function(e) {
        deviceState.sendAction('end-path', 0);
      });

      canvas.addEventListener('mouseleave', function(e) {
        deviceState.sendAction('end-path', 0);
      });

      canvas.addEventListener('touchstart', function(e) {
        var touch;
        for (var i = 0; i < e.changedTouches.length; i++) {
          touch = e.changedTouches[i];
          deviceState.sendAction('create-path', touch.identifier + 1);
          var rect = e.target.getBoundingClientRect();
          var offsetX = touch.pageX - rect.left;
          var offsetY = touch.pageY - rect.top;
          deviceState.sendAction('add-point', touch.identifier + 1, offsetX * canvasWidth / window.innerWidth, (offsetY) * canvas.height / canvasHeight + 50);
        }
      });

      canvas.addEventListener('touchmove', function(e) {
        var touch;
        for (var i = 0; i < e.changedTouches.length; i++) {
          touch = e.changedTouches[i];
          var rect = e.target.getBoundingClientRect();
          var offsetX = touch.pageX - rect.left;
          var offsetY = touch.pageY - rect.top;
          deviceState.sendAction('add-point', e.changedTouches[i].identifier + 1, offsetX * canvasWidth / window.innerWidth, (offsetY) * canvas.height / canvasHeight + 50);
        }
      });

      canvas.addEventListener('touchend', function(e) {
        for (var i = 0; i < e.changedTouches.length; i++)
          deviceState.sendAction('end-path', e.changedTouches[i].identifier + 1);
      });

      window.addEventListener('resize', function() {
        resizeCanvas();
      });
    }

    function clearScreen() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  var Controls = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      return m('div#controls',
        m.component(ColorSelect, args),
        m.component(LineSelect, args),
        m.component(ToolSelect, args),
        m('div.controlComponent', m.trust('&nbsp;')),
        m.component(UndoButton, args),
        m.component(ClearButton, args),
        m.component(Slider, args)
      );
    }
  };

  var saved;
  var ColorSelect = {
    'controller': function(args) {
      return {
        'trayOpen': false
      };
    },
    'view': function(ctrl, args) {
      return m('div.controlComponent', {
        'onclick': function(e) {
          ctrl.trayOpen = !ctrl.trayOpen;
        }
      },
        m.component(ColorIndicator, {'pen': args.pen, 'color': saved ? saved : args.pen.strokeStyle}),
        m('span.buttonLabel', "Color"),
        m('div.colorTray', {
          'style': 'display: ' + (ctrl.trayOpen ? 'block' : 'none')
        },
          m('div.spacer'),
          colors.map(function(color) {
            if (color !== args.pen.strokeStyle && color !== saved)
              return [
                m.component(ColorIndicator, {'pen': args.pen, 'color': color}),
                m('div.spacer')
              ];

            return [];
          })
        )
      );
    }
  };

  var ColorIndicator = {
    'view': function(ctrl, args) {
      return m('div.colorIndicator', {
        'style': 'background-color: ' + args.color,
        'onclick': function(e) {
          saved = undefined;
          args.pen.strokeStyle = args.color;
        }
      }, m.trust('&nbsp;'));
    }
  };

  var lines = [];
  for (var i = 1; i < 7; i++)
    lines.push(i*3);
  var LineSelect = {
    'controller': function(args) {
      return {
        'trayOpen': false
      };
    },
    'view': function(ctrl, args) {
      var margin = (20 - args.pen.lineWidth)/2;
      return m('div.controlComponent', {
        'onclick': function(e) {
          ctrl.trayOpen = !ctrl.trayOpen;
        }
      },
        m.component(LineIndicator, {color: 'white', pen: args.pen, width: args.pen.lineWidth, margin: 10.5 - (args.pen.lineWidth/2)}),
        m('div.buttonLabel', "Line"),
        m('div.lineTray', {
          'style': 'display: ' + (ctrl.trayOpen ? 'block' : 'none')
        },
          lines.map(function(line) {
            return [
              m.component(LineIndicator, {pen: args.pen, width: line, margin: 15})
            ];
          })
        )
      );
    }
  };

  var LineIndicator = {
    'view': function(ctrl, args) {
      var margin = args.margin || 0;
      return m('div.line', {
        'onclick': function(e) {
          args.pen.lineWidth = args.width;
        },
        'style': 'height: ' + args.width + 'px; margin-top: ' + margin + 'px; margin-bottom: ' + margin + 'px; background-color: ' + (args.color ? args.color : 'black')
      }, m.trust('&nbsp;'));
    }
  };

  var tools = {'pen':0, 'highlight':1, 'pointer':2, 'eraser':3};
  var currentTool = tools.pen;
  var ToolSelect = {
    'controller': function(args) {
      return {
        'trayOpen': false
      };
    },
    'view': function(ctrl, args) {
      var icon;
      var label;
      switch(currentTool) {
        case tools.pen:
          icon = 'apps/whiteboard/pen.png';
          label = "Pen";
          break;
        case tools.highlight:
          icon = 'apps/whiteboard/highlight.png';
          label = "Highlight";
          break;
        case tools.pointer:
          icon = 'apps/whiteboard/pointer.png';
          label = "Pointer";
          break;
        case tools.eraser:
          icon = 'apps/whiteboard/eraser.png';
          label = "Eraser";
          break;
      }
      return m('div.controlComponent', {
        'onclick': function(e) {
          ctrl.trayOpen = !ctrl.trayOpen;
        }
      },
        m('img.controlIcon', {'src': icon}),
        m('div.buttonLabel', label),
        m('div', {
          'style': 'display: ' + (ctrl.trayOpen ? 'block' : 'none')
        },
          m('div', {
            'onclick': function() {
              currentTool = tools.pen;
              if (saved) {
                args.pen.strokeStyle = saved;
                saved = void 0;
              }
              document.getElementById('pointers').style['pointer-events'] = 'none';
            }
          },
            m('img.icon-select', {'src': 'apps/whiteboard/pen.png'}),
            m('div.buttonLabel', {'style': 'color: black;'}, "Pen")
          ),
          m('div', {
            'onclick': function() {
              currentTool = tools.highlight;
              if (saved) {
                args.pen.strokeStyle = saved;
                saved = void 0;
              }
              document.getElementById('pointers').style['pointer-events'] = 'none';
            }
          },
            m('img.icon-select', {'src': 'apps/whiteboard/highlight.png'}),
            m('div.buttonLabel', {'style': 'color: black;'}, "Highlight")
          ),
          m('div', {
            'onclick': function() {
              currentTool = tools.pointer;
              document.getElementById('pointers').style['pointer-events'] = 'all';
            }
          },
            m('img.icon-select', {'src': 'apps/whiteboard/pointer.png'}),
            m('div.buttonLabel', {'style': 'color: black;'}, "Pointer")
          ),
          m('div', {
            'onclick': function(e) {
              currentTool = tools.eraser;
              saved = args.pen.strokeStyle;
              args.pen.strokeStyle = '#ffffff';

              document.getElementById('pointers').style['pointer-events'] = 'none';
            }
          },
            m('img.icon-select', {'src': 'apps/whiteboard/eraser.png'}),
            m('div.buttonLabel', {'style': 'color: black;'}, "Eraser")
          )
        )
      );
    }
  };

  var UndoButton = {
    'view': function(ctrl, args) {
      return m('div.controlComponent',
      {
        'onclick': function(e) {
          args.deviceState.sendAction('undo');
        }
      },
      m('img.controlIcon', {'src': '/apps/whiteboard/undo-arrow.png'}),
      m('span.buttonLabel', "Undo")
      );
    }
  };

  var ClearButton = {
    'controller': function(args) {
      return {
        'confirmState': false
      };
    },
    'view': function(ctrl, args) {
      return m('div.controlComponent',
      {
        'onclick': function(e) {
          if (!ctrl.confirmState) {
            setTimeout(function() {
              ctrl.confirmState = true;
              m.redraw(true);
              setTimeout(function() {
                ctrl.confirmState = false;
                m.redraw(true);
              }, canvasHeight);
            }, 250);
          }
            else {
            args.deviceState.sendAction('clear-screen');
            ctrl.confirmState = false;
          }
        }
      },
      m('img.controlIcon', {'src': '/apps/whiteboard/clear-button.png'}),
      m('span.buttonLabel', !ctrl.confirmState ? "Clear" : "Sure?")
      );
    }
  };

  function colorHash(num) {
    var r = 37, g = 569, b = 997;
    if (num != -1) {
      for (var i = 0; i < num; i++) {
        r = (r * g + b) % 255;
        b = (b * g + r) % 255;
        g = (g * r + b) % 255;
      }
    }

    return 'rgba(' + [r,g,b,0.9].join(',') + ')';
  }

  var Slider = {
    'controller': function(args) {
      return {
        'sliderValue': m.prop(canvasHeight)
      };
    },
    'view': function(ctrl, args) {
      var canvas = document.getElementsByTagName('canvas')[0];
      var myCursor;
      var cursors = _.pairs(args.deviceState.cursors).map(function(pair, i) {
        var left = (pair[1] - 1500) * (80.1/(canvasHeight-1500)) + 5;
        if (pair[0] === args.cursor)
          myCursor = i;

        return m('span.cursor' + (pair[0] == args.cursor ? '.my-cursor' : ''), {
          'style': 'margin-left: calc(' + left + 'vh - 36px); margin-top: ' + 'px; background-color: ' + colorHash(pair[0])
        }, m.trust('&nbsp;'));
      });

      cursors.push(cursors.splice(myCursor, 1)[0]);

      return m('#slidercontainer', [
        cursors,
        m('input#slider[type=range]', {
          min: 1500,
          max: canvasHeight,
          value: args.deviceState.cursors[args.cursor],
          'oninput': function(e) {
            args.deviceState.cursors.sendAction('update-cursor', args.cursor, e.target.value);
          }
        }),
      ]);
    }
  };

  var Pointers = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      return m('div', {
        'style': 'height: 100%',
        'ontouchstart': function(e) {
          if (e.changedTouches[0].identifier === 0)
            args.pointers[args.cursor].sendAction('update-pointer', e.changedTouches[0].pageX, e.changedTouches[0].pageY);
        },
        'ontouchmove': function(e) {
          for (var i = 0; i < e.changedTouches.length; i++)
            if (e.changedTouches[i].identifier === 0)
              args.pointers[args.cursor].sendAction('update-pointer', e.changedTouches[i].pageX, e.changedTouches[i].pageY);

            return e.preventDefault(), false;
        },
        'ontouchend': function(e) {
          for (var i = 0; i < e.changedTouches.length; i++)
            if (e.changedTouches[i].identifier === 0)
              args.pointers[args.cursor].sendAction('update-pointer', -1, -1);

        },
        'onmousedown': function(e) {
          args.pointers[args.cursor].sendAction('update-pointer', e.offsetX * canvasWidth / window.innerWidth, (e.offsetY) * canvas.height / canvasHeight + 50);
        },
        'onmouseup': function(e) {
          args.pointers[args.cursor].sendAction('update-pointer', -1, -1);
        },
        'onmousemove': function(e) {
          if (e.buttons > 0)
            args.pointers[args.cursor].sendAction('update-pointer', e.offsetX * canvasWidth / window.innerWidth, (e.offsetY) * canvas.height / canvasHeight + 50);
        }
      },
        _.pairs(args.pointers).map(function(pair) {
          return m('div.pointer', {
            'style': 'top: ' + (((pair[1].y-50)*canvasHeight/canvas.height)) + 'px; left: ' + (pair[1].x * window.innerWidth / canvasWidth) + 'px; background-color: ' + colorHash(pair[0]) + '; opacity: ' + (pair[1].x < 0 ? '0;' : '1;')
          });
        })
      );
    }
  };
});
