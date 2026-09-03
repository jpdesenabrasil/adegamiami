
// ADEGA MIAMI — Protótipo funcional
// Para usar Supabase, preencha estas duas variáveis.
const SUPABASE_URL = "https://uejphakuneilzxsrcdzq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Sy3loBK8JoIdGRdxF7OH2w_UdSfvb31";

const supabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const storageKey = "adega_miami_final_v3_datefix";

const dailyBackupKey = "adega_miami_final_v3_daily_backup";
const dailyBackupDateKey = "adega_miami_final_v3_daily_backup_date";

function createBackupPayload(){
  return {
    app:"Adega Miami",
    version:"v7",
    exported_at:new Date().toISOString(),
    data:state
  };
}

function saveDailyLocalBackup(force=false){
  const today=todayISO();
  const lastDate=localStorage.getItem(dailyBackupDateKey);
  if(force || lastDate!==today){
    localStorage.setItem(dailyBackupKey, JSON.stringify(createBackupPayload()));
    localStorage.setItem(dailyBackupDateKey, today);
  }else{
    // Mantém o backup do dia sempre atualizado com o estado mais recente.
    localStorage.setItem(dailyBackupKey, JSON.stringify(createBackupPayload()));
  }
  updateBackupStatus();
}

function updateBackupStatus(){
  const label=document.getElementById("lastBackupLabel");
  if(!label) return;
  const raw=localStorage.getItem(dailyBackupKey);
  if(!raw){
    label.textContent="Último backup local: ainda não realizado";
    return;
  }
  try{
    const parsed=JSON.parse(raw);
    const dt=new Date(parsed.exported_at);
    label.textContent="Último backup local: "+dt.toLocaleString("pt-BR");
  }catch{
    label.textContent="Último backup local: disponível";
  }
}

function exportFullBackup(){
  const payload=createBackupPayload();
  const json=JSON.stringify(payload,null,2);
  const blob=new Blob([json],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const stamp=todayISO();
  a.href=url;
  a.download=`Adega-Miami-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  saveDailyLocalBackup(true);
}

async function importFullBackup(file){
  if(!file) return;
  try{
    const text=await file.text();
    const parsed=JSON.parse(text);
    const incoming=parsed && parsed.data ? parsed.data : parsed;

    if(!incoming || !Array.isArray(incoming.orders) || !Array.isArray(incoming.expenses)){
      throw new Error("Formato inválido");
    }
    if(!Array.isArray(incoming.outflows)) incoming.outflows=[];

    const ok=confirm("Importar este backup? Os dados atuais serão substituídos.");
    if(!ok) return;

    state=incoming;
    saveState();
    saveDailyLocalBackup(true);
    renderAll();
    alert("Backup importado com sucesso.");
  }catch(err){
    alert("Não foi possível importar este backup. Verifique se o arquivo é válido.");
  }finally{
    const input=document.getElementById("importBackupInput");
    if(input) input.value="";
  }
}

const money = v => Number(v || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const localDateKey = (value = new Date()) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayISO = () => localDateKey(new Date());
const nowISO = () => new Date().toISOString();
const daysBetween = d => Math.max(0, Math.floor((new Date() - new Date(d)) / 86400000));

let state = loadState();
let role = "owner";
let calendarDate = new Date();
let selectedCalendarISO = todayISO();
let draggedOrderId = null;
let selectedOrderISO = todayISO();
let selectedFinanceISO = todayISO();


async function loadFromSupabase(){
  if(!supabaseClient) return false;

  const {data:{session}} = await supabaseClient.auth.getSession();
  if(!session) return false;

  const [ordersRes, expensesRes, outflowsRes] = await Promise.all([
    supabaseClient.from("orders").select("*").order("created_at",{ascending:false}),
    supabaseClient.from("expenses").select("*").order("created_at",{ascending:false}),
    supabaseClient.from("outflows").select("*").order("created_at",{ascending:false})
  ]);

  if(ordersRes.error) throw ordersRes.error;
  if(expensesRes.error) throw expensesRes.error;
  if(outflowsRes.error) throw outflowsRes.error;

  state.orders=(ordersRes.data||[]).map(o=>({
    id:o.id,
    name:o.client_name,
    phone:o.client_phone||"",
    items:o.items,
    value:Number(o.value||0),
    payment_method:o.payment_method,
    payment_status:o.payment_status,
    status:o.status,
    business_date:o.business_date || localDateKey(o.created_at),
    paid_date:o.paid_date || (o.paid_at ? localDateKey(o.paid_at) : null),
    paid_at:o.paid_at,
    created_at:o.created_at
  }));

  state.expenses=(expensesRes.data||[]).map(e=>({
    id:e.id,
    description:e.description,
    category:e.category||"",
    value:Number(e.value||0),
    due_date:e.due_date,
    paid:Boolean(e.paid),
    recurring:Boolean(e.recurring),
    created_at:e.created_at
  }));

  state.outflows=(outflowsRes.data||[]).map(o=>({
    id:o.id,
    description:o.description,
    value:Number(o.value||0),
    method:o.method,
    date:o.date,
    created_at:o.created_at
  }));

  localStorage.setItem(storageKey,JSON.stringify(state));
  renderAll();
  return true;
}

async function syncOrderToSupabase(order){
  if(!supabaseClient) return;
  const payload={
    client_name:order.name,
    client_phone:order.phone||null,
    items:order.items,
    value:Number(order.value||0),
    payment_method:order.payment_method,
    payment_status:order.payment_status,
    status:order.status,
    paid_at:order.paid_at||null,
    business_date:order.business_date||orderCreatedDate(order),
    paid_date:order.paid_date||null
  };
  const isUuid=typeof order.id==="string" && /^[0-9a-f-]{36}$/i.test(order.id);
  let res;
  if(isUuid){
    res=await supabaseClient.from("orders").update(payload).eq("id",order.id).select().single();
  }else{
    res=await supabaseClient.from("orders").insert(payload).select().single();
    if(!res.error && res.data) order.id=res.data.id;
  }
  if(res.error) throw res.error;
}

async function deleteOrderFromSupabase(id){
  if(!supabaseClient || !(typeof id==="string" && /^[0-9a-f-]{36}$/i.test(id))) return;
  const {error}=await supabaseClient.from("orders").delete().eq("id",id);
  if(error) throw error;
}

async function syncExpenseToSupabase(expense){
  if(!supabaseClient) return;
  const payload={
    description:expense.description,
    category:expense.category||null,
    value:Number(expense.value||0),
    due_date:expense.due_date,
    paid:Boolean(expense.paid),
    recurring:Boolean(expense.recurring)
  };
  const isUuid=typeof expense.id==="string" && /^[0-9a-f-]{36}$/i.test(expense.id);
  let res;
  if(isUuid){
    res=await supabaseClient.from("expenses").update(payload).eq("id",expense.id).select().single();
  }else{
    res=await supabaseClient.from("expenses").insert(payload).select().single();
    if(!res.error && res.data) expense.id=res.data.id;
  }
  if(res.error) throw res.error;
}

async function deleteExpenseFromSupabase(id){
  if(!supabaseClient || !(typeof id==="string" && /^[0-9a-f-]{36}$/i.test(id))) return;
  const {error}=await supabaseClient.from("expenses").delete().eq("id",id);
  if(error) throw error;
}

async function syncOutflowToSupabase(outflow){
  if(!supabaseClient) return;
  const payload={
    description:outflow.description,
    value:Number(outflow.value||0),
    method:outflow.method,
    date:outflow.date
  };
  const isUuid=typeof outflow.id==="string" && /^[0-9a-f-]{36}$/i.test(outflow.id);
  let res;
  if(isUuid){
    res=await supabaseClient.from("outflows").update(payload).eq("id",outflow.id).select().single();
  }else{
    res=await supabaseClient.from("outflows").insert(payload).select().single();
    if(!res.error && res.data) outflow.id=res.data.id;
  }
  if(res.error) throw res.error;
}

async function loginSupabase(email,password){
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error) throw error;
  await loadFromSupabase();
  return data;
}

async function logoutSupabase(){
  if(supabaseClient) await supabaseClient.auth.signOut();
}

function seedState(){
  return {
    orders: [],
    expenses: [],
    outflows: []
  }
}
function loadState(){
  try{
    const loaded=JSON.parse(localStorage.getItem(storageKey)) || seedState();
    if(!Array.isArray(loaded.outflows)) loaded.outflows=[];
    if(!Array.isArray(loaded.expenses)) loaded.expenses=[];
    if(!Array.isArray(loaded.orders)) loaded.orders=[];
    return loaded;
  }catch{return seedState()}
}
function saveState(){
  localStorage.setItem(storageKey, JSON.stringify(state));
  saveDailyLocalBackup();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("connectionStatus").textContent = supabaseClient ? "Supabase conectado" : "Modo demonstração";
  document.getElementById("todayLabel").textContent = new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
  bindUI();
  saveDailyLocalBackup();

  if(supabaseClient){
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session){
      try{
        await loadFromSupabase();
        document.getElementById("connectionStatus").textContent="Online • Supabase";
      }catch(err){
        console.error(err);
        document.getElementById("connectionStatus").textContent="Erro ao sincronizar";
        renderAll();
      }
    }else{
      renderAll();
      document.getElementById("loginModal").showModal();
    }
  }else{
    renderAll();
  }
  updateBackupStatus();
});

function bindUI(){
  document.querySelectorAll(".menu-item").forEach(btn=>btn.onclick=()=>switchView(btn.dataset.view));
  document.getElementById("newOrderBtn").onclick=()=>openOrderModal();
  document.getElementById("newOutflowBtn").onclick=()=>{
    document.getElementById("outflowDate").value=todayISO();
    document.getElementById("outflowModal").showModal();
  };
  document.getElementById("newExpenseBtn").onclick=()=>document.getElementById("expenseModal").showModal();
  document.getElementById("loginForm").addEventListener("submit", async e=>{
    e.preventDefault();
    const email=document.getElementById("loginEmail").value.trim();
    const password=document.getElementById("loginPassword").value;
    const errorEl=document.getElementById("loginError");
    errorEl.textContent="";
    try{
      await loginSupabase(email,password);
      document.getElementById("loginModal").close();
      document.getElementById("connectionStatus").textContent="Online • Supabase";
    }catch(err){
      errorEl.textContent="Não foi possível entrar. Confira e-mail e senha.";
      console.error(err);
    }
  });
  document.getElementById("orderForm").addEventListener("submit", saveOrder);
  document.getElementById("expenseForm").addEventListener("submit", saveExpense);
  document.getElementById("outflowForm").addEventListener("submit", saveOutflow);
  document.getElementById("roleSelect").onchange=e=>{ role=e.target.value; applyRole(); };
  document.getElementById("clientSearch").oninput=renderClients;
  document.getElementById("prevMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()};
  document.getElementById("nextMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()};
  document.getElementById("menuToggle").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("prevOrderDay").onclick=()=>changeOrderDay(-1);
  document.getElementById("nextOrderDay").onclick=()=>changeOrderDay(1);
  document.getElementById("todayOrdersBtn").onclick=()=>{ selectedOrderISO=todayISO(); renderOrders(); };
  document.getElementById("ordersDateInput").onchange=e=>{ if(e.target.value){selectedOrderISO=e.target.value;renderOrders();} };
  selectedFinanceISO=todayISO();
  document.getElementById("financeFilterDate").value=selectedFinanceISO;
  document.getElementById("financeFilterDate").onchange=e=>{ if(e.target.value){selectedFinanceISO=e.target.value;renderFinance();} };
  document.getElementById("todayFinanceBtn").onclick=()=>{selectedFinanceISO=todayISO();document.getElementById("financeFilterDate").value=selectedFinanceISO;renderFinance();};
  document.getElementById("exportDayBtn").onclick=exportDayHistory;
  document.getElementById("exportBackupBtn").onclick=exportFullBackup;
  document.getElementById("importBackupBtn").onclick=()=>document.getElementById("importBackupInput").click();
  document.getElementById("importBackupInput").onchange=e=>importFullBackup(e.target.files?.[0]);
  document.querySelectorAll(".eye-btn").forEach(btn=>btn.onclick=()=>toggleMoney(btn.dataset.target,btn));
  setupKanbanDropZones();
}

function switchView(id){
  if(role==="employee" && ["dashboard","clientes","dividas","financeiro","calendario","gastos","usuarios","configuracoes","backup"].includes(id)) return;
  if(role==="cashier" && ["financeiro","calendario","gastos","usuarios","configuracoes","backup"].includes(id)) return;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".menu-item").forEach(v=>v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const btn=[...document.querySelectorAll(".menu-item")].find(x=>x.dataset.view===id); if(btn) btn.classList.add("active");
  document.getElementById("pageTitle").textContent = btn ? btn.textContent : "Adega Miami";
  document.getElementById("sidebar").classList.remove("open");
}
function applyRole(){
  const hideOwner = role!=="owner";
  document.querySelectorAll(".owner-only").forEach(x=>x.style.display=hideOwner?"none":"");
  const restricted = role==="employee" ? ["dashboard","clientes","dividas","financeiro","calendario","gastos"] :
                     role==="cashier" ? ["financeiro","calendario","gastos"] : [];
  document.querySelectorAll(".menu-item").forEach(x=>{
    if(restricted.includes(x.dataset.view)) x.style.display="none";
    else if(!x.classList.contains("owner-only")) x.style.display="";
  });
  if(role==="employee") switchView("pedidos");
}

function renderAll(){ renderOrders();renderDashboard();renderClients();renderDebts();renderFinance();renderCalendar();renderExpenses();applyRole(); }

function openOrderModal(order=null){
  document.getElementById("orderModalTitle").textContent=order?"Editar pedido":"Novo pedido";
  document.getElementById("orderId").value=order?.id||"";
  document.getElementById("orderName").value=order?.name||"";
  document.getElementById("orderPhone").value=order?.phone||"";
  document.getElementById("orderItems").value=order?.items||"";
  document.getElementById("orderValue").value=order?.value||"";
  document.getElementById("paymentMethod").value=order?.payment_method||"pix";
  document.getElementById("paymentStatus").value=order?.payment_status||"paid";
  document.getElementById("orderModal").showModal();
}

async function saveOrder(e){
  e.preventDefault();
  const id=document.getElementById("orderId").value;
  const data={
    name:orderName.value.trim(),
    phone:orderPhone.value.trim(),
    items:orderItems.value.trim(),
    value:Number(orderValue.value),
    payment_method:paymentMethod.value,
    payment_status:paymentStatus.value
  };

  if(id){
    const idx=state.orders.findIndex(o=>String(o.id)===String(id));
    const existing=state.orders[idx];
    const paidAt = data.payment_status==="paid"
      ? (existing.paid_at || nowISO())
      : null;
    state.orders[idx]={...existing,...data,paid_at:paidAt,paid_date:data.payment_status==="paid" ? (existing.paid_date || todayISO()) : null};
  }else{
    const createdAt=nowISO();
    state.orders.unshift({
      id:Date.now(),
      status:"pending",
      business_date:todayISO(),
      created_at:createdAt,
      paid_date:data.payment_status==="paid" ? todayISO() : null,
      paid_at:data.payment_status==="paid" ? createdAt : null,
      ...data
    });
  }

  saveState();
  const savedOrder=id
    ? state.orders.find(o=>String(o.id)===String(id))
    : state.orders[0];

  if(supabaseClient){
    try{
      await syncOrderToSupabase(savedOrder);
      saveState();
    }catch(err){
      console.error(err);
      alert("O pedido foi salvo localmente, mas houve erro ao enviar ao Supabase.");
    }
  }

  document.getElementById("orderModal").close();
  renderAll();

  // Novo pedido criado pelo Dashboard abre diretamente a tela de Pedidos.
  if(!id){
    selectedOrderISO=todayISO();
    switchView("pedidos");
    renderOrders();
  }
}

function statusLabel(s){return s==="pending"?"Não entregue":s==="preparing"?"Em preparação":"Entregue"}
function paymentLabel(p){return ({pix:"Pix",cash:"Dinheiro",credit:"Crédito",debit:"Débito"})[p]||p}
function renderOrders(){
  const selectedDate = new Date(selectedOrderISO+"T12:00:00");
  const isSelectedToday = selectedOrderISO===todayISO();
  document.getElementById("ordersDateInput").value=selectedOrderISO;
  document.getElementById("ordersDateLabel").textContent=isSelectedToday
    ? "Pedidos de hoje"
    : "Pedidos de " + selectedDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
  document.getElementById("nextOrderDay").disabled = isSelectedToday;

  ["pending","preparing","delivered"].forEach(status=>{
    const el=document.getElementById(status+"Orders");
    const orders=state.orders.filter(o=>o.status===status && orderCreatedDate(o)===selectedOrderISO);
    el.innerHTML=orders.map(orderCard).join("")||`<p class="muted empty-orders">Nenhum pedido nesta data.</p>`;
    document.getElementById("count"+(status==="pending"?"Pending":status==="preparing"?"Preparing":"Delivered")).textContent=orders.length;
  });
  setupOrderDragAndDrop();
}
function changeOrderDay(delta){
  const d=new Date(selectedOrderISO+"T12:00:00");
  d.setDate(d.getDate()+delta);
  const next=localDateKey(d);
  if(next>todayISO()) return;
  selectedOrderISO=next;
  renderOrders();
}

function setupOrderDragAndDrop(){
  document.querySelectorAll(".order-card[draggable='true']").forEach(card=>{
    card.addEventListener("dragstart",e=>{
      draggedOrderId=card.dataset.orderId;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain",card.dataset.orderId);
    });
    card.addEventListener("dragend",()=>{
      card.classList.remove("dragging");
      draggedOrderId=null;
      document.querySelectorAll(".kanban-column").forEach(c=>c.classList.remove("drag-over"));
    });
  });
}

function setupKanbanDropZones(){
  const map={pendingOrders:"pending",preparingOrders:"preparing",deliveredOrders:"delivered"};
  Object.entries(map).forEach(([id,status])=>{
    const list=document.getElementById(id), column=list.closest(".kanban-column");
    column.addEventListener("dragover",e=>{e.preventDefault();column.classList.add("drag-over");});
    column.addEventListener("dragleave",()=>column.classList.remove("drag-over"));
    column.addEventListener("drop",e=>{e.preventDefault();column.classList.remove("drag-over");if(draggedOrderId!==null)moveOrder(draggedOrderId,status);});
  });
}
function orderCard(o){
  const safeId=JSON.stringify(String(o.id));
  let moveBtns="";
  if(o.status==="pending"){
    moveBtns=`<button type="button" onclick='moveOrder(${safeId},"preparing")'>Preparar →</button>`;
  }
  if(o.status==="preparing"){
    moveBtns=`<button type="button" onclick='moveOrder(${safeId},"pending")'>← Voltar</button>
              <button type="button" onclick='moveOrder(${safeId},"delivered")'>Entregar →</button>`;
  }
  if(o.status==="delivered"){
    moveBtns=`<button type="button" onclick='moveOrder(${safeId},"preparing")'>← Reabrir</button>`;
  }

  return `<article class="order-card" draggable="true" data-order-id="${escapeHTML(String(o.id))}">
    <div class="drag-hint" title="Arraste para outra coluna">⋮⋮ Arraste</div>
    <h4>#${String(o.id).slice(-4)} — ${escapeHTML(o.name)}</h4>
    <p><b>Pedido:</b> ${escapeHTML(o.items)}</p>
    <p><b>Valor:</b> ${money(o.value)}</p>
    <p><b>Pagamento:</b> ${paymentLabel(o.payment_method)}</p>
    <div class="order-meta">
      <span>${new Date(o.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
      <span class="badge ${o.payment_status==="paid"?"paid":"unpaid"}">${o.payment_status==="paid"?"PAGO":"NÃO PAGO"}</span>
    </div>
    <div class="order-actions">
      ${moveBtns}
      <button type="button" onclick='editOrder(${safeId})'>Editar</button>
      <button type="button" onclick='deleteOrder(${safeId})'>Excluir</button>
    </div>
  </article>`;
}
async function moveOrder(id,status){
  const o=state.orders.find(x=>String(x.id)===String(id));
  if(o){
    o.status=status;
    saveState();
    renderAll();
    if(supabaseClient){
      try{await syncOrderToSupabase(o);saveState()}catch(err){console.error(err)}
    }
  }
}
function editOrder(id){openOrderModal(state.orders.find(o=>String(o.id)===String(id)))}
async function deleteOrder(id){
  if(confirm("Excluir este pedido?")){
    state.orders=state.orders.filter(o=>String(o.id)!==String(id));
    saveState();
    renderAll();
    if(supabaseClient){
      try{await deleteOrderFromSupabase(id)}catch(err){console.error(err)}
    }
  }
}

function orderCreatedDate(o){
  return o.business_date || localDateKey(o.created_at);
}
function orderPaidDate(o){
  return o.paid_date || localDateKey(o.paid_at || o.created_at);
}

function paidOrders(){return state.orders.filter(o=>o.payment_status==="paid")}
function isToday(d){return localDateKey(d)===todayISO()}
function isThisMonth(d){
  const key=localDateKey(d);
  if(!key) return false;
  const nowKey=todayISO();
  return key.slice(0,7)===nowKey.slice(0,7);
}
function totals(orders){
  const t={pix:0,cash:0,credit:0,debit:0,total:0};
  orders.forEach(o=>{t[o.payment_method]=(t[o.payment_method]||0)+Number(o.value);t.total+=Number(o.value)});
  return t;
}

function outflowsForDate(iso){
  return state.outflows.filter(o=>o.date===iso);
}
function outflowTotalForDate(iso){
  return outflowsForDate(iso).reduce((sum,o)=>sum+Number(o.value||0),0);
}
function outflowTotalForMonth(year,month){
  return state.outflows.filter(o=>{
    const d=new Date(o.date+"T12:00:00");
    return d.getFullYear()===year && d.getMonth()===month;
  }).reduce((sum,o)=>sum+Number(o.value||0),0);
}

function detailCard(label, value, extraClass=""){
  return `<div class="breakdown-card ${extraClass}">
    <span>${label}</span>
    <strong>${money(value)}</strong>
  </div>`;
}

function renderDashboard(){
  const today=paidOrders().filter(o=>orderPaidDate(o)===todayISO()), month=paidOrders().filter(o=>orderPaidDate(o).slice(0,7)===todayISO().slice(0,7));
  const td=totals(today), tm=totals(month);

  // Todo gasto cadastrado entra no saldo pela data de vencimento.
  const expToday=state.expenses.filter(e=>e.due_date===todayISO()).reduce((a,b)=>a+Number(b.value),0);
  const expMonth=state.expenses.filter(e=>{const d=new Date(e.due_date+"T12:00:00"),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()}).reduce((a,b)=>a+Number(b.value),0);

  const dayOutflows=outflowTotalForDate(todayISO());
  const nowDate=new Date();
  const monthOutflows=outflowTotalForMonth(nowDate.getFullYear(),nowDate.getMonth());
  const dayResult=td.total-expToday-dayOutflows, monthResultValue=tm.total-expMonth-monthOutflows;
  setMoneyValue("dailyBalance",dayResult);
  setMoneyValue("monthlyBalance",monthResultValue);
  setBalanceColor(dailyBalance,dayResult);
  setBalanceColor(monthlyBalance,monthResultValue);

  ordersToday.textContent=state.orders.filter(o=>orderCreatedDate(o)===todayISO()).length;
  ticketAverage.textContent=`Ticket médio: ${money(today.length?td.total/today.length:0)}`;

  const debts=state.orders.filter(o=>o.payment_status==="unpaid");
  openDebt.textContent=money(debts.reduce((a,b)=>a+Number(b.value),0));
  debtCount.textContent=`${new Set(debts.map(x=>x.name.toLowerCase())).size} cliente(s) com dívida`;

  const totalDayExpenses=expToday+dayOutflows;
  document.getElementById("dailyDetailGrid").innerHTML = [
    detailCard("Pix", td.pix, "pix-card"),
    detailCard("Cartão", td.credit + td.debit, "card-card"),
    detailCard("Dinheiro", td.cash, "cash-card"),
    detailCard("Gastos", totalDayExpenses, "expense-card")
  ].join("");

  financialSummary.innerHTML=[
    ["Vendas recebidas",td.total],["Gastos do dia",expToday+dayOutflows],["Saldo do dia",dayResult],["Não pagos",debts.reduce((a,b)=>a+Number(b.value),0)]
  ].map(([a,b])=>`<div class="summary-item ${a==="Não pagos"?"summary-danger":""}"><span>${a}</span><b>${money(b)}</b></div>`).join("");
}

function setMoneyValue(id,value){
  const el=document.getElementById(id);
  if(!el) return;
  el.textContent=money(value);
  el.dataset.hidden="0";
  el.dataset.real="";
  const btn=document.querySelector(`.eye-btn[data-target="${id}"]`);
  if(btn) btn.textContent="👁";
}

function setBalanceColor(el,value){
  el.classList.remove("balance-positive","balance-negative");
  el.classList.add(Number(value)>=0?"balance-positive":"balance-negative");
}
function toggleMoney(id,btn){
  const el=document.getElementById(id);
  if(el.dataset.hidden==="1"){el.textContent=el.dataset.real;el.dataset.hidden="0";btn.textContent="👁"}
  else{el.dataset.real=el.textContent;el.textContent="R$ ••••••";el.dataset.hidden="1";btn.textContent="🙈"}
}

function clientsData(){
  const map={};
  state.orders.forEach(o=>{
    const key=o.name.trim().toLowerCase(); if(!map[key])map[key]={name:o.name,phone:o.phone,total:0,debt:0,orders:[]};
    map[key].orders.push(o); if(o.payment_status==="paid")map[key].total+=Number(o.value); else map[key].debt+=Number(o.value);
  }); return Object.values(map)
}
function renderClients(){
  const q=(document.getElementById("clientSearch")?.value||"").toLowerCase();
  const rows=clientsData().filter(c=>c.name.toLowerCase().includes(q));
  clientsTable.innerHTML=rows.map(c=>`<tr><td><b>${escapeHTML(c.name)}</b></td><td>${escapeHTML(c.phone||"-")}</td><td>${money(c.total)}</td><td>${money(c.debt)}</td><td><button class="secondary-btn" onclick='showClient(${JSON.stringify(c.name)})'>Ver</button></td></tr>`).join("");
}
function showClient(name){
  const c=clientsData().find(x=>x.name===name); clientModalTitle.textContent=c.name;
  clientHistory.innerHTML=c.orders.sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(o=>`<div class="summary-item"><span>${new Date(o.created_at).toLocaleDateString("pt-BR")} — ${escapeHTML(o.items)}</span><b>${money(o.value)} • ${o.payment_status==="paid"?"Pago":"Pendente"}</b></div>`).join("");
  clientModal.showModal();
}

function renderDebts(){
  const debts=state.orders.filter(o=>o.payment_status==="unpaid");
  const debtorCount=new Set(debts.map(o=>o.name.trim().toLowerCase())).size;
  const receivable=debts.reduce((a,b)=>a+Number(b.value),0);
  document.getElementById("totalDebtors").textContent=debtorCount;
  document.getElementById("totalReceivable").textContent=money(receivable);
  debtsList.innerHTML=debts.length?debts.map(o=>`<article class="debt-card urgent-debt-card">
    <div><b>${escapeHTML(o.name)}</b><p>${escapeHTML(o.items)} • <strong>${money(o.value)}</strong></p><small>⚠ Devendo há ${daysBetween(o.created_at)} dia(s)</small></div>
    <div class="debt-actions"><button class="primary-btn" onclick='receiveDebt(${JSON.stringify(String(o.id))})' >Receber pagamento</button></div>
  </article>`).join(""):`<div class="no-debt-message">✓ Nenhuma dívida em aberto.</div>`;
}
async function receiveDebt(id){
  const o=state.orders.find(x=>String(x.id)===String(id)); if(!o)return;
  const method=prompt("Forma de pagamento: pix, cash, credit ou debit","pix");
  if(!["pix","cash","credit","debit"].includes(method||"")) return alert("Forma inválida.");
  o.payment_method=method;o.payment_status="paid";o.paid_at=nowISO();o.paid_date=todayISO();saveState();renderAll();
  if(supabaseClient){try{await syncOrderToSupabase(o);saveState()}catch(err){console.error(err)}}
}

function renderFinance(){
  const today=paidOrders().filter(o=>orderPaidDate(o)===todayISO());
  const month=paidOrders().filter(o=>orderPaidDate(o).slice(0,7)===todayISO().slice(0,7));
  const ti=totals(today).total, mi=totals(month).total;

  // Gastos afetam os saldos, porém não aparecem em Movimentações.
  const te=state.expenses.filter(e=>e.due_date===todayISO()).reduce((a,b)=>a+Number(b.value),0);
  const me=state.expenses.filter(e=>{const d=new Date(e.due_date+"T12:00:00"),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()}).reduce((a,b)=>a+Number(b.value),0);

  const todayTotals=totals(today);
  setMoneyValue("financePix",todayTotals.pix);
  setMoneyValue("financeCash",todayTotals.cash);
  setMoneyValue("financeCard",todayTotals.credit+todayTotals.debit);
  setMoneyValue("todayIncome",ti);
  const dayOutflows=outflowTotalForDate(todayISO());
  const nowDate=new Date();
  const monthOutflows=outflowTotalForMonth(nowDate.getFullYear(),nowDate.getMonth());

  const monthDetailEl=document.getElementById("monthlyDetailGrid");
  if(monthDetailEl){
    monthDetailEl.innerHTML=[
      detailCard("Pix", totals(month).pix, "pix-card"),
      detailCard("Cartão", totals(month).credit + totals(month).debit, "card-card"),
      detailCard("Dinheiro", totals(month).cash, "cash-card"),
      detailCard("Gastos", me, "expense-card"),
      detailCard("Saídas do mês", monthOutflows, "outflow-card")
    ].join("");
  }

  setMoneyValue("todayExpenses",te+dayOutflows);
  setMoneyValue("todayResult",ti-te-dayOutflows);
  setMoneyValue("monthResult",mi-me-monthOutflows);
  setBalanceColor(todayResult,ti-te-dayOutflows);
  setBalanceColor(monthResult,mi-me-monthOutflows);

  const selectedOrders=paidOrders().filter(o=>orderPaidDate(o)===selectedFinanceISO);
  const selectedOutflows=outflowsForDate(selectedFinanceISO);
  const selectedTotals=totals(selectedOrders);
  const selectedOutflowTotal=selectedOutflows.reduce((sum,o)=>sum+Number(o.value||0),0);

  document.getElementById("financeFilterDate").value=selectedFinanceISO;
  document.getElementById("financeDaySummary").innerHTML=`
    <div><span>Data</span><strong>${new Date(selectedFinanceISO+"T12:00:00").toLocaleDateString("pt-BR")}</strong></div>
    <div><span>Pix</span><strong>${money(selectedTotals.pix)}</strong></div>
    <div><span>Dinheiro</span><strong>${money(selectedTotals.cash)}</strong></div>
    <div><span>Cartão</span><strong>${money(selectedTotals.credit+selectedTotals.debit)}</strong></div>
    <div><span>Entradas</span><strong>${money(selectedTotals.total)}</strong></div>
    <div><span>Saídas</span><strong class="money-negative">${money(selectedOutflowTotal)}</strong></div>
    <div><span>Saldo</span><strong class="${selectedTotals.total-selectedOutflowTotal>=0?"money-positive":"money-negative"}">${money(selectedTotals.total-selectedOutflowTotal)}</strong></div>
  `;

  const tx=[
    ...selectedOrders.map(o=>({
      date:o.paid_at||o.created_at,
      type:"Entrada",
      desc:`Pedido #${String(o.id).slice(-4)} — ${o.name}`,
      method:paymentLabel(o.payment_method),
      value:o.value
    })),
    ...selectedOutflows.map(o=>({
      date:o.created_at||o.date+"T12:00:00",
      type:"Saída",
      desc:o.description,
      method:paymentLabel(o.method),
      value:-Number(o.value)
    }))
  ].sort((a,b)=>b.date.localeCompare(a.date));

  transactionsTable.innerHTML=tx.length
    ? tx.map(t=>`<tr><td>${new Date(t.date).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td><td class="${t.type==="Saída"?"movement-out":"movement-in"}">${t.type}</td><td>${escapeHTML(t.desc)}</td><td>${t.method}</td><td class="${t.value<0?"money-negative":"money-positive"}">${money(t.value)}</td></tr>`).join("")
    : `<tr><td colspan="5" class="muted">Nenhuma movimentação registrada nesta data.</td></tr>`;
}

function renderCalendar(){
  const y=calendarDate.getFullYear(),m=calendarDate.getMonth();
  calendarTitle.textContent=new Date(y,m,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  const weekdays=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  let html=weekdays.map(x=>`<div class="calendar-weekday">${x}</div>`).join("");
  for(let i=0;i<first;i++)html+=`<div class="calendar-day empty"></div>`;
  for(let d=1;d<=days;d++){
    const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const income=paidOrders().filter(o=>orderPaidDate(o)===iso).reduce((a,b)=>a+Number(b.value),0);
    const expense=state.expenses.filter(e=>e.due_date===iso).reduce((a,b)=>a+Number(b.value),0);
    html+=`<div class="calendar-day ${selectedCalendarISO===iso?"selected":""}" onclick="selectCalendarDay('${iso}')"><b>${d}</b><span>${money(income-expense)}</span></div>`;
  }
  calendarGrid.innerHTML=html;
  renderCalendarDayDetails(selectedCalendarISO);
}
function selectCalendarDay(iso){selectedCalendarISO=iso;renderCalendar()}
function renderCalendarDayDetails(iso){
  const dayOrders=paidOrders().filter(o=>orderPaidDate(o)===iso), t=totals(dayOrders);
  const expenses=state.expenses.filter(e=>e.due_date===iso).reduce((a,b)=>a+Number(b.value),0);
  const date=new Date(iso+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
  document.getElementById("calendarDayDetails").innerHTML=`<b>${date}</b><div class="day-detail-grid">
    <div><small>PIX</small><strong>${money(t.pix)}</strong></div><div><small>Dinheiro</small><strong>${money(t.cash)}</strong></div>
    <div><small>Cartão</small><strong>${money(t.credit+t.debit)}</strong></div><div><small>Saídas</small><strong>${money(expenses)}</strong></div>
    <div><small>Resultado</small><strong>${money(t.total-expenses)}</strong></div></div>`;
}


function exportDayHistory(){
  const iso=selectedFinanceISO||todayISO();
  const dayOrders=paidOrders().filter(o=>orderPaidDate(o)===iso);
  const dayOutflows=outflowsForDate(iso);
  const t=totals(dayOrders);
  const outTotal=dayOutflows.reduce((sum,o)=>sum+Number(o.value||0),0);

  const lines=[
    ["ADEGA MIAMI - MOVIMENTAÇÕES DO DIA",iso,"","",""],
    ["Tipo","Descrição","Forma de pagamento","Status","Valor"],
    ...dayOrders.map(o=>["Entrada",`Pedido #${String(o.id).slice(-4)} - ${o.name} - ${o.items}`,paymentLabel(o.payment_method),"Pago",Number(o.value).toFixed(2)]),
    ...dayOutflows.map(o=>["Saída",o.description,paymentLabel(o.method),"Registrada",(-Number(o.value)).toFixed(2)]),
    [],
    ["RESUMO","PIX",money(t.pix),"",""],
    ["RESUMO","DINHEIRO",money(t.cash),"",""],
    ["RESUMO","CARTÃO",money(t.credit+t.debit),"",""],
    ["RESUMO","TOTAL DE ENTRADAS",money(t.total),"",""],
    ["RESUMO","TOTAL DE SAÍDAS",money(outTotal),"",""],
    ["RESUMO","SALDO",money(t.total-outTotal),"",""]
  ];

  const csv=lines.map(row=>row.map(cell=>`"${String(cell??"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`Adega-Miami-movimentacoes-${iso}.csv`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}


async function saveOutflow(e){
  e.preventDefault();
  const description=document.getElementById("outflowDescription").value.trim();
  const value=Number(document.getElementById("outflowValue").value);
  const method=document.getElementById("outflowMethod").value;
  const date=document.getElementById("outflowDate").value || todayISO();

  if(!description || !Number.isFinite(value) || value<=0){
    alert("Preencha a descrição e um valor válido.");
    return;
  }

  const newOutflow={
    id:Date.now(),
    description,
    value,
    method,
    date,
    created_at:nowISO()
  };
  state.outflows.unshift(newOutflow);

  saveState();
  if(supabaseClient){
    try{await syncOutflowToSupabase(newOutflow);saveState()}catch(err){console.error(err);alert("Saída salva localmente, mas houve erro ao sincronizar.")}
  }
  document.getElementById("outflowModal").close();
  document.getElementById("outflowForm").reset();
  document.getElementById("outflowDate").value=todayISO();
  renderAll();
}

async function saveExpense(e){
  e.preventDefault();
  const newExpense={id:Date.now(),description:expenseDescription.value.trim(),category:expenseCategory.value.trim(),value:Number(expenseValue.value),due_date:expenseDueDate.value,paid:false,recurring:expenseRecurring.checked};
  state.expenses.unshift(newExpense);
  saveState();
  if(supabaseClient){
    try{await syncExpenseToSupabase(newExpense);saveState()}catch(err){console.error(err);alert("Gasto salvo localmente, mas houve erro ao sincronizar.")}
  }
  expenseModal.close();expenseForm.reset();renderAll();
}
function renderExpenses(){
  const exactTotal=state.expenses.reduce((sum,e)=>sum+Number(e.value||0),0);
  const totalEl=document.getElementById("expensesMonthTotal");
  if(totalEl) totalEl.textContent=money(exactTotal);

  expensesTable.innerHTML=state.expenses.length
    ? state.expenses.map(e=>{
        const safeId=JSON.stringify(String(e.id));
        return `<tr>
          <td>${escapeHTML(e.description)}</td>
          <td>${escapeHTML(e.category||"-")}</td>
          <td>${new Date(e.due_date+"T12:00:00").toLocaleDateString("pt-BR")}</td>
          <td>${money(e.value)}</td>
          <td>${e.paid?"Pago":"Pendente"}${e.recurring?" • Fixo":""}</td>
          <td>
            <button class="secondary-btn" onclick='toggleExpense(${safeId})'>${e.paid?"Desmarcar":"Marcar pago"}</button>
            <button class="secondary-btn" onclick='deleteExpense(${safeId})'>Excluir</button>
          </td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="6" class="muted">Nenhuma conta adicionada.</td></tr>`;
}
async function toggleExpense(id){
  const e=state.expenses.find(x=>String(x.id)===String(id));
  e.paid=!e.paid;
  saveState();renderAll();
  if(supabaseClient){try{await syncExpenseToSupabase(e);saveState()}catch(err){console.error(err)}}
}
async function deleteExpense(id){
  if(confirm("Excluir gasto?")){
    state.expenses=state.expenses.filter(e=>String(e.id)!==String(id));
    saveState();renderAll();
    if(supabaseClient){try{await deleteExpenseFromSupabase(id)}catch(err){console.error(err)}}
  }
}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
