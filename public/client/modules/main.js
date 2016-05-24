/* Main client module
 * This is the main module for the CCAF client application. The client application
 * is how students will use applications. It can be run in the browser, in the electron-browser
 * app (which has some extra external logic to handle server discovery), or projected
 * (ie via iframe). The client module first identifies with a student (via GUI login)
 * or a specific instance (via URL parameters).
 * - GUI login
 *    Loads the instance pointed to by the user-instance mapping. If there is no
 *    instance, it shows a blank screen. It automatically unloads/loads instances
 *    when the mapping is changed.
 * - URL login
 *    Used when instances are loaded via iframe to be shown as projector panels.
 *    Loads the specified instance. If the instance is deleted, it shows a blank screen.
 *    However, as projections are also removed when instances are removed, this is
 *    a fallback and shouldn't ever be seen by the end-user.
 */

/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

// Ensures that RequireJS plays nicely with electron-browser.
module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', './cornerMenu'], function(exports, checkerboard, m, autoconnect, login, cornerMenu) {
  /* jshint ignore:start */
  var wsAddress = 'ws://' + window.location.hostname + ':' + {{ws}};
  /* jshint ignore:end */
  var stm = new checkerboard.STM(wsAddress);

  // autoconnect will detect a WebSocket disconnect, show a modal and try to reconnect.
  autoconnect.monitor(stm.ws);

  // Prevent multitouch zoom in Google Chrome.
  document.body.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  // Prevent back/forward gestures in Google Chrome.
  document.body.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  stm.init(function(store) {
    store.addObserver(function(){});
    /* --- Definitions dependent on store --- */

    /* The updateApp routine has three tasks.
     * 1) Check whether instance still exists. If not, clear the screen.
     * 2) Update the list of students assigned to this instance, for the titlebar.
     * 3) Check if thet app has been loaded. If not, load the app via RequireJS.
     */
    var loadedApp;
    function updateApp(instanceId, classroom, student, reloadApp) {
      var instance = store.classrooms[classroom].currentState.instances[instanceId];

      // Check if the instance has been removed. If so, clear the screen.
      if (typeof instance === 'undefined' || typeof instance.app === 'undefined') {
        reRoot();

        // Want the titlebar to have some indication that things are working.
        if (typeof student !== 'undefined')
          document.getElementById('statusbar').textContent = "Logged in as " + store.classrooms[classroom].users[student].name;
        else
          document.getElementById('statusbar').textContent = "";

        return;
      }

      // Collect all the names of users who are assigned to the current instance, and push them to the array.
      var users = _.pairs(store.classrooms[classroom].currentState.userInstanceMapping)
        .filter(function(pair) {
          return pair[1] == instanceId;
        }).map(function(pair) {
          return store.classrooms[classroom].users[pair[0]].name;
        });
      var appName = store.apps[instance.app].title;

      // Set the titlebar text to "[apptitle] | [users]", omitting the pipe if no users connected.
      document.getElementById('statusbar').textContent = appName + (users.length > 0 ? " | " + users.join(", ") : "");

      if (!reloadApp)
        return;

      // Otherwise, we need to load the app. To do this, we import it using RequireJS and
      // call the 'load' function specified by the app interface.
      requirejs(['/apps/' + instance.app + '/' + store.apps[instance.app].client], function(appModule) {
        // Posssible params for the future are the name of the classroom, user, other connected users, etc.
        // For now, these are not implemented but we leave a placeholder.
        var params = {};

        // The load function takes a root element, an action creator, the root store and the future paramters object.
        appModule.load(reRoot(), stm.action, instance.root, params);
      });
    }

    /* --- Start of code run on initialization --- */

    // The client can be logged in via URL parameters or via user GUI. The gup
    // function [g]ets [u]RL [p]arameters or returns null if they don't exist.
    // We check to see whether there are URL parameters pointing to a specific instance.
    // If there are none, we default to visual login.
    if (gup('classroom') && gup('instance')) {
      store.classrooms[gup('classroom')].currentState.addObserver(function(newStore, oldStore) {
        updateApp(gup('instance'), gup('classroom'), undefined, oldStore === null);
      });
    }
    else {
      login.display(reRoot(), {'student': true, 'store': store}, function (classroom, student) {
        store.classrooms[classroom].currentState.addObserver(function(newStore, oldStore) {
          // We want to reload the app if this is the first time observer is called (data being populated,
          // oldStore will be null) or if the app has changed. Otherwise just update student names.
          var reloadApp = oldStore === null || newStore.userInstanceMapping[student] != oldStore.userInstanceMapping[student] ||
            (typeof newStore.userInstanceMapping[student] !== 'undefined' && newStore.instances[newStore.userInstanceMapping[student]].app !== oldStore.instances[newStore.userInstanceMapping[student]].app);
          updateApp(newStore.userInstanceMapping[student], classroom, student, reloadApp);
        });
      });
    }
  });

  /* --- support functions --- */

  /* [g]et [u]RL [p]arameters, or return null if there are none.
   * http://stackoverflow.com/a/979997
   */
  function gup( name, url ) {
    if (!url) url = location.href;
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( url );
    return results === null ? null : results[1];
  }

  /* The reRoot function prunes the root element which all applications attach
   * themselves to.
   */
  function reRoot() {
    if (document.getElementById('root'))
      document.body.removeChild(document.getElementById('root'));

    var el = document.createElement('div');
    el.id = 'root';
    document.body.appendChild(el);
    return el;
  }
});
