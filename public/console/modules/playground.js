define(['exports', 'mithril', 'interact', 'underscore', './overhead'], function(exports, m, interact, _, overhead) {    
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
        }),
        m('a.list-group-item', 'Add student')
      );
    }
  };
  
  var content = {
    'view': function(ctrl, args) {
      return m('div', 'content');
    }
  };
  
  var createIcon = {
    'view': function(_, args) {
      return m('span', m('img', {'style': 'width: 64px; display: block; margin: 0 auto;', 'src': args.icon}), args.title ? args.title : '');
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

    interact('.icon')
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
  
  interact('.appInstance>div')
    .dropzone({
      'accept': '.userInstance>div',
      'overlap': 0.1,
      'ondragenter': function(e) {
        e.target.classList.add('drop-active');
      },
      'ondragleave': function(e) {
        e.target.classList.remove('drop-active');
      },
      'ondrop': function(e) {
        e.relatedTarget.assignAppInstanceId(e.target.instanceId);
        e.target.classList.remove('drop-active');
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