define(["exports", "mithril", "css", "models", "bootstrap", "typeahead"], function(exports, m, css, models) {
  var User = models.User;

  /* args
   * userList: an array of users represented in the picker
   * type: the type of user to add if not in system, one of "administrator", "teacher", "student" or undefined to prevent adding
   * restrictTo: an array of the type of users that can be added
   */
  exports.userPicker = {
    controller: function(args) {
      var restrictFilter = function(userList) {
          return userList.filter(function(el) {
            return args.restrictTo.includes(User.typeNames[el.type]);
          });
      };
      return {
        currentUser: "",
        classroom: args.classroom,
        currentUsers: (function() {
            var userList = args.classroom.users();
            if(userList.then)
                return userList.then(restrictFilter);
            else
                return m.prop([]);
        })(),
        availableUsers: User.list().then(restrictFilter),
        restrictFilter: restrictFilter,
      };
    },
    view: function(ctrl, args) {
      var submit;
      return m("div", {
          config: function() {
            css.load("/shared/userPicker.css");

          }
        },
        m.component(CannotAddUserModal),
        m(".user-listing",
          ctrl.currentUsers().map(function(user) {
              return m("div", {
                  style: "background-color: " + (user.name.length === 0 ? "lightgray" : "lightblue")
                },
                (user.name.length !== 0 ? user.name + " " : "") + "<" + user.email + ">", " ",
                m("span.glyphicon.glyphicon-remove", {
                    style: "color: darkslategray; font-size: 8pt",
                    onclick: function() {
                      User.get(user.id).then(function(user) {
                        user.removeClassroom(ctrl.classroom.id).then(function() {
                          ctrl.currentUser = "";
                          ctrl.classroom.users().then(ctrl.restrictFilter).then(ctrl.currentUsers).then(function() {
                            m.redraw(true);
                          });
                        });
                      });
                    }
                  }
                )
              );
            })
        ),
        m(".user-entry",
          m("form",
            m(".input-group",
              m("input.input-sm.form-control", {
                value: ctrl.currentUser,
                config: function(el) {
                  $(el).typeahead({
                    source: ctrl.availableUsers(),
                    displayText: function(user) {
                      return (user.name.length !== 0 ? user.name : "") + " <" + user.email + ">";
                    },
                    afterSelect: function(user) {
                      ctrl.currentUser = user.email;
                      submit.click();
                    }
                  });
                },
                oninput: function(e) {
                  ctrl.currentUser = e.target.value;
                }
              }),
              m("span.input-group-btn",
                m("button.btn.btn-sm.btn-default", {
                  disabled: ctrl.currentUser.length === 0,
                  config: function(el) {
                    submit = el;
                  },
                  onclick: function(e) {
                    ctrl.currentUser = ctrl.currentUser.toLowerCase();


                    var userIdx = ctrl.availableUsers().map(function(user) {
                      return user.email;
                    }).indexOf(ctrl.currentUser);

                    if (userIdx < 0 && typeof args.type === "undefined") {
                      $("#cannot-add-user-restricted-modal").modal("show");
                    } else {
                      m.startComputation();

                      var userId = ctrl.availableUsers()[userIdx].id;
                      User.get(userId).then(function(user) {
                        user.addClassroom(ctrl.classroom.id).then(function() {
                          ctrl.currentUser = "";
                          ctrl.classroom.users().then(ctrl.restrictFilter).then(ctrl.currentUsers).then(function() {
                            m.redraw(true);
                          });
                        });
                      });
                    }

                    e.preventDefault();
                    return false;
                  }
                }, "Add")
              )
            )
          )
        )
      );
    }
  };

  var CannotAddUserModal = {
    view: function() {
      return m("div",
        m(".modal.fade#cannot-add-user-restricted-modal",
          m(".modal-content.col-xs-offset-3.col-sm-offset-3.col-md-offset-3.col-xs-6.col-sm-6.col-md-6",
            m(".modal-header",
              m("h4.modal-title", "Cannot add user")
            ),
            m(".modal-body", "A user with that email address is not in the system and cannot be added by you."),
            m(".modal-footer",
              m("button.btn.btn-default", {
                  onclick: function(e) {
                    $("#cannot-add-user-restricted-modal").modal("hide");
                    e.preventDefault();
                    return false;
                  }
                }, "Dismiss"
              )
            )
          )
        ),
        m(".modal.fade#cannot-add-user-type-modal",
          m(".modal-content.col-xs-offset-3.col-sm-offset-3.col-md-offset-3.col-xs-6.col-sm-6.col-md-6",
            m(".modal-header",
              m("h4.modal-title", "Cannot add user")
            ),
            m(".modal-body", "A user with that email address is in the system, but is not the correct type."),
            m(".modal-footer",
              m("button.btn.btn-default", {
                  onclick: function(e) {
                    $("#cannot-add-user-type-modal").modal("hide");
                    e.preventDefault();
                    return false;
                  }
                }, "Dismiss"
              )
            )
          )
        )
      );
    }
  };
});
