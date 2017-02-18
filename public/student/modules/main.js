define("main", ["exports", "mithril", "synchronizedStateClient", "models", "multicast"], function(exports, m, synchronizedStateClient, models, multicast) {
  var REFRESH_INTERVAL = 5000;

  var User = models.User;
  var Classroom = models.Classroom;
  var wsAddress = 'ws://' + window.location.host + "/ws";

  var appPath = "whiteboard";
  var widthClasses = ".col-xs-8.col-xs-offset-2.col-sm-8.col-sm-offset-2.col-md-6.col-md-offset-3";

  var Main = {
    controller: function(args) {
      function refresh() {
        return User.me().then(function(me) {
          me.classrooms().then(function(classrooms) {
            me.groups().then(function(groups) {
              var groupClassrooms = groups.map(function(group) { return group.classroom; });
              classrooms.forEach(function(classroom) {
                classroom.sessions().then(function(sessions) {
                  ctrl.activeSessions([]);
                  var curSession;
                  sessions.forEach(function(session) {
                    if (session.endTime === null)
                      curSession = session;
                  });

                  var groupIdx = groupClassrooms.indexOf(curSession.classroom);
                  ctrl.activeSessions().push({session: curSession, group: groups[groupIdx]});
                });
              });
            });
          });
          return me;
        });
      }

      var ctrl = {
        activeSessions: m.prop([]),
        me: refresh()
      };

      setInterval(function() {
        ctrl.me = refresh();
      }, REFRESH_INTERVAL);

      return ctrl;
    },
    view: function(ctrl, args) {
      return m(".container-fluid.bg-color-med.stretch",
        m(".row",
          m(widthClasses,
            m.component(SessionSelect, ctrl)
          )
        )
      );
    }
  };

  var SessionSelect = {
    view: function(__, args) {
      return m(".main-menu-section.bg-color-white",
        m(".main-menu-header.primary-color-green.text-color-secondary", "Available Sessions",
          m("div.spinner.pull-right",
            m(".bounce1"),
            m(".bounce2"),
            m(".bounce3")
          )
        ),
        m(".main-menu-body",
          (args.activeSessions().length === 0 ? m(".call-to-action", "Waiting for your teacher...") : ""),
          m(".list-group",
            args.activeSessions().map(function(activeSession) {
              return m(".list-group-item.classroom", {
                  style: activeSession.group ? "" : "display: none",
                  onclick: function(e) {
                    loadSession(args.me, activeSession);
                  }
                },
                m(".list-group-heading", activeSession.session.title)
              );
            })
          )
        )
      );
    }
  };

  m.mount(document.body, Main);

  function loadSession(me, session) {
    m.mount(document.body, null);

    var group = session.group;
    session = session.session;
    var metadata = (session.metadata ? JSON.parse(session.metadata) : {});

    session.getStoreId(group.id, me.id).then(function(storeId) {
      require(["/apps/" + metadata.app + "/main.js"], function(app) {
        var connection = synchronizedStateClient.connect(wsAddress, function() {
          connection.sync(storeId);
          app.load(connection, document.body, {
            pdf: "/media/" + metadata.pdf.filename,
            user: me
          });
        });
      });
    });
  }
});
