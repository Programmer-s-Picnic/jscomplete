
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const JSON_URL = "data/slides.json";

const state = {
  data: null,
  edition: "express",
  query: "",
  tag: "all"
};

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function setChipActive(which){
  const ex = $("#chipExpress"), fu = $("#chipFull");
  ex.classList.toggle("active", which === "express");
  fu.classList.toggle("active", which === "full");
  ex.setAttribute("aria-selected", String(which === "express"));
  fu.setAttribute("aria-selected", String(which === "full"));
}

function buildTagOptions(projects){
  const tags = new Set();
  projects.forEach(p => (p.tags||[]).forEach(t => tags.add(t)));
  const select = $("#tagSelect");
  select.innerHTML = `<option value="all">All tags</option>` + Array.from(tags).sort().map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  select.value = state.tag;
}

function matches(p){
  const q = state.query.trim().toLowerCase();
  if(q){
    const hay = `${p.id} ${p.title} ${p.summary} ${(p.skills||[]).join(" ")} ${(p.tags||[]).join(" ")}`.toLowerCase();
    if(!hay.includes(q)) return false;
  }
  if(state.tag !== "all"){
    if(!(p.tags||[]).includes(state.tag)) return false;
  }
  return true;
}

function cardHTML(p){
  const tags = (p.tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join("");
  const skills = (p.skills||[]).slice(0,6).map(s => `<span class="tag">${esc(s)}</span>`).join("");
  const express = p.links?.express || "#";
  const full = p.links?.full || "#";
  const preview = (state.edition === "full" ? full : express);
  const thumb = p.thumb || "assets/thumbs/default.svg";
  const diff = p.difficulty || "Beginner";

  return `
  <article class="card" data-id="${esc(p.id)}">
    <img class="thumb" src="${esc(thumb)}" alt="Thumbnail: ${esc(p.title)}" loading="lazy"/>
    <div class="hd">
      <div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <span class="pill">${esc(p.icon || "✨")} ${esc(p.id)}</span>
          <span class="badge diff small">🎯 ${esc(diff)}</span>
        </div>
        <h2 style="margin-top:10px">${esc(p.title)}</h2>
        <p>${esc(p.summary || "")}</p>
        <div class="meta" style="margin-top:10px">${tags}${skills}</div>
      </div>
      <div class="row" style="justify-content:flex-end">
        <a class="btn ghost" href="${esc(express)}" target="_blank" rel="noopener">⚡ Express ↗</a>
        <a class="btn primary" href="${esc(full)}" target="_blank" rel="noopener">🏆 Full ↗</a>
        <button class="btn" data-action="preview">👀 Preview</button>
        <button class="btn" data-action="copy">🔗 Copy</button>
      </div>
    </div>

    <div class="preview" hidden>
      <div class="row spread" style="margin-bottom:10px">
        <div class="row">
          <span class="pill">Preview</span>
          <span class="note">Edition: <b>${state.edition}</b></span>
        </div>
        <div class="row">
          <button class="btn" data-action="openPreview">Open ↗</button>
          <button class="btn" data-action="hidePreview">Hide</button>
        </div>
      </div>
      <iframe loading="lazy" title="Preview: ${esc(p.title)}" src="${esc(preview)}"></iframe>
      <div class="note">If preview is blank locally, use Live Server / http server.</div>
    </div>
  </article>`;
}

function render(){
  const projects = state.data?.projects || [];
  const list = projects.filter(matches);
  $("#count").textContent = `${list.length} / ${projects.length}`;

  $("#cards").innerHTML = list.map(cardHTML).join("") || `
    <div class="card" style="grid-column:span 12;padding:16px">
      <h2 style="margin:0">No matches</h2>
      <p class="sub" style="margin:6px 0 0">Try clearing search or choosing another tag.</p>
    </div>
  `;

  $$("#cards .card").forEach(card => {
    const id = card.getAttribute("data-id");
    const proj = projects.find(p => p.id === id);
    const previewWrap = $(".preview", card);

    const togglePreview = (show) => {
      previewWrap.hidden = !show;
      if(show){
        const iframe = $("iframe", previewWrap);
        iframe.src = (state.edition === "full") ? proj.links.full : proj.links.express;
      }
    };

    card.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if(!btn) return;
      const act = btn.getAttribute("data-action");

      if(act === "preview") togglePreview(previewWrap.hidden);
      if(act === "hidePreview") togglePreview(false);
      if(act === "openPreview"){
        const url = (state.edition === "full") ? proj.links.full : proj.links.express;
        window.open(url, "_blank", "noopener,noreferrer");
      }
      if(act === "copy"){
        const u = new URL(location.href);
        u.searchParams.set("p", proj.id);
        u.searchParams.set("e", state.edition);
        const link = u.toString();
        try{ await navigator.clipboard.writeText(link); toast("Copied link ✅"); }
        catch{ prompt("Copy link:", link); }
      }
    });
  });
}

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove("show"), 1400);
}

async function load(){
  const FALLBACK = {
    meta:{title:"JavaScript Projects Showcase (Fallback)",version:"1.0"},
    projects:[{id:"todo",icon:"📝",title:"To‑Do App",summary:"Add tasks.",skills:["DOM"],tags:["starter"],
      links:{express:"projects/todo/express/index.html",full:"projects/todo/full/index.html"}}]
  };

  try{
    const res = await fetch(JSON_URL, {cache:"no-store"});
    if(!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if(!json || !Array.isArray(json.projects)) throw new Error("Invalid JSON");
    state.data = json;
  }catch(err){
    console.warn("Using fallback JSON:", err);
    state.data = FALLBACK;
  }

  $("#pageTitle").textContent = state.data.meta?.title || "Projects Showcase";
  buildTagOptions(state.data.projects);

  const urlp = new URLSearchParams(location.search);
  const e = urlp.get("e");
  state.edition = (e === "full") ? "full" : "express";
  setChipActive(state.edition);

  render();
  renderGuidedPath();
  wireGuidedPath();

  const p = urlp.get("p");
  if(p){
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${CSS.escape(p)}"]`);
      if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
    }, 150);
  }
}

function wire(){
  $("#chipExpress").addEventListener("click", () => {
    state.edition = "express";
    setChipActive("express");
    render();
  });
  $("#chipFull").addEventListener("click", () => {
    state.edition = "full";
    setChipActive("full");
    render();
  });

  $("#q").addEventListener("input", (e) => { state.query = e.target.value; render(); });

  $("#tagSelect").addEventListener("change", (e) => { state.tag = e.target.value; render(); });

  $("#btnReset").addEventListener("click", () => {
    state.query = ""; state.tag = "all";
    $("#q").value = ""; $("#tagSelect").value = "all";
    render();
  });

  $("#btnCopySite").addEventListener("click", async () => {
    const link = location.href.split("?")[0];
    try{ await navigator.clipboard.writeText(link); toast("Copied site link ✅"); }
    catch{ prompt("Copy:", link); }
  });
}

wire();
load();


function renderGuidedPath(){
  const meta = state.data?.meta?.guidedPath;
  const stepsEl = $("#pathSteps");
  if(!meta || !stepsEl) return;

  const projects = state.data.projects || [];
  stepsEl.innerHTML = (meta.steps || []).map((s, idx) => {
    const first = projects.find(p => p.id === (s.projectIds || [])[0]);
    const diff = first?.difficulty || "Beginner";
    return `
      <div class="pathStep" data-step="${idx}">
        <div class="row" style="justify-content:space-between">
          <span class="badge diff small">🎯 ${esc(diff)}</span>
          <span class="pill">Step ${idx+1}</span>
        </div>
        <h3 style="margin-top:10px">${esc(s.title)}</h3>
        <p>${esc(s.desc || "")}</p>
        <div class="row" style="margin-top:10px">
          <button class="btn primary" data-act="openStep" data-step="${idx}">Open Step</button>
          <button class="btn" data-act="scrollStep" data-step="${idx}">See Project</button>
        </div>
      </div>
    `;
  }).join("");
}

function openPathModal(){
  const back = $("#pathModalBack");
  if(!back) return;
  back.classList.add("show");
  back.setAttribute("aria-hidden","false");
}

function closePathModal(){
  const back = $("#pathModalBack");
  if(!back) return;
  back.classList.remove("show");
  back.setAttribute("aria-hidden","true");
}

function buildPathModal(stepIndex=0){
  const meta = state.data?.meta?.guidedPath;
  const list = $("#pathList");
  if(!meta || !list) return;

  const step = (meta.steps || [])[stepIndex];
  const projects = state.data.projects || [];
  const items = (step?.projectIds || []).map(id => projects.find(p => p.id === id)).filter(Boolean);

  list.innerHTML = items.map(p => {
    const thumb = p.thumb || "assets/thumbs/default.svg";
    return `
      <div class="modalItem" data-id="${esc(p.id)}">
        <div class="left">
          <img src="${esc(thumb)}" alt="Thumbnail ${esc(p.title)}" loading="lazy"/>
          <div style="min-width:0">
            <b>${esc(p.icon || "✨")} ${esc(p.title)}</b>
            <div class="sub" style="margin:4px 0 0">🎯 ${esc(p.difficulty || "Beginner")} • ${esc(p.id)}</div>
          </div>
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn" data-act="openExpress" data-id="${esc(p.id)}">⚡</button>
          <button class="btn primary" data-act="openFull" data-id="${esc(p.id)}">🏆</button>
        </div>
      </div>
    `;
  }).join("");
}

function openProjectById(id, edition){
  const projects = state.data?.projects || [];
  const p = projects.find(x => x.id === id);
  if(!p) return;
  const url = edition === "full" ? p.links.full : p.links.express;
  window.open(url, "_blank", "noopener,noreferrer");
}

function scrollToProject(id){
  const el = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
}

function wireGuidedPath(){
  const btnStart = $("#btnStart");
  const btnOpenPath = $("#btnOpenPath");
  const btnClose = $("#btnPathClose");
  const back = $("#pathModalBack");

  const open = () => { buildPathModal(0); openPathModal(); };
  if(btnStart) btnStart.addEventListener("click", open);
  if(btnOpenPath) btnOpenPath.addEventListener("click", open);
  if(btnClose) btnClose.addEventListener("click", closePathModal);
  if(back) back.addEventListener("click", (e)=>{ if(e.target === back) closePathModal(); });

  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closePathModal(); });

  const stepsEl = $("#pathSteps");
  if(stepsEl){
    stepsEl.addEventListener("click", (e)=>{
      const b = e.target.closest("[data-act]");
      if(!b) return;
      const act = b.getAttribute("data-act");
      const step = Number(b.getAttribute("data-step"));
      const meta = state.data?.meta?.guidedPath;
      const ids = meta?.steps?.[step]?.projectIds || [];
      if(act === "openStep"){ buildPathModal(step); openPathModal(); }
      if(act === "scrollStep"){ if(ids[0]) scrollToProject(ids[0]); }
    });
  }

  const list = $("#pathList");
  if(list){
    list.addEventListener("click", (e)=>{
      const b = e.target.closest("[data-act]");
      if(!b) return;
      const act = b.getAttribute("data-act");
      const id = b.getAttribute("data-id");
      if(act === "openExpress") openProjectById(id, "express");
      if(act === "openFull") openProjectById(id, "full");
    });
  }

  const btnE = $("#btnPathExpress");
  const btnF = $("#btnPathFull");
  if(btnE) btnE.addEventListener("click", ()=>{
    const first = $("#pathList .modalItem");
    if(first) openProjectById(first.getAttribute("data-id"), "express");
  });
  if(btnF) btnF.addEventListener("click", ()=>{
    const first = $("#pathList .modalItem");
    if(first) openProjectById(first.getAttribute("data-id"), "full");
  });
}
