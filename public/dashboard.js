const $=s=>document.querySelector(s);
const serviceName=s=>s==="coaching"?"1:1 Live Coaching":s==="review"?"Gameplay Review":"Monthly Coaching";
let dashboardData=null;
async function load(){
  const r=await fetch("/api/dashboard");
  if(!r.ok){location.href="/login.html";return}
  dashboardData=await r.json();
  $("#name").textContent=dashboardData.user.name;
  $("#orders").innerHTML=dashboardData.orders.length?dashboardData.orders.map(o=>`<div class="order"><b>${serviceName(o.service)}</b><span class="status">${o.status}</span><br>£${(o.amount/100).toFixed(2)} ${o.booking_id?"• Booked":"• Ready to schedule"}</div>`).join(""):"No purchases yet.";
  const coachingOrders=dashboardData.orders.filter(o=>o.status==="paid"&&!o.booking_id&&o.service==="coaching");
  $("#bookingBox").style.display=coachingOrders.length?"block":"none";
  $("#order").innerHTML=coachingOrders.map(o=>`<option value="${o.id}">1:1 Coaching — £${(o.amount/100).toFixed(2)}</option>`).join("")||"<option>No unbooked paid 1:1 sessions</option>";
  const sr=await fetch("/api/slots");
  const slots=await sr.json();
  $("#slot").innerHTML=slots.slots.map(s=>`<option value="${s.id}">${new Date(s.starts_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</option>`).join("")||"<option>No slots available</option>";
  const reviewOrders=dashboardData.orders.filter(o=>o.status==="paid"&&o.service==="review");
  const submittedIds=new Set(dashboardData.reviews.map(r=>r.order_id));
  const pendingReviews=reviewOrders.filter(o=>!submittedIds.has(o.id));
  $("#reviewBox").style.display=reviewOrders.length?"block":"none";
  if(pendingReviews.length){
    $("#reviewContent").innerHTML=`<p>Upload your gameplay wherever you normally store your video, then paste the share link below. Make sure the link can be viewed by your coach.</p><select id="reviewOrder">${pendingReviews.map(o=>`<option value="${o.id}">Gameplay Review — £${(o.amount/100).toFixed(2)}</option>`).join("")}</select><input id="gameplayUrl" type="url" placeholder="Gameplay video link (https://…)" autocomplete="url"><textarea id="reviewNotes" placeholder="Anything you'd like your coach to focus on?"></textarea><button class="btn" id="submitReview">Submit gameplay →</button><div id="reviewMsg"></div>`;
    $("#submitReview").onclick=submitReview;
  }else{
    $("#reviewContent").innerHTML=reviewOrders.length?`<p>Gameplay submitted ✓</p><p class="muted">Your coach will review the submitted gameplay and provide your breakdown.</p>`:"";
  }
  $("#bookings").innerHTML=dashboardData.bookings.length?dashboardData.bookings.map(b=>`<div class="session"><b>${new Date(b.starts_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</b><br>${serviceName(b.service)}</div>`).join(""):"No sessions booked yet.";
}
async function submitReview(){
  const msg=$("#reviewMsg");
  const r=await fetch("/api/review-submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:Number($("#reviewOrder").value),gameplay_url:$("#gameplayUrl").value,notes:$("#reviewNotes").value})});
  const x=await r.json();
  msg.textContent=x.ok?"Gameplay submitted ✓":x.error;
  if(x.ok)load();
}
$("#book").onclick=async()=>{const r=await fetch("/api/book",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:Number($("#order").value),slot_id:Number($("#slot").value),notes:$("#notes").value})});const x=await r.json();$("#bookmsg").textContent=x.ok?"Booking confirmed ✓":x.error;if(x.ok)load()};
$("#logout").onclick=async()=>{await fetch("/api/auth/logout",{method:"POST"});location.href="/"};
load();