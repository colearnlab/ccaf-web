define(['clientUtil', 'exports'], function(clientUtil, exports) {
  var canvasHeight = 5000;
  exports.load = function(el, action, store, params) {
    var deviceState, canvas, ctx, pen = {'strokeStyle': '#ff0000', 'lineWidth': 10};
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
      clientUtil.css('/apps/whiteboard/styles.css');

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
          this.paths[this.paths.length] = [pen];
          lastPath.push(curPath[identifier] = this.paths.length - 1);
        });
        
      action('set-pen')
        .onReceive(function() {
          this[0] = pen;
        });
        
      action('add-point')
        .onReceive(function(identifier, x, y) {
          if (curPath[identifier] >= 0)
            deviceState.paths[curPath[identifier]].sendAction('add-point-2', x, y);
          return false;
        })
        
      action('add-point-2')
        .onReceive(function(x, y) {
          this.push({'x': x, 'y': y});
        });
        
      action('end-path')
        .onReceive(function(identifier) {
          if (curPath[identifier] >= 0) {
            this.paths[this.paths.length] = [];
            curPath[identifier] = -(this.paths.length - 1);
          } else {
            return false;
          }
        });
        
      action('undo')
        .onReceive(function(path) {
          curPath = {};
          if (lastPath.length > 0)
            this.paths[lastPath.pop()] = 0;
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
        if (typeof curPath[0] === 'undefined')
          deviceState.sendAction('create-path', 0);
        else if (curPath[0] >= 0)
          return;
        else {
          curPath[0] *= -1;
          deviceState.paths[curPath[0]].sendAction('set-pen');
          lastPath.push(curPath[0]);
        }
        deviceState.sendAction('add-point', 0, e.pageX, e.pageY + canvas.canvasTop);
        deviceState.sendAction('add-point', 0, e.pageX, e.pageY + canvas.canvasTop + 1);
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
          if (typeof curPath[touch.identifier + 1] === 'undefined')
            deviceState.sendAction('create-path', touch.identifier + 1);
          else if (curPath[touch.identifier] >= 0)
            return;
          else {
            curPath[touch.identifier + 1] *= -1;
            deviceState.paths[curPath[touch.identifier + 1]].sendAction('set-pen');
            lastPath.push(curPath[touch.identifier + 1]);
          }
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
    };
    
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
        
        for (var j = oldPaths[i] ? oldPaths[i].length : 1; j < newPaths[i].length; j++) {
          path = newPath;
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
});