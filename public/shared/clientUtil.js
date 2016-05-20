/* clientUtil.js: contains some basic functions that applications
 * might want to use.
 */

define('clientUtil', ['exports'], function(exports) {
  /* Load a CSS file at the specified URL. If persist is true, then
   * the CSS file will not be unloaded between app changes. */
   
  exports.css = function(url, persist) {
    // Look through existing loaded CSS files to see if this URL has already been loaded.
    // If so, do nothing and return.
    var links = document.getElementsByTagName('link');
    for (var i = 0; i < links.length; i++)
      if (links[i].href === url)
        return;

    // Create a link element to load the stylesheet.
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = url;

    // If persist flag is not set, then add an indicator that CSS belongs to an app.
    if (!persist) link.classList.add('app-css');

    // Add the CSS file to the head.
    document.head.appendChild(link);
  };
});
