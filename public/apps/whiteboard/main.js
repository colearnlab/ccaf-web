define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "interact", "css"], function(exports, pdfjs, m, interact, css) {
  var PDFJS = pdfjs.PDFJS;
  exports.load = function(connection, el, params) {
    css.load("/apps/whiteboard/styles.css");
    var ctrl = m.mount(el, m.component(Main, {
      pdf: params.pdf,
      connection: connection
    }));
    connection.addObserver(function(store) {
      ctrl.y(store.scrollPositions ? store.scrollPositions[4] || 0 : 0);
      m.redraw(true);
    });
    document.getElementById("main").addEventListener('touchstart', function(event){
      event.preventDefault();
      return false;
    });
    window.addEventListener("resize", m.redraw.bind(null, true));
  };

  var Main = {
    controller: function(args) {
      var ctrl = {
        numPages: m.prop(0),
        y: m.prop(0),
        scroll: m.prop("open"),
        pages: [],
        currentPath: m.prop(null),
        pdf: m.prop(null),
        setScroll: function(pos) {
          args.connection.transaction(["scrollPositions"], function(scrollPositions) {
            scrollPositions[4] = pos;
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
      var params = {
        numPages: ctrl.numPages,
        y: ctrl.y,
        scroll: ctrl.scroll,
        pages: ctrl.pages,
        currentPath: ctrl.currentPath,
        pdf: ctrl.pdf,
        setScroll: ctrl.setScroll
      };

      return m("#main", {
          class: "scroll-" + ctrl.scroll()
        },
        m.component(PDFViewer, params),
        m.component(Minimap, params),
        m.component(Controls, params)
      );

    }
  };

  var Controls = {
    view: function(__, args) {
      return m("#controls",
        m("span.glyphicon", {
          class: args.scroll() === "open" ? "glyphicon-chevron-right" : "glyphicon-chevron-left",
          onclick: function() {
            args.scroll(args.scroll() === "open" ? "closed" : "open");
          }
        })
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
          var totalLength = containerRect.height - window.innerHeight + 37;
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
                var totalLength = containerRect.height - window.innerHeight + 37;
                var currentPos = percentage * totalLength;

                var newY = currentPos - e.dy;
                var newPercentage = newY / totalLength;

                if (newPercentage >= 0 && newPercentage <= 1)
                  args.setScroll(newPercentage);

                m.redraw(true);
              }
            })
            .on('move', function (event) {
              var interaction = event.interaction;

              if (!interaction.interacting() && event.pointerType === "touch")
                interaction.start({ name: 'drag' }, event.interactable, event.currentTarget);
            });
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

          var overflow = minimapRect.height - window.innerHeight + 37;
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

              m.redraw(true);
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
      if (!args.pages[i])
        args.pages[i] = {paths: []};
      return m.component(PDFPageHolder, {page: args.pages[i], currentPath: args.currentPath, pdf: args.pdf(), pageNum: i + 1});
    });
  }

  var PDFPageHolder = {
    controller: function(args) {
      return {
        dimensions: null,
        virtualDimensions: {height: 2500, width: parseInt(11 / 8.5 * 2500)},
        width: 0,
        redrawing: false
      };
    },
    view: function(ctrl, args) {
      return m("div.pdf-page-holder",
        m("canvas.pdf-page", {
          config: function(canvas, isInit) {
            if (isInit && canvas.getBoundingClientRect().width === ctrl.width || ctrl.redrawing)
              return;

            ctrl.redrawing = true;
            args.pdf.getPage(args.pageNum).then(function(page) {
              ctrl.width = canvas.getBoundingClientRect().width;
              canvas.style.width = "0vw";

              var viewport = page.getViewport(ctrl.width / page.getViewport(1).width * 1.5);
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

            ctx.strokeStyle = "#000000";
            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            //ctx.clearRect(0, 0, canvas.width, canvas.height);
            args.page.paths.slice(-1).forEach(function(path) {
              ctx.lineWidth = 5 * ctrl.canvasDimensions.width / ctrl.virtualDimensions.width;

              ctx.beginPath();
              var xM = ctrl.canvasDimensions.width / ctrl.virtualDimensions.width;
              var yM = ctrl.canvasDimensions.height / ctrl.virtualDimensions.height;

              ctx.moveTo(path[0].x * xM, path[0].y * yM);

              for (j = 1; j < path.length - 2; j += 2 ) {
                var xc = (path[j].x * xM + path[j + 2].x * xM) / 2;
                var yc = (path[j].y * yM + path[j + 2].y * yM) / 2;
                ctx.quadraticCurveTo(path[j].x * xM, path[j].y * yM, xc, yc);
              }

              ctx.stroke();
            });
          },
          onmousedown: function(e) {
            var targetRect = e.target.getBoundingClientRect();
            var x = (e.pageX - targetRect.left) * ctrl.virtualDimensions.width / ctrl.styleDimensions.width;
            var y = (e.pageY - targetRect.top) * ctrl.virtualDimensions.height / ctrl.styleDimensions.height;
            args.currentPath(args.page.paths.push([{x: x, y: y}, {x: x - 1, y: y}, {x: x, y: y}, {x: x - 1, y: y}]) - 1);
          },
          onmousemove: function(e) {
            if (args.currentPath() === null)
              return;

            var targetRect = e.target.getBoundingClientRect();
            var x = (e.pageX - targetRect.left) * ctrl.virtualDimensions.width / ctrl.styleDimensions.width;
            var y = (e.pageY - targetRect.top) * ctrl.virtualDimensions.height / ctrl.styleDimensions.height;
            args.page.paths[args.currentPath()].push({
              x: x,
              y: y
            });
          },
          onmouseup: function(e) {
            args.currentPath(null);
          },
          style:  "margin-left: " + (ctrl.styleDimensions ? -ctrl.styleDimensions.width : 0) + "px; " +
                  "height: " + (ctrl.styleDimensions ? ctrl.styleDimensions.height : 0) + "px; " +
                  "width: " + (ctrl.styleDimensions ? ctrl.styleDimensions.width : 0) + "px; "
        })
      );
    }
  };
});
