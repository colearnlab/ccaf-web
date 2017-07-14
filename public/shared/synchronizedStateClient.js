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

    this.userList = new UserList();

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
  };

  Connection.prototype.removeObserver = function(observer) {
    this.observers.splice(this.observers.indexOf(observer), 1);
  };

  Connection.prototype.transaction = function(paths, action, seq) {
    var originalPaths = [];
    paths = paths.map((function(path, i) {
      if (typeof path === "string" || path instanceof String)
        path = path.split(".");

      originalPaths[i] = path.slice();

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
      if (typeof seq !== "undefined") {
        this.send("skip-seq", seq);
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

    seq = (typeof seq !== "undefined" ? seq : this.transactionSeq++);
    //console.log(seq, this.transactionQueue[seq] = {paths: originalPaths, action: action});

    this.send("transaction", {
      seq: seq,
      storeId: this.storeId,
      versions: versions,
      updates: updates
    });

      // Don't run own observers
    /*
    this.observers.forEach((function(observer) {
      observer(this.store);
    }).bind(this));
    */
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
    var sendStr = JSON.stringify(new Envelope(channel, message, seq));
    var fn = (function() {
      this.ws.send(sendStr);
      //console.log("sending", seq);
      this.sendSeqToTimeoutId[seq] = setTimeout(fn, this.timeout);
    }).bind(this);

    fn();
  };

  Connection.prototype.receive = function(e) {
    var envelope = Object.assign(new Envelope(), JSON.parse(e.data));

    if (envelope.channel === "ack") {
      clearTimeout(this.sendSeqToTimeoutId[envelope.seq]);
      delete this.sendSeqToTimeoutId[envelope.seq];
    } else {
      this.ws.send(JSON.stringify(new Ack(envelope.seq)));
      this.receiveQueue.push(envelope);
      this.receiveQueue.sort(function(a, b) {
        return a.seq - b.seq;
      });

      while (this.receiveQueue.length > 0) {
        if (this.receiveSeq === this.receiveQueue[0].seq) {
          this.receiveSeq++;
          this.processReceive(this.receiveQueue.shift());
        } else if (this.receiveQueue[0].seq < this.receiveSeq) {
          this.receiveQueue.shift();
        } else {
          break;
        }
      }
    }
  };

  Connection.prototype.processReceive = function(envelope) {
    var channel = envelope.channel,
        message = envelope.message;

    console.log(message);
    var p, path;
    switch(channel) {
      case "set-store":
        if (message.storeId !== this.storeId)
          break;

        this.store = message.store;

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
        for (p in message.updates) {
          path = p.split(".");
          getByPath(this.store, path.slice(0, -1))[path.pop()] = message.updates[p];
        }
            console.log(transaction);
        this.transaction(transaction.paths, transaction.action, message.seq);
        break;
      case "connected-users":
        this.userList.update(message.users);
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

  function UserList() {
    this.users = [];
    this.observers = [];
  }

  UserList.prototype.update = function(users) {
    this.users = users;
    for (var i = 0; i < this.observers.length; i++)
      this.observers[i](users);
  };

  UserList.prototype.addObserver = function(callback) {
    this.observers.push(callback);
  };

  UserList.prototype.removeObserver = function(callback) {
    var idx = this.observers.indexOf(callback);
    this.observers.splice(idx, 1);
  };
});
