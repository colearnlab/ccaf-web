define(['clientUtil', 'exports', 'mithril'], function(clientUtil, exports, m) {
  var canvasHeight = 5000;
  var colors = ['#C72026', '#772787', '#20448E', '#499928', '#000000'];
  exports.load = function(el, action, store, params) {
    var deviceState, canvas, ctx, pen = {'strokeStyle': colors[0], 'lineWidth': 10};
    var curPath = {}, lastPath = [];

    createActions();
    store.sendAction('wb-init');
    deviceState = store.deviceState[params.device];

    initElements();
    initListeners();
    resizeCanvas();
    clearScreen();

    deviceState.paths.addObserver(drawPaths);

    function initElements() {
      clientUtil.css('/apps/whiteboard-new/styles.css');

      canvas = document.createElement('canvas');
      canvas.canvasTop = 0;
      el.appendChild(canvas);

      var controls = document.createElement('div');
      m.mount(controls, m.component(Controls, {'pen': pen, 'deviceState': deviceState, 'canvas': canvas}));
      el.appendChild(controls);
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = canvasHeight;
      canvas.style.height = canvasHeight + 'px';
      ctx = canvas.getContext('2d');
    }

    function createActions() {
      action('wb-init')
        .onReceive(function() {
          if (typeof this.deviceState === 'undefined')
            this.deviceState = {};
          if (typeof this.deviceState[params.device] === 'undefined')
            this.deviceState[params.device] = {'paths': []};
        });

      action('create-path')
        .onReceive(function(identifier) {
          if (typeof curPath[identifier] === 'undefined') {
            this.paths[this.paths.length] = [{'strokeStyle': pen.strokeStyle, 'lineWidth': pen.lineWidth}];
            lastPath.push(curPath[identifier] = this.paths.length - 1);
          } else if (curPath[identifier] >= 0) {
            return false;
          } else {
            curPath[identifier] *= -1;
            if (!this.paths[curPath[identifier]]) {
              this.paths[this.paths.length] = [{'strokeStyle': pen.strokeStyle, 'lineWidth': pen.lineWidth}];
              lastPath.push(curPath[identifier] = this.paths.length - 1);
            } else {
              this.paths[curPath[identifier]][0] = {'strokeStyle': pen.strokeStyle, 'lineWidth': pen.lineWidth};
              lastPath.push(curPath[identifier]);
            }
          }
        }).onRevert(function(identifier) {
          console.log("reverted");
          lastPath = [];
          delete curPath[identifier];
        });

      action('add-point')
        .onReceive(function(identifier, x, y) {
          if (curPath[identifier] >= 0 && this.paths[curPath[identifier]] && !isNaN(parseInt(x)) && !isNaN(parseInt(y)))
            this.paths[curPath[identifier]].push({'x': parseInt(x), 'y': parseInt(y) - 50});
        });

      action('end-path')
        .onReceive(function(identifier) {
          if (curPath[identifier] >= 0) {
            this.paths[this.paths.length] = [];
            curPath[identifier] = -(this.paths.length - 1);
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
    }

    function initListeners() {
      canvas.addEventListener('mousedown', function(e) {
        deviceState.sendAction('create-path', 0);

        deviceState.sendAction('add-point', 0, e.pageX, e.pageY + canvas.canvasTop);
        deviceState.sendAction('add-point', 0, e.pageX + 1, e.pageY + canvas.canvasTop + 1);
      });

      canvas.addEventListener('mousemove', function(e) {
        deviceState.sendAction('add-point', 0, e.pageX, e.pageY + canvas.canvasTop);
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
          deviceState.sendAction('add-point', touch.identifier + 1, e.changedTouches[i].pageX, e.changedTouches[i].pageY + canvas.canvasTop);
        }
      });

      canvas.addEventListener('touchmove', function(e) {
        for (var i = 0; i < e.changedTouches.length; i++)
          deviceState.sendAction('add-point', e.changedTouches[i].identifier + 1, e.changedTouches[i].pageX, e.changedTouches[i].pageY + canvas.canvasTop);
      });

      canvas.addEventListener('touchend', function(e) {
        for (var i = 0; i < e.changedTouches.length; i++)
          deviceState.sendAction('end-path', e.changedTouches[i].identifier + 1);
      });

      window.addEventListener('resize', function() {
        resizeCanvas();
        drawPaths(deviceState.paths, null);
      });
    }

    function drawPaths(newPaths, oldPaths) {
      var path;
      oldPaths = oldPaths || [];

      if (newPaths.filter(Boolean).length < oldPaths.filter(Boolean).length) {
        oldPaths = [];
        curPath = {};
        clearScreen();
      }

      newPaths.forEach(function(newPath, i) {
        if (!newPath || newPath.length === 0)
          return;

        ctx.strokeStyle = newPath[0].strokeStyle;
        ctx.lineWidth = newPath[0].lineWidth;
        ctx.lineJoin = "round";

        path = newPath;
        var first = true;
        for (var j = oldPaths[i] ? oldPaths[i].length : 1; j < newPaths[i].length; j++) {
          if (!path[j])
            continue;
          ctx.beginPath();
          if (path[j - 1])
            ctx.moveTo(path[j - 1].x, path[j - 1].y);
          else
            ctx.moveTo(path[j].x - 1, path[j].y);

          ctx.lineTo(path[j].x, path[j].y);
          ctx.closePath();
          ctx.stroke();
        }
      });
    }

    function clearScreen() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  var Controls = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      return m('div#controls',
        m.component(ColorSelect, args),
        m.component(LineSelect, args),
        m.component(EraseButton, args),
        m('div.controlComponent', m.trust('&nbsp;')),
        m.component(UndoButton, args),
        m.component(ClearButton, args),
        m.component(Slider)
      );
    }
  };

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
            if (color !== args.pen.strokeStyle)
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
        m('img.controlIcon', {'src': '/apps/whiteboard-new/pen.png'}),
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
        'style': 'height: ' + args.width + 'px; margin-top: ' + margin + 'px; margin-bottom: ' + margin + 'px'
      }, m.trust('&nbsp;'));
    }
  };

  var saved;
  var EraseButton = {
    'view': function(ctrl, args) {
      var selected = args.pen.strokeStyle === '#ffffff';
      return m('div.controlComponent', {
        'onclick': function(e) {
          if (selected) {
            args.pen.strokeStyle = saved;
            saved = null;
          } else {
            saved = args.pen.strokeStyle;
            args.pen.strokeStyle = '#ffffff';
          }
        }
      },
        m('img.controlIcon', {'src': selected ? 'apps/whiteboard-new/eraser-selected.png' : 'apps/whiteboard-new/eraser.png'}),
        m('span.buttonLabel', {
          'style': 'font-weight: ' + (selected ? 'bold' : 'normal')
        }, "Eraser")
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
      m('img.controlIcon', {'src': '/apps/whiteboard-new/undo-arrow.png'}),
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
              }, 5000);
            }, 250);
          }
            else {
            args.deviceState.sendAction('clear-screen');
            ctrl.confirmState = false;
          }
        }
      },
      m('img.controlIcon', {'src': '/apps/whiteboard-new/clear-button.png'}),
      m('span.buttonLabel', !ctrl.confirmState ? "Clear" : "Sure?")
      );
    }
  };

  var Slider = {
    'controller': function(args) {
      return {
        'sliderValue': m.prop(canvasHeight)
      };
    },
    'view': function(ctrl, args) {
      var canvas = document.getElementsByTagName('canvas')[0];
      return m('#slidercontainer', [
        m('input#slider[type=range]', {
          min: 0,
          max: canvasHeight - window.innerHeight,
          value: ctrl.sliderValue(),
          config: function(el) {
            el.addEventListener('input', function(e) {
              ctrl.sliderValue(e.target.value);
              canvas.canvasTop = (canvasHeight - window.innerHeight - e.target.value);
              canvas.style.transform = 'translate(0px,-' + canvas.canvasTop + 'px)';
            });
          }
        })
      ]);
    }
  };

  /*
  var Controls = {
    'controller': function() {
      return {
        'colors': ['red', 'green', 'blue', 'black'],
        'sliderValue': m.prop(canvasHeight)
      };
    },
    'view': function(ctrl, args) {
      var pen = args.pen;
      var deviceState = args.deviceState;
      var canvas = args.canvas;
      return (
        m('div#controls.form-inline', [
          m('#slidercontainer', [
            m('input#slider[type=range]', {
              min: 0,
              max: canvasHeight - window.innerHeight,
              value: ctrl.sliderValue(),
              config: function(el) {
                el.addEventListener('input', function(e) {
                  ctrl.sliderValue(e.target.value);
                  canvas.canvasTop = (canvasHeight - window.innerHeight - e.target.value);
                  canvas.style.transform = 'translate(0px,-' + canvas.canvasTop + 'px)';
                });
              }
            })
          ]),
          m('button.btn.btn-default.btn-lg', {
            'onclick': function(e) {
              deviceState.sendAction('clear-screen');
            }
          }, ['Clear']),
          m('span.spacer1', [m.trust('&nbsp;')]),
          m('button.btn.btn-default.btn-lg', {
            'onclick': function(e) {
              deviceState.sendAction('undo');
            }
          }, ['Undo']),
          m('span.spacer1', [m.trust('&nbsp;')]),
          m('span.input-group', [
            m('input[type=range].form-control.input-lg', {
              'value': pen.lineWidth,
              'min': 5,
              'max': 32,
              'step': 1,
              'oninput': function(e) {
                pen.lineWidth = e.target.value;
              }
            }),
            m('span.input-group-addon', [
              m('span', {
                'style': 'background-color:' + pen.strokeStyle + '; ' +
                         'padding: 0; ' +
                         'margin-left: ' + (25 - pen.lineWidth)/2 + 'px; ' +
                         'margin-right: ' + (25 - pen.lineWidth)/2 + 'px; ' +
                         'line-height: ' + pen.lineWidth + 'px; ' +
                         'display: inline-block; ' +
                         'width: ' + pen.lineWidth + 'px; ' +
                         'height: ' + pen.lineWidth + 'px; ' +
                         'border-radius: 50%'
              }, [m.trust('&nbsp;')])
            ])
          ]),
          m('span.spacer1', [m.trust('&nbsp;')]),
          m('span.brush-holder',
            ctrl.colors.map(function(color) {
              return (
                m('span.brush', {
                  'style': 'background-color: ' + color + '; ',
                  'onclick': function(e) {
                    pen.strokeStyle = color;
                  }
                }, [
                  m('img[src=/apps/whiteboard/splatter.gif]', {
                    'height': '50px',
                    'width': '50px'
                  })
                ])
              );
            }),
            m('span.brush', {
              'onclick': function(e) {
                pen.strokeStyle = 'white';
              }
            }, [
              m('img[src=/apps/whiteboard/eraser.png]', {
                'height': '50px',
                'width': '50px'
              })
            ])
          )
        ])
      );
    }
  };
  */
});
