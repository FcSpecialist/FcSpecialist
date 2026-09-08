const $=s=>document.querySelector(s);
const serviceNames={review:"Gameplay Review",coaching:"1:1 Live Coaching",champs1:"FUT Champions Rank 1 Coaching",champs2:"FUT Champions Rank 2 Coaching",champs3:"FUT Champions Rank 3 Coaching",champs4:"FUT Champions Rank 4 Coaching",champs5:"FUT Champions Rank 5 Coaching",monthly:"Monthly Coaching"};
const serviceName=s=>serviceNames[s]||s;
const bookable=new Set(["coaching","champs1","champs2","champs3","champs4","champs5","monthly"]);
let dashboardData=null;
async function load(){
  const r=await fetch("/api/dashboard");
  if(!r.ok){location.href="/login.html";return}
  dashboardData=await r.json();
  $("#name").textContent=dashboardData.user.name;
  const orders=dashboardData.orders||[];
  $("#orders").innerHTML=orders.length?orders.map(o=>{
    const paid=o.status==="paid";
    const state=o.booking_id?"Session booked":paid?"Ready to use":o.status;
    return `<div class="order"><b>${serviceName(o.service)}</b><span class="status ${o.status}">${o.status}</span><br><span>£${(o.amount/100).toFixed(2)} · ${state}</span></div>`;
  }).join(""):"<p class='muted'>No purchases yet.</p>";

  const eligible=orders.filter(o=>o.status==="paid"&&bookable.has(o.service)&&(o.service==="monthly"?true:!o.booking_id));
  $("#bookingBox").style.display=eligible.length?"block":"none";
  $("#order").innerHTML=eligible.map(o=>`<option value="${o.id}">${serviceName(o.service)} — £${(o.amount/100).toFixed(2)}</option>`).join("")||"<option>No coaching purchases ready to book</option>";
  const sr=await fetch("/api/slots");
  const slots=await sr.json();
  $("#slot").innerHTML=slots.slots?.length?slots.slots.map(x=>`<option value="${x.id}">${new Date(x.starts_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</option>`).join(""):"<option>No slots available</option>";

  const reviewOrders=orders.filter(o=>o.status==="paid"&&o.service==="review");
  const submittedIds=new Set((dashboardData.reviews||[]).map(x=>x.order_id));
  const pendingReviews=reviewOrders.filter(o=>!submittedIds.has(o.id));
  $("#reviewBox").style.display=reviewOrders.length?"block":"none";
  if(pendingReviews.length){
    $("#reviewContent").innerHTML=`<p>Paste a share link to your gameplay video. Make sure your coach can view it.</p><select id="reviewOrder">${pendingReviews.map(o=>`<option value="${o.id}">Gameplay Review — £${(o.amount/100).toFixed(2)}</option>`).join("")}</select><input id="gameplayUrl" type="url" placeholder="Gameplay video link (https://…)" autocomplete="url"><textarea id="reviewNotes" placeholder="What would you like your coach to focus on?"></textarea><button class="btn" id="submitReview">Submit gameplay →</button><div id="reviewMsg" class="msg"></div>`;
    $("#submitReview").onclick=submitReview;
  }else $("#reviewContent").innerHTML=reviewOrders.length?`<p class="msg">Gameplay submitted ✓</p><p class="muted">Your coach will review it and provide your breakdown.</p>`:"";

  $("#bookings").innerHTML=dashboardData.bookings?.length?dashboardData.bookings.map(b=>`<div class="session"><b>${new Date(b.starts_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</b><br>${serviceName(b.service)}</div>`).join(""):"<p class='muted'>No sessions booked yet.</p>";
}
async function submitReview(){
  const msg=$("#reviewMsg");
  const r=await fetch("/api/review-submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:Number($("#reviewOrder").value),gameplay_url:$("#gameplayUrl").value.trim(),notes:$("#reviewNotes").value.trim()})});
  const x=await r.json();msg.textContent=x.ok?"Gameplay submitted ✓":x.error||"Something went wrong.";if(x.ok)load();
}
$("#book").onclick=async()=>{
  const btn=$("#book");btn.disabled=true;btn.textContent="Confirming…";
  const r=await fetch("/api/book",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:Number($("#order").value),slot_id:Number($("#slot").value),notes:$("#notes").value.trim()})});
  const x=await r.json();$("#bookmsg").textContent=x.ok?"Booking confirmed ✓":x.error||"Something went wrong.";btn.disabled=false;btn.textContent="Confirm booking →";if(x.ok)load();
};
$("#logout").onclick=async()=>{await fetch("/api/auth/logout",{method:"POST"});location.href="/"};
load();