var blackList = ["net.pierrox.lightning_launcher_extreme"];
var whiteList = [];

var logScript = LL.getScriptByName('logScript');
if(logScript!=null){ return eval('(function() {' + logScript.getText() + '}())'); }else{throw("logScript not found!");} //logScriptEnd
 
LL.bindClass("android.app.AlertDialog");
LL.bindClass("android.content.DialogInterface");
LL.bindClass("android.widget.Toast");
LL.bindClass("android.content.pm.PackageManager");
LL.bindClass('java.lang.Runtime');
LL.bindClass('java.io.DataInputStream');
LL.bindClass('java.io.DataOutputStream');
LL.bindClass('java.lang.StringBuffer');

var e = LL.getEvent();
var it = e.getItem();
var script = LL.getCurrentScript();
var context = LL.getContext();
 
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
  if(c!=null){
    c.setTag("longTapFreeze",false);
    returnEventHandler(c,"i.longTap");
    returnEventHandler(c, "resumed");
    var frozenItIds = JSON.parse(c.getTag("frozenItIds"));
    if(frozenItIds!=null){
      for(var i=0;i<frozenItIds.length;i++){
        var it = c.getItemById(frozenItIds[i]);
        if(it!=null){
          it.getProperties().edit().setInteger("s.iconColorFilter",0xffffffff).commit();
          it.setTag("frozen",false);
        }
      }
      c.setTag("frozenItIds",null);
    }
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
    return err;
  }
}

function isFreezable(it){
  var onBlackList = false;
  try{
    var pkgName = it.getIntent().getComponent().getPackageName();
  }catch(e){
    Toast.makeText(context, "This item doesn't launch an app!", Toast.LENGTH_SHORT).show();
  }
  if(pkgName!=null){
    for(var i=0;i<blackList.length;i++){
      if(pkgName==blackList[i]){
        onBlackList=true;
        Toast.makeText(context, "on blacklist!", Toast.LENGTH_SHORT).show();
        break;
      }
    }
    onWhiteList = true;
    if(whiteList.length!=0){
      onWhiteList = false;
      for(var i=0;i<whiteList.length;i++){
        if(pkgName==whiteList[i]){
          onWhiteList=true;
          break;
        }
      }
    }
    var pm = context.getPackageManager();
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
    }
    if(!onBlackList && onWhiteList && toolboxInstalled){
      return {sendToPkg: sendToPkg, pkgName: pkgName};
    }
  }
  return false;
}

function freeze(it){
  it.getProperties().edit().setInteger("s.iconColorFilter",0x00ffffff).commit();
  it.setTag("frozen",true);
  frozenItIds.push(it.getId());
}

function unfreeze(it){
  it.getProperties().edit().setInteger("s.iconColorFilter",0xffffffff).commit();
  it.setTag("frozen",false);
  frozenItIds.splice(frozenItIds.indexOf(it.getId()),1);
}
 
if(it==null){
  var c = e.getContainer();
  var cIds = JSON.parse(script.getTag("cIds"));
  if(cIds==null)cIds=[];
  if(c!=null){
    if(e.getSource()=="C_RESUMED"){
      var frozenApps = runAsRoot("pm list packages -d");
      for(var i=0;i<frozenApps.length;i++){
        frozenApps[i] = frozenApps[i].split(":")[1];
      }
      var items = c.getItems();
      var frozenItIds = JSON.parse(c.getTag("frozenItIds"));
      if(frozenItIds==null)frozenItIds=[];
      for(var i = 0; i<items.length; i++){
        var it = items.getAt(i);
        if(it.getType()=="Shortcut"){
          var matched = false;
          var isFrozen = it.getTag("frozen")
          if(isFrozen==null){
            isFrozen==false;
          }else{
            isFrozen = isFrozen.valueOf();
          }
          for(var j = 0; j<frozenApps.length; j++){
            if(it.getIntent().getComponent().getPackageName().split("/") == frozenApps[j]){
              matched = true;
              if(isFreezable(it) && !isFrozen){
                freeze(it);
              }
            }
          }
          if(!matched && isFrozen){
            unfreeze(it);
          }
        }
      }
      c.setTag("frozenItIds", JSON.stringify(frozenItIds));
    }else{
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
          loanEventHandler(c, "i.longTap", EventHandler.RUN_SCRIPT, script.getId());
          loanEventHandler(c, "resumed", EventHandler.RUN_SCRIPT, script.getId());
          script.setTag("cIds", JSON.stringify(cIds));
          Toast.makeText(context, "Installed!", Toast.LENGTH_SHORT).show();
        });
      }
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
}else{
  var c = it.getParent();
  var frozenItIds = JSON.parse(c.getTag("frozenItIds"));
  if(frozenItIds==null)frozenItIds=[];
  var freezeInfo;
  if((freezeInfo = isFreezable(it)) != false){
    LL.runAction(EventHandler.LAUNCH_SHORTCUT, "#Intent;action=ccc71.at.freeze;launchFlags=0x34000000;component="+freezeInfo.sendToPkg+"/ccc71.at.activities.tweaks.at_tweaker_activity;S.ccc71.at.packagename="+freezeInfo.pkgName+";end");
    if(it.getTag("frozen")=="true"){
      unfreeze(it);
    }else{
      freeze(it);
    }
  c.setTag("frozenItIds", JSON.stringify(frozenItIds));
  }
}
delete(AlertDialog);