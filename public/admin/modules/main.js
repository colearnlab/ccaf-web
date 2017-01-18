define("main", ["exports", "mithril", "jquery", "underscore"], function(exports, m, $, _) {
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
        m("td", user.name),
        m.component(EditBox, {editing: ctrl.editInitial, type: args.user.type, key: "email", value: user.email, url: "/api/v1/users", _id: user._id}),
        m("td", user.type.charAt(0).toUpperCase() + user.type.slice(1))
      )
    }
  };

  // The edit box allows us to change record fields via the API.
  // args: _id, key, value, url (ie API endpoint).
  var EditBox = {
    controller: function(args) {
      var ctrl = {
        _id: args._id,
        editing: args.editing || false, // Whether the value is currently being edited.
        value: args.value, // The value that can be edited.
        timeout: null, // The id to the timeout such that 750ms of inactivity will trigger a save.
        success: false // If this is true, display the "success" checkmark to indicate saving has worked.
      };

      // The save function takes the value input by the user and crafts a post
      // request to update the record.
      ctrl.save = function() {
          // The data to be sent consists of the updated field and the id of the record (if it exists).
          var data = {
            _id: ctrl._id,
            type: args.type
          };
          data[args.key] = ctrl.value;

          $.post({
            url: args.url,
            data: data,
            success: function(newData) {
              console.log(newData);
              ctrl._id = newData.data._id;

              if (!ctrl.editing)
                return;
              // This dance is simple: set the success checkmark flag and force
              // it to be rendered; then create a timeout to take the flag away
              // in 1.5s and start the computation process again to ensure that
              // change is reflected as well.
              ctrl.success = true;
              m.redraw();
              setTimeout(function() {
                ctrl.success = false;
                m.redraw();
              }, 1500);
            },
            error: function() {
              alert("Could not save. Refresh the page and try again.")
            }
          });
        };
        return ctrl;
    },
    view: function(ctrl, args) {
      if (!ctrl.editing)
        return m("td#edit-box-static", {
          onclick: function() {
            ctrl.editing = true;
          }
        }, ctrl.value);

      return m("td.form-group.form-inline.has-feedback",
        m("input.form-control.input-sm", {
          value: ctrl.value,
          onkeyup: function(e) {
            ctrl.value = e.target.value;
            if (ctrl.timeout !== null)
              clearTimeout(ctrl.timeout);

            if (e.keyCode === 13) {
              ctrl.editing = false;
            } else {
              ctrl.timeout = setTimeout(ctrl.save.bind(null, ctrl.value), 1000);
            }
          },
          onblur: function(e) {
            ctrl.editing = false;
            if (ctrl.timeout !== null)
              clearTimeout(ctrl.timeout);

            ctrl.save(ctrl.value);
          },
          config: function(el) {
            el.focus();
          }
        }),
        m("span.glyphicon.glyphicon-ok.form-control-feedback.edit-box-feedback.edit-box-feedback-" + (ctrl.success ? "on" : "off"))
      );
    }
  }

  var UserListing = {
    controller: function(args) {
      return {
        newUser: null,
        users: User.list(args.type)
      };
    },
    view: function(ctrl, args) {
      return m("div",
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
              return m.component(UserRow, {user: user});
            }),
            (
              ctrl.newUser ? m.component(UserRow, {editInitial: true, user: ctrl.newUser}) : ''
            ),
            m("tr",
              m("td[colspan=3].user-listing-add-user", m("a", {
                onclick: function() {
                  ctrl.newUser = new User("New person", "", args.type);
                }
              },
              "Click to add"))
            )
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
  })
});
