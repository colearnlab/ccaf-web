### Format

Each log file records a single group's activity during one session and
is kept in the `stores` directory. A line in a log file represents one log entry and
has two parts: a timestamp (`"time"`, milliseconds since 1/1/1970) and event-specific data (`"updates"`).

Log files were originally gzip-compressed but after changes on September 18 they are stored uncompressed.

### Information included with many types of entries

-   The `"_id"` attribute is used internally to keep track of different versions of a property.
-   Some entries will include 
    a `"data"` section and a `"meta"` section. The `"meta"` information is for internal use and may include the
    user's ID (`"u"`), group ID (`"g"`), and the session ID (`"s"`). A `"type"` field may be present with a message describing the action (e.g. clicking the undo button to restore a deleted object).


# Events recorded in log files

### Page change

Key: `setPage`

Data: `{<userId>: <page index>}`

Recorded when a user changes pages by clicking a page-change button in the top left.


### Scrolling position change

Key: `scrollPositions.<userId>.<pageIndex>`

Data: 
```
{
    pos: <scroll position in range [0, 1]>,
    viewTop: <position of the top edge of the visible region>,
    viewBottom: <position of the bottom edge of the visible region>
}
```    

Reports a user's scrolling position (zero is the topmost position, one is the 
bottommost) on the given page. `viewTop` and `viewBottom` describe what
portion of the page is visible on the screen.


### Drawing object update

Key: `objects.<UUID>`

Data: `{data: <object data>, meta: <metadata>}`

When an object (identified by `<UUID>`) is added/drawn or modified,
this update reports some or all of the object's properties, or just
`name: "remove"` for deleting the object.


### Tool change

Key: `tool.<userId>`

Data: `{tool: <toolId (0 for pen, 2 for eraser, 3 for select)>}`

This event is logged whenever a user changes tools by clicking a tool icon. 


### Accelerometer data change

Key: `accel.<userId>`

Data: 
```
{
    x: <x>,
    y: <y>,
    z: <z>,
    a: <alpha>,
    b: <beta>,
    g: <gamma>
}
```

The browser reports six values to do with the device's motion -- `x`, `y` and
`z` give acceleration along three axis in m/s^2, and `a`, `b` and `g` report
rate of rotation in degrees per second on three axes (alpha, beta, gamma). While
the browser fires the event sixty times per second, we only log the event when one
or more of these values changes.


### Pen color change

Key: `penColor.<userId>`

Data: `{color: <color string>}`

Reports an update to a user's pen drawing color as an HTML color string.


### Selection box change

Key: `selectionBox.<userId>`

Data:
```
{
    visible: <boolean flag>,
    doc: <page index>,
    page: <index of page within document (tab)>,
    left: <x position of selection box (left edge)>,
    top: <y position (top edge)>,
    width: <width>,
    height: <height>,
    contents: <list of object UUIDs>
}
```

This event occurs when a user finishes selecting one or more objects, or when
the selection is cleared (in which case the only field present might be
"visible"). It tells which canvas the selection is on (described by 
"doc", "page"), the position and size of the selection bounding box in canvas
coordinates, and a list of UUIDs for the objects in the selection.


### Group membership change

Key: `membershipChange`

Data:
```
{
    id: <user ID>
    name: <user name>
    email: <user email>
    type: <user type (0 for admin, 1 for teacher, 2 for student)>
    action: <brief message about what happened>
}
```

This event is logged each time a user loads the app, unloads by clicking the 
"Reload" or "Exit" button, or is moved into or out of a group.


### App visibility change

Key: `appVisible`

Data: `{<userId>: <boolean flag, true if app is visible>}`

This is logged any time the app is minimized or restored, or if the window
comes into or out of focus. 


