import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import Stripe from "stripe";

dotenv.config();
const app=express();
const db=new Database("fcspecialist.db");
const PORT=process.env.PORT||3000;
const BASE_URL=process.env.BASE_URL||`http://localhost:${PORT}`;
const JWT_SECRET=process.env.JWT_SECRET||"dev-only-change-this";
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,service TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,stripe_session_id TEXT UNIQUE,stripe_subscription_id TEXT,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS slots(id INTEGER PRIMARY KEY AUTOINCREMENT,starts_at TEXT NOT NULL,duration_minutes INTEGER NOT NULL DEFAULT 45,booked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,order_id INTEGER NOT NULL,slot_id INTEGER NOT NULL UNIQUE,notes TEXT,status TEXT NOT NULL DEFAULT 'confirmed',created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(order_id) REFERENCES orders(id),FOREIGN KEY(slot_id) REFERENCES slots(id));
`);
function now(){return new Date().toISOString()}
function tokenFor(u){return jwt.sign({id:u.id,email:u.email},JWT_SECRET,{expiresIn:"14d"})}
function publicUser(r){return {id:r.id,name:r.name,email:r.email}}
function auth(req,res,next){try{const t=req.cookies.fcs_token;if(!t)return res.status(401).json({error:"Please sign in."});const p=jwt.verify(t,JWT_SECRET);const u=db.prepare("SELECT id,name,email FROM users WHERE id=?").get(p.id);if(!u)return res.status(401).json({error:"Session expired."});req.user=u;next()}catch{return res.status(401).json({error:"Please sign in again."})}}
function seedSlots(){if(db.prepare("SELECT COUNT(*) c FROM slots").get().c)return;const ins=db.prepare("INSERT INTO slots(starts_at,duration_minutes) VALUES(?,45)");const tx=db.transaction(()=>{for(let i=1;i<=28;i++){const d=new Date();d.setDate(d.getDate()+i);for(const hour of [18,19,20]){const s=new Date(d);s.setHours(hour,0,0,0);if(s>new Date())ins.run(s.toISOString())}}});tx()}
seedSlots();

// Stripe webhook must receive raw body before express.json().
app.post("/api/stripe/webhook",express.raw({type:"application/json"}),(req,res)=>{if(!stripe||!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).send("Stripe not configured");let event;try{event=stripe.webhooks.constructEvent(req.body,req.headers["stripe-signature"],process.env.STRIPE_WEBHOOK_SECRET)}catch(e){return res.status(400).send(`Webhook error: ${e.message}`)}const s=event.data.object;if(event.type==="checkout.session.completed"){const o=db.prepare("SELECT * FROM orders WHERE stripe_session_id=?").get(s.id);if(o){db.prepare("UPDATE orders SET status='paid',stripe_subscription_id=COALESCE(?,stripe_subscription_id) WHERE id=?").run(s.subscription||null,o.id)}}if(event.type==="invoice.paid"&&s.subscription){db.prepare("UPDATE orders SET status='paid',stripe_subscription_id=? WHERE stripe_subscription_id=?").run(s.subscription,s.subscription)}if(event.type==="customer.subscription.deleted"&&s.id){db.prepare("UPDATE orders SET status='cancelled' WHERE stripe_subscription_id=?").run(s.id)}res.json({received:true})});
app.use(express.json());app.use(cookieParser());app.use(express.static("public"));

const services={
 review:{name:"Gameplay Review",amount:1500,description:"Personalised gameplay breakdown and written action plan.",mode:"payment"},
 coaching:{name:"1:1 Live Coaching",amount:2500,description:"45-minute live coaching session with tactics and a focused game plan.",mode:"payment"},
 monthly:{name:"Monthly Coaching",amount:14900,description:"2 x 1:1 coaching sessions every week, up to 8 sessions per month.",mode:"subscription"}
};

app.post("/api/auth/register",async(req,res)=>{const{name,email,password}=req.body||{};if(!name||!email||!password||password.length<8)return res.status(400).json({error:"Use your name, a valid email and a password of at least 8 characters."});const n=email.trim().toLowerCase();if(db.prepare("SELECT id FROM users WHERE email=?").get(n))return res.status(409).json({error:"An account already exists for this email."});const hash=await bcrypt.hash(password,12);const info=db.prepare("INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)").run(name.trim(),n,hash,now());const u=db.prepare("SELECT id,name,email FROM users WHERE id=?").get(info.lastInsertRowid);res.cookie("fcs_token",tokenFor(u),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:14*864e5});res.json({user:publicUser(u)})});
app.post("/api/auth/login",async(req,res)=>{const{email,password}=req.body||{};const u=db.prepare("SELECT * FROM users WHERE email=?").get((email||"").trim().toLowerCase());if(!u||!(await bcrypt.compare(password||"",u.password_hash)))return res.status(401).json({error:"Email or password is incorrect."});res.cookie("fcs_token",tokenFor(u),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:14*864e5});res.json({user:publicUser(u)})});
app.post("/api/auth/logout",(req,res)=>{res.clearCookie("fcs_token");res.json({ok:true})});
app.get("/api/me",auth,(req,res)=>res.json({user:publicUser(req.user)}));
app.get("/api/services",(req,res)=>res.json(services));
app.get("/api/slots",auth,(req,res)=>res.json({slots:db.prepare("SELECT id,starts_at,duration_minutes FROM slots WHERE booked=0 AND starts_at>? ORDER BY starts_at LIMIT 60").all(now())}));
app.post("/api/checkout",auth,async(req,res)=>{const service=services[req.body?.service];if(!service)return res.status(400).json({error:"Choose a valid service."});const order=db.prepare("INSERT INTO orders(user_id,service,amount,currency,status,created_at) VALUES(?,?,?,?,?,?)").run(req.user.id,Object.keys(services).find(k=>services[k]===service),service.amount,process.env.STRIPE_CURRENCY||"gbp","pending",now());const orderId=Number(order.lastInsertRowid);if(!stripe){db.prepare("UPDATE orders SET status='paid' WHERE id=?").run(orderId);return res.json({demo:true,redirect:`/dashboard.html?order=${orderId}`})}try{const params={mode:service.mode,customer_email:req.user.email,line_items:[{price_data:{currency:process.env.STRIPE_CURRENCY||"gbp",product_data:{name:service.name,description:service.description},unit_amount:service.amount,...(service.mode==="subscription"?{recurring:{interval:"month"}}:{})},quantity:1}],metadata:{order_id:String(orderId),user_id:String(req.user.id),service:Object.keys(services).find(k=>services[k]===service)},success_url:`${BASE_URL}/dashboard.html?paid=1`,cancel_url:`${BASE_URL}/checkout.html?cancelled=1`};const session=await stripe.checkout.sessions.create(params);db.prepare("UPDATE orders SET stripe_session_id=? WHERE id=?").run(session.id,orderId);res.json({url:session.url})}catch(e){db.prepare("DELETE FROM orders WHERE id=?").run(orderId);console.error(e);res.status(500).json({error:"Checkout could not be created."})}});
app.get("/api/orders",auth,(req,res)=>res.json({orders:db.prepare("SELECT o.id,o.service,o.amount,o.currency,o.status,o.created_at,b.id booking_id,s.starts_at FROM orders o LEFT JOIN bookings b ON b.order_id=o.id LEFT JOIN slots s ON s.id=b.slot_id WHERE o.user_id=? ORDER BY o.created_at DESC").all(req.user.id)}));
app.post("/api/book",auth,(req,res)=>{const{order_id,slot_id,notes}=req.body||{};const order=db.prepare("SELECT * FROM orders WHERE id=? AND user_id=? AND status='paid' AND service IN ('coaching')").get(order_id,req.user.id);if(!order)return res.status(400).json({error:"You need a paid 1:1 coaching order before booking a slot."});const slot=db.prepare("SELECT * FROM slots WHERE id=? AND booked=0").get(slot_id);if(!slot)return res.status(409).json({error:"That slot has just been taken. Please choose another."});try{db.transaction(()=>{const changed=db.prepare("UPDATE slots SET booked=1 WHERE id=? AND booked=0").run(slot_id);if(!changed.changes)throw new Error("taken");db.prepare("INSERT INTO bookings(user_id,order_id,slot_id,notes,created_at) VALUES(?,?,?,?,?)").run(req.user.id,order_id,slot_id,notes||"",now())})();res.json({ok:true})}catch{res.status(409).json({error:"That slot is no longer available."})}});
app.get("/api/dashboard",auth,(req,res)=>{const orders=db.prepare("SELECT o.*,b.id booking_id,s.starts_at FROM orders o LEFT JOIN bookings b ON b.order_id=o.id LEFT JOIN slots s ON s.id=b.slot_id WHERE o.user_id=? ORDER BY o.created_at DESC").all(req.user.id);const bookings=db.prepare("SELECT b.*,s.starts_at,s.duration_minutes,o.service FROM bookings b JOIN slots s ON s.id=b.slot_id JOIN orders o ON o.id=b.order_id WHERE b.user_id=? ORDER BY s.starts_at").all(req.user.id);res.json({user:publicUser(req.user),orders,bookings})});
app.get("*",(req,res)=>res.sendFile("index.html",{root:"public"}));
app.listen(PORT,"0.0.0.0",()=>console.log(`FCspecialist running at ${BASE_URL}`));
