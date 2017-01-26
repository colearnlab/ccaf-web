define(["exports"], function(exports) {
  exports.load = function(url) {
    var links = document.getElementsByTagName("link");

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;

    for (var i = 0; i < links.length; i++)
      if (links[i].href === link.href)
        return;

    document.getElementsByTagName("head")[0].appendChild(link);
  };

  exports.unload = function(url) {
    var links = document.getElementsByTagName("link");
    for (var i = 0; i < links.length; i++)
      if (links[i].href === url)
        links[i].parentNode.removeChild(links[i]);
  };
});
