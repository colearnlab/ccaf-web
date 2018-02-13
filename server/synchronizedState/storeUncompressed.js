//  Filesystem operations.
var fs = require("fs"),

  //  File path operations.
  path = require("path"),

  //  Create a stream to enable compressing the log as it is written.
  stream = require("stream");

  //  Compression library; we will use gzip.
  //zlib = require("zlib");


//  Store class. Represents a store, which can be loaded from disk and is
//  also written to the disk on update.
//  Parameters:
//    id: a string that represents this store; also the filename of it.
//    dir: where to save and load stores from.
function Store(id, dir) {
  this.id = id;
  this.path = path.resolve(dir, id.toString());

  //  The actual object that clients want.
  this.data = {};

  //  An array of clients (Connections) that can make changes and receive changes
  this.subscriptions = [];

  //  This will be the input to the gzip stream.
  this.readStream = new stream.Readable();
  this.readStream._read = function(){};

  //  After we load from a file, this will be populated with a write stream
  //  to the logfile.
  this.writeStream = null;

    this.hasClosed = false;

    // for playback
    this.updateQueue = [];
}

//  Utility function to create and load a store id in dir.
Store.create = function(id, dir, callback) {
  var store = new Store(id, dir);
  store.load(function() {
    //  Now that we've finished reading from the file we can open a writestream
    //  to it.
    store.writeStream = fs.createWriteStream(store.path, {
      flags: "a",
      encoding: "utf8"
    });

    //  Set up so when we push to the readStream on updates, the data gets
    //  compressed and then written to disk.
    store.readStream
      // TODO remove .pipe(store.gzipStream)
      .pipe(store.writeStream);

    //  Push at least one piece of data to prime the stream... if this is not
    //  done and nothing is written to the stream (no changes made) gzip will
    //  corrupt the data.
    store.readStream.push(" ");

    callback(store);
  });
};

//  Simple utilities to manage the list of clients subscribed.
Store.prototype.addSubscriber = function(subscriber) {
  this.subscriptions.push(subscriber);
};

Store.prototype.removeSubscriber = function(subscriber) {
  var subIdx = this.subscriptions.indexOf(subscriber);
  this.subscriptions.splice(subIdx, 1);
};

//  Apply changes to the store. toApply is an object mapping paths to objects
//  at that path. Simply iterate through all key/value pairs and apply the changes.
Store.prototype.applyUpdates = function(toApply) {
  for (var p in toApply) {
    var path = p.split(".");
    var base = path.slice(0, -1);
    var prop = path.pop();
    this.getByPath(base)[prop] = toApply[p];
  }

  //  Record the updates made in the log.
  this.writeUpdateToLog(toApply);
};


Store.prototype.writeUpdateToLog = function(toApply) {
    if(this.hasClosed || this.playback)
        return;
    
    this.readStream.push(JSON.stringify({
        time: + new Date(),
        updates: toApply
    }) + "\n");
};


//  Load a logfile (or continue if no file exists).
Store.prototype.load = function(callback, doNotApply) {
    if(typeof(doNotApply) === 'undefined')
        doNotApply = false;

  if (fs.existsSync(this.path)) {
    //  A stream that will uncompress the log file.
    // TODO remove // var tmpGunzip = zlib.createGunzip();

    //  Create a readStream to pipe into the gunzip object.
    var tmpReadStream = fs.createReadStream(this.path);

    //  Normally gunzip will only output once enough data has been input into it,
    //  but if we are at the end of the file we know no more data will be coming
    //  so we can force gunzip to spit out the rest of what it has.
    /* TODO remove
    tmpReadStream.on("end", function() {
      tmpGunzip.flush();
    });
    */

    //  The write stream will receive the uncompressed data from the gunzip stream.
    var tmpWriteStream = new stream.Writable();

    //  gzip works in chunks (which can actually be specified by the user). The
    //  log file is a newline-delimited list of objects. Since the border of a
    //  chunk can be in the middle of a line, we treat the last line of a chunk
    //  as incomplete and append it to the beginning of the next chunk.
    //  The _write function gets called by when a chunk is processed by gunzip.
    //  @TODO: this will break if a single line is bigger than a chunk, so that
    //    needs to be accounted for.
    var leftovers = "";
    tmpWriteStream._write = (function(_doNotApply) {
        return (function(chunk, encoding, done) {
          //  Take the remainder of the last chunk and combine it with the current
          //  chunk. Then break up the resulting string by line into an array.
          var lines = (leftovers + chunk.toString()).split("\n");

          //  Treat the last line as incomplete and save for later.
          leftovers = lines.pop();

          //  Each line is its own set of updates, so apply them in order.
          lines.forEach((function(line) {
              var lineObj = JSON.parse(line);
              var updateObject = lineObj.updates;
              console.log(_doNotApply);
              if(_doNotApply) {
                  this.updateQueue.push(lineObj);
              } else {
                  this.applyUpdates(updateObject);
              }
          }).bind(this));

          //  The chunk is processed, so signal that we're ready for the next one.
          done();
        }).bind(this);
    }).bind(this)(doNotApply);

    //  After we're done processing the stream, return with our callback.
    tmpWriteStream.on("finish", function() {
      callback();
    });

    //  Finally, take the input file; pipe it into the gunzip file to decompress
    //  it; then pipe it into our write stream so we can process it.
    tmpReadStream
      // TODO remove // .pipe(tmpGunzip)
      .pipe(tmpWriteStream);
  } else {
    callback();
  }
};


//  Take a period-delimited path and find it in the store. For example, paths.4.2
//  would look like:
//  this.data = {
//    paths: {
//      4: {
//        2: { /* THIS IS RETURNED */ }
//       }
//    }
//  }
//  If the path does not exist, it is created.
Store.prototype.getByPath = function(curPath, obj) {
  if (typeof curPath === "string")
    curPath = curPath.split(".");

  if (typeof obj === "undefined")
    obj = this.data;

  if (curPath.length === 0)
    return obj;

  if (!(curPath[0] in obj))
    obj[curPath[0]] = {};

  return this.getByPath(curPath.slice(1), obj[curPath[0]]);
};

//  Close all streams and return when finished writing to the disk.
Store.prototype.close = function(callback) {
    //setTimeout((function() {
      this.hasClosed = true;
      this.readStream.push(null);
      // TODO remove // this.gzipStream.flush();
      //if(this.writeStream)
        this.writeStream.on("finish", callback);
    //}).bind(this), 3000);
};

exports.Store = Store;
