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

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', 'configurationActions'], function(exports, checkerboard, m, autoconnect, login, configurationActions) {
  var wsAddress = 'wss://' + window.location.host;
  var stm = new checkerboard.STM(wsAddress);

  // autoconnect will detect a WebSocket disconnect, show a modal and try to reconnect.
  autoconnect.monitor(stm.ws);

  // Prevent multitouch zoom in Google Chrome.
  document.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  // Prevent back/forward gestures in Google Chrome.
  document.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  var instance;
  var StatusBar = {
    'controller': function(args) {
      return {
        'trayOpen': false,
        'addedClickListener': args.addedClickListener || false
      };
    },
    'view': function(ctrl, args) {
      return m('div', {
        'onclick': function(e) {
          ctrl.trayOpen = false;
        }
      },
        m('span.glyphicon glyphicon-th-large#menu-icon' + (!instance || !args.statusText || args.statusText === "" ? '.hidden' : ''), {
          'onclick': function(e) {
            ctrl.trayOpen = !ctrl.trayOpen;
            if (ctrl.trayOpen)
              return e.stopPropagation(), false;
          },
          'config': function() {
            if (ctrl.addedClickListener)
              return;

            ctrl.addedClickListener = true;
            document.addEventListener('click', function(e) {
              if (ctrl.trayOpen) {
                ctrl.trayOpen = false;
                m.redraw(true);
              }
            });
          }
        }),
        m.component(MenuTray, ctrl),
        m.trust('&nbsp;&nbsp;'),
        m('span', args.statusText || "")
      );
    }
  };

  var MenuTray = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      return m('div#menu-tray' + (!args.trayOpen ? '.hidden' : ''),
        m('div.menu-tray-block', {
          'onclick': function(e) {
            instance.sendAction('set-instance-playback-mode', !instance.playback);
          }
        },
          m('img.menu-tray-block-icon', {
            'src': 'media/user.png'
          }),
          m('div.menu-tray-block-caption', (instance && instance.playback ? "Live" : "Playback"))
        ),
        m('div.menu-tray-block',
          m('img.menu-tray-block-icon', {
            'src': 'media/user.png'
          }),
          m('div.menu-tray-block-caption', "")
        ),
        m('div.menu-tray-block',
          m('img.menu-tray-block-icon', {
            'src': 'media/user.png'
          }),
          m('div.menu-tray-block-caption', "")
        ),
        m('div.menu-tray-block',
          m('img.menu-tray-block-icon', {
            'src': 'media/user.png'
          }),
          m('div.menu-tray-block-caption', "")
        )
      );
    }
  };



  function setStatus(text) {
    console.log('setStatus');
    if (!this.args) {
      this.args = {'statusText': text};
      m.mount(document.getElementById('statusbar'), m.component(StatusBar, this.args));
    }
    else {
      this.args.statusText = text;
      this.args.addedClickListener = true;
      m.redraw(true);
    }
  }

  stm.init(function(store) {
    store.addObserver(function(){});
    configurationActions.load(stm);
    /* --- Definitions dependent on store --- */

    /* The updateApp routine has three tasks.
     * 1) Check whether instance still exists. If not, clear the screen.
     * 2) Update the list of students assigned to this instance, for the titlebar.
     * 3) Check if thet app has been loaded. If not, load the app via RequireJS.
     */
    var playback = false;
    var i, initial, log, curTime, start, curIndex, pstore, pwss, pstm, slider;
    function updateApp(instanceId, classroom, student, reloadApp, reloadUsers) {
      instance = store.classrooms[classroom].currentState.instances[instanceId];

      // Check if the instance has been removed. If so, clear the screen.
      if (typeof instance === 'undefined' || typeof instance.app === 'undefined' || instance.app === null) {
        reRoot();

        // Want the titlebar to have some indication that things are working.
        if (typeof student !== 'undefined')
          setStatus("Logged in as " + store.classrooms[classroom].users[student].name);
        else
          setStatus(null);

        return;
      }

      if (reloadUsers || reloadApp) {
        console.log(reloadUsers,reloadApp);
        // Collect all the names of users who are assigned to the current instance, and push them to the array.
        var users = _.pairs(store.classrooms[classroom].currentState.userInstanceMapping)
          .filter(function(pair) {
            return pair[1] == instanceId;
          }).map(function(pair) {
            return store.classrooms[classroom].users[pair[0]].name;
          });
        var appName = store.apps[instance.app].title;

        // Set the titlebar text to "[apptitle] | [users]", omitting the pipe if no users connected.
        setStatus(appName + (users.length > 0 ? " | " + users.join(", ") : ""));
      }

      // Playback mode has just been enabled.
      if (instance.playback && !playback) {
        slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'playback-slider';

        var xhttp = new XMLHttpRequest();

        // Get initial and log files.
        xhttp.open("GET", "logs/latest.initial", false);
        xhttp.send();
        initial = JSON.parse(xhttp.responseText);

        xhttp.open("GET", "logs/latest", false);
        xhttp.send();
        log = JSON.parse("[" + xhttp.responseText.split("\n").slice(0, -1) + "]");

        start = log[0].ts;
        slider.min = 0;
        slider.max = log[log.length - 1].ts - start;

        curTime = slider.value = instance.playbackTime || slider.min;
        curIndex = 0;


        slider.oninput = function(e) {
          instance.sendAction('set-instance-playback-time', parseInt(e.target.value));
        };

        document.body.appendChild(slider);

        pwss = new WebSocketShell();
        pstm = new checkerboard.STM(pwss);

        pwss.sendFrame('set-state', {data: initial});

        pstm.init(function(store) {
          pstore = store;
          var pinstance = store.classrooms[classroom].currentState.instances[instanceId];
          requirejs(['/apps/' + pinstance.app + '/' + store.apps[pinstance.app].client], function(appModule) {
            var mode;
            if (typeof classroom !== 'undefined' && typeof student !== 'undefined')
              mode = 'student';
            else
              mode = 'projector';
            var params = {
              'mode': mode,
              'student': student
            };

            appModule.load(reRoot(), pstm.action, pinstance.root, params);
            document.getElementById('root').style['pointer-events'] = 'none';
            for (i = 0; (log[i] ? log[i].ts : +Infinity) - start <= curTime; i++) {
              if (!log[i])
                continue;
              pwss.sendFrame('update-state', {deltas: log[i].deltas});
            }
            curIndex = i;
          });
        });

        playback = true;

        return;
      } else if (!instance.playback && playback) {
        // Playback has been disabled.
        if (instance.app)
          reloadApp = true;

        document.body.removeChild(document.getElementById('playback-slider'));
        playback = false;
      }

      if (instance.playback) {
        if (curTime < parseInt(instance.playbackTime)) {
          curTime = parseInt(instance.playbackTime);
          for (i = curIndex; (log[i] ? log[i].ts : +Infinity) - start <= curTime; i++) {
            pwss.sendFrame('update-state', {deltas: log[i].deltas});
          }
          curIndex = i;
        } else if (curTime > parseInt(instance.playbackTime)) {
          var diffpatch = pstm.lib.diffpatch;
          var util = pstm.lib.util;

          curTime = parseInt(instance.playbackTime);

          var patchCount = 0;
          var copy = JSON.parse(JSON.stringify(pstore));
          for (i = curIndex - 1; log[i].ts - start > curTime; i--) {
            for (var j = log[i].deltas.length - 1; j >= 0; j--) {
              patchCount++;
              pwss.sendFrame('update-state', {deltas: [{delta:diffpatch.reverse(log[i].deltas[j].delta), path:log[i].deltas[j].path}]});
            }
            curIndex = i;
          }
          if (patchCount > 0) {
            
          }
        }
        slider.value = instance.playbackTime;
      }

      if (!reloadApp)
        return;

      // Otherwise, we need to load the app. To do this, we import it using RequireJS and
      // call the 'load' function specified by the app interface.
      requirejs(['/apps/' + instance.app + '/' + store.apps[instance.app].client], function(appModule) {
        var mode;
        if (typeof classroom !== 'undefined' && typeof student !== 'undefined')
          mode = 'student';
        else
          mode = 'projector';
        var params = {
          'mode': mode,
          'student': student
        };

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
          // oldStore will be null) or if the app has changed. Otherwise just update student names or flip into or
          // out of playback mode.

          var reloadApp = oldStore === null || newStore.userInstanceMapping[student] != oldStore.userInstanceMapping[student] ||
            (typeof newStore.userInstanceMapping[student] !== 'undefined' && newStore.instances[newStore.userInstanceMapping[student]].app !== oldStore.instances[newStore.userInstanceMapping[student]].app);
          updateApp(newStore.userInstanceMapping[student], classroom, student, reloadApp, false);
        });

        store.classrooms[classroom].currentState.userInstanceMapping.addObserver(function(newUserInstanceMapping, oldUserInstanceMapping) {
          var reloadUsers = false;
          if (oldUserInstanceMapping) {
            for (var p in newUserInstanceMapping)
              if (newUserInstanceMapping[p] != oldUserInstanceMapping[p])
                reloadUsers = true;
          }
          if (reloadUsers)
            updateApp(newUserInstanceMapping[student], classroom, student, false, true);
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

  /* --- playback helpers --- */

  /* WebSocketShell: a dummy WebSocket object that we can trigger arbitrary messages */
  function WebSocketShell () {
    this.messageHandlers = [];
  }

  WebSocketShell.prototype = Object.create(WebSocket.prototype);
  WebSocketShell.prototype.addEventListener = function(channel, callback) {
    if (channel === 'message')
      this.messageHandlers.push(callback);
  };
  WebSocketShell.prototype.send = function() {  /*wss.messageHandlers[0](makeFrame('set-state', {data:{}}));*/ };
  WebSocketShell.prototype.sendFrame = function(channel, message) {
    this.messageHandlers.forEach(function(handler) {
      handler({data: JSON.stringify({channel: channel, message: message})});
    });
  };
});
