define('clientUtil', ['exports'], function(exports) {
  exports.css = function(url, persist) {
    var links = document.getElementsByTagName('link');
    for (var i = 0; i < links.length; i++)
      if (links[i].href === url)
        return;
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = url;
    if (!persist) link.classList.add('app-css');
    document.getElementsByTagName("head")[0].appendChild(link);
  };
});
