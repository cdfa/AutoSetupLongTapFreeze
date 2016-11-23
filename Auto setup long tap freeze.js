var blackList = ["net.pierrox.lightning_launcher_extreme"]
  , whiteList = []
  // for Sources see: http://www.lightninglauncher.com/scripting/reference/api/reference/net/pierrox/lightning_launcher/script/api/Event.html
  // for Events see http://www.lightninglauncher.com/scripting/reference/api/reference/net/pierrox/lightning_launcher/script/api/PropertySet.html
  // you may only have to set 1 in the future.
  , freezeSource = "I_LONG_CLICK"
  , freezeEvent = "i.longTap";

bindClass("android.widget.Toast");
bindClass("android.content.pm.PackageManager");
bindClass('java.lang.Runtime');
bindClass("java.io.DataInputStream")
bindClass('java.io.DataOutputStream');
bindClass('java.lang.StringBuffer');
bindClass("java.lang.Runnable");
bindClass("java.lang.Thread");
bindClass("android.os.Handler");
bindClass("android.os.Looper");

var script = getCurrentScript()
  , screen = getActiveScreen()
  , context = screen.getContext()
  , frozenItIdss = []
  , threads = []
  , GUIHandler = new Handler()
  , frozenApps;

function setEventHandlerRestorably(ob, name, action, data) {
  var prop = ob.getProperties()
    , ed = prop.edit()
    , evHa = prop.getEventHandler(name);
  evHa = [evHa.getAction(), evHa.getData()];
  ed.setEventHandler(name, action, data);
  ed.commit();
  ob.setTag("old " + name + " evHa", JSON.stringify(evHa));
}

function restoreEventHandler(ob, name) {
  if(ob) {
    var evHa = JSON.parse(ob.getTag("old " + name + " evHa"));
    if(evHa) {
      var ed = ob.getProperties().edit();
      ed.setEventHandler(name, evHa[0], evHa[1]);
      ed.commit();
      ob.setTag("name", null);
    } else {
      throw new Error("No eventhandler backup for " + name + " on " + ob + "found!")
    }
  } else {
    throw new Error("Cannot restore " + name + "of null!")
  }
}

function uninstall(c) {
  if(c && c.getTag("longTapFreeze")) {
    c.setTag("longTapFreeze", false);
    restoreEventHandler(c, freezeEvent);
    restoreEventHandler(c, "i.menu");
    restoreEventHandler(c, "menu");
    if(c.getTag("autosync") == "true") restoreEventHandler(c, "resumed");
    var frozenItIds = getFrozenItIds(c)
      , it;
    frozenItIds.forEach(function (itId, ind) {
      if(it = c.getItemById(itId)) {
        unfreezeEffect(it);
      }
    })
    frozenItIds.clear();
    frozenItIds.queueSave();
  }
}

function runCmd(cmd, asRoot, newThread, callback) {
  function execCmd(cmd) {
    try {
      var process = Runtime.getRuntime().exec(asRoot ? "su" : cmd)
        , reader = new DataInputStream(process.getInputStream())
        , writer = new DataOutputStream(process.getOutputStream());

      if(asRoot) {
        writer.writeBytes(cmd + '\n');
        writer.flush();
        writer.close();
      }

      var tmp
        , output = [];
      while((tmp = reader.readLine()) != null) {
        output.push(tmp);
      }
      reader.close();
      process.waitFor();
      return output;
    } catch(err) {
      alert(err + "At line " + err.lineNumber);
    }
  }

  if(newThread == false) {
    return execCmd(cmd);
  } else {
    var handler = getHandler();
    startNewBackgroundThread(function () {
      if(callback) {
        var output = execCmd(cmd);
        handler.post(function () {
          callback(output);
        });
      } else {
        execCmd(cmd)
      }
    })
  }
}

function getPackageName(it) {
  try {
    return it.getIntent().getComponent().getPackageName();
  } catch(e) {
    return null;
  }
}

function isFreezable(pkgName) {
  if(!pkgName)
    return false;

  var onBlackList = false;
  for(var i = 0; i < blackList.length; i++) {
    if(pkgName == blackList[i]) {
      onBlackList = true;
      break;
    }
  }

  if(whiteList.length == 0) {
    var onWhiteList = true;
  } else {
    var onWhiteList = false;
    for(var i = 0; i < whiteList.length; i++) {
      if(pkgName == whiteList[i]) {
        onWhiteList = true;
        break;
      }
    }
  }

  return !onBlackList && onWhiteList;
}

function freeze(it, pkgName) {
  runCmd("pm disable " + pkgName, true, true, function () {
    freezeEffect(it);
    var frozenItIds = getFrozenItIds(it.getParent());
    frozenItIds.push(it.getId());
    frozenItIds.queueSave();
  });
}

function unfreeze(it, pkgName) {
  runCmd("pm enable " + pkgName, true, true, function () {
    unfreezeEffect(it);
    var frozenItIds = getFrozenItIds(it.getParent());
    frozenItIds.remove(it.getId());
    frozenItIds.queueSave();
  });
}

function freezeEffect(it) {
  it.getProperties().edit().setInteger("s.iconColorFilter", 0x00ffffff).commit();
  it.setTag("frozen", true);
}

function unfreezeEffect(it) {
  it.getProperties().edit().setInteger("s.iconColorFilter", 0xffffffff).commit();
  it.setTag("frozen", false);
}

function getFrozenItIds(c) {
  var cId = c.getId();
  if(!frozenItIdss[cId])
    frozenItIdss[cId] = new TagArray(c, "frozenItIds");
  return frozenItIdss[cId];
}

function getFrozenApps() {
  if(!frozenApps) {
    frozenApps = runCmd("pm list packages -d", false, false);
    for(var i = 0; i < frozenApps.length; i++) {
      frozenApps[i] = frozenApps[i].split(":")[1];
    }
  }
  return frozenApps;
}

function syncContainer(c) {
  startNewBackgroundThread(function () {
    var items = c.getItems();
    for(var i = 0; i < items.length; i++) {
      syncItem(items.getAt(i));
    }
  });
}

function syncItem(it) {
  var c = it.getParent()
    , frozenItIds = getFrozenItIds(c)
    , frozenApps = getFrozenApps();
  if(it.getType() == "Shortcut") {
    var pkgName = getPackageName(it);
    if(pkgName && isFreezable(pkgName)) {
      var matched = false
        , isFrozen = it.getTag("frozen") == "true";
      for(var j = 0; j < frozenApps.length; j++) {
        if(pkgName == frozenApps[j]) {
          matched = true;
          break;
        }
      }
      if(!isFrozen && matched) {
        handleGUIEdit(function () {
          freezeEffect(it);
        })
        frozenItIds.push(it.getId());
        frozenItIds.queueSave();
      }
      if(!matched && isFrozen) {
        handleGUIEdit(function () {
          unfreezeEffect(it);
        })
        frozenItIds.remove(it.getId());
        frozenItIds.queueSave();
      }
    }
  }
}

function handleGUIEdit(func) {
  if(Looper.getMainLooper().getThread() == Thread.currentThread()) {
    func();
  } else {
    GUIHandler.post(func);
  }
}

function startNewBackgroundThread(func) {
  var thread = new Thread(function () {
    func();
    if(threads[Thread.currentThread().getId()].prepared == true) {
      Looper.myLooper().getQueue().addIdleHandler(function () {
        Looper.myLooper().quitSafely();
      })
      Looper.loop();
    }
  })
  thread.setUncaughtExceptionHandler(function (th, ex) {
    handleGUIEdit(function () {
      alert(ex.getMessage());
    })
  })
  threads[thread.getId()] = {};
  thread.start();
}

function getHandler() {
  if(Looper.getMainLooper().getThread() == Thread.currentThread()) {
    return GUIHandler;
  } else {
    var threadId = Thread.currentThread().getId();
    if(threads[threadId].prepared != true) {
      Looper.prepare();
      threads[threadId].prepared = true;
    }
    return new Handler();
  }
}

function TagArray(ob, name, manualSave) {
  this.push.apply(this, JSON.parse(ob.getTag(name)) || []);
  var me = this;
  this.save = function () {
    ob.setTag(name, JSON.stringify(Array.prototype.slice.call(me)));
  }
  if(manualSave != true) this.queueSave();
}

TagArray.prototype = new Array();
TagArray.prototype.constructor = TagArray;
TagArray.prototype.saveQueued = false;

TagArray.prototype.queueSave = function () {
  if(!this.queueSaved) {
    getHandler().post(this.save)
    this.queueSaved = true;
  }
}

TagArray.prototype.remove = function (el) {
  var ind = this.indexOf(el);
  if(ind != -1)
    this.splice(ind, 1);
  else
    return false;
}

TagArray.prototype.clear = function () {
  this.length = 0;
}

if(typeof getEvent != "undefined") {
  var e = getEvent()
    , it = e.getItem()
    , data = e.getData();
  if(data) {
    if(data.length == 4) {
      var c;
      if(it) {
        syncContainer(it.getParent());
      } else if(c = e.getContainer()) {
        syncContainer(c);
      } else {
        throw new Error("Could not find a way to determine the container to sync. Run the script from an item in the container or from the container itself or add the container id directly afrer 'sync'.")
      }
    } else if(data.substring(0, 4) == "sync") {
      var cId = data.substring(4, data.length)
        , c = screen.getContainerById(cId);
      if(!c) throw new Error("Could not find container with id:" + cId)
      syncContainer(c);
    }
  } else {
    if(!it) {
      var cIds = new TagArray(script, "cIds", true);
      var c = e.getContainer()
      cId = c.getId();
      if(c.getTag("longTapFreeze") == "true") {
        if(confirm("Are you sure you want to uninstall?")) {
          uninstall(c);
          cIds.remove(c.getId());
          cIds.save();
          Toast.makeText(context, "Uninstalled!", Toast.LENGTH_SHORT).show();
        }
      } else {
        if(confirm("Are you sure you want to install?")) {
          cIds.push(c.getId());
          c.setTag("longTapFreeze", true);
          setEventHandlerRestorably(c, freezeEvent, EventHandler.RUN_SCRIPT, script.getId());
          setEventHandlerRestorably(c, "i.menu", EventHandler.RUN_SCRIPT, script.getId());
          setEventHandlerRestorably(c, "menu", EventHandler.RUN_SCRIPT, script.getId());
          if(confirm("Do you want to enable autosync?")) {
            setEventHandlerRestorably(c, "resumed", EventHandler.RUN_SCRIPT, script.getId() + "/sync");
            syncContainer(c);
            c.setTag("autosync", true);
          }
          cIds.save();
          Toast.makeText(context, "Installed!", Toast.LENGTH_SHORT).show();
        }
      }
    } else {
      //long tap
      var src = e.getSource();
      if(src == freezeSource) {
        var c = it.getParent()
          , pkgName = getPackageName(it)
          , freezeAble = isFreezable(pkgName);
        if(pkgName && freezeAble) {
          if(it.getTag("frozen") == "true") {
            unfreeze(it, pkgName);
          } else {
            freeze(it, pkgName);
          }
        } else if(!pkgName) {
          Toast.makeText(context, it + " doesn't launch an app!", Toast.LENGTH_SHORT).show();
        } else if(!freezeAble) {
          Toast.makeText(context, "Cannot freeze/unfreeze! (Probably because of black- or whitelist", Toast.LENGTH_SHORT).show();
        }
      }
    }
  }
} else if(menu) {
  var mode = menu.getMode()
  if(mode == Menu.MODE_ITEM_SUBMENU_ACTION || mode == Menu.MODE_ITEM_NO_EM) {
    menu.addMainItem("Sync frozen-state", function () {
      syncItem(item);
      menu.close();
    });
  } else if(mode == Menu.MODE_CONTAINER_SUBMENU_ITEMS) {
    menu.addMainItem("Sync frozen-state", function () {
      syncContainer(container)
      menu.close();
    });
  }
}

/* uninstall everywhere
if(confirm("Are you sure you want to uninstall from every container?")) {
          for(var i = 0; i < cIds.length; i++) {
            uninstall(screen.getContainerById(cIds[i]));
          }
          cIds.clear();
          cIds.save();
          Toast.makeText(context, "Uninstalled everywhere!", Toast.LENGTH_SHORT).show();
        }
*/