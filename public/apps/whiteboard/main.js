define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "interact", "css"], function(exports, pdfjs, m, interact, css) {
  var PDFJS = pdfjs.PDFJS;
  var array;
  exports.load = function(connection, el, params) {
    array = connection.array;
    css.load("/apps/whiteboard/styles.css");
    var ctrl = m.mount(el, m.component(Main, {
      pdf: params.pdf,
      connection: connection
    }));
    connection.addObserver(function(store) {
      ctrl.y(store.scrollPositions ? store.scrollPositions[4] || 0 : 0);
      ctrl.remotePages(store.pages || {});
      m.redraw();
    });
    document.getElementById("main").addEventListener('touchstart', function(event){
      event.preventDefault();
      return false;
    });
    window.addEventListener("resize", m.redraw.bind(null, true));
  };

  var colors = {
    0: "#000000",
    1: "#FF0000",
    2: "#00FF00",
    3: "#0000FF"
  };

  var Main = {
    controller: function(args) {
      var ctrl = {
        numPages: m.prop(0),
        y: m.prop(0),
        scroll: m.prop("open"),
        pages: [],
        remotePages: m.prop({}),
        currentPath: m.prop(null),
        currentPage: null,
        currentPath2: null,
        drawn: m.prop([]),
        pdf: m.prop(null),
        tool: m.prop(0),
        color: {0: 0, 1: 0},
        size: m.prop(5),
        setScroll: function(pos) {
          args.connection.transaction([["scrollPositions"]], function(scrollPositions) {
            scrollPositions[4] = pos;
          });
        },
        startStroke: function(page, size, x, y) {
          args.connection.transaction([["pages", page, "paths", "+"]], function(path) {
            ctrl.currentPath2 = this.props[0].slice(-1);
            ctrl.currentPage = page;

            path[0] = {tool: ctrl.tool(), color: colors[ctrl.color[ctrl.tool()]], size: ctrl.size(), currentlyDrawing: true};
            path[1] = path[3] = {x: x, y: y};
            path[2] = path[4] = {x: x - 1, y: y};
          });
        },
        addPoint: function(x, y) {
          if (ctrl.currentPath2 === null) return;
          args.connection.transaction([["pages", ctrl.currentPage, "paths", ctrl.currentPath2]], function(path) {
            args.connection.array.push(path, {x: x, y: y});
          });
        },
        endStroke: function() {
          if (ctrl.currentPath2 === null) return;
          args.connection.transaction([["pages", ctrl.currentPage, "paths", ctrl.currentPath2]], function(path) {
            ctrl.currentPath2 = null;
            path[0].currentlyDrawing = false;
          });
        },
        clear: function() {
          args.connection.transaction([["pages"]], function(pages) {
            array.forEach(pages, function(__, i) {
              pages[i] = {paths: {}};
            });
          });
        }
      };

      PDFJS.getDocument(args.pdf).then(function(pdf) {
        ctrl.numPages(pdf.numPages);
        ctrl.pdf(pdf);
        m.redraw(true);
      });

      return ctrl;
    },
    view: function(ctrl, args) {
      return m("#main", {
          class: "scroll-" + ctrl.scroll()
        },
        m.component(PDFViewer, ctrl),
        m.component(Minimap, ctrl),
        m.component(Controls, ctrl)
      );

    }
  };

  var Controls = {
    view: function(__, args) {
      return m("#controls",
        m("span.glyphicon#minimap-chevron", {
          class: args.scroll() === "open" ? "glyphicon-chevron-right" : "glyphicon-chevron-left",
          onclick: function() {
            args.scroll(args.scroll() === "open" ? "closed" : "open");
          },
          ontouchend: function() {
            args.scroll(args.scroll() === "open" ? "closed" : "open");
          }
        }),
        m("span.glyphicon.glyphicon-remove#clear-screen", {
          onclick: args.clear,
          ontouchend: args.clear
        }),
        m("#tools",
          m.component(Tool, {tool: args.tool, color: args.color, toolId: 0, hasTray: true}),
          m.component(Tool, {tool: args.tool, color: args.color, toolId: 1, hasTray: true})
        )
      );
    }
  };

  var Tool = {
    controller: function() {
      return {
        open: m.prop(false)
      };
    },
    view: function(ctrl, args) {
      return m("div.tool-button", {
        },
        m("div.color-swatch-holder", {
          class: (args.tool() === args.toolId ? "selected" : "")
        },
          m("div.color-swatch", {
            style: "background-color: " + colors[args.color[args.toolId]],
            config: function(el, isInit) {
              if (isInit)
                return;
            },
            onclick: function() {
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

            return m("div.color-swatch", {
              onclick: handler,
              ontouchend: handler,
              style: "background-color: " + colors[colorId] + "; " + (args.color[args.toolId] == colorId ? "display: none; " : ""),
            });
          })
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
      return m("#pdf-container", {
        config: function(el, isInit, ctx) {
          var containerRect = el.getBoundingClientRect();

          var percentage = args.y();
          var totalLength = containerRect.height - window.innerHeight + 52;
          var currentPos = -percentage * totalLength;

          el.style.transform = "translate(0px, " + currentPos + "px)";

          if (isInit)
            return;

          ctrl.interactable = interact("#pdf-container")
            .draggable({
              manualStart: true,
              inertia: true,
              onmove: function(e) {
                var containerRect = e.target.getBoundingClientRect();

                var percentage = args.y();
                var totalLength = containerRect.height - window.innerHeight + 52;
                var currentPos = percentage * totalLength;

                var newY = currentPos - e.dy;
                var newPercentage = newY / totalLength;

                if (newPercentage >= 0 && newPercentage <= 1)
                  args.setScroll(newPercentage);

              }
            })
            .on('move', function (event) {
              var interaction = event.interaction;

              if (!interaction.interacting() && event.pointerType === "touch")
                interaction.start({ name: 'drag' }, event.interactable, event.currentTarget);
            })
            .styleCursor(false);
        }
      }, drawPDF(ctrl, args, 1));
    }
  };

  var Minimap = {
    controller: function(args) {
      return {

      };
    },
    view: function(ctrl, args) {
      return m("#minimap",
        m.component(MinimapScreen, args),
        m("#minimap-overlay", " "),
        drawPDF(ctrl, args, 1)
      );
    }
  };

  var MinimapScreen = {
    controller: function(args) {
      return {
        interactable: null
      };
    },
    view: function(ctrl, args) {
      return m(".minimap-screen", {
        style: "height: " + (window.innerHeight / 10) + "px",
        config: function(el, isInit, ctx) {
          var minimapRect = el.parentNode.getBoundingClientRect();
          var screenRect = el.getBoundingClientRect();

          var percentage = args.y();
          var totalLength = minimapRect.height - screenRect.height;
          var currentPos = percentage * totalLength;

          var overflow = minimapRect.height - window.innerHeight + 52;
          if (overflow > 0)
            el.parentNode.style.transform = "translate(0px, " + (-percentage * overflow) + "px)";

          el.style.transform = "translate(0px, " + currentPos + "px)";

          if (isInit)
            return;

          ctrl.interactable = interact(el).draggable({
            inertia: true,
            onmove: function(e) {
              var minimapRect = document.getElementById("minimap").getBoundingClientRect();
              var screenRect = el.getBoundingClientRect();

              var percentage = args.y();
              var totalLength = minimapRect.height - screenRect.height;
              var currentPos = percentage * totalLength;

              var newY = currentPos + e.dy;
              var newPercentage = newY / totalLength;

              if (newPercentage >= 0 && newPercentage <= 1)
                args.setScroll(newPercentage);
            }
          })
          .styleCursor(false);

          ctx.onunload = function() {
            if (ctrl.interactable)
              ctrl.interactable.unset();
          };
        }
      });
    }
  };

  function drawPDF(ctrl, args, scale) {
    return Array.apply(null, {length: args.numPages()}).map(function(__, i) {
      return m.component(PDFPageHolder, {drawn: args.drawn, startStroke: args.startStroke, addPoint: args.addPoint, endStroke: args.endStroke, page: args.remotePages()[i], currentPath: args.currentPath, pdf: args.pdf(), pageNum: i});
    });
  }

  var PDFPageHolder = {
    controller: function(args) {
      return {
        dimensions: null,
        virtualDimensions: {height: 2500, width: parseInt(11 / 8.5 * 2500)},
        width: 0,
        redrawing: false,
        drawn: {}
      };
    },
    view: function(ctrl, args) {
      return m("div.pdf-page-holder",
        m("canvas.pdf-page", {
          config: function(canvas, isInit) {
            if (isInit && canvas.getBoundingClientRect().width === ctrl.width || ctrl.redrawing)
              return;

            ctrl.redrawing = true;
            args.pdf.getPage(args.pageNum + 1).then(function(page) {
              ctrl.width = canvas.getBoundingClientRect().width;
              canvas.style.width = "0vw";

              var viewport = page.getViewport(ctrl.width / page.getViewport(1).width * 1);
              canvas.height = viewport.height;
              canvas.width = viewport.width;


              page.render({canvasContext: canvas.getContext("2d"), viewport: viewport}).then(function() {
                canvas.style.width = "";
                ctrl.styleDimensions = {height: canvas.getBoundingClientRect().height, width: canvas.getBoundingClientRect().width};
                ctrl.canvasDimensions = {height: canvas.height, width: canvas.width};

                m.redraw(true);
                ctrl.redrawing = false;
              });
            });
          }
        }),
        m("canvas.drawing-surface", {
          height: (ctrl.canvasDimensions ? ctrl.canvasDimensions.height : 0),
          width: (ctrl.canvasDimensions ? ctrl.canvasDimensions.width : 0),
          config: function(canvas) {
            var ctx = canvas.getContext("2d");

            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            if (!args.page || !ctrl.canvasDimensions)
              return;

            var numDrawn = 0, p;

            if (args.drawn()[args.pageNum]) {
              for (p in args.drawn()[args.pageNum])
                if (args.drawn()[args.pageNum][p][ctrl.canvasDimensions.height])
                  numDrawn++;
            }

            if (numDrawn > array.length(args.page.paths)) {
              ctx.clearRect(0, 0, ctrl.canvasDimensions.width, ctrl.canvasDimensions.height);
              for (p in args.drawn()[args.pageNum])
                args.drawn()[args.pageNum][p][ctrl.canvasDimensions.height] = false;
            }

            array.forEach(args.page.paths, function(path, i) {
              if (path[0].currentlyDrawing || args.drawn()[args.pageNum] && args.drawn()[args.pageNum][i] && args.drawn()[args.pageNum][i][ctrl.canvasDimensions.height])
                return;

              ctx.strokeStyle = path[0].color;
              ctx.lineWidth = path[0].size * ctrl.canvasDimensions.width / ctrl.virtualDimensions.width;

              ctx.beginPath();
              var xM = ctrl.canvasDimensions.width / ctrl.virtualDimensions.width;
              var yM = ctrl.canvasDimensions.height / ctrl.virtualDimensions.height;

              ctx.moveTo(path[1].x * xM, path[1].y * yM);

              for (j = 2; j < array.length(path) - 2; j += 2 ) {
                var xc = (path[j].x * xM + path[j + 2].x * xM) / 2;
                var yc = (path[j].y * yM + path[j + 2].y * yM) / 2;
                ctx.quadraticCurveTo(path[j].x * xM, path[j].y * yM, xc, yc);
              }

              ctx.stroke();
              if (!args.drawn()[args.pageNum])
                args.drawn()[args.pageNum] = {};

              if (!args.drawn()[args.pageNum][i])
                args.drawn()[args.pageNum][i] = {};

              args.drawn()[args.pageNum][i][ctrl.canvasDimensions.height] = true;
            });
          },
          onmousedown: function(e) {
            var targetRect = e.target.getBoundingClientRect();
            var x = (e.pageX - targetRect.left) * ctrl.virtualDimensions.width / ctrl.styleDimensions.width;
            var y = (e.pageY - targetRect.top) * ctrl.virtualDimensions.height / ctrl.styleDimensions.height;
            args.startStroke(args.pageNum, parseInt(x), parseInt(y));
            m.redraw.strategy("none");
          },
          onmousemove: function(e) {
            var targetRect = e.target.getBoundingClientRect();
            var x = (e.pageX - targetRect.left) * ctrl.virtualDimensions.width / ctrl.styleDimensions.width;
            var y = (e.pageY - targetRect.top) * ctrl.virtualDimensions.height / ctrl.styleDimensions.height;
            args.addPoint(parseInt(x), parseInt(y));
            m.redraw.strategy("none");
          },
          onmouseup: function(e) {
            args.endStroke();
            m.redraw.strategy("none");
          },
          onmouseleave: function(e) {
            args.endStroke();
            m.redraw.strategy("none");
          },
          style:  "margin-left: " + (ctrl.styleDimensions ? -ctrl.styleDimensions.width : 0) + "px; " +
                  "height: " + (ctrl.styleDimensions ? ctrl.styleDimensions.height : 0) + "px; " +
                  "width: " + (ctrl.styleDimensions ? ctrl.styleDimensions.width : 0) + "px; "
        }),
        m("canvas.drawing-surface.currently-drawing-surface-pen", {
          height: (ctrl.canvasDimensions ? ctrl.canvasDimensions.height : 0) / 1,
          width: (ctrl.canvasDimensions ? ctrl.canvasDimensions.width : 0) / 1,
          config: function(canvas) {
            var ctx = canvas.getContext("2d");

            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            if (!args.page || !ctrl.canvasDimensions)
              return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            array.forEach(args.page.paths, function(path) {
              if (!path[0].currentlyDrawing)
                return;

              ctx.strokeStyle = path[0].color;
              ctx.lineWidth = path[0].size * ctrl.canvasDimensions.width / ctrl.virtualDimensions.width / 1;

              ctx.beginPath();
              var xM = ctrl.canvasDimensions.width / ctrl.virtualDimensions.width / 1;
              var yM = ctrl.canvasDimensions.height / ctrl.virtualDimensions.height / 1;

              ctx.moveTo(path[1].x * xM, path[1].y * yM);

              for (j = 2; j < array.length(path) - 2; j += 2 ) {
                var xc = (path[j].x * xM + path[j + 2].x * xM) / 2;
                var yc = (path[j].y * yM + path[j + 2].y * yM) / 2;
                ctx.quadraticCurveTo(path[j].x * xM, path[j].y * yM, xc, yc);
              }

              ctx.stroke();
            });
          },
          style:  "margin-left: " + (ctrl.styleDimensions ? -ctrl.styleDimensions.width : 0) + "px; " +
                  "height: " + (ctrl.styleDimensions ? ctrl.styleDimensions.height : 0) + "px; " +
                  "width: " + (ctrl.styleDimensions ? ctrl.styleDimensions.width : 0) + "px; "
        })
      );
    }
  };
});
