define("main", ["exports", "mithril", "jquery", "underscore", "models", "bootstrap"], function(exports, m, $, _, models) {
  var User = models.User;

  // The main component has a sidebar and a place to display content.
  var Shell = {
    controller: function(args) {
      return {
        links: {
          "administrators": "Manage administrators",
          "teachers": "Manage teachers",
          "students": "Manage students"
        }
      };
    },
    view: function(ctrl, component) {
      return m("div.container#main",
        m("row",
          m("div.col-sm-4.col-md-3",
            m("ul.nav.nav-pills.nav-stacked",
              m("li",
                  m("a", {
                      href: "/teacher"
                    }, "Teacher mode"
                  ),

                  m("a", {
                        href: "#/logs"
                    },
                    "Session logs"
                  )

              ),

              

              // Take the mapping of links; turn them into pairs; turn each pair into a list item
              // with an link to the key and the text of the value.
              _.pairs(ctrl.links).map(function(pair) {
                var hash = pair[0],
                    linkText = pair[1];

                // If this button refers to the active pane, mark as active.
                // We slice because m.route() returns with a leading slash.
                return m("li", {
                    class: (m.route().slice(1) === pair[0] ? "active" : "")
                  },
                  m("a", {
                      href: "#/" + hash
                    },
                    linkText
                  )
                );
              })
            )
          ),
          m("div.col-sm-8.col-md-9",
            m.component(component)
          )
        )
      );
    }
  };

  // A simple placeholder when you first visit the page.
  var Placeholder = {
    view: function(__, args) {
      return m("div", "Select an option.");
    }
  };

  var UserListing = {
    controller: function(args) {
      return {
        users: User.list().then(function(users) {
          return users.filter(function(user) {
            return user.type === args.type;
          });
        }),
        // editingUser is the user that is currently being edited. When a user
        // is selected to be edited this property is filled in.
        editingUser: null,
        // Similar to editingUser, when a user is selected to be deleted this
        // property is filled in.
        deletingUser: null
      };
    },
    view: function(ctrl, args) {
      return m("div",
        (ctrl.editingUser ? m.component(UserEditModal, {
                user: ctrl.editingUser,
                endEdit: function(reload) {
                  // When the modal is closed, reload the user list, clear the
                  // currently edited user, and end the asynchronous process
                  // to trigger a redraw.
                  if (reload)
                    User.list().then(function(users) {
                      return users.filter(function(user) {
                        return user.type === args.type;
                      });
                    }).then(ctrl.users).then(function() {
                      m.redraw(true);
                    });
                  ctrl.editingUser = null;
                }
              }
            )
          : ""),
        (ctrl.deletingUser ? m.component(UserDeleteModal, {
                user: ctrl.deletingUser,
                endDelete: function(reload) {
                  // Similar to endEdit.
                  if (reload)
                    User.list().then(function(users) {
                      return users.filter(function(user) {
                        return user.type === args.type;
                      });
                    }).then(ctrl.users).then(function() {
                      m.redraw(true);
                    });
                  ctrl.deletingUser = null;
                }
              }
            )
          : ""),
        m("table.table.table-striped.user-listing",
          m("thead",
            m("tr",
              m("th",
                "Name"
              ),
              m("th",
                "Email"
              ),
              m("th",
                "User type"
              )
            )
          ),
          m("tbody",
            ctrl.users().map(function(user) {
              // The user component is passed the user to display, as well
              // as functions it can call to trigger edit and delete modals.
              return m.component(UserRow, {
                user: user,
                lastUser: ctrl.users().length === 1,
                triggerEdit: function() {
                  ctrl.editingUser = user;
                },
                triggerDelete: function() {
                  ctrl.deletingUser = user;
                }
              });
            }),
            m("tr",
              m("td[colspan=3].user-listing-add-user",
                // To add a user, simply set the currently edited user property
                // to a new user.
                m("a", {
                    onclick: function() {
                      ctrl.editingUser = new User("", "", args.type);
                    }
                  },
                  "Click to add"
                )
              )
            )
          )
        )
      );
    }
  };

  // This is a row in the user table, with options to click a user"s name to
  // bring up an edit modal and to click a delete button to bring up a delete
  // modal. Since the logic for the edit and delete dialogs are in the parent
  // component, the parent component provides triggerEdit and triggerDelete
  // functions to allow this component to trigger an edit or delete.
  var UserRow = {
    view: function(ctrl, args) {
      return m("tr",
        m("td", m("a", {
            onclick: args.triggerEdit
          },
          args.user.name)
        ),
        m("td",
          m("a", {
              onclick: args.triggerEdit
            },
            args.user.email
          )
        ),
        m("td",
          User.prettyPrintTypes[args.user.type],
          m.trust("&nbsp;&nbsp;&nbsp;"),
          m("span.glyphicon.glyphicon-remove", {
              style: (args.lastUser && args.user.type == User.types.administrator ? "display: none;" : ""),
              onclick: args.triggerDelete
            }
          )
        )
      );
    }
  };

  var UserEditModal = {
    controller: function(args) {
      return {
        user: _.clone(args.user),
        warnEmail: false,
        saving: false
      };
    },
    view: function(ctrl, args) {
      var submit = function(e) {
        ctrl.saving = true;
        ctrl.user.save().then(function success() {
            $("#user-edit-modal").modal("hide");
          args.endEdit(true);
        }, function error() {
            ctrl.saving = false;
            ctrl.warnEmail = true;
            m.redraw(true);
        });

        e.preventDefault();
        return false;
      };
      return m(".modal.fade#user-edit-modal", {
          config: function() {
            $("#user-edit-modal").modal({
              backdrop: "static"
            });
            $("#user-edit-modal").modal("show");
          }
        },
        m(".modal-content.col-md-6.col-md-offset-3",
          m(".modal-header",
            m("h4.modal-title", "Edit user")
          ),
          m(".modal-body",
            m("form.form-horizontal", {
              onsubmit: submit
            },
              m(".form-group",
                m("label.col-md-2.control-label[for=user-modal-name]", "Name"),
                m("div.col-md-10",
                  m("input.form-control#user-modal-name", {
                    value: ctrl.user.name,
                    oninput: function(el) {
                      ctrl.user.name = el.target.value;
                    }
                  })
                )
              ),
              m(".form-group",
                m("label.col-md-2.control-label[for=user-modal-email]", "Email"),
                m("div.col-md-10",
                  m("input.form-control#user-modal-email", {
                    value: ctrl.user.email,
                    oninput: function(el) {
                      ctrl.user.email = el.target.value;
                    }
                  }),
                  m("div", {
                      style: (ctrl.warnEmail ? "" : "display: none;")
                    },
                    m("br"),
                    m(".alert.alert-warning",
                      "There is already a user with this email address."
                    )
                  )
                )
              ),
              m(".form-group",
                m("label.col-md-2.control-label[for=user-modal-type]", "User Type"),
                m("div.col-md-10",
                  m("select.form-control#user-modal-type", {
                      value: ctrl.user.type,
                      onchange: function(e) {
                        ctrl.user.type = e.target.value;
                      },
                      "disabled": typeof ctrl.user.id !== "undefined"
                    },
                    ["administrator", "teacher", "student"].map(function(type) {
                      return m("option", {
                        value: User.types[type]
                      }, type);
                    })
                  )
                )
              ),
              m("input[type=submit]", {
                style: "display: none"
              })
            )
          ),
          m(".modal-footer",
            m("button.btn.btn-default", {
              disabled: ctrl.saving,
              onclick: args.endEdit.bind(null, false),
              "data-dismiss": "modal"
            }, "Cancel"),
            m("button.btn.btn-primary", {
              disabled: ctrl.saving || ctrl.user.name.length === 0 || ctrl.user.email.length === 0,
              onclick: submit
            }, "Save")
          )
        )
      );
    }
  };

  var UserDeleteModal = {
    view: function(ctrl, args) {
      return m(".modal.fade#user-delete-modal", {
          config: function() {
            $("#user-delete-modal").modal({
              backdrop: "static"
            });
            $("#user-delete-modal").modal("show");
          }
        },
        m(".modal-content.col-md-6.col-md-offset-3",
          m(".modal-header",
            m("h4.modal-title", "Delete user?")
          ),
          m(".modal-body",
            "Are you sure you want to delete this user? All classrooms and activities belonging to this user will also be deleted. This cannot be undone."
          ),
          m(".modal-footer",
            m("button.btn.btn-default", {
              onclick: args.endDelete.bind(null, false),
              "data-dismiss": "modal"
            }, "Cancel"),
            m("button.btn.btn-danger", {
              "data-dismiss": "modal",
              onclick: function() {
                args.user.delete().then(function() {
                  args.endDelete(true);
                });
              }
            }, "Delete!")
          )
        )
      );
    }
  };

    var LogList = {
        controller: function(args) {
            var ctrl = {
                logInfo: m.prop([]),
                groups: m.prop({})
            };

            m.request({
                method: "GET",
                url: "/api/v1/logs"
            }).then(function(res) {
                ctrl.logInfo(res.data);  
            });

            m.request({
                method: "GET",
                url: "/api/v1/groups"
            }).then(function(res) {
                for(var i in res.data) {
                    ctrl.groups()[res.data[i].id] = res.data[i];
                }
            });

            return ctrl;
        },
        view: function(ctrl, args) {
            return m("table.table.table-striped", {

                },
                m("thead", 
                    m("tr",
                        m("th", "Session"),
                        m("th", "Group"),
                        m("th", "Duration"),
                        m("th", "File size"),
                        m("th", "")
                    ),
                ),
                m("tbody",
                    ctrl.logInfo() ?
                        ctrl.logInfo().map(function(logRow) {
                            var duration = logRow.endTime - logRow.startTime;
                            var days = Math.floor(duration / 1000 / 60 / 60 / 24);
                            duration -= days * 1000 * 60 * 60 * 24;
                            var hours = Math.floor(duration / 1000 / 60 / 60);
                            duration -= hours * 1000 * 60 * 60;
                            var minutes = Math.floor(duration / 1000 / 60);

                            var durationString = ""
                                + (days ? days + " day" + ((days == 1) ? " " : "s ") : "")
                                + (hours ? hours + " hour" + ((hours == 1) ? "" : "s") + " ": "")
                                + (minutes ? minutes + " minute" + ((minutes == 1) ? "" : "s") + " " : "");

                            var sizeString = "--";
                            if('size' in logRow) {
                                if(logRow.size > (1024 * 1024 * 1024))
                                    sizeString = "" + (Math.round(10 * logRow.size / 1024 / 1024 / 1024) / 10) + " GiB";
                                else if(logRow.size > (1024 * 1024))
                                    sizeString = "" + (Math.round(10 * logRow.size / 1024 / 1024) / 10) + " MiB";
                                else
                                    sizeString = "" + (Math.round(10 * logRow.size / 1024) / 10) + " KiB";
                            }

                            return m("tr",
                                m("td", logRow.title),
                                m("td", (ctrl.groups()[logRow.groupId] ? ctrl.groups()[logRow.groupId].title : "")),
                                m("td", durationString),
                                m("td", sizeString),
                                m("td", (('size' in logRow)
                                        ? m("a", {
                                                href: "/stores/" + logRow.storeId
                                            },
                                            "Download"
                                           )
                                        : "Log file missing")
                                )
                            );
                        })
                        : ""
                )
            );
        }
    };

  m.route.mode = "hash";
  m.route(document.body, "/", {
    "/": m.component(Shell, Placeholder),
    "/administrators": m.component(Shell, m.component(UserListing, {type: User.types.administrator})),
    "/teachers": m.component(Shell, m.component(UserListing, {type: User.types.teacher})),
    "/students": m.component(Shell, m.component(UserListing, {type: User.types.student})),
    "/logs": m.component(Shell, m.component(LogList, {}))
  });

});
