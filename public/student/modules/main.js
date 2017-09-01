define("main", ["exports", "mithril", "synchronizedStateClient", "models", "multicast"], function(exports, m, synchronizedStateClient, models, multicast) {
  var REFRESH_INTERVAL = 10000;

  var User = models.User;
  var Classroom = models.Classroom;
  var ClassroomSession = models.ClassroomSession;
  //var wsAddress = 'wss://' + window.location.host + "/ws";
  var wsAddress = 'ws://' + window.location.host + "/ws";
  var Activity = models.Activity;
  var ActivityPage = models.ActivityPage;
  var appPath = "whiteboard";
  var widthClasses = ".col-xs-8.col-xs-offset-2.col-sm-8.col-sm-offset-2.col-md-6.col-md-offset-3";

  var Main = {
    controller: function(args) {
      function refresh() {
        return User.me().then(function(me) {
          
            m.request({
                method: 'GET',
                url: '/api/v1/snapshot/' + me.id
            }).then(function(res) {
                ctrl.snapshots(res.data);
            });


          me.classrooms().then(function(classrooms) {
            me.groups().then(function(groups) {
              var groupClassrooms = groups.map(function(group) { return group.classroom; });
              classrooms.forEach(function(classroom) {
                classroom.sessions().then(function(sessions) {
                  ctrl.activeSessions([]);
                  sessions.forEach(function(session) {
                    if (session.endTime !== null)
                      return;

                    var groupIdx = groupClassrooms.indexOf(session.classroom);
                    ctrl.activeSessions().push({session: session, group: groups[groupIdx]});
                  });

                });
              });
            });
          });
          return me;
        });
      }

      var ctrl = {
        activeSessions: m.prop([]),
        snapshots: m.prop([]),
        me: refresh(),
        interval: setInterval(function() {
            ctrl.me = refresh();
          }, REFRESH_INTERVAL)
      };

      return ctrl;
    },
    view: function(ctrl, args) {
      return m(".container-fluid.bg-color-med.stretch",
        m(".row",
          m(widthClasses,
            m.component(SessionSelect, ctrl),
            m.component(SnapshotsMenu, ctrl)
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
                    clearInterval(args.interval);
                    var sessionId = activeSession.session.id;
                    var classroomId = activeSession.group.classroom;
                    var groupId = activeSession.group.id;

                    var me = args.me();
                    args.interval = setInterval(function() {
                      ClassroomSession.get(sessionId).then(function(updatedActiveSession) {
                        if (updatedActiveSession.endTime !== null) {
                          clearInterval(args.interval);

                          console.log(wbApp);
                          // Run the whiteboard app's exit callback
                          if(wbApp.exitCallback) {
                              wbApp.exitCallback();
                          }
                        }
                      });

                      me.groups().then(function(groups) {
                        var groupClassrooms = groups.map(function(group) { return group.classroom; });
                        var groupIdx = groupClassrooms.indexOf(classroomId);

                        if (groups[groupIdx].id !== groupId) {
                          groupId = groups[groupIdx].id;
                          loadSession(me, {session: activeSession.session, group: groups[groupIdx]});
                        }
                      });
                    }, REFRESH_INTERVAL);
                    loadSession(me, activeSession);
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

  var SnapshotsMenu = {
    controller: function(args) {
        return {
            snapshots: args.snapshots,
            showMenu: (args.snapshots().length != 0)
        };
    },
    view: function(ctrl, args) {
        return m(".main-menu-section.bg-color-white",
            m(".main-menu-header.primary-color-green.text-color-secondary",
                "Your saved work"
            ),

            ctrl.showMenu ?
                m("table.table.table-striped",
                    m("thead",
                        m("tr",
                           m("th", "Session"),
                            m("th", "Pages")
                        )
                    ),
                    m("tbody",
                        ctrl.snapshots().map(function(snapshot) {
                            return m("tr",
                                m("td", snapshot.title),
                                m("td", snapshot.pages.map(function(snapshotPage) {
                                        return m('a[href="/snapshots/' + snapshotPage.file + '"]', {
                                                style: "padding-right: 1em",
                                                download: snapshotPage.file
                                            },
                                            "" + (snapshotPage.doc + 1) + "." + (snapshotPage.page + 1)
                                        );
                                    })
                                )
                            );
                        })
                    )
                )
            : m("div", {style: "color: gray; text-align: center"}, "(no saved work)")
        );
    }
  };

  m.mount(document.body, Main);

    var wbApp;

  function loadSession(me, session) {
    m.mount(document.body, null);

    var group = session.group;
      //console.log("Group: " + group);
    session = session.session;
    var metadata = (session.metadata ? JSON.parse(session.metadata) : {});

    session.getStoreId(group.id, me.id).then(function(storeId) {
      group.users().then(function(userList) {

        require(["/apps/" + metadata.app + "/main.js"], function(app) {
          var connection = synchronizedStateClient.connect(wsAddress, function() {
            connection.sync(storeId);
            var appReturn = {};
            app.load(connection, document.body, {
              user: me,
              group: group.id,
              groupObject: group,
              session: session,
              appReturn: appReturn,
              exitCallback: function(appCallback) {
                if(appCallback)
                      appCallback();

                // After the whiteboard app cleans up, return to our main menu
                m.mount(document.body, Main);
              }
            });
            
            wbApp = app;
            
          });
        });
      });
    });
    //return app;
  }
});
