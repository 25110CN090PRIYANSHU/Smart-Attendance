const clients = new Map();
function addClient(sessionId,res){
  const key=String(sessionId); if(!clients.has(key)) clients.set(key,new Set());
  clients.get(key).add(res); res.on("close",()=>{const set=clients.get(key);if(!set)return;set.delete(res);if(!set.size)clients.delete(key);});
}
function publish(sessionId,event,data){const set=clients.get(String(sessionId));if(!set)return;const payload=`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;for(const res of set){try{res.write(payload);}catch(_){}}}
module.exports={addClient,publish};
