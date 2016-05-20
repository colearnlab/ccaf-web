/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('stateVisualizer', ['exports', 'mithril', 'underscore'], function(exports, m, _) {
  var visualizer = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      var apps = args.store.apps;
      var instances = args.state.instances;
      var userInstanceMapping = args.state.userInstanceMapping;
      return (
        m('div#visualizer',
          m('div',
            m('div#cards',
              _.values(instances).map(function(instance) {
                return m.component(instanceCard, {'store': args.store, 'state': args.state, 'classroom': args.classroom, 'instance': instance});
              }),
              m.component(RoundButton, {'text': "+"})
            )
          )
        )
      );
    }
  };

  var appPalette = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      var apps = args.apps;
      var state = args.state;
      return (
        m('div.col-sm-2.col-md-2#appPalette',
          _.pairs(apps).map(function(app) {
            return (
              m('div.icon',
                {'onclick': function() {
                  state.sendAction('create-app-instance', app[0]);
                }},
                m('img', {
                  'src': 'apps/' + app[0] + '/' + app[1].icon
                }),
                m('div.appTitle', app[1].title)
              )
            );
          })
        )
      );
    }
  };

  var instanceCard = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      var id;
      _.pairs(args.state.instances).forEach(function(pair) {
        if (pair[1] === args.instance)
          id = pair[0];
      });

      return m('div.instance',
        args.instance.app,
        m('button', {
          'onclick': function() {
            if (typeof _.findKey(args.store.classrooms[args.classroom].projections, function(p) {return p.instanceId == id; } ) !== 'undefined')
              args.store.classrooms[args.classroom].sendAction('toggle-projection', id);
            args.state.sendAction('delete-app-instance', id);
          }
        }, "Delete"),
        m('button', {
          'onclick': function() {
            args.store.classrooms[args.classroom].sendAction('toggle-projection', id);
          }
        }, typeof _.findKey(args.store.classrooms[args.classroom].projections, function(p) {return p.instanceId == id; } ) !== 'undefined' ? "Unproject" : "Project"),
        m('ul',
          _.pairs(args.state.userInstanceMapping).filter(function(pair) {
            return pair[1] == id;
          }).map(function(pair) {
            return m('li', args.store.classrooms[args.classroom].users[pair[0]].name);
          }),
          m('li',
            m('select', {
              'onchange': function(e) {
                if (e.target.value === -1)
                  return;
                args.state.sendAction('associate-user-to-instance', e.target.value, id);
                e.target.value = -1;
              }
            },
              m('option', {'value': -1}, '--'),
              _.values(args.store.classrooms[args.classroom].users).map(function(user) {
                return m('option', {'value': user.id}, user.name);
              })
            )
          )
        )
      );
    }
  };

  var RoundButton = {
    'view': function(ctrl, args) {
      return m('div.roundButton#addInstanceButton', args.text);
    }
  };

  exports.display = function(el, store, classroom, state, isLive) {
    state.addObserver(function(newState) {
      m.mount(el, m.component(visualizer, {'store': store, 'classroom': classroom, 'state': newState}));
    });
  };
});
