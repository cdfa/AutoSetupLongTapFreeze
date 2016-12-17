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
bindClass('java.io.BufferedReader');
bindClass('java.io.InputStreamReader');
bindClass('java.io.DataOutputStream');
bindClass('java.lang.StringBuffer');
bindClass("java.lang.Runnable");
bindClass("java.lang.Thread");
bindClass("android.os.Handler");
bindClass("android.os.Looper");

var script = getCurrentScript()
  , screen = getActiveScreen()
  , context = screen.getContext()
  , threads = []
  , GUIHandler = new Handler()
  , frozenApps;

function setEventHandlerRestorably(ob, name, action, data){
  var prop = ob.getProperties()
    , ed = prop.edit()
    , evHa = prop.getEventHandler(name);
  evHa = [evHa.getAction(), evHa.getData()];
  ed.setEventHandler(name, action, data);
  ed.commit();
  ob.setTag("old " + name + " evHa", JSON.stringify(evHa));
}

function restoreEventHandler(ob, name){
  if(ob){
    var evHa = JSON.parse(ob.getTag("old " + name + " evHa"));
    if(evHa){
      var ed = ob.getProperties().edit();
      ed.setEventHandler(name, evHa[0], evHa[1]);
      ed.commit();
      ob.setTag("name", null);
    }else{
      throw new Error("No eventhandler backup for " + name + " on " + ob + "found!")
    }
  }else{
    throw new Error("Cannot restore " + name + "of null!")
  }
}

function uninstall(c){
  if(c && c.getTag("longTapFreeze")){
    c.setTag("longTapFreeze", false);
    restoreEventHandler(c, freezeEvent);
    restoreEventHandler(c, "i.menu");
    restoreEventHandler(c, "menu");
    if(c.getTag("autosync") == "true") restoreEventHandler(c, "resumed");
    c.getAllItems().forEach(function(it){
      if(isFrozen(it))
        unfreezeEffect(it);
    });
    var cs = screen.getAllContainersById(c.getId());
    cs.forEach(function(c){
      var opener;
      if((opener = c.getOpener()) && opener.getType() == "Folder"){
        if(isFrozen(opener))
          unfreezeEffect(opener);
      }
    });
  }
}

/**
 * Checks if an object is an array.
 * @param object
 * @returns {boolean}
 */
function isArray(object){
  return Object.prototype.toString.call(object) == '[object Array]';
}

/**
 * This callback will be called when the executing of the command(s) is finished
 *
 * @callback finishedCallback
 * @param {string[]} An array of the lines the command(s) returned
 */
/**
 * This callback will be called when a command is executed.
 *
 * @callback executedCallback
 */
/**
 * Runs a command in the terminal
 * @param cmds {string|string[]} - The command or array of commmands to be executed.
 * @param [asRoot=false] {boolean} - If the command(s) should be executed as root or not.
 * @param [newThread=true] {boolean} - If the executing of commands should happen in a new thread or not. (useful for root commands)
 * @param [callback] {finishedCallback} - The callback that handles the output.
 * @param [onExecuted] {executedCallback} - A callback that will be called when a command is executed. useful for multiple commands that take some time)
 * @returns {string[]||string[][]} - (only if asRoot == false && newThread == false) Returns an array of the lines written in the terminal or an array of arrays if multiple commands were executed.
 */
function runCmd(cmds, asRoot, newThread, callback, onExecuted){
  var handler = getHandler()
    , output, process, reader, writer;

  // set optional arguments
  if(asRoot == null)
    asRoot = false;
  if(newThread == null)
    newThread = true;

  /**
   * Helper function for executing the command(s). Gets its parameters from the parent function.
   * @returns {string[]||string[][]} - (only if asRoot == false && newThread == false) Returns an array of the lines written in the terminal or an array of arrays if multiple commands were executed.
   */
  function execCmd(){
    /**
     * Checks if the command is a string and if not alerts the user.
     * @param cmd {string}
     * @returns {boolean}
     */
    function checkCmd(cmd){
      if(typeof(cmd) === "string"){
        return true;
      }else
        handleGUIEdit(function(){
          alert(cmd + " is not a string!");
        });
      return false;
    }

    /**
     * Actually executes command.
     * @param cmd {string}
     * @param writer {DataOutputStream} - The writer to write the command to.
     * @returns {boolean} If the command was actually written or not.
     */
    function exec(cmd, writer){
      if(checkCmd(cmd)){
        writer.writeBytes(cmd + "\n");
        writer.flush();
        return true;
      }
      return false;
    }

    /**
     * Read the output from the reader.
     * @param reader {BufferedReader}
     * @returns {Array} An array of lines that were outputted by the
     */
    function readOutput(reader){
      var tmp, output = [];
      while((tmp = reader.readLine()) != null)
        output.push(tmp);

      return output.length == 1 ? output[0] : output;
    }

    /**
     * Executes the callback and if the callback is not a function alerts the user.
     * @param callback
     * @param output {Array} - The argument that is passed to the callback
     */
    function handleCallback(callback, output){
      if(typeof callback == "function"){
        handler.post(function(){
          callback(output);
        });
      }else if(callback){
        handleGUIEdit(function(){
          alert(callback + " is not a function!");
        });
      }
    }

    try{
      if(asRoot){
        process = Runtime.getRuntime().exec("su");
        reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
        writer = new DataOutputStream(process.getOutputStream());

        if(isArray(cmds)){
          output = [];
          cmds.forEach(function(cmd){
            if(exec(cmd, writer)){
              handleCallback(onExecuted);
            }
          });

          exec("exit", writer);
          writer.close();

          output = readOutput(reader);
          handleCallback(callback, output);
        }else{
          var succes = exec(cmds, writer);

          exec("exit", writer);
          writer.close();

          if(succes){
            output = readOutput(reader);
            handleCallback(onExecuted);
            handleCallback(callback, output);
          }
        }

        reader.close();
        process.waitFor();
      }else{
        if(isArray(cmds)){
          var outputs = [];
          cmds.forEach(function(cmd){
            if(checkCmd(cmd)){
              process = Runtime.getRuntime().exec(cmd);
              reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
              output = readOutput(reader);
              reader.close();
              outputs.push(output);
              handleCallback(onExecuted);
              handleCallback(callback, output);
            }
          });
          process.waitFor();
          return outputs;
        }else{
          process = Runtime.getRuntime().exec(cmds);
          reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
          output = readOutput(reader);
          reader.close();
          process.waitFor();
          handleCallback(onExecuted);
          handleCallback(callback, output);
          return output;
        }
      }
    }catch(err){
      handleGUIEdit(function(){
        alert("At line " + err.lineNumber + ": " + err);
      });
    }
  }

  if(asRoot && isArray(callback))
    throw new Error("Multiple callbacks are not possible in su mode. Use onExecuteds instead.");

  if(newThread){
    startNewBackgroundThread(function(){
      execCmd();
    });
  }else{
    return execCmd();
  }
}

function getPackageName(it){
  try{
    return it.getIntent().getComponent().getPackageName();
  }catch(e){
    return null;
  }
}

function isFreezable(pkgName){
  if(!pkgName)
    return false;

  var onBlackList = false, onWhiteList;
  for(var i = 0; i < blackList.length; i++){
    if(pkgName == blackList[i]){
      onBlackList = true;
      break;
    }
  }

  if(whiteList.length == 0){
    onWhiteList = true;
  }else{
    onWhiteList = false;
    for(var i = 0; i < whiteList.length; i++){
      if(pkgName == whiteList[i]){
        onWhiteList = true;
        break;
      }
    }
  }

  return !onBlackList && onWhiteList;
}

function freezeChecks(it, allGood, giveFeedback){
  var pkgName = getPackageName(it)
    , freezeAble = isFreezable(pkgName);
  if(pkgName && freezeAble){
    allGood(pkgName);
  }else if(giveFeedback !== false){
    if(!pkgName)
      Toast.makeText(context, it + " doesn't launch an app!", Toast.LENGTH_SHORT).show();
    else if(!freezeAble)
      Toast.makeText(context, "Cannot freeze/unfreeze! (Probably because of black- or whitelist", Toast.LENGTH_SHORT).show();
  }
}

function freeze(it){
  if(it.getType() == "Folder"){
    freezeContainer(it.getContainer());
  }else{
    freezeChecks(it, function(pkgName){
      runCmd("pm disable " + pkgName, true, true, null, function(){
        freezeEffect(it);
      });
    });
  }
}

function unfreeze(it){
  if(it.getType() == "Folder"){
    unfreezeContainer(it.getContainer());
  }else{
    freezeChecks(it, function(pkgName){
      runCmd("pm enable " + pkgName, true, true, null, function(){
        unfreezeEffect(it);
      });
    });
  }
}

function freezeEffect(it){
  it.getProperties().edit().setInteger("s.iconColorFilter", 0x00ffffff).commit();
  it.setTag("frozen", true);
}

function unfreezeEffect(it){
  it.getProperties().edit().setInteger("s.iconColorFilter", 0xffffffff).commit();
  it.setTag("frozen", false);
}

function batchFreezeAction(items, action, callback){
  var frozenStateChecker, cmd, effect;
  if(action == "freeze"){
    frozenStateChecker = function(it){ return !isFrozen(it); };
    cmd = "pm disable ";
    effect = function(it){ freezeEffect(it); }
  }else if(action == "unfreeze"){
    frozenStateChecker = function(it){ return isFrozen(it); };
    cmd = "pm enable ";
    effect = function(it){ unfreezeEffect(it); }
  }

  var freezableItems = []
    , cmds = [];

  items.forEach(function(it){
    if(frozenStateChecker(it)){
      freezeChecks(it, function(pkgName){
        freezableItems.push(it);
        cmds.push(cmd + pkgName);
      }, false);
    }
  });

  if(cmds.length != 0){
    var counter = 0;
    runCmd(cmds, true, true, function(){
      callback();
    }, function(){
      effect(freezableItems[counter]);
      counter++;
    });
  }
}

function containerFreezeAction(c, effect){
  var cs = screen.getAllContainersById(c.getId());
  cs.forEach(function(c){
    var opener;
    if((opener = c.getOpener()) && opener.getType() == "Folder")
      effect(opener);
  });
}

function freezeContainer(c){
  batchFreezeAction(c.getAllItems(), "freeze", function(){
    containerFreezeAction(c, freezeEffect);
  });
}

function unfreezeContainer(c){
  batchFreezeAction(c.getAllItems(), "unfreeze", function(){
    containerFreezeAction(c, unfreezeEffect);
  });
}

function isFrozen(it){
  return it.getTag("frozen") == "true";
}

function getFrozenApps(){
  if(frozenApps == null){
    frozenApps = [];
    var pkgs = runCmd("pm list packages -d", false, false);
    pkgs.forEach(function(pkg, i){
      frozenApps[i] = pkg.split(":")[1];
    });
  }
  return frozenApps;
}

function syncContainer(c){
  startNewBackgroundThread(function(){
    var items = c.getItems();
    for(var i = 0; i < items.length; i++){
      syncItem(items.getAt(i));
    }
  });
}

function syncItem(it){
  var frozenApps = getFrozenApps();
  if(it.getType() == "Shortcut"){
    var pkgName = getPackageName(it);
    if(pkgName && isFreezable(pkgName)){
      var isFrozen = it.getTag("frozen") == "true";
      var matched = frozenApps.some(function(pkg){
        return pkg == pkgName;
      });
      if(!isFrozen && matched){
        handleGUIEdit(function(){
          freezeEffect(it);
        });
      }else if(isFrozen && !matched){
        handleGUIEdit(function(){
          unfreezeEffect(it);
        });
      }
    }
  }
}

/**
 * If this function is executed in a thread that is the main GUI thread, execute func, or else execute func in the main GUI thread. (Android doesn't like it when you change the GUI outside of the main GUI thread)
 * @param func {function}
 */
function handleGUIEdit(func){
  if(Looper.getMainLooper().getThread() == Thread.currentThread()){
    func();
  }else{
    GUIHandler.post(func);
  }
}

/**
 * Starts a new background thread with func.
 * @param func {function} - The function the thread executes.
 */
function startNewBackgroundThread(func){
  var thread = new Thread(function(){
    func();
    // if a looper was initialized in func, make sure the thread can die by stopping the thread when the Looper idles.
    if(threads[Thread.currentThread().getId()].prepared == true){
      Looper.myLooper().getQueue().addIdleHandler(function(){
        Looper.myLooper().quitSafely();
      });
      Looper.loop();
    }
  });
  thread.setUncaughtExceptionHandler(function(th, ex){
    handleGUIEdit(function(){
      alert(ex.getMessage());
    })
  });
  threads[thread.getId()] = {};
  thread.start();
}

/**
 * Gets a handler for the current thread and initializes a looper if necessary.
 * @returns {Handler}
 */
function getHandler(){
  if(Looper.getMainLooper().getThread() == Thread.currentThread()){
    return GUIHandler;
  }else{
    var threadId = Thread.currentThread().getId();
    if(threads[threadId].prepared != true){
      Looper.prepare();
      threads[threadId].prepared = true;
    }
    return new Handler();
  }
}

if(typeof getEvent != "undefined"){
  var c
    , e = getEvent()
    , it = e.getItem()
    , data = e.getData();
  if(data){
    if(data == "sync"){
      if(c = e.getContainer()){
        syncContainer(c);
      }else{
        throw new Error("Could not find a way to determine the container to sync. Run the script from an item in the container or from the container itself or add the container id directly afrer 'sync'.")
      }
    }else if(data.substring(0, 4) == "sync"){
      var cId = data.substring(4, data.length);
      c = screen.getContainerById(cId);
      if(!c) throw new Error("Could not find container with id:" + cId);
      syncContainer(c);
    }
  }else{
    if(!it){
      c = e.getContainer();
      cId = c.getId();
      if(c.getTag("longTapFreeze") == "true"){
        if(confirm("Are you sure you want to uninstall?")){
          uninstall(c);
          Toast.makeText(context, "Uninstalled!", Toast.LENGTH_SHORT).show();
        }
      }else{
        if(confirm("Are you sure you want to install?")){
          c.setTag("longTapFreeze", true);
          setEventHandlerRestorably(c, freezeEvent, EventHandler.RUN_SCRIPT, script.getId());
          setEventHandlerRestorably(c, "i.menu", EventHandler.RUN_SCRIPT, script.getId());
          setEventHandlerRestorably(c, "menu", EventHandler.RUN_SCRIPT, script.getId());
          if(confirm("Do you want to enable autosync?")){
            setEventHandlerRestorably(c, "resumed", EventHandler.RUN_SCRIPT, script.getId() + "/sync");
            syncContainer(c);
            c.setTag("autosync", true);
          }
          Toast.makeText(context, "Installed!", Toast.LENGTH_SHORT).show();
        }
      }
    }else{
      //long tap
      var src = e.getSource();
      if(src == freezeSource){
        if(isFrozen(it)){
          unfreeze(it);
        }else{
          freeze(it);
        }
      }
    }
  }
}else if(menu){
  var mode = menu.getMode();
  if(mode == Menu.MODE_ITEM_SUBMENU_ACTION || mode == Menu.MODE_ITEM_NO_EM){
    menu.addMainItem("Sync frozen-state", function(){
      syncItem(item);
      menu.close();
    });
  }else if(mode == Menu.MODE_CONTAINER_SUBMENU_ITEMS){
    menu.addMainItem("Sync frozen-state", function(){
      syncContainer(container);
      menu.close();
    });
    menu.addMainItem("Freeze all items", function(){
      freezeContainer(container);
      menu.close();
    });
    menu.addMainItem("Unfreeze all items", function(){
      unfreezeContainer(container);
      menu.close();
    });
  }
}