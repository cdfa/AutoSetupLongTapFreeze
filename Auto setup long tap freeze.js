var blackList = ["net.pierrox.lightning_launcher_extreme"]
  , whiteList = []
  // for Sources see: http://www.lightninglauncher.com/scripting/reference/api/reference/net/pierrox/lightning_launcher/script/api/Event.html
  // for Event see http://www.lightninglauncher.com/scripting/reference/api/reference/net/pierrox/lightning_launcher/script/api/PropertySet.html
  // you may only have to set 1 in the future.
  , freezeSource = "I_LONG_CLICK"
  , freezeEvent = "i.longTap"
  , menuSource = "I_SWIPE_UP"
  , menuEvent = "i.swipeUp";

var logScript=LL.getScriptByName('logScript');if(logScript){try{return eval('(function(){'+logScript.getText()+'})()');}catch(e){if(e.message!="Custom view not found!"&&e.message!="Custom view not loaded!"){alert(e);}function log(){}}}else{function log(){}}/*logScriptEnd*/
 
LL.bindClass("android.app.AlertDialog");
LL.bindClass("android.content.DialogInterface");
LL.bindClass("android.widget.Toast");
LL.bindClass("android.content.pm.PackageManager");
LL.bindClass('java.lang.Runtime');
LL.bindClass('java.io.DataInputStream');
LL.bindClass('java.io.DataOutputStream');
LL.bindClass('java.lang.StringBuffer');
LL.bindClass("java.lang.Runnable");
LL.bindClass("java.lang.Thread");
LL.bindClass("android.os.AsyncTask");

var e = LL.getEvent();
var it = e.getItem();
var script = LL.getCurrentScript();
var context = LL.getContext();
var data = e.getData();
 
function loanEventHandler(ob, name, action, data){
  var prop = ob.getProperties();
  var ed = prop.edit();
  var evHa = prop.getEventHandler(name);
  evHa = [evHa.getAction(), evHa.getData()];
  ed.setEventHandler(name, action, data);
  ed.commit();
  ob.setTag("old "+name+" evHa", JSON.stringify(evHa));
}
 
function returnEventHandler(ob, name){
  var ed = ob.getProperties().edit();
  var evHa = JSON.parse(ob.getTag("old "+name+" evHa"));
  ed.setEventHandler(name, evHa[0], evHa[1]);
  ed.commit();
  ob.setTag("name", null);
}
 
function customConfirmDialog(title,onConfirmFunction){
  var builder=new AlertDialog.Builder(context);
  builder.setCancelable(true);
  builder.setTitle(title);
  builder.setNegativeButton("Cancel",new DialogInterface.OnClickListener(){onClick:function(dialog,id){dialog.dismiss();}});
  builder.setPositiveButton("Confirm",new DialogInterface.OnClickListener(){onClick:function(dialog,id){dialog.dismiss();setTimeout(onConfirmFunction,0);}});
  builder.show();
}
 
function uninstall(c){
  if(c){
    c.setTag("longTapFreeze",false);
    returnEventHandler(c, freezeEvent);
    returnEventHandler(c, menuEvent);
    if(c.getTag("autosync")=="true")returnEventHandler(c, "resumed");
    var frozenItIds = getFrozenItIds(c)
    for(var i=0;i<frozenItIds.length;i++){
      var it = c.getItemById(frozenItIds[i]);
      if(it){
        it.getProperties().edit().setInteger("s.iconColorFilter",0xffffffff).commit();
        it.setTag("frozen",false);
      }
    }
    c.setTag("frozenItIds",null);
  }
}

function runAsRoot(cmd) {
  try {
    var process = Runtime.getRuntime().exec("su");
    var reader = new DataInputStream(process.getInputStream());
    var writer = new DataOutputStream(process.getOutputStream());

    writer.writeBytes(cmd + '\n');
    writer.flush();
    writer.close();

    var tmp;
    var output = [];
    while ((tmp = reader.readLine()) != null) {
      output.push(tmp);
    }
    reader.close();
    process.waitFor();
    return output;
  } catch (err) {
    log("{} At line {}", logScript.logLevel.ERROR, err, err.lineNumber);
  }
}

function getPackageName(it){
  try{
    return it.getIntent().getComponent().getPackageName();
  }catch(e){
    Toast.makeText(context, "This item doesn't launch an app!", Toast.LENGTH_SHORT).show();
    return null;
  }
}

function isFreezable(pkgName){
  if(!pkgName)
    return false;
  
  var onBlackList = false;
  for(var i=0;i<blackList.length;i++){
    if(pkgName==blackList[i]){
      onBlackList=true;
      break;
    }
  }

  if(whiteList.length==0){
    onWhiteList = true;
  }else{
    onWhiteList = false;
    for(var i=0;i<whiteList.length;i++){
      if(pkgName==whiteList[i]){
        onWhiteList=true;
        break;
      }
    }
  }

  /*var pm = context.getPackageManager();
  try {
    pm.getPackageInfo( "ccc71.at.free" , PackageManager.GET_ACTIVITIES);
    var toolboxInstalled = true;
    var sendToPkg = "ccc71.at.free";
  } catch (e) {
    try {
      pm.getPackageInfo("ccc71.at", PackageManager.GET_ACTIVITIES);
      toolboxInstalled = true;
      var sendToPkg = "ccc71.at";
    } catch (e) {
      var toolboxInstalled = false;
    }
  }*/
  
  /*if(!onBlackList && onWhiteList && toolboxInstalled){
    return {sendToPkg: sendToPkg, pkgName: pkgName};
  }*/
  
  return !onBlackList && onWhiteList;
}

function freeze(it, pkgName, frozenItIds){
  runAsRoot("pm disable "+pkgName);
  freezeEffect(it, frozenItIds);
}

function unfreeze(it, pkgName, frozenItIds){
  runAsRoot("pm enable "+pkgName);
  unfreezeEffect(it, frozenItIds);
}

function freezeEffect(it, frozenItIds){
  it.getProperties().edit().setInteger("s.iconColorFilter",0x00ffffff).commit();
  it.setTag("frozen",true);
  frozenItIds.push(it.getId());
}

function unfreezeEffect(it, frozenItIds){
  it.getProperties().edit().setInteger("s.iconColorFilter",0xffffffff).commit();
  it.setTag("frozen",false);
  frozenItIds.splice(frozenItIds.indexOf(it.getId()),1);
}

function getFrozenItIds(c){
  return JSON.parse(c.getTag("frozenItIds")) || []
}

function getFrozenApps(){
  var frozenApps = runAsRoot("pm list packages -d");
  for(var i=0;i<frozenApps.length;i++){
    frozenApps[i] = frozenApps[i].split(":")[1];
  }
  return frozenApps;
}

function syncContainer(c){
  if(!frozenItIds) var frozenItIds = getFrozenItIds(c);
  if(!frozenApps) var frozenApps = getFrozenApps();
  var items = c.getItems();
  for(var i = 0; i<items.length; i++){
    syncItem(items.getAt(i), frozenApps, frozenItIds);
  }
  c.setTag("frozenItIds", JSON.stringify(frozenItIds));
}

function syncItem(it, frozenApps, frozenItIds){
  if(!frozenItIds) var frozenItIds = getFrozenItIds(it.getParent());
  if(!frozenApps) var frozenApps = getFrozenApps();
  if(it.getType()=="Shortcut"){
    var pkgName = getPackageName(it);
    if(pkgName && isFreezable(pkgName)){
      var matched = false;
      var isFrozen = it.getTag("frozen")=="true";
      for(var j = 0; j<frozenApps.length; j++){
        //if(it.getIntent().getComponent().getPackageName().split("/") == frozenApps[j]){
        if(pkgName==frozenApps[j]){
          matched = true;
          if(isFreezable(it) && !isFrozen){
            freezeEffect(it, frozenItIds);
          }
        }
      }
      if(!matched && isFrozen){
        unfreezeEffect(it, frozenItIds);
      }
    }
  }
}

if(data){
  if(data.length == 4){
    var c;
    if(it){
      syncContainer(it.getParent());
    }else if(c = e.getContainer()){
      syncContainer(c);
    }else{
      throw new Error("Could not find a way to determine the container to sync. Run the script from an item in the container or from the container itself or add the container id directly afrer 'sync'.")
    }
  }else if(data.substring(0,4) == "sync"){
    var cId = data.substring(4, data.length)
    var c = LL.getContainerById(cId);
    if(!c)throw new Error("Could not find container with id:"+ cId)
    syncContainer(c);
  }
}else{
  if(!it){
    var c = e.getContainer();
    var cIds = JSON.parse(script.getTag("cIds")) || [];
    if(c){
      cId = c.getId();
      if(c.getTag("longTapFreeze")=="true"){
        customConfirmDialog("Are you sure you want to uninstall?", function(){
          uninstall(c);
          cIds.splice(cIds.indexOf(c.getId()),1);
          script.setTag("cIds", JSON.stringify(cIds));
          Toast.makeText(context, "Uninstalled!", Toast.LENGTH_SHORT).show();
        });
      }else{
        customConfirmDialog("Are you sure you want to install?", function(){
          cIds.push(c.getId());
          c.setTag("longTapFreeze",true);
          loanEventHandler(c, freezeEvent, EventHandler.RUN_SCRIPT, script.getId());
          loanEventHandler(c, menuEvent, EventHandler.RUN_SCRIPT, script.getId());
          customConfirmDialog("Do you want to enable autosync?", function(){
            loanEventHandler(c, "resumed", EventHandler.RUN_SCRIPT, script.getId()+"sync");
            c.setTag("autosync", true);
          });
          script.setTag("cIds", JSON.stringify(cIds));
          Toast.makeText(context, "Installed!", Toast.LENGTH_SHORT).show();
        });
      }
    }else{
      customConfirmDialog("Are you sure you want to uninstall from every container?", function(){
        for(var i=0;i<cIds.length;i++){
          uninstall(LL.getContainerById(cIds[i]));
        }
        script.setTag("cIds",null);
        Toast.makeText(context, "Uninstalled everywhere!", Toast.LENGTH_SHORT).show();
      });
    }
  } else {
    var src = e.getSource();
    if(src==freezeSource){
      var c = it.getParent();
      var frozenItIds = getFrozenItIds(c)
      //var freezeInfo;
      var pkgName = getPackageName(it);
      if(isFreezable(pkgName)){
        //LL.runAction(EventHandler.LAUNCH_SHORTCUT, "#Intent;action=ccc71.at.freeze;launchFlags=0x34000000;component="+freezeInfo.sendToPkg+"/ccc71.at.activities.tweaks.at_tweaker_activity;S.ccc71.at.packagename="+freezeInfo.pkgName+";end");
        if(it.getTag("frozen")=="true"){
          unfreeze(it, pkgName, frozenItIds);
        }else{
          freeze(it, pkgName, frozenItIds);
        }
      c.setTag("frozenItIds", JSON.stringify(frozenItIds));
      }else{
        Toast.makeText(context, "Cannot freeze/unfreeze! (Probably because of black- or whitelist", Toast.LENGTH_SHORT).show();
      }
    }else if(src == menuSource){
      LL.bindClass("android.R");
      LL.bindClass("java.util.ArrayList");
      LL.bindClass("android.view.ViewTreeObserver");
      LL.bindClass("android.widget.Button");
      LL.bindClass("android.view.View");
      LL.bindClass("android.os.Build");

      var pkg = context.getPackageName();
      var rsrc = context.getResources();
      var id = rsrc.getIdentifier("bubble_content", "id",  pkg);
      var menu = context.getWindow().getDecorView().findViewById(id);
      var menuRoot = menu.getParent();
      var version = Build.VERSION.SDK_INT;
      
      function add(text,onClickFunction,first,list){
        var t=new Button(LL.getContext());
        if(version >= 16) t.setBackground(first.getBackground().mutate().getConstantState().newDrawable());
        else t.setBackgroundDrawable(first.getBackground().mutate().newDrawable());
        t.setTypeface(first.getTypeface());
        if(version >= 14) t.setAllCaps(false);
        t.setTextSize(0,first.getTextSize());
        if(version >= 21) t.setFontFeatureSettings(first.getFontFeatureSettings());
        t.setGravity(first.getGravity());
        t.setText(text);
        t.setOnClickListener(new View.OnClickListener(){
        onClick:onClickFunction
        });
        list.addView(t);
      }

      var obs=menuRoot.getViewTreeObserver();
      var l=new ViewTreeObserver.OnGlobalLayoutListener(){
        onGlobalLayout:function(){
          var list=menu;
          var first=list.getChildAt(0);
          add("Sync", function(){
            syncItem(it);
          },first, list)
          obs.removeOnGlobalLayoutListener(l);
          return true;
        }
      };﻿

      obs.addOnGlobalLayoutListener(l);
      LL.runAction(EventHandler.LAUNCHER_MENU);
    }
  }
}