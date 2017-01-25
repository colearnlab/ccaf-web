define('main', ["exports", "mithril", "jquery", "underscore", "bootstrap"], function(exports, m, $, _) {
  var Shell = {
    view: function(__, component) {
      return m("div.container#main",
        m.component(component)
      );
    }
  };

  var Menu = {
    view: function(ctrl, args) {
      return m("div",
        m(".row",
            m.component(ClassroomsMenu, args)
        )
      );
    }
  };

  var ClassroomsMenu = {
    'view': function(ctrl, args) {
      return m('.panel.panel-default.menu-holder',
        m('.panel-heading',
          m('.panel-title', "Classes",
            m('span.glyphicon.glyphicon-plus.pull-right', {
              'onclick': function() {
                $('#create-class-modal').modal('show');
              }
            })
          )
        ),
        m('.panel-body.menu-body-holder'
        )
      );
    }
  };

  m.route.mode = "hash";
  m.route(document.body, "/", {
    "/": m.component(Shell, Menu),
  });
});
