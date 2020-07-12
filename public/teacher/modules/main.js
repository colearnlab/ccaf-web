define('main', ["exports", "mithril", "jquery", "models", "userPicker", "modules/groupEditor", "modules/datavis", "bootstrap", "synchronizedStateClient"], function (exports, m, $, models, userPicker, groupEditor, dataVis, bs, synchronizedStateClient) {
  var Classroom = models.Classroom;
  var User = models.User;
  var ClassroomSession = models.ClassroomSession;
  var File = models.File;
  var Activity = models.Activity;
  var ActivityPage = models.ActivityPage;

  var UserPicker = userPicker.userPicker;
  var GroupEditor = groupEditor.groupEditor;
  var DataVis = dataVis.DataVis;

  var wsAddress = 'wss://' + window.location.host + "/ws"; //When running on Csteps server
  //    var wsAddress = 'ws://' + window.location.host + "/ws"; //When running locally

  var Shell = {
    controller: function (args) {
      var ctrl = {
        me: m.prop({}),
        refreshData: function () {
          ctrl.me = User.me().then(function (me) {
            ctrl.classrooms = Classroom.list().then(function (classrooms) {

              classrooms.filter(function (classroom) {
                return classroom.owner == me.id;
              }).map(function (classroom) {
                classroom.sessions().then(function (sessions) {
                  for (var i = 0; i < sessions.length; i++)
                    ctrl.sessions().push(sessions[i]);
                });
              });
              return classrooms;
            });
            return me;
          }).then(function (me) {
            Activity.list().then(ctrl.activities);
            return me;
          });
        },
        toolbarText: m.prop(""),
        activities: m.prop([]),
        classrooms: m.prop([]),
        sessions: m.prop([]),
        showMenus: {
          sessions: false,
          activities: false,
          classrooms: false
        },
        onunload: function () {
          clearInterval(ctrl.refreshInterval);
        }
      };

      ctrl.refreshData();
      ctrl.refreshInterval = setInterval(ctrl.refreshData, 10000);

      return ctrl;
    },
    view: function (ctrl, component) {
      return m("div.container-fluid.bg-color-med#main.stretch",
        m("#toolbar.primary-color-blue.text-color-secondary",
          m("span.glyphicon.glyphicon-circle-arrow-left#back-button", {
            style: (m.route() === "/") ? "display: none" : "",
            onclick: function () {
              if (component.exitCallback)
                component.exitCallback();
              m.route("/");
            }
          }),
          m("span", " ", m.trust(ctrl.toolbarText()))
        ),
        m.component(component, ctrl)
      );
    }
  };

  //var widthClasses = ".col-xs-8.col-xs-offset-2.col-sm-8.col-sm-offset-2.col-md-6.col-md-offset-3";
  var widthClasses = ".col-xs-10.col-xs-offset-1.col-sm-10.col-sm-offset-1.col-md-10.col-md-offset-1";
  var Menu = {
    view: function (ctrl, args) {
      var me = args.me() || {
        name: "",
        email: ""
      };
      args.toolbarText(me.name + " - " + me.email); // TODO put text here
      return m(".row",
        m(widthClasses,
          m.component(Sessions, args),
          //m.component(StartSessionMenu, args),
          //m.component(ActiveSessions, args),
          m.component(PastSessions, args),

          // TODO make these menus
          m.component(ActivitiesMenu, args),
          m.component(ClassroomsMenu, args)

          //m.component(RecordedClassesMenu, args)

          /*
          m("a", { 
              onclick: function() {
                  m.route("/activity");
              }
            },
            "Activity Editor"
          )*/
        )
      );
    }
  };

  var StartSessionMenu = {
    controller: function (args) {
      return {
        showBody: false,
        sessionName: "New session",
        classroom: null,
        sessionFile: null
      };
    },
    view: function (ctrl, args) {
      return m(".main-menu-section.bg-color-white", {
          style: args.sessions().filter(function (session) {
            return session.endTime === null;
          }).length === 0 ? "" : "display: none"
        },
        m(".main-menu-header.primary-color-green.text-color-secondary", {
            onclick: function () {
              ctrl.showBody = !ctrl.showBody;
            }
          },
          "Start a new session ", m("span.glyphicon.glyphicon-chevron-right")
        ),
        m(".main-menu-body", {
            style: "height: 250px; " + (ctrl.showBody ? "" : "display: none")
          },
          m("form.start-session-form",
            m(".form-group",
              m("label", "Title"),
              m("input.form-control", {
                value: ctrl.sessionName,
                oninput: function (e) {
                  ctrl.sessionName = e.target.value;
                }
              })
            ),
            m(".form-group",
              m("label", "Classroom"),
              m("select.form-control", {
                  value: ctrl.classroom,
                  onchange: function (e) {
                    ctrl.classroom = e.target.value;
                  }
                },
                m("option", ""),
                args.classrooms().map(function (classroom) {
                  return m("option", {
                    value: classroom.id
                  }, classroom.title);
                })
              )
            ),
            m(".form-group",
              m("label", {
                style: "display: block"
              }, "PDF"),
              m("input[type=file]", {
                style: "display: inline-block",
                onchange: function (e) {
                  ctrl.sessionFile = e.target.files[0] || null;
                }
              }),
              m("button.btn.btn-primary.pull-right", {
                disabled: ctrl.sessionName.length === 0 || ctrl.classroom === null || ctrl.sessionFile === null || ctrl.sessionFile.type !== "application/pdf",
                onclick: function (e) {
                  File.upload(ctrl.sessionFile).then(function (filename) {
                    var newClassroomSession = new ClassroomSession();
                    newClassroomSession.title = ctrl.sessionName;
                    newClassroomSession.classroom = ctrl.classroom;
                    newClassroomSession.metadata = {
                      pdf: filename.data,
                      app: "whiteboard"
                    };
                    newClassroomSession.save().then(function () {
                      m.route("/session/" + newClassroomSession.id);
                    });
                  });
                  return false;
                }
              }, "Start")
            )
          )
        )
      );
    }
  };

  // For active sessions
  var Sessions = {
    controller: function (args) {
      var ctrl = {
        sessions: m.prop([]),
        showBody: args.showMenus.sessions,
        refresh: function () {
          ClassroomSession.list().then(function (sessions) {
            ctrl.sessions(sessions.filter(function (session) {
              return session.endTime == null;
            }));
            m.redraw();
          });
        },
        onunload: function () {
          clearInterval(ctrl.refreshInterval);
        }
      };

      ctrl.refresh();
      ctrl.refreshInterval = setInterval(ctrl.refresh, 10000);

      return ctrl;
    },
    view: function (ctrl, args) {
      return m(".main-menu-section.bg-color-white", {},
        m(".main-menu-header.primary-color-green.text-color-secondary", {
            onclick: function () {
              args.showMenus.sessions = ctrl.showBody = !ctrl.showBody;
            }
          },
          m.trust((ctrl.showBody ? "&#9660; " : "&#9658; ") + "View and manage active sessions")),
        m(".main-menu-body", {
            style: (ctrl.showBody ? "" : "display: none;")
          },
          m(".list-group",
            ctrl.sessions().length ? "" : m(".list-group-item", {
              style: "color: gray; text-align: center"
            }, "(no active sessions)"),
            ctrl.sessions().map(function (session) {
              var classroomIdx = args.classrooms().map(function (classroom) {
                return classroom.id;
              }).indexOf(session.classroom);
              var classroom = args.classrooms()[classroomIdx];
              return m(".list-group-item.classroom",
                m(".list-group-heading", {
                    //style: (session.endTime == null) ? "font-weight: bold" : ""
                  },
                  session.title,
                  " [",
                  classroom.title,
                  "]",
                  m("a.session-link.pull-right", {
                      onclick: function () {
                        var endSession = confirm("Are you sure you want to end the session?\n\n Press Yes to End Session or Cancel.");
                        if (endSession == true) {
                          session.endTime = (+new Date());
                          session.save().then(ctrl.refresh);
                        }
                      }
                    },
                    m.trust("&laquo;End session&raquo;")
                  ),
                  m("a.session-link.pull-right", {
                      onclick: function () {
                        m.route("/session/" + session.id);
                      }
                    },
                    m.trust("&laquo;Edit groups&raquo;")
                  ),
                  m("a.session-link.pull-right", {
                      onclick: function () {
                        m.route("/visualize/" + session.id);
                      }
                    },
                    m.trust("&laquo;View live&raquo;")
                  )
                )
              );
            })
          )
        )
      );
    }
  };

  // TODO future sessions menu, and be able to create future sessions

  var PastSessions = {
    controller: function (args) {
      var ctrl = {
        sessions: m.prop([]),
        sendWork: null,
        curr_users: {},
        sel_students: {},
        showBody: args.showMenus.sessions,
        refresh: function () {
          ClassroomSession.list().then(function (sessions) {
            ctrl.sessions(sessions.reverse().filter(function (session) {
              return session.endTime !== null;
            }));

            // Fetch groups
            sessions.map(function (session) {
              Classroom.get(session.classroom).then(function (classroom) {
                classroom.groups().then(function (groups) {
                  session.groups = groups;
                });
              });
            });

            m.redraw();
          });
        },
        onunload: function () {
          clearInterval(ctrl.refreshInterval);
        },
        // TODO need: group, me, session, syncStateClient(?) 
        launchWhiteboardApp: function (group, session) {
          // Add self to group and launch whiteboard
          args.me().addGroup(group).then(function () {
            m.mount(document.body, null);

            var me = args.me();
            var metadata = (session.metadata ? JSON.parse(session.metadata) : {});

            session.getStoreId(group.id, me.id).then(function (storeId) {
              group.users().then(function (userList) {

                require(["/apps/" + metadata.app + "/main.js"], function (app) {
                  var connection = synchronizedStateClient.connect(wsAddress, function () {
                    connection.sync(storeId, 0); // playback start time is 0

                    //connection.startPlayback(storeId, 0);
                    var appReturn = {};
                    app.load(connection, document.body, {
                      user: me,
                      group: group.id,
                      groupObject: group,
                      session: session,
                      appReturn: appReturn,

                      // start in observer mode!
                      observerMode: true,

                      exitCallback: function (appCallback) {
                        // Remove self from first group (dirty, but shouldn't be in more than one group)
                        args.me().groups().then(function (groups) {
                          var group = groups[0];

                          // Remove self from group and then return
                          args.me().removeGroup(group).then(function () {
                            if (appCallback) {
                              appCallback(function () {
                                //m.mount(document.body, exports.DataVis);
                                location.reload();
                              });
                            } else {
                              //m.mount(document.body, exports.DataVis);
                              location.reload();
                            }
                          });
                        });
                      }
                    }); // app.load

                  }); // connect
                });

              }); // group.users

            }); // getStoreId
          });
        } // launchWhiteboardApp
      };

      ctrl.refresh();
      //ctrl.refreshInterval = setInterval(ctrl.refresh, 10000);

      return ctrl;
    },
    view: function (ctrl, args) {

      if (ctrl.sendWork) {
        var sel_session = ctrl.sendWork;
        var send_to_me = "";
        // var curr_users = ["parthpatel1898@gmail.com", "cstepsuser1@gmail.com", "cstepsuser2@gmail.com"];

        return m(".modal.fade#send-work-modal", {
            config: function () {
              $("#send-work-modal").modal({
                backdrop: "static"
              });
              $("#send-work-modal").modal("show");
            }
          },
          m(".modal-content.modal-work",
            m(".modal-header",
              m("h4.modal-title", sel_session.title)
            ),
            m(".modal-body",
              m("div.table-cont",
                m("table.cont-emails",
                  m("tr", 
                    m("th", {
                      colspan: 2
                    },
                      m("p", "Just send documents to you? Enter your email below")
                    )
                  ),
                  m("tr",
                    m("td.right", {
                      colspan: 2
                    },
                      m("input.txt-email", {id: "input-email"})
                    )
                  ),
                  m("tr", [
                    m("th.left",
                      {style: "top: 0; position: sticky"},
                      [
                        m("input[type=checkbox]", {
                          name: "selectAll",
                          onclick: function () {
                            checkboxes = document.getElementsByName('emails');
                            for (var i = 0, n = checkboxes.length; i < n; i++) {
                              checkboxes[i].checked = this.checked;
                            }
                            if (this.checked) {
                              for (var i = 0, n = checkboxes.length; i < n; i++) {
                                ctrl.sel_students[checkboxes[i].value] = ctrl.curr_users[checkboxes[i].value];
                              }
                            }
                            else {
                              ctrl.sel_students = {};
                            }
                          }
                        })
                      ]),
                    m("th.right", {style: "top: 0; position: sticky"}, m("p", "Select All")),
                  ]),
                  (ctrl.curr_users ? Object.keys(ctrl.curr_users).map(function (email) {
                    return m("tr", [
                      m("td.left", [
                        m("input[type=checkbox]", {
                          name: "emails",
                          value: email,
                          onclick: function () {
                            selectAll = document.getElementsByName('selectAll');
                            if (selectAll[0].checked && !this.checked) {
                              selectAll[0].checked = false;
                            }
                            if (this.checked) {
                              ctrl.sel_students[email] = ctrl.curr_users[email];
                            } else {
                              delete ctrl.sel_students[email]; 
                            }
                          }
                        })
                      ]),
                      m("td.right", m("p", email)),
                    ])
                  }) : "")
                ))
            ),
            m(".modal-footer",
              m("button.btn.btn-default", {
                "data-dismiss": "modal",
                onclick: function () {
                  $("#send-work-modal").modal("hide");
                  ctrl.sendWork = null;
                  ctrl.curr_users = {};
                  ctrl.sel_students = {};
                },

              }, "Cancel"),
              m("button.btn.btn-primary", {
                "data-dismiss": "modal",
                disabled: Object.keys(ctrl.sel_students).length == 0,
                onclick: function () {
                  send_to_me = document.getElementById('input-email').value;
                  m.request({
                    method: "POST",
                    url: '/api/v1/sendWork',
                    data: {
                      "emails" : JSON.stringify([ctrl.sel_students]), 
                      "session_id" : sel_session.id, 
                      "session_name" : sel_session.title,
                      "send_to_me": send_to_me
                    }
                  }).then(function() {
                    $("#send-work-modal").modal("hide");
                    ctrl.sendWork = null;
                    ctrl.curr_users = [];
                    ctrl.sel_students = new Set();
                  });
                },
              }, "Send")
            )
          )
        );

      }
      return m(".main-menu-section.bg-color-white", {
          style: ctrl.sessions().length > 0 ? "" : "display: none"
        },
        m(".main-menu-header.primary-color-green.text-color-secondary", "View past sessions"),
        m(".main-menu-body.canscroll",
          m(".list-group.canscroll",
            ctrl.sessions().map(function (session) {

              var classroomIdx = args.classrooms().map(function (classroom) {
                return classroom.id;
              }).indexOf(session.classroom);
              var classroom = args.classrooms()[classroomIdx];

              return m(".list-group-item.classroom",
                m(".list-group-heading", {},
                  session.title,
                  " [",
                  classroom.title,
                  "]",

                  //Remove .hide-recorded to bring this back up.
                  (session.groups ? session.groups.map(function (g) {
                    return m("a.session-link.pull-right.hide-recorded", {
                        onclick: function () {
                          ctrl.launchWhiteboardApp(g, session);
                        }
                      },
                      g.title
                    );
                  }) : ""),
                  m(".pull-right.hide-recorded", "Watch recorded session for group:"),



                  //Open modal to send work to students
                  m("a.session-link.pull-right", {
                    style: "color: gray",
                    onclick: function (e) {
                      e.stopPropagation();
                      console.log(classroom.id);
                      m.request({
                        method: "GET",
                        url: "/api/v1/classrooms/" + classroom.id + '/users'
                      })
                      .then(function (result) {
                        for (var j = 0; j < result.data.length; j++) {
                          ctrl.curr_users[result.data[j].email] = result.data[j].id;
                        }
                        console.log(result);
                        ctrl.sendWork = session;
                      });
                    }
                  }, m.trust("&laquo;Send Work&raquo;"))

                  /* TODO remove this
                  m("a.session-link.pull-right", {
                      onclick: function() {
                              // TODO change link!
                          m.route("/visualize/" + session.id);
                      }
                    }, 
                    m.trust("&laquo;Play back session&raquo;")
                  ) */

                )
              );
            })
          )
        )
      );
    }
  };

  var ClassroomsMenu = {
    controller: function (args) {
      return {
        classrooms: args.classrooms,
        editingClassroom: null,
        deletingClassroom: null,
        creating: false,
        showBody: args.showMenus.classrooms
      };
    },
    view: function (ctrl, args) {
      return m("div",
        (ctrl.editingClassroom ? m.component(ClassroomEditModal, {
            me: args.me,
            creating: ctrl.creating,
            classroom: ctrl.editingClassroom,
            triggerDelete: function () {
              ctrl.deletingClassroom = ctrl.editingClassroom;
            },
            endEdit: function (reload) {
              ctrl.editingClassroom = null;
              if (reload)
                Classroom.list().then(ctrl.classrooms).then(function () {
                  m.redraw(true);
                });
            }
          }) :
          ""),
        (ctrl.deletingClassroom ? m.component(ClassroomDeleteModal, {
            classroom: ctrl.deletingClassroom,
            endDelete: function (reload) {
              ctrl.deletingClassroom = null;
              $("#classroom-delete-modal").modal("hide");
              if (reload) {
                ctrl.editingClassroom = null;
                $("#classroom-edit-modal").modal("hide");
                Classroom.list().then(ctrl.classrooms).then(function () {
                  m.redraw(true);
                });
              }
            }
          }) :
          ""),
        m('.main-menu-section.bg-color-white', {
            /*
            style: args.sessions().filter(function(session) {
              return session.endTime === null;
            }).length === 0 ? "" : "display: none"*/
          },
          m('.main-menu-header.primary-color-blue.text-color-secondary', {
              onclick: function () {
                args.showMenus.classrooms = ctrl.showBody = !ctrl.showBody;
              }
            },
            m.trust((ctrl.showBody ? "&#9660; Class Rosters" : "&#9658; Class Rosters")),
            m('span.glyphicon.glyphicon-plus.pull-right', {
              style: (ctrl.showBody ? "" : "display: none"),
              onclick: function (e) {
                ctrl.creating = true;
                ctrl.editingClassroom = new Classroom("", args.me().id);
                ctrl.showContents = true;
                e.stopPropagation();
              }
            })
          ),
          m('.main-menu-body', {
              style: (ctrl.showBody ? "overflow: auto" : "display: none")
            },
            m(".list-group",
              ctrl.classrooms().length ? "" : m(".list-group-item", {
                style: "color: gray; text-align: center"
              }, "(no classrooms)"),
              ctrl.classrooms().map(function (classroom) {
                return m(".list-group-item.classroom",
                  m(".list-group-heading", {
                      onclick: function () {
                        m.route("/classroom/" + classroom.id);
                      }
                    },
                    classroom.title,
                    /*
                    m("a.session-link.pull-right", {
                      style: "color: gray",
                      onclick: function(e) {
                        m.route("/classroom/" + classroom.id);
                        //ctrl.editingClassroom = Object.assign(new Classroom(), JSON.parse(JSON.stringify(classroom)));
                        //e.stopPropagation();
                      }}, m.trust("&laquo;Edit class roster&raquo;")
                    ),
                    */
                    //m("span.glyphicon.glyphicon-edit.pull-right", {
                    m("a.session-link.pull-right", {
                      style: "color: gray",
                      onclick: function (e) {
                        ctrl.creating = false;
                        ctrl.editingClassroom = Object.assign(new Classroom(), JSON.parse(JSON.stringify(classroom)));
                        e.stopPropagation();
                      }
                    }, m.trust("&laquo;Edit&raquo;"))
                  )
                );
              })
            )
          )
        )
      );
    }
  };

  var ClassroomEditModal = {
    controller: function (args) {
      return {
        notOwner: args.classroom.owner !== args.me().id,
        classroom: args.classroom
      };
    },
    view: function (ctrl, args) {
      return m(".modal.fade#classroom-edit-modal", {
          config: function (el) {
            $("#classroom-edit-modal").modal({
              backdrop: "static"
            });
            $("#classroom-edit-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title",
              args.creating ? "Create class" : "Edit class"
            )
          ),
          m(".modal-body",
            m("form",
              m(".form-group",
                m("label.control-label[for=classroom-modal-title]", "Title"),
                m("div",
                  m("input.input-sm.form-control#classroom-modal-title", {
                    value: ctrl.classroom.title,
                    oninput: function (el) {
                      ctrl.classroom.title = el.target.value;
                    }
                  })
                )
              ),
              m(".form-group", {
                  style: typeof ctrl.classroom.id === "undefined" ? "display: none;" : ""
                },
                m("label.control-label", "Shared with (teachers): "),
                m.component(UserPicker, {
                  classroom: ctrl.classroom,
                  restrictTo: ["administrator", "teacher"],
                  type: void 0
                })
              )
            )
          ),
          m(".modal-footer",
            m("button.btn.btn-danger.pull-left", {
              onclick: args.triggerDelete,
              style: (typeof ctrl.classroom.id === "undefined" || ctrl.notOwner ? "display: none;" : ""),
            }, "Delete"),
            m("button.btn.btn-default", {
              onclick: function (e) {
                args.endEdit();
              },
              "data-dismiss": "modal"
            }, "Cancel"),
            args.creating ? "" :
            m("button.btn.btn-default", {
                onclick: function () {
                  args.endEdit();
                  m.route("/classroom/" + args.classroom.id);
                },
                "data-dismiss": "modal"
              },
              "Edit class roster"
            ),
            m("button.btn.btn-primary", {
              onclick: function () {
                ctrl.classroom.save().then(function () {
                  args.endEdit(true);
                });
              },
              "data-dismiss": "modal"
            }, "Save")
          )
        )
      );
    }
  };

  var ClassroomDeleteModal = {
    view: function (ctrl, args) {
      return m(".modal.fade#classroom-delete-modal", {
          config: function () {
            $("#classroom-delete-modal").modal({
              backdrop: "static"
            });
            $("#classroom-delete-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", "Delete class?")
          ),
          m(".modal-body",
            "Are you sure you want to delete this classroom? This cannot be undone."
          ),
          m(".modal-footer",
            m("button.btn.btn-default", {
              onclick: args.endDelete.bind(null, false),
            }, "Cancel"),
            m("button.btn.btn-danger", {
              "data-dismiss": "modal",
              onclick: function () {
                args.classroom.delete().then(function () {
                  args.endDelete(true);
                });
              }
            }, "Delete!")
          )
        )
      );
    }
  };

  //////////////////////

  var ActivitiesMenu = {
    controller: function (args) {
      var ctrl = {
        activities: args.activities,
        editingActivity: null,
        deletingActivity: null,
        startActivity: null,
        showRecentDocsModal: false,

        showBody: args.showMenus.activities

      };
      ctrl.addPage = function (page) {
        //console.log(ctrl.editingActivity());
        page.metadata = {};
        ctrl.editingActivity().pages.push(page);
        m.redraw();
      };

      ctrl.triggerRecentDocs = function (show) {
        ctrl.showRecentDocsModal = show;
        //console.log(show ? "Show recent docs" : "Don't show recent docs");
      };
      return ctrl;
    },
    view: function (ctrl, args) {
      return m("div",
        (ctrl.editingActivity ? m.component(ActivitiesEditModal, {
            me: args.me,
            creating: ctrl.creating,
            activity: ctrl.editingActivity,
            triggerDelete: function () {
              ctrl.deletingActivity = ctrl.editingActivity;
            },
            triggerRecentDocs: ctrl.triggerRecentDocs,
            endEdit: function (reload, cb) {
              ctrl.editingActivity = null;
              if (reload)
                Activity.list().then(ctrl.activities).then(function () {
                  m.redraw(true);
                });

              if ((typeof cb) != "undefined") {
                cb();
              }
            }

          }) :
          ""), // TODO for Activity.list, give owner as parameter
        (ctrl.deletingActivity ? m.component(ActivitiesDeleteModal, {
            activity: ctrl.deletingActivity,
            endDelete: function (reload) {
              ctrl.deletingActivity = null;
              $("#activity-delete-modal").modal("hide");
              if (reload) {
                ctrl.editingActivity = null;
                $("#activity-edit-modal").modal("hide");
                Activity.list().then(ctrl.activities).then(function () {
                  m.redraw(true);
                });
              }
            }
          }) :
          ""),
        (ctrl.showRecentDocsModal ? m.component(RecentDocumentsModal, {
          me: args.me,
          addPage: ctrl.addPage,
          triggerRecentDocs: ctrl.triggerRecentDocs
        }) : ""),
        (ctrl.startActivity ? m.component(StartActivityModal, {
          me: args.me,
          activity: ctrl.startActivity,
          classrooms: args.classrooms,
          cancelStartActivity: function () {
            ctrl.startActivity = null;
          }
        }) : ""),

        m('.main-menu-section.bg-color-white', {
            /*style: args.sessions().filter(function(session) {
              return session.endTime === null;
            }).length === 0 ? "" : "display: none"*/
          },
          m('.main-menu-header.primary-color-blue.text-color-secondary', {
              onclick: function () {
                args.showMenus.activities = ctrl.showBody = !ctrl.showBody;
              }
            },
            m.trust((ctrl.showBody ? "&#9660; Activities" : "&#9658; Activities")),
            m('span.glyphicon.glyphicon-plus.pull-right', {
              style: (ctrl.showBody ? "" : "display: none"),
              onclick: function (e) {
                // TODO create activity modal
                ctrl.editingActivity = m.prop(new Activity(null, args.me().id));
                ctrl.creating = true;
                e.stopPropagation();
              }

            })
          ),
          m('.main-menu-body', {
              style: (ctrl.showBody ? "overflow: auto" : "display: none")
            },
            m(".list-group",
              ctrl.activities().length ? "" : m(".list-group-item", {
                style: "color: gray; text-align: center"
              }, "(no activities)"),
              ctrl.activities().map(function (activity) {
                if (ctrl.deleteActivityPromptId == activity.id) {
                  return m(".list-group-item", {
                      onclick: function (e) {
                        e.stopPropagation();
                      }
                    },
                    m("p", "Delete activity?",
                      m("button.btn.btn-danger", {
                          onclick: function () {
                            // Delete activity and then refresh activity list
                            activity.delete();
                            Activity.list().then(ctrl.activities).then(function () {
                              m.redraw(true);
                            });
                          }
                        },
                        "Delete"),
                      m("button.btn.btn-default", {
                          onclick: function (e) {
                            // Close prompt
                            ctrl.deleteActivityPromptId = null;
                          }
                        },
                        "Cancel")
                    )
                  );
                } else {
                  return m(".list-group-item.activity",
                    m(".list-group-heading", {
                        onclick: function () {
                          //ctrl.editingActivity = Object.assign(new Activity(activity.title, activity.owner), JSON.parse(JSON.stringify(activity)));
                          // Gets all pages for activity
                          ctrl.creating = false;
                          ctrl.editingActivity = Activity.get(activity.id);
                          //console.log(ctrl.editingActivity);
                          //console.log(args.activities()[0]);
                        }
                      },
                      //m("span.glyphicon.glyphicon-remove.pull-right", {
                      m("a.session-link.pull-right", {
                        style: "color: gray",
                        onclick: function (e) {
                          ctrl.deleteActivityPromptId = activity.id;
                          e.stopPropagation();
                        }
                      }, m.trust("&laquo;Delete&raquo;")),
                      //m("span.glyphicon.glyphicon-edit.pull-right", {
                      m("a.session-link.pull-right", {
                        style: "color: gray",
                        onclick: function (e) {
                          // TODO go to activity editor page
                          // pulls up modal
                          ctrl.creating = false;
                          ctrl.editingActivity = Activity.get(activity.id);
                          //ctrl.editingActivity = Object.assign(new Activity(activity.title, activity.owner), JSON.parse(JSON.stringify(activity)));
                          e.stopPropagation();
                        }
                      }, m.trust("&laquo;Edit&raquo;")),
                      activity.title,
                      //m("span.glyphicon.glyphicon-play-circle.pull-right", {
                      m("a.session-link.pull-right", {
                        style: "color: gray",
                        onclick: function (e) {
                          // TODO start activity modal -- choose class and end time?
                          ctrl.startActivity = activity;
                          e.stopPropagation();
                        }
                      }, m.trust("&laquo;Start a session&raquo;"))
                    ) // heading
                  );
                } // if
              })
            )
          )
        )
      );
    }
  };

  var StartActivityModal = {
    controller: function (args) {
      var timeNow = new Date();
      var hour = timeNow.getHours();
      if (timeNow.getMinutes() >= 30)
        hour++;
      var day = timeNow.getDate();
      var month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][timeNow.getMonth()];

      var datestring = "" + day + " " + month + " " + hour + ":00";

      var ctrl = {
        title: "Start a session using " + args.activity.title,
        doneButtonLabel: "Start",
        activity: args.activity,
        //sessionTitle: "New session - " + args.activity.title,
        sessionTitle: args.activity.title + " - " + datestring,
        showEndTime: false,
        // TODO hour and a half?
        scheduledEndTime: Date.now() + 60000,
        classroom: null,
      };

      console.log(ctrl.scheduledEndTime);
      return ctrl;
    },
    view: function (ctrl, args) {
      return m(".modal.fade#start-activity-modal", {
          config: function (el) {
            $("#start-activity-modal").modal({
              backdrop: "static"
            });
            $("#start-activity-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", ctrl.title)
          ),
          m(".modal-body",
            // TODO include document first page previews?
            m("form",
              m(".form-group", {
                  style: "display: block"
                },
                m("label", "Session name"),
                m("input.form-control", {
                  value: ctrl.sessionTitle,
                  onchange: function (e) {
                    ctrl.sessionTitle = e.target.value;
                  }
                }),
                m("label", "Classroom"),
                m("select.form-control", {
                    value: ctrl.classroom,
                    onchange: function (e) {
                      ctrl.classroom = e.target.value;
                    }
                  },
                  m("option", ""),
                  args.classrooms().map(function (classroom) {
                    return m("option", {
                      value: classroom.id
                    }, classroom.title);
                  })
                )

                /*
                  m("input[type=checkbox]#showTimeCheckBox", {
                    value: ctrl.showEndTime,
                    onchange: function(e) {
                        ctrl.showEndTime = e.target.checked;
                    },
                  }),
                  m("label[for=showTimeCheckbox]", "Automatically end session when class is over"),
                  m("label[for=timeInput]", {
                      style: (ctrl.showEndTime ? "display: block" : "display: none")},
                      "Class end time"
                  ),
                  m("input[type=time].form-control#timeInput", {
                      style: (ctrl.showEndTime ? "display: block" : "display: none"),
                      value: (new Date(ctrl.scheduledEndTime)).toTimeString().slice(0, 5),
                      onchange: function(e) {
                        //console.log(e);
                        ctrl.scheduledEndTime = e.target.valueAsDate.getTime();
                      }
                  }),*/
              )
            )
          ),
          m(".modal-footer",
            m("button.btn.btn-default", {
              onclick: function (e) {
                args.cancelStartActivity();
              },
              "data-dismiss": "modal"
            }, "Cancel"),
            m("button.btn.btn-primary", {
              onclick: function () {
                var newClassroomSession = new ClassroomSession();
                newClassroomSession.title = ctrl.sessionTitle;
                newClassroomSession.classroom = ctrl.classroom;
                //newClassroomSession.metadata = {pdf: filename.data, app: "whiteboard"};
                newClassroomSession.metadata = {
                  app: "whiteboard"
                };
                newClassroomSession.activityId = ctrl.activity.id;
                // Close modal, save, and go to the visualizations page
                args.cancelStartActivity();
                newClassroomSession.save().then(function () {
                  m.request({
                      method: "GET",
                      url: "/api/v1/prompts/newsession/" + newClassroomSession.id
                    })
                    .then(function (result) {
                      m.route("/visualize/" + newClassroomSession.id);
                    });
                  // m.route("/visualize/" + newClassroomSession.id);
                });

              },
              "data-dismiss": "modal"
            }, ctrl.doneButtonLabel)
          )
        )
      );
    }
  };

  var ActivitiesEditModal = {
    controller: function (args) {
      var ctrl = {
        notOwner: args.activity.owner !== args.me().id,
        activity: args.activity,
      };

      if (args.creating) {
        ctrl.title = "Create activity";
        ctrl.doneButtonLabel = "Create";
      } else {
        ctrl.title = "Edit activity";
        ctrl.doneButtonLabel = "Save";
      }

      return ctrl;
    },
    view: function (ctrl, args) {
      return m(".modal.fade#activity-edit-modal", {
          config: function (el) {
            $("#activity-edit-modal").modal({
              backdrop: "static"
            });
            $("#activity-edit-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", ctrl.title)
          ),
          m(".modal-body",
            m("form",
              m(".form-group",
                m("label.control-label[for=activity-modal-title]", "Title"),
                m("div",
                  m("input.input-sm.form-control#activity-modal-title", {
                    value: (ctrl.activity().title != null) ? ctrl.activity().title : "Untitled",
                    oninput: function (el) {
                      ctrl.activity().title = el.target.value;
                    }
                  })
                )
              ),
              m("label", {
                style: "display: block"
              }, "Pages"),
              // TODO list of documents
              m(".list-group",
                (ctrl.activity().pages) ?
                (ctrl.activity().pages.map(function (page, idx) {
                  return m(".list-group-item",
                    page.originalFilename,
                    m("span.glyphicon.glyphicon-remove.pull-right", {
                      onclick: function () {
                        // If clicked, remove the page from the activity
                        ctrl.activity().pages.splice(idx, 1);
                      }
                    }),
                    m("input[type=checkbox].pull-right", {
                      id: "FBD" + page.id,
                      checked: page.metadata && page.metadata.hasFBD,
                      onclick: function (e) {
                        page.metadata = page.metadata || {};
                        page.metadata.hasFBD = !(page.metadata.hasFBD);
                      },
                      style: "margin-right: 2em"
                    }),
                    m("label[for=FBD" + page.id + "].pull-right", {
                        style: "padding-right: 0.5em"
                      },
                      "FBD tools"
                    )


                  );
                })) : "",
                m(".btn.btn-default", {
                    style: "display: block",
                    onclick: function () {
                      args.triggerRecentDocs(true);
                    }
                  },
                  "Add page")
              )
            )
          ),
          m(".modal-footer",
            m("button.btn.btn-danger.pull-left", {
              onclick: args.triggerDelete,
              style: (typeof ctrl.activity.id === "undefined" || ctrl.notOwner ? "display: none;" : ""),
            }, "Delete"),
            m("button.btn.btn-default", {
              onclick: function (e) {
                args.endEdit();
              },
              "data-dismiss": "modal"
            }, "Cancel"),
            m("button.btn.btn-primary", {
              onclick: function () {
                ctrl.activity().save().then(function () {
                  args.endEdit(true);
                });
              },
              "data-dismiss": "modal"
            }, ctrl.doneButtonLabel)
          )
        )
      );
    }
  };


  var RecentDocumentsModal = {
    controller: function (args) {
      var ctrl = {
        newUploadFile: null,
        selectedPage: null,
        pages: m.prop([])
      };

      ActivityPage.getByOwner(args.me().id).then(function (pages) {
        ctrl.pages(pages);
        //console.log(ctrl.pages());
        m.redraw();
      });

      return ctrl;
    },
    view: function (ctrl, args) {
      return m(".modal.fade#recent-documents-modal", {
          config: function (el) {
            $("#recent-documents-modal").modal({
              backdrop: "static"
            });
            $("#recent-documents-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", "Recent documents")
          ),
          m(".modal-body",
            // Hidden file upload thing
            m("input[type=file]", {
              style: "display: none",
              onchange: function (e) {
                //console.log(e);
                ctrl.newUploadFile = e.target.files[0];
                if (ctrl.newUploadFile) {
                  // Upload file and then add to the list of recent documents.
                  File.upload(ctrl.newUploadFile).then(function (file) {
                    ctrl.pages().push(file);
                    ctrl.selectedPage = file;
                    args.addPage(ctrl.selectedPage);
                    args.triggerRecentDocs(false);
                    $('#recent-documents-modal').modal('hide');
                    return file;
                  });
                }
              }
            }, ""),
            (ctrl.pages() ?
              m(".list-group",
                ctrl.pages().map(function (page) {
                  var selected = (ctrl.selectedPage && ctrl.selectedPage.id == page.id) ? ".active" : "";
                  return m(".list-group-item" + selected, {
                      onclick: function () {
                        ctrl.selectedPage = page;
                        m.redraw();
                      }
                    },
                    page.originalFilename
                  );
                })
              ) :
              "No recent documents")
          ),
          m(".modal-footer",
            m("button.btn.btn-default.pull-left", {
              onclick: function () {
                // Show choose file dialog
                $('input[type=file]').click();
              }
            }, "Upload new document..."),
            m("button.btn.btn-default", {
              onclick: function (e) {
                args.triggerRecentDocs(false);
              },
              "data-dismiss": "modal"
            }, "Cancel"),
            m("button.btn.btn-primary", {
              onclick: function () {
                args.addPage(ctrl.selectedPage);
                args.triggerRecentDocs(false);
              },
              "data-dismiss": "modal"
            }, "Add")
          )
        )
      );
    }
  };

  var ActivitiesDeleteModal = {
    view: function (ctrl, args) {
      return m(".modal.fade#activity-delete-modal", {
          config: function () {
            $("#activity-delete-modal").modal({
              backdrop: "static"
            });
            $("#activity-delete-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", "Delete activity?")
          ),
          m(".modal-body",
            "Are you sure you want to delete this activity? This cannot be undone."
          ),
          m(".modal-footer",
            m("button.btn.btn-default", {
              onclick: args.endDelete.bind(null, false),
            }, "Cancel"),
            m("button.btn.btn-danger", {
              "data-dismiss": "modal",
              onclick: function () {
                args.activity.delete().then(function () {
                  args.endDelete(true);
                  m.redraw();
                });
              }
            }, "Delete!")
          )
        )
      );
    }
  };




  m.route.mode = "hash";
  m.route(document.body, "/", {
    "/": m.component(Shell, Menu),
    "/classroom/:classroomId": m.component(Shell, GroupEditor),
    "/session/:sessionId": m.component(Shell, GroupEditor),
    "/visualize/:sessionId": m.component(Shell, DataVis),
  });
});
