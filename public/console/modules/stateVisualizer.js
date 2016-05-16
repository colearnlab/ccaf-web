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
        m('div.container',
          m('div.row',
            m.component(appPalette, {'state': args.state, 'apps': apps}),
            m('div.col-sm-10.col-md-10.panel#cards',
              m.trust('&nbsp;'),
              _.values(instances).map(function(instance) {
                return m.component(instanceCard, {'instance': instance});
              })
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
      return m('div', args.instance.app);
    }
  };

  exports.display = function(el, store, state) {
    m.mount(el, m.component(visualizer, {'store': store, 'state': state}));
    state.addObserver(function(newState) {
      m.mount(el, m.component(visualizer, {'store': store, 'state': newState}));
    });
  };
});
