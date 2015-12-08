define(['exports', 'mithril', 'interact', 'underscore'], function(exports, m, interact, _) {
  exports.view = function(ctrl, args) {
    var store = args.store;
    return m('.col-xs-9.col-sm-9.col-md-9.stretch',
      m('.well.stretch#overhead', 
        _.pairs(args.configuration.apps)
          .map(function(pair) {
            return m.component(appInstance, _.extend(_.clone(args), {'id': pair[0], 'instance': pair[1]}));              
          }),
        _.pairs(args.configuration.users)
          .map(function(pair) {
            return m.component(userInstance, _.extend(_.clone(args), {'id': pair[0], 'instance': pair[1]}));              
          })
      )
    );
  };
  
  var icon = {
    'view': function(ctrl, args) {
      return m('div.icon', {
        'config': function(el) {
            var overhead = document.getElementById('overhead');
            var x = args.x * overhead.offsetWidth;
            var y = args.y * overhead.offsetHeight;
            el.setAttribute('data-x', x);
            el.setAttribute('data-y', y);
            el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
            el.move = function(el) { args.move(el) };
            el.del = args.del;
            el.assignAppInstanceId = args.assignAppInstanceId ? args.assignAppInstanceId : undefined;
            el.instanceId = args.id;
          },
       }, m('img', {'src': args.icon, 'style': 'display: block; margin: 0 auto;'}), args.title
      );
    }
  };
  
  var appInstance = {
    'view': function(ctrl, args) {
      var store = args.store;
      return m('span.appInstance', m.component(icon, _.extend(_.clone(args), {
        'icon': '/apps/' + args.instance.app + '/' + store.apps[args.instance.app].icon,
        'title': args.instance.title,
        'x': args.instance.x,
        'y': args.instance.y,
        'move': function(el) {
          args.instance.sendAction('set-coords', el);
        },
        'del': function() {
          args.configuration.apps.sendAction('delete-app-instance', args.id);
        }
      })));
    }
  };
  
  var userInstance = {
    'view': function(ctrl, args) {
      var store = args.store;
      return m('span.userInstance', m.component(icon, _.extend(_.clone(args), {
        'icon': '/media/user.png',
        'title': args.classroom.users[args.instance.id].name,
        'x': args.instance.x,
        'y': args.instance.y,
        'move': function(el) {
          args.instance.sendAction('set-coords', el);
        },
        'del': function() {
          args.configuration.users.sendAction('delete-user-instance', args.id);
        },
        'assignAppInstanceId': function(appInstanceId) {
          args.instance.sendAction('assign-user-instance', appInstanceId);
        }
      })));
    }
  };
});