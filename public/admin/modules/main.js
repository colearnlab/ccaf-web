define("main", ["exports", "mithril", "jquery", "underscore", "models", "bootstrap"], function(exports, m, $, _, models) {
  var User = models.User;

  // The main component has a sidebar and a place to display content.
  var Shell = {
    controller: function(args) {
      return {
        links: {
          "administrators": "Manage administrators",
          "teachers": "Manage teachers"
        }
      };
    },
    view: function(ctrl, component) {
      return m("div.container#main",
        m("row",
          m("div.col-sm-4.col-md-3",
            m("ul.nav.nav-pills.nav-stacked",
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
        users: User.list(args.type),
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
                    ctrl.users = User.list(args.type);
                  ctrl.editingUser = null;
                  m.endComputation();
                }
              }
            )
          : ""),
        (ctrl.deletingUser ? m.component(UserDeleteModal, {
                user: ctrl.deletingUser,
                endDelete: function(reload) {
                  // Similar to endEdit.
                  if (reload)
                    ctrl.users = User.list(args.type);
                  ctrl.deletingUser = null;
                  m.endComputation();
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
                      ctrl.editingUser = new User(null, null, args.type);
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
          args.user.email
        ),
        m("td",
          args.user.type,
          m.trust("&nbsp;&nbsp;&nbsp;"),
          m("span.glyphicon.glyphicon-remove", {
              style: (args.lastUser && args.user.type == "administrator" ? "display: none;" : ""),
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
        m.startComputation();
        ctrl.user.save({
            success: function() {
              $("#user-edit-modal").modal("hide");
              args.endEdit(true);
            },
            error: function(jqxhr) {
              if (jqxhr.status == 400) {
                ctrl.saving = false;
                ctrl.warnEmail = true;
              } else if (jqxhr.status == 401) {
                alert("Authentication error: you have probably been logged out. Refresh the page to try again.");
              } else {
                alert("Server error. Try your request again later.");
              }
              m.endComputation();
            }
          }
        );
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
                      }
                    },
                    ["administrator", "teacher"].map(function(type) {
                      return m("option", {
                        onclick: function() {
                          ctrl.user.type = type;
                        }
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
                m.startComputation();
                args.user.delete({
                  success: function() {
                    $("#user-delete-modal").modal("hide");
                    args.endDelete(true);
                  },
                  error: function(jqxhr) {
                    if (jqxhr.status == 401) {
                      alert("Authentication error: you have probably been logged out. Refresh the page to try again.");
                    } else {
                      alert("Server error. Try your request again later.");
                    }
                    args.endDelete();
                  }
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
    "/": m.component(Shell, Placeholder),
    "/administrators": m.component(Shell, m.component(UserListing, {type: "administrator"})),
    "/teachers": m.component(Shell, m.component(UserListing, {type: "teacher"}))
  });

});
