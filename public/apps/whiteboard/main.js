define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "interact", "css"], function(exports, pdfjs, m, interact, css) {
  var PDFJS = pdfjs.PDFJS;
  exports.load = function(connection, el, params) {
    css.load("/apps/whiteboard/styles.css");
    m.mount(el, m.component(Main, params));
    document.getElementById("main").addEventListener('touchstart', function(event){
      event.preventDefault();
      return false;
    });
  };

  var Main = {
    controller: function(args) {
      var ctrl = {
        numPages: 0,
        scale: m.prop(1),
        x: m.prop(0),
        y: m.prop(0),
        scroll: m.prop("open")
      };

      PDFJS.getDocument(args.pdf).then(function(pdf) {
        ctrl.numPages = pdf.numPages;
        ctrl.pdf = pdf;
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
        interactable: null,
        dimensions: []
      };
    },
    view: function(ctrl, args) {
      return m("#pdf-container", {
        style: "transform: translate(" + args.x() + "px, " + args.y() + "px) scale(" + args.scale() + ")",
        onclick: function(e) {
          var target = (e.target.id === "pdf-container") ? e.target : e.target.parentNode;
          var targetRect = target.getBoundingClientRect();
        },
        config: function(el, isInit, ctx) {
          ctrl.interactable = interact("#pdf-container")
            .draggable({
              inertia: true,
              onmove: function(e) {
                var newY = args.y() + e.dy;

                var targetRect = e.target.getBoundingClientRect();
                if (newY <= 0 && newY + targetRect.height >= window.innerHeight)
                  args.y(newY);

                m.redraw(true);
              }
            });
        }
      }, drawPDF(ctrl, args, 1));
    }
  };

  var Minimap = {
    controller: function(args) {
      return {
        dimensions: []
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
          var percentage = (-args.y() - 37) / (document.getElementById("pdf-container").getBoundingClientRect().height - window.innerHeight);
          el.style.transform = "translate(0px, " + percentage * (el.parentNode.getBoundingClientRect().height - el.getBoundingClientRect().height) + "px)";
          var overflow = el.parentNode.getBoundingClientRect().height - window.innerHeight;
          if (overflow > 0) {
            el.parentNode.style.transform = "translate(0px, " + (-percentage * overflow) + "px)";
          }

          ctrl.interactable = interact(el).draggable({
            inertia: true,
            onmove: function(e) {
              var newY = parseInt(args.y()) - e.dy * document.getElementById("pdf-container").getBoundingClientRect().height / e.target.parentNode.getBoundingClientRect().height;

              var targetRect = document.getElementById("pdf-container").getBoundingClientRect();
              if (newY <= 0 && newY + targetRect.height >= window.innerHeight)
                args.y(newY);

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
    return Array.apply(null, {length: args.numPages}).map(function(__, i) {
      return m("div.pdf-page-holder",
        m("canvas.pdf-page", {
          config: function(canvas, isInit) {
            if (isInit)
              return;

            args.pdf.getPage(i + 1).then(function(page) {
              var originalWidth = canvas.getBoundingClientRect().width;
              canvas.style.width = "0vw";

              var viewport = page.getViewport(originalWidth / page.getViewport(1).width * 1.5);
              canvas.height = viewport.height;
              canvas.width = viewport.width;


              page.render({canvasContext: canvas.getContext("2d"), viewport: viewport}).then(function() {
                canvas.style.width = "";
                ctrl.dimensions[i] = {height: canvas.getBoundingClientRect().height, width: canvas.getBoundingClientRect().width};
                m.redraw(true);
              });
            });
          }
        }),
        m("canvas.drawing-surface", {
          style: "margin-left: " + (ctrl.dimensions[i] ? -ctrl.dimensions[i].width : 0) + "px; height: " + (ctrl.dimensions[i] ? ctrl.dimensions[i].height : 0) + "px; width: " + (ctrl.dimensions[i] ? ctrl.dimensions[i].width : 0) + "px; "
        })
      );
    });
  }
});
