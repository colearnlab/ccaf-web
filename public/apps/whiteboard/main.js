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
      if (store.scrollPositions) {
        ctrl.y(store.scrollPositions[4] || 0);
      }
      ctrl.remotePages(store.pages || {});
      m.redraw();
    });

    window.addEventListener("resize", m.redraw.bind(null, true));
  };

  var colors = {
    0: "#000000",
    1: "#FF0000",
    2: "#00FF00",
    3: "#0000FF",
    4: "#FFFFFF"
  };

  function dist(x1, y1, x2, y2) {
    var d = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    return d;
  }

  var Main = {
    controller: function(args) {
      var ctrl = {
        numPages: m.prop(0),
        y: m.prop(0),
        scroll: m.prop("open"),
        pages: [],
        remotePages: m.prop({}),
        currentPath: null,
        currentPage: null,
        drawn: m.prop([]),
        pdf: m.prop(null),
        tool: m.prop(0),
        color: {0: 0, 1: 0},
        size: m.prop(10),
        fireScrollEvent: true,
        setScroll: function(pos) {
          args.connection.transaction([["scrollPositions"]], function(scrollPositions) {
            scrollPositions[4] = pos;
          });
        },
        startStroke: function(page, x, y) {
          if (ctrl.tool() === 0 || ctrl.tool() === 1) {
            ctrl.currentPage = page;

            args.connection.transaction([["pages", page, "paths", "+"]], function(path) {
              ctrl.currentPath = this.props[0].slice(-1);
              var opacity = ctrl.tool() === 0 ? 1 : 0.5;
              path[0] = {opacity: opacity, color: colors[ctrl.color[ctrl.tool()]], size: ctrl.size(), currentlyDrawing: true};
              path[1] = path[3] = {x: x, y: y};
              path[2] = path[4] = {x: x - 0.005, y: y};
            });
          } else if (ctrl.tool() === 2) {
            ctrl.currentPage = page;
          }
        },
        addPoint: function(x, y) {
          if (ctrl.tool() === 0 || ctrl.tool() === 1) {
            if (ctrl.currentPath === null) return;

            args.connection.transaction([["pages", ctrl.currentPage, "paths", ctrl.currentPath]], function(path) {
              args.connection.array.push(path, {x: x, y: y});
            });
          } else if (ctrl.tool() === 2) {
            if (ctrl.currentPage === null) return;

            args.connection.transaction([["pages", ctrl.currentPage, "paths"]], function(paths) {
              array.forEach(paths, function(path) {
                array.forEach(path, function(point) {
                  if (dist(point.x, point.y, x, y) < ctrl.size()) {
                    point.x = point.y = -1;
                    path[0].lastErased = (path[0].lastErased || 0) + 1;
                  }
                });
              });
            });
          }
        },
        endStroke: function() {
          if (ctrl.tool() === 0 || ctrl.tool() === 1) {
            if (ctrl.currentPath === null) return;

            args.connection.transaction([["pages", ctrl.currentPage, "paths", ctrl.currentPath]], function(path) {
              path[0].currentlyDrawing = false;
            });
          }

          ctrl.currentPath = null;
          ctrl.currentPage = null;
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
      var listener = function(e) {
      };
      return m("#main", {
          class: "scroll-" + ctrl.scroll(),
          config: function(el) {
            ctrl.fireScrollEvent = false;
            el.scrollTop = parseInt(ctrl.y() * (el.scrollHeight - window.innerHeight));
          },
          onscroll: function(e) {
            var el = e.target;
            if (!ctrl.fireScrollEvent) {
              console.log("cancelled scroll event");
              ctrl.fireScrollEvent = true;
              m.redraw.strategy("none");
              return false;
            }
            console.log("fired scroll event");
            ctrl.setScroll(el.scrollTop / (el.scrollHeight - window.innerHeight));
          }
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
          m.component(Tool, {tool: args.tool, color: args.color, toolId: 1, hasTray: true}),
          m.component(Tool, {tool: args.tool, color: {2: 4}, toolId: 2, hasTray: false})
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
          onmousedown: ctrl.open.bind(null, false),
          ontouchstart: ctrl.open.bind(null, false)
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
            onmousedown: function(e) {
              if (args.tool() !== args.toolId)
                args.tool(args.toolId);
              else
                ctrl.open(!ctrl.open());

              e.stopPropagation();
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
              onmousedown: handler,
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
      return m("#pdf-container", drawPDF(ctrl, args, 1));
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

          el.style.transform = "translate(0px, " + currentPos + "px)";

          if (isInit)
            return;

          console.log("set interactable");
          ctrl.interactable = interact(el).draggable({
            onmove: function(e) {
              console.log(e);
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
          });

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
        virtualWidth: 1000,
        virtualHeight: 1000 * 11 / 8.5,
        redrawing: false,
        target: null
      };
    },
    view: function(ctrl, args) {
      return m("div.pdf-page-holder",
        m("img.pdf-page", {
          onload: m.redraw,
          config: function(el, isInit) {
            if (isInit || ctrl.redrawing)
              return;

            var canvas = document.createElement("canvas");

            ctrl.redrawing = true;
            args.pdf.getPage(args.pageNum + 1).then(function(page) {
              var viewport = page.getViewport(1000 / page.getViewport(1).width * 1);
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              page.render({canvasContext: canvas.getContext("2d"), viewport: viewport}).then(function() {
                el.src = canvas.toDataURL();
                ctrl.redrawing = false;
              });
            });
          }
        }),
        m("svg.drawing-surface", {
          config: function(el) {
            var h = el.parentNode.children[0].getBoundingClientRect().height;
            el.style.marginTop = (-h) + "px";
            el.style.transform = "scale(" + (h / ctrl.virtualHeight) + ")";
            ctrl.target = el;
          },
          onmousedown: function(e) {
            var targetRect = ctrl.target.getBoundingClientRect();
            var x = (e.pageX - targetRect.left) / targetRect.width * ctrl.virtualWidth;
            var y = (e.pageY - targetRect.top) / targetRect.height * ctrl.virtualHeight;
            //console.log("down", x, y);
            args.startStroke(args.pageNum, parseInt(x), parseInt(y));
            m.redraw.strategy("none");
          },
          onmousemove: function(e) {
            var targetRect = ctrl.target.getBoundingClientRect();
            var x = (e.pageX - targetRect.left) / targetRect.width * ctrl.virtualWidth;
            var y = (e.pageY - targetRect.top) / targetRect.height * ctrl.virtualHeight;
            //console.log("move", x, y);
            args.addPoint(parseInt(x), parseInt(y));
            m.redraw.strategy("none");
          },
          onmouseup: function(e) {
            //var targetRect = ctrl.target.getBoundingClientRect();
            //var x = (e.pageX - targetRect.left) / targetRect.width * ctrl.virtualWidth;
            //var y = (e.pageY - targetRect.top) / targetRect.height * ctrl.virtualHeight;
            //console.log("up", x, y);
            args.endStroke();
          }
        }, array.map(args.page.paths, function(path) { return m.component(Path, path); })
        )
      );
    }
  };

  var Path = {
    controller: function() {
      return {
        drawn: false,
        lastErased: null
      };
    },
    view: function(ctrl, path) {
      if (ctrl.drawn && path[0].lastErased === ctrl.lastErased)
        return {subtree: "retain"};
      else if (path[0].currentlyDrawing === false) {
        ctrl.drawn = true;
      }

      var xM = 1;
      var yM = 1;

      var dStr = "";
      var a;
      for (var i = 1; i < array.length(path) - 2; i += a) {
        a = 1;

        var cont = false;
        for (var j = i; j <= i + a; j++) {
          if (path[j].x == -1) {
            cont = true;
          }
        }

        if (cont)
          continue;

        if (i - 1 !== 0 && path[i - 1].x === -1 || !path[i - 1].x) {
            dStr += " M " + path[i].x * xM + " " + path[i].y * yM;
            continue;
        }

        var xc = (path[i].x * xM + path[i + a].x * xM) / 2;
        var yc = (path[i].y * yM + path[i + a].y * yM) / 2;
        dStr += " Q " + (path[i].x * xM) + " " + (path[i].y * yM) + ", " + xc + " " + yc;
      }

      ctrl.lastErased = path[0].lastErased;

      return m("path", {
        stroke: path[0].color,
        "stroke-opacity": path[0].opacity,
        fill: "transparent",
        "stroke-width": path[0].size,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        d: dStr
      });
    }
  };
});
