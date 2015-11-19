define(['exports', 'mithril', 'interact', 'underscore'], function(exports, m, interact, _) {    
  exports.view = function(ctrl, args) {
    return m('.container',
      m('.row',
        m('h1.col-md-12', 'ccaf-playground')
      ),
      m('.row', {
        'style': 'height: 80vh',
        },
        m.component(sidebar, args),
        m.component(overhead, args)
      )
    );
  };
  
  var sidebar = {
    'controller': function(args) {
      return {
        'tab': m.prop(0)
      };
    },
    'view': function(ctrl, args) {
      var tabs = [
        ["Apps", apps],
        ["Users", users],
        ["Content", content]
      ];
      
      return m('.col-xs-3.col-sm-3.col-md-3.stretch',
        m('ul.nav.nav-tabs',
          tabs.map(function(tab, i) { return m(ctrl.tab() == i ? 'li.active' : 'li', {'onclick': ctrl.tab.bind(this, i)},  m('a', tab[0])); })
        ),
        m('.tab-content.stretch',
          m('.tab-pane.active.stretch',
            m('.panel.panel-default.stretch.menu',
              tabs.filter(function(tab, i) { return ctrl.tab() === i; }).map(function(tab) { return m.component(tab[1], args); })
            )
          )
        )
      );
    }
  };
  
  
  var overhead = {
    'view': function(ctrl, args) {
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
    }
  };
  
  var apps = {
    'view': function(ctrl, args) {
      var store = args.store;
      return m('div.list-group', Object.keys(store.apps).map(function(app) {
          return m('a.list-group-item.createIcon', {
            'config': function(el) {
              el.icon = '/apps/' + app + '/' + store.apps[app].icon;
              el.title = '';
              el.create = function() {
                store.sendAction('create-app-instance', app, el.childComponent);
              }
            }
          }, m('img', {height: '32px', src: '/apps/' + app + '/' + store.apps[app].icon}), ' ' + store.apps[app].title);
        })
      );
    }
  };
  
  var createIcon = {
    'view': function(_, args) {
      return m('span', m('img', {'style': 'width: 64px; display: block; margin: 0 auto;', 'src': args.icon}), args.title ? args.title : '');
    }
  };
  
  var movableIcon = {
    'view': function(ctrl, args) {
      return m('div.movableIcon', {
        'config': function(el) {
            var overhead = document.getElementById('overhead');
            var x = args.x * overhead.offsetWidth;
            var y = args.y * overhead.offsetHeight;
            el.setAttribute('data-x', x);
            el.setAttribute('data-y', y);
            el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
            el.move = function(el) { args.move(el) };
            el.del = args.del;
          },
       }, m('img', {'src': args.icon, 'style': 'display: block; margin: 0 auto;'}), args.title
      );
    }
  };
  
  var appInstance = {
    'view': function(ctrl, args) {
      var store = args.store;
      return m('span.instance', m.component(movableIcon, _.extend(_.clone(args), {
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
      return m('span.instance', m.component(movableIcon, _.extend(_.clone(args), {
        'icon': '/media/user.png',
        'title': args.classroom.users[args.instance.id].name,
        'x': args.instance.x,
        'y': args.instance.y,
        'move': function(el) {
          args.instance.sendAction('set-coords', el);
        },
        'del': function() {
          args.configuration.users.sendAction('delete-user-instance', args.id);
        }
      })));
    }
  };
  
  var users = {
    'view': function(ctrl, args) {
      var store = args.store;
      return m('div.list-group', Object.keys(args.classroom.users).map(function(user) {
        var dim =_.values(args.configuration.users).some(function(u) { return u.id === user});
        return m('a.list-group-item' + (dim ? '.dim' : '.createIcon'), {
          'config': function(el) {
            el.icon = '/media/user.png';
            el.title = args.classroom.users[user].name;
            el.create = function() {
              store.sendAction('create-user-instance', user, el.childComponent);
            }
          }}, m.trust(' ' + (dim ? '&#x2714; ' : '')), m('img', {height: '32px', src: '/media/user.png'}), args.classroom.users[user].name);
        })
      );
    }
  };
  
  var content = {
    'view': function(ctrl, args) {
      return m('div', 'content');
    }
  };
  
  interact('.createIcon')
    .draggable({
      'onstart': function(event) {
        var el = document.createElement('div');
        var rect = document.getElementById('overhead').getBoundingClientRect();
        el.setAttribute('data-x', event.pageX - 64 - rect.left);
        el.setAttribute('data-y', event.pageY - 64 - rect.top);
        
        m.render(el, m.component(createIcon, {'icon': event.target.icon, 'title': event.target.title}));
        
        el.classList.add('createdIcon');
        document.getElementById('overhead').appendChild(el);
        event.target.childComponent = el;
      },
      'onmove': function(event) {
        var target = event.target.childComponent;
        var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        target.style.transform =
          'translate(' + x + 'px, ' + y + 'px)';

        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
      },
      'onend': function(event) {
        if (isInWell(event.target.childComponent))
          event.target.create();
        
        event.target.childComponent.parentNode.removeChild(event.target.childComponent);
        event.target.childComponent = null;
      }
    });

    interact('.movableIcon')
      .draggable({
        'onmove': function(event) {
          var target = event.target;
          var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
          
          target.setAttribute('data-x', x);
          target.setAttribute('data-y', y);
          
          target.style.opacity = isInWell(target) ? 1 : 0.5;
          
          target.move(target);
        },
        'onend': function(event) {
          var target = event.target;
          target.style.opacity = 1;
          if (!isInWell(target))
            event.target.del();
        }
      });
  
  function isInWell(el) {
    var overhead = document.getElementById('overhead');
    if (!overhead)
      return;
      
    var outerRect = overhead.getBoundingClientRect();
    var innerRect = el.getBoundingClientRect();
    
    return innerRect.top >= outerRect.top && innerRect.bottom <= outerRect.bottom && innerRect.left + 32 >= outerRect.left && innerRect.right - 32 <= outerRect.right;
  };
});