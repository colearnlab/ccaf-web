define(["exports"], function(exports) {
  exports.connect = function(ws, callback) {
    return new Connection(ws, callback);
  };

  function Connection(ws, callback) {
    for (var p in Connection.defaults)
      this[p] = Connection.defaults[p];

    this.sendSeqToTimeoutId = {};
    this.sendSeq = 0;

    this.receiveQueue = [];
    this.receiveSeq = 0;

    this.transactionQueue = {};
    this.transactionSeq = 0;

    this.store = {};
    this.observers = [];

    this.playbackStore = null;
    this.log = null;

    this.playback = false;

    this.ws = new WebSocket(ws);
    this.ws.addEventListener("message", this.receive.bind(this));
    this.ws.addEventListener("open", callback.bind(this));
  }

  Connection.defaults = {
    timeout: 1000
  };

  Connection.prototype.sync = function(id) {
    this.storeId = id;
    this.send("sync", id);
  };

  Connection.prototype.addObserver = function(observer) {
    this.observers.push(observer);
    observer(this.store);
  };

  Connection.prototype.removeObserver = function(observer) {
    this.observers.splice(this.observers.indexOf(observer), 1);
  };

  Connection.prototype.transaction = function(paths, action, seq) {
    if (this.playback)
      return;

    seq = (typeof seq !== "undefined" ? seq : this.transactionSeq++);

    paths = paths.map((function(path) {
      if (typeof path === "string" || path instanceof String)
        return path.split(".");

      return path;
    }).bind(this));

    var createdPropPaths = [];
    var dependencies = paths.map((function(path) {
      return getByPath(this.store, path, 0, createdPropPaths);
    }).bind(this));

    var doAction = action.apply({
      props: paths
    }, dependencies);

    if (doAction === false) {
      var toUndo;
      while((toUndo = createdPropPaths.pop())) {
        delete getByPath(this.store, toUndo.slice(0, -1))[toUndo.pop()];
      }
      return;
    } else if (doAction instanceof Array) {
      paths = doAction;
      dependencies = paths.map((function(path) {
        return getByPath(this.store, path, 0);
      }).bind(this));
    }

    var versions = {};
    var updates = {};
    for (var i = 0; i < paths.length; i++) {
      var version = dependencies[i]._id || 0;
      versions[paths[i].join(".")] = version;
      dependencies[i]._id = version + 1;
      updates[paths[i].join(".")] = dependencies[i];
    }

    this.transactionQueue[seq] = {paths: paths, action: action};

    this.send("transaction", {
      seq: seq,
      storeId: this.storeId,
      versions: versions,
      updates: updates
    });

    this.observers.forEach((function(observer) {
      observer(this.store);
    }).bind(this));
  };

  function getByPath(obj, path, i, createdPropPaths) {
    if (typeof i === "undefined")
      i = 0;

    if (typeof createdPropPaths === "undefined")
      createdPropPaths = [];

    if (path.length - i === 0 || path[i] === "")
      return obj;

    if (path[i] === "+") {
      path[i] = arrayHelpers.push(obj, {}) - 1;
      createdPropPaths.push(path.slice(0, i + 1));
    } else if (!(path[i] in obj)) {
      obj[path[i]] = {};
      createdPropPaths.push(path.slice(0, i + 1));
    }

    var next = obj[path[i]];

    return getByPath(next, path, i + 1, createdPropPaths);
  }

  // Sending and receiving logic.
  Connection.prototype.send = function(channel, message, seq) {
    seq = (typeof seq !== "undefined" ? seq : this.sendSeq++);

    this.ws.send(JSON.stringify(new Envelope(channel, message, seq)));
    this.sendSeqToTimeoutId[seq] = setTimeout((function() {
      this.send(channel, message, seq);
    }).bind(this), this.timeout);
  };

  Connection.prototype.receive = function(e) {
    var envelope = Object.assign(new Envelope(), JSON.parse(e.data));

    if (envelope.channel === "ack") {
      clearTimeout(this.sendSeqToTimeoutId[envelope.seq]);
      delete this.sendSeqToTimeoutId[envelope.seq];
    } else if (envelope.seq >= this.receiveSeq) {
      this.ws.send(JSON.stringify(new Ack(envelope.seq)));

      this.receiveQueue.push(envelope);
      this.receiveQueue.sort(function(a, b) {
        return a.seq - b.seq;
      });

      while (this.receiveQueue.length > 0 && this.receiveSeq === this.receiveQueue[0].seq) {
        this.receiveSeq++;
        this.processReceive(this.receiveQueue.shift());
      }
    }
  };

  Connection.prototype.processReceive = function(envelope) {
    var channel = envelope.channel,
        message = envelope.message;

    var p, path;
    switch(channel) {
      case "set-store":
        if (message.storeId !== this.storeId)
          break;

        this.store = message.store;

        if (this.playback)
          return;

        this.observers.forEach((function(observer) {
          observer(this.store);
        }).bind(this));

        break;
      case "updates":
        if (message.storeId !== this.storeId)
          break;

        for (p in message.updates) {
          path = p.split(".");
          getByPath(this.store, path.slice(0, -1))[path.pop()] = message.updates[p];
        }

        if (this.playback)
          return;

        this.observers.forEach((function(observer) {
          observer(this.store);
        }).bind(this));

        break;
      case "transaction-success":
        delete this.transactionQueue[message.seq];
        break;
      case "transaction-failure":
        var transaction = this.transactionQueue[message.seq];
        delete this.transactionQueue[message.seq];
        this.transaction(transaction.paths, transaction.action, message.seq);
        break;
    }
  };

  var arrayHelpers = Connection.prototype.array = {
    length: function(arr) {
      return Object.keys(arr).length -
        ("_id" in arr ? 1 : 0);
    },
    forEach: function(arr, callback, thisArg) {
      var length = arrayHelpers.length(arr);
      for (var i = 0; i < length; i++)
        callback.call(thisArg, arr[i], i, arr);
    },
    map: function(arr, callback, thisArg) {
      var length = arrayHelpers.length(arr);
      var toReturn = [];

      arrayHelpers.forEach(arr, function(item, i) {
        toReturn[i] = callback.call(thisArg, item, i, arr);
      });

      return toReturn;
    },
    push: function(arr) {
      var savedLength = arr.length;
      var hasLength = "length" in arr;
      arr.length = arrayHelpers.length(arr);

      var toReturn = Array.prototype.push.apply(arr, Array.prototype.slice.call(arguments, 1));

      if (hasLength)
        arr.length = savedLength;
      else
        delete arr.length;

      return toReturn;
    },
    pop: function(arr) {
      var savedLength = arr.length;
      var hasLength = "length" in arr;
      arr.length = arrayHelpers.length(arr);

      var toReturn = Array.prototype.pop.apply(arr);

      if (hasLength)
        arr.length = savedLength;
      else
        delete arr.length;

      return toReturn;
    },
    splice: function(arr) {
      var savedLength = arr.length;
      var hasLength = "length" in arr;
      arr.length = arrayHelpers.length(arr);

      var toReturn = Array.prototype.splice.apply(arr, Array.prototype.slice.call(arguments, 1));

      if (hasLength)
        arr.length = savedLength;
      else
        delete arr.length;

      return toReturn;
    }
  };

  // Helpers.
  function Envelope(channel, message, seq) {
    this.channel = channel;
    this.message = message;
    this.seq = seq;
  }

  function Ack(seq) {
    this.channel = "ack";
    this.seq = seq;
  }
});
