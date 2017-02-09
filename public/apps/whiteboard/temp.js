var target = e.target;
var y = args.y();

var targetRect = target.getBoundingClientRect();

var minimap = document.getElementById("minimap");
var minimapRect = minimap.getBoundingClientRect();

if (targetRect.top + e.dy >= minimapRect.top && e.dy < 0 || targetRect.bottom + e.dy <= minimapRect.bottom && e.dy > 0)
  y += e.dy;


var pageLength = window.innerHeight - targetRect.height;
var minimapExcess = minimapRect.height - window.innerHeight;

var top = 0;
if (minimapExcess > 0) {
  top = (-(y / pageLength) * minimapExcess);
   minimap.style.top = top + "px";
}
target.style.top = (y - top) + "px";

var pdfContainer = document.getElementById("pdf-container");

var minimapPercent = (y - top) / minimap.getBoundingClientRect().height;
var pdfContainerHeight = pdfContainer.getBoundingClientRect().height;

pdfContainer.style.top = (-minimapPercent * pdfContainerHeight) + "px";

target.setAttribute("data-y", y);
