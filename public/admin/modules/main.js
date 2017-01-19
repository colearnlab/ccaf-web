define("main", ["exports", "mithril", "jquery", "underscore", "bootstrap"], function(exports, m, $, _) {
  // The main component has a sidebar and a place to display content.
  var Shell = {
    controller: function(args) {
      return {
        links: {
          "administrators": "Manage administrators",
          "teachers": "Manage teachers"
        }
      }
    },
    view: function(ctrl, component) {
      return m("div.container#main",
        m("row",
          m("div.col-sm-4.col-md-3",
            m("ul.nav.nav-pills.nav-stacked",
              // Take the mapping of links; turn them into pairs; turn each pair into a list item
              // with an anchor to the key and the text of the value.
              _.pairs(ctrl.links).map(function(pair) { return m("li" + (location.hash.slice(2) === pair[0] ? ".active" : ""), m("a[href=#/" + pair[0] + "]", pair[1])); })
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
      return m("div", "Select an option on the right")
    }
  }

  // User methods.
  var User = function User(name, email, type){
    this.name = name;
    this.email = email;
    this.type = type;
  }

  // Return a list of all users of a certain type.
  User.list = function(type) {
    return m.request({method: "GET", url: "/api/v1/users"}).then(function(users) {
      if (typeof type === "undefined")
        return users.data;
      else
        return users.data.filter(function(user) { return user.type === type });
    })
  };

  var UserRow = {
    controller: function(args) {
      return {
        editInitial: args.editInitial
      };
    },
    view: function(ctrl, args) {
      var user = args.user;
      return m("tr",
        m("td", m("a", {
          onclick: args.triggerEdit
        },
        user.name)),
        m("td", user.email),
        m("td", user.type.charAt(0).toUpperCase() + user.type.slice(1))
      )
    }
  };

  var UserListing = {
    controller: function(args) {
      return {
        users: User.list(args.type),
        editingUser: null
      };
    },
    view: function(ctrl, args) {
      var userEditModal = m.component(UserEditModal);
      return m("div",
        (ctrl.editingUser ? m.component(UserEditModal, {
            user: ctrl.editingUser,
            endEdit: function() {
              ctrl.users = User.list(args.type);
              ctrl.editingUser = null;
              m.endComputation();
            }
          }) : ""),
        m("table.table.table-striped.user-listing",
          m("thead",
            m("tr",
              m("th", "Name"),
              m("th", "Email"),
              m("th", "User type")
            )
          ),
          m("tbody",
            (ctrl.users() || []).map(function(user) {
              return m.component(UserRow, {
                user: user,
                triggerEdit: function() {
                  ctrl.editingUser = user;
                }
              });
            }),
            m("tr",
              m("td[colspan=3].user-listing-add-user", m("a", {
                onclick: function() {
                  ctrl.editingUser = {};
                }
              },
              "Click to add"))
            )
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
    'view': function(ctrl, args) {
      var submit = function() {
        ctrl.saving = true;
        m.startComputation();
        $.post({
          url: "/api/v1/users",
          data: ctrl.user,
          success: function() {
            $("#user-edit-modal").modal("hide");
            args.endEdit();
          },
          error: function(jqxhr) {
            if (jqxhr.status == 400) {
              ctrl.saving = false;
              ctrl.warnEmail = true;
            } else if (jqxhr.status == 401) {
              alert("Authentication error: you have probably been logged out. Refresh the page to try again.");
            } else {
              alert("Server error. Try your request again later.")
            }
            m.endComputation();
          }
        })
      };
      return m('.modal.fade#user-edit-modal', {
          config: function() {
            $("#user-edit-modal").modal({
              backdrop: "static"
            });
            $("#user-edit-modal").modal("show");
          }
        },
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Edit user")
          ),
          m('.modal-body',
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
                m(".alert.alert-warning", {
                  style: (ctrl.warnEmail ? "" : "display: none;")
                },
                  "There is already a user with this email address."
                ),
                m("div.col-md-10",
                  m("input.form-control#user-modal-email", {
                    value: ctrl.user.email,
                    oninput: function(el) {
                      ctrl.user.email = el.target.value;
                    }
                  })
                )
              ),
              m(".form-group",
                m("label.col-md-2.control-label[for=user-modal-type]", "User Type"),
                m("div.col-md-10",
                  m("input.form-control#user-modal-type", {
                    value: ctrl.user.type,
                    oninput: function(el) {
                      ctrl.user.type = el.target.value;
                    }
                  })
                )
              ),
              m("input[type=submit]", {
                style: "display: none"
              })
            )
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              disabled: ctrl.saving,
              'data-dismiss': 'modal'
            }, "Cancel"),
            m('button.btn.btn-primary', {
              disabled: ctrl.saving,
              onclick: submit
            }, "Save")
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
