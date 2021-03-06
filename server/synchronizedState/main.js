/*
 * server/synchronizedState/main.js: This file provides the core of our
 *      synchronized state machinery that facilitates shared drawing. See also:
 *      public/shared/synchronizedStateClient.js
 */

//  Filesystem operations.
var fs = require("fs"),

    //  File path operations.
    path = require("path"),

    //  Handle WebSocket connections.
    WebSocket = require("ws"),

    //  Utilities for asynchronous methods.
    async = require("async");

//  The Store object represents a datastore. It handles all operations on the
//  store (loading, saving, updating, accessing etc).
//var Store = require("./store").Store,
var Store = require("./storeUncompressed").Store;

//  The Connection object represents a connected client. It handles sending
//  and receiving (e.g. queueing, guarantees messages are delivered in order.)
Connection = require("./connection").Connection;

//  Helper function to create and return a server.
module.exports.server = function(port, dir, verifyClient, stats) {
    return new Server(port, dir, verifyClient, stats);
};

//  Server class.
//  Parameters:
//    server: HTTP server which the WebSocket server will use to upgrade requests
//    dir: the directory that datastores will be located in.
//    verifyClient: a function that takes a WebSocket upgrade request and a
//      callback, and if the client is authenticated invokes the callback.
function Server(server, dir, verifyClient, stats) {
    //  Try to create the directory; if this fails it is already created so we can
    //  ignore the error.
    this.dir = dir;
    try {
        fs.mkdirSync(dir);
    } catch(e) { /* ignore */ }

    //  A collection of our stores, indexed by their storeId.
    this.stores = {};

    // Provides interface to report student activity for measurement
    this.stats = stats;

    //  The actual WebSocket server, which handles the protocol, handing us
    //  connections and messages and allowing us to send messages.
    this.server = new WebSocket.Server({
        server: server,
        perMessageDeflate: false,
        path: "/ws"
    });

    //  When a client connections, the connection event is emitted and the handler
    //  function given the parameter of the connection.
    this.server.on("connection", (function(rawConnection) {
        var connection = new Connection(rawConnection);
        connection.transactionQueue = [];
        connection.transactionSeq = 0;

        //  Call the verifyClient function with the upgrade request. The upgrade
        //  request has a cookie that can be examined to find the session (if it
        //  exists). verifyClient invokes a callback that follows the typical format.
        console.log(rawConnection.upgradeReq);
        verifyClient(rawConnection.upgradeReq, (function(err, user) {
            if (err)
                return rawConnection.close();

            //  Save a reference to the user object. We'll subscribe all clients to
            //  a list of users connected to their store, so we'll use this object to
            //  populate those lists.
            connection.user = user;

            //  Subscribe to the message event with our function to handle messages.
            connection.on("message", this.processReceive.bind(this));

            //  Subscribe to the close event on the raw connection. If the connection
            //  is closed we just want to unsubscribe them from the store to which
            //  they might have been connected.
            rawConnection.on("close", (function() {
                if (connection.store) {
                    connection.store.removeSubscriber(connection);
                    this.handleSubscriptionUpdate(connection.store);
                }
            }).bind(this));
        }).bind(this));
    }).bind(this));
}

//  Process a message received from a WebSocket client. Messages are in envelopes.
//  The channel determines the type of that message, and the message in the
//  envelope is any data needed to act on the message.
Server.prototype.processReceive = function(connection, envelope) {
    var channel = envelope.channel,
        message = envelope.message;

    //  Look at the channel and invoke the appropriate function to process that
    //  message.
    switch(channel) {
            //  A sync message subscribes to a datastore.
        case "sync":
            return this.processSync(connection, message);
            //  A transaction message is an attempt to update the datastore.
        case "transaction":
            return this.processTransaction(connection, message);
        case "skip-seq":
            return this.processSkipSeq(connection, message);
        case "log-only":
            return this.processLogOnly(connection, message);
    }
};


// Store something in the log without doing transaction-style checks and
// without sending it out as an update.
Server.prototype.processLogOnly = function(connection, message) {
    var store = connection.store;
    if(!store || (store.id != message.storeId))
        return;

    if(message.update.meta) {
        // Run any stats tracker hooks
        this.stats.sessionStats[message.update.meta.s].processUpdate(message.update, message.clientTime);
    }

    // Write log
    store.writeUpdateToLog(message.update);
};


//  Subscribe a client to the datastore.
Server.prototype.processSync = function(connection, message) {
    //  If the client was already connected, remove them from the subscription list
    //  and update the remaining clients' subscription lists.
    if (connection.store) {
        connection.store.removeSubscriber(connection);
        this.handleSubscriptionUpdate(connection.store);
    }

    var id = message.id;

    // If playback time is given in the message, we prepare the session for
    // playback mode, in which events from the log are sent out as if they were
    // really happening. 
    var playbackTime = null;
    if(typeof(message.playbackTime) != 'undefined') {
        playbackTime = message.playbackTime;
    }
    //console.log(message);

    // Define a function to finish setting up the sync state after loading the
    // session one way or another
    var afterLoadCallback = function(store, callback) {
        if(!store)
            store = this.stores[id];

        //  Keep a reference to the store with the connection object.
        connection.store = store;

        //  send a message to the client with the current state of the datastore.
        connection.send("set-store", {
            storeId: id,
            store: store.data
        });

        //console.log('sent store! Playback time: ' + playbackTime);

        //  Add the client to the list of subscribers of that store, and update
        //  clients' subscription lists. Since we add the subscriber first, they'll
        //  also get a message with the client list.
        store.addSubscriber(connection);
        this.handleSubscriptionUpdate(connection.store);

        if(callback)
            callback(store, playbackTime);
    };

    // If playback mode, prepare for playback, otherwise just load the store for
    // normal use
    if(playbackTime == null) {
        //  Obtain the store associated with that id.
        this.getOrCreateStore(id, afterLoadCallback.bind(this));
    } else {
        this.loadPlayback(id, afterLoadCallback.bind(
            this, null, this.seekPlayback.bind(this)
        ));    
    }
};

//  Handle an attempt by a client to update the datastore. The basic algorithm
//  is as follows:
//    1)  Make sure that the update is for the same datastore to which the
//        client is subscribed.
//    2)  Make sure that the transaction is the next in the sequence. If
//        messages are dropped, we don't want to process transactions out of
//        order!
//    3)  Check to see that the version of each updated component held by the
//        client is the latest version. If it is not, send the latest version
//        to the client so they can update their store.
//    4)  If we've passed preconditions 1-3, apply the changes the client wants
//        to make. (If we haven't, we'll have rejected the transaction and stopped.)
//    5)  Send the changes that the client made to all other clients subscribed
//        to that store.
//    6)  Let the client making the change know that their attempt succeeded.
//    7)  Save the change to the log.
//  An example of how this is used is in the sketch tools application. If a
//  user clears the screen while another is drawing, the user that is drawing
//  has their path cancelled.

//  A transaction has the following elements:
//    storeId: the unique identifier of the store that is being changed.
//    seq: the sequence number, a unique identifier that increments by one.
//    versions: a mapping of paths to version numbers that is checked against
//      the local version numbers.
//    updates: a mapping of paths to objects that will be placed at those paths.
Server.prototype.processTransaction = function(connection, transaction) {
    var store = connection.store;

    //  Precondition 1.
    if (!store || store.id !== transaction.storeId)
        return;

    //  Precondition 2. If the transaction is out of order, queue it for later.
    if (transaction.seq != connection.transactionSeq && !store.playback) {
        connection.transactionQueue.push(transaction);
        return;
    }

    //  Precondition 3.
    var p3_passed = true;
    if(!store.playback) { // bypass checks if playback
        for (var p in transaction.versions) {
            //  Check to see that the _id of that object is the same as the current _id.
            //  By default, _ids are 0, so we treat an undefined as 0. If we find that
            //  the client was acting on the incorrect version, reject the transaction
            //  and send them updates.
            //  @TODO: if precondition 3 fails, must go back and remove any objects created
            //    by getByPath. This can be seen with createdPropPaths in synchronizedStateClient.
            if ((store.getByPath(p)._id || 0) !== transaction.versions[p]) {
                p3_passed = false;

                //  Create a mapping of paths to current versions of the object at that path
                //  to send to the client.
                var updates = {};
                for (var p_ in transaction.versions)
                    updates[p_] = store.getByPath(p_);

                connection.send("transaction-failure", {
                    seq: transaction.seq,
                    updates: updates
                });
                break;
            }
        }
    }

    //  If all three preconditions have passed:
    if (p3_passed) {
        //  Apply the client's changes.
        store.applyUpdates(transaction.updates);

        // Get the current time, to be saved with point counts
        var currentTime = Date.now();

        // Run any stats update hooks
        //var updateObj = JSON.parse(transaction.updates);
        for(var key in transaction.updates) {
            var updateObj = Object.assign({}, transaction.updates[key]);
            if('meta' in updateObj) {
                updateObj.meta = JSON.parse(updateObj.meta);
                updateObj.data = JSON.parse(updateObj.data);
                if(this.stats.sessionStats[updateObj.meta.s]) {
                    this.stats.sessionStats[updateObj.meta.s].processUpdate(updateObj, currentTime);
                }
            }

            // Playback controls. Only used when session is in playback mode.
            if(key == "playback") {
                switch(updateObj.mode) {
                    case 'seek':
                        this.seekPlayback(store, updateObj.time, (function() {
                            // If we were playing before, continue playing
                            if(store.lastPlaybackMode == "play") {
                                this.startPlayback(store);
                            }
                        }).bind(this));
                        break;
                    case 'pause':
                        this.pausePlayback(store, function() {
                            console.log('paused');
                        });
                        break;
                    case 'play':
                        // start sending updates
                        this.startPlayback(store, function() {
                            console.log('playing');
                        });
                        break;
                }
            }
        }
        //  Iterate through all other clients subscribed to that store to update
        //  them on changes made.
        store.subscriptions.forEach(function(subscription) {
            //  No need to update the client making changes -- locally these changes
            //  have already been applied.
            if (subscription === connection)
                return;

            subscription.send("updates", {
                storeId: transaction.storeId,
                updates: transaction.updates
            });
        });

        //  Increment the expected transaction number to receive the next transaction.
        connection.transactionSeq += 1;

        // Let the client know that their transaction has succeeded.
        connection.send("transaction-success", {
            seq: transaction.seq
        });
    }

    //  If there are other transactions in the queue (ie because we received them
    //  out of order), look through them and process them if the next one
    connection.transactionQueue.sort(function(a, b) {
        return a.seq - b.seq;
    });

    if (connection.transactionQueue.length > 0 &&
        connection.transactionQueue[0].seq == connection.transactionSeq) {
        this.processTransaction(connection, connection.transactionQueue.shift());
    }
};

//  A skip-seq message happens when a sequence number is assigned to a transaction,
//  that transaction is rejected and later cancelled. skip-seq tells the server
//  to advance the expected sequence number by one.
Server.prototype.processSkipSeq = function(connection, seq) {
    if (connection.transactionSeq == seq)
        connection.transactionSeq++;
};

//  handleSubscriptionUpdate is called whenever a client subscribes or
//  unsubscribes to a store. It looks through all WebSocket connections subscribed
//  to the store and sends each client a list of connected users. Each user only
//  appears a maximum of once, even if there are more than one connections
//  associated with that user.
Server.prototype.handleSubscriptionUpdate = function(store) {
    var users = {};
    for (var i = 0; i < store.subscriptions.length; i++) {
        var toAdd = store.subscriptions[i].user;
        users[toAdd.id] = toAdd;
    }

    users = Object.keys(users).map(function(userId) {
        return users[userId];
    });

    store.subscriptions.forEach(function(connection) {
        connection.send("connected-users", {
            users: users
        });
    });
};

//  Retrieve a store by storeId. If the store has already been instantiated,
//  retrieve it from the stores collection. Otherwise, instantiate the store
//  object. Since loading the store is a asynchronous operation, this function
//  takes a callback.
Server.prototype.getOrCreateStore = function(id, callback) {
    if (id in this.stores) {
        callback(this.stores[id]);
    } else {
        Store.create(id, this.dir, (function(store) {
            this.stores[id] = store;
            callback(store);
        }).bind(this));
    }
};


// Ensures session is loaded for playback
Server.prototype.loadPlayback = function(storeId, callback) {
    var store = this.stores[storeId];
    if(store) {
        if(store.currentTimeout)
            clearTimeout(store.currentTimeout);
        store.playback = true;
        callback();
    } else {
        store = new Store(storeId, this.dir);
        store.playback = true;
        this.stores[storeId] = store;
        store.load(callback, true);
    }
};


/*
 * Based on logged events, sets up the store as it appeared at the given time
 * offset.
 */
Server.prototype.seekPlayback = function(store, time, callback) {
    // TODO handle seeking forward as special case

    // TODO handle setPage issue
    if(!store.updateQueue || !store.updateQueue[0])
        return;

    // Find target timestamp: adjust to the one immediately before
    store.sessionTime0 = store.updateQueue[0].time; 
    store.sessionEndTime = store.updateQueue[store.updateQueue.length - 1].time;
    store.sessionStartTime = store.sessionTime0;
    store.sessionTargetTime = store.sessionTime0 + time;

    // Nuke state but preserve users, _pages
    store.data = {users: store.data.users, _pages: {}};

    // Seek to the right update
    store.updateIndex = 0;
    var queue = store.updateQueue;
    for(store.updateIndex = 0; store.updateIndex < queue.length; store.updateIndex++) {
        var updateObject = queue[store.updateIndex];
        store.sessionTime = updateObject.time;

        if(updateObject.time > store.sessionTargetTime)
            break;

        // collect page numbers
        // TODO this is stupid and needs to be fixed properly in a new version
        for(var p in updateObject.updates) {
            if(p == "setPage") {
                //console.log(updateObject.updates[p]);
                var setPageObj = JSON.parse(updateObject.updates[p].data);
                for(var userId in setPageObj)
                    store.data._pages[parseInt(userId)] = setPageObj[userId];
            }
        }

        store.applyUpdates(updateObject.updates);
    }
    //console.log(store.data._pages);

    store.seekDelay = store.sessionTime - store.sessionTargetTime;
    //console.log(store.seekDelay);
    store.sessionTime = store.sessionTargetTime;

    // Set up playback state
    if(!store.data.playback) {
        store.data.playback = {};
    }
    store.data.playback.time = store.sessionTime - store.sessionTime0;
    store.data.playback.duration = store.sessionEndTime - store.sessionTime0;

    // Send state to clients
    store.subscriptions.forEach(function(subscription) {
        subscription.send("set-store", {
            storeId: store.id,
            store: store.data
        });
    });

    if(callback)
        callback();

};


/*
 * Plays back session events from the log.
 */
Server.prototype.startPlayback = function(store, callback) {

    // Repeating update function
    var sendUpdate = (function() {

        var updateObject = store.updateQueue[store.updateIndex];
        store.sessionTime = updateObject.time;

        store.applyUpdates(updateObject.updates);

        //console.log(store.data);

        // Send update to all clients
        store.subscriptions.forEach(function(subscription) {
            subscription.send("updates", {
                storeId: store.id,
                updates: Object.assign({}, updateObject.updates, {
                    'playback.time': store.sessionTime - store.sessionTime0,
                })
            });
        });

        // Update time


        store.serverTime = Date.now();

        // Prepare for next update
        store.updateIndex++;
        if(store.updateQueue.length == store.updateIndex) {
            console.log('end of playback');
            return;
        }

        var nextUpdateObject = store.updateQueue[store.updateIndex];

        var serverElapsedTime = store.serverTime - store.serverStartTime,
            delayTime = nextUpdateObject.time - store.sessionStartTime - serverElapsedTime;

        store.currentTimeout = setTimeout(sendUpdate, delayTime);
    }).bind(this);

    // Set up timing: we keep the "session" time for synchronization with the server's timekeeping
    //store.sessionTime = store.updateQueue[store.updateIndex].time;
    store.sessionStartTime = store.sessionTime;
    store.serverStartTime = Date.now();

    // Find extra delay before the first update
    var nextUpdateTime = store.updateQueue[store.updateIndex].time;
    var firstUpdateDelay = store.seekDelay || 0;

    //console.log(firstUpdateDelay / 1000);

    // TODO send play mode, time
    store.subscriptions.forEach(function(subscription) {
        subscription.send("updates", {
            storeId: store.id,
            updates: {
                playback: {
                    mode: "play",
                    time: store.sessionTime - store.sessionTime0,
                    duration: store.sessionEndTime - store.sessionTime0
                }
            }
        });
    });

    store.seekDelay = 0;

    // Start updating
    if(store.currentTimeout) {
        clearTimeout(store.currentTimeout);
    }
    store.currentTimeout = setTimeout(sendUpdate, firstUpdateDelay);

    store.lastPlaybackMode = "play";

    if(callback)
        callback();
};


/*
 * Pauses playback.
 */
Server.prototype.pausePlayback = function(store) {
    // Prevent the next update from being sent
    clearTimeout(store.currentTimeout);
    store.currentTimeout = null;

    // Update the time
    if(store.serverStartTime && store.sessionStartTime) {
        store.sessionTime = store.sessionStartTime + (Date.now() - store.serverStartTime);
    }

    //console.log(store.sessionTime0, store.sessionEndTime);

    // Send update to clients 
    store.subscriptions.forEach(function(subscription) {
        subscription.send("updates", {
            storeId: store.id,
            updates: {
                playback: {
                    mode: "pause",
                    time: store.sessionTime - store.sessionTime0,
                    duration: store.sessionEndTime - store.sessionTime0
                }
            }
        });
    });

    store.lastPlaybackMode = "pause";
};


//  Call close on each opened store, which will finish writing them to the disk.
Server.prototype.close = function(callback) {
    async.each(Object.keys(this.stores), (function(storeId, innerCallback) {
        this.stores[storeId].close(innerCallback);
    }).bind(this), callback);
};
