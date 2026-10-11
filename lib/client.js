window.__ModuleLoader__.load({
	id: "dsh-johnny",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var ROUTE = "/dsh-johnny";
var MONEY_W = 92;
var MONEY_H = 62;
var FALLBACK = {
  words: ["发钱", "给钱", "付钱", "交钱", "小费"],
  pet: { base: "/dsh-pet-7340", id: "main", anim: "余额-钱袋满溢", bubble: "TOKEN 的味道……不错……", meme: "" }
};
var status = { active: false, words: FALLBACK.words, pet: FALLBACK.pet };
var uid = 0;
var composer = { sessionId: null, actions: null };
function isMoneyWord(text) {
  const t = String(text ?? "").replace(/[\s!！。.~～、，,]+$/u, "").trim();
  if (t === "") return false;
  return status.words.includes(t);
}
function fishHitAt(x, y) {
  const pad = 16;
  const els = document.querySelectorAll(".dsh-pet-hit");
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return r;
  }
  return null;
}
function clearComposer(inputEl) {
  try {
    if (composer.actions !== null && typeof composer.actions.setDraft === "function") {
      composer.actions.setDraft("");
      return;
    }
  } catch {
  }
  try {
    inputEl.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("delete", false, null);
    sel.removeAllRanges();
  } catch {
  }
}
async function petCall(url, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return r.json();
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function ComposerBridge(props) {
  (0, import_react.useEffect)(() => {
    const sid = props?.johnnySessionId ?? props?.sessionId;
    if (typeof sid === "string" && sid !== "") composer.sessionId = sid;
    if (props?.inputActions) composer.actions = props.inputActions;
  });
  return null;
}
function MoneySVG() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { viewBox: "0 0 96 64", width: "92", height: "62", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { transform: "rotate(-8 48 32)", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "12", y: "20", width: "72", height: "32", rx: "4", fill: "#8fbe6d", stroke: "#5c8a45", strokeWidth: "1.5" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { transform: "rotate(7 48 32)", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "12", y: "16", width: "72", height: "32", rx: "4", fill: "#9dcb7a", stroke: "#5c8a45", strokeWidth: "1.5" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "12", y: "12", width: "72", height: "36", rx: "4", fill: "#abd98a", stroke: "#4e7d3a", strokeWidth: "1.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "48", cy: "30", r: "9.5", fill: "none", stroke: "#4e7d3a", strokeWidth: "1.6", opacity: "0.85" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { x: "48", y: "34.5", textAnchor: "middle", fontSize: "12", fontWeight: "700", fill: "#3f6a2e", fontFamily: "serif", children: "¥" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "19", cy: "19", r: "2.2", fill: "#4e7d3a", opacity: "0.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "77", cy: "19", r: "2.2", fill: "#4e7d3a", opacity: "0.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "19", cy: "41", r: "2.2", fill: "#4e7d3a", opacity: "0.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "77", cy: "41", r: "2.2", fill: "#4e7d3a", opacity: "0.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "35", y: "10", width: "26", height: "40", rx: "3", fill: "#c98b4b", stroke: "#9a6531", strokeWidth: "1.4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "40.5", y: "10", width: "2.6", height: "40", fill: "#b57a3d", opacity: "0.75" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "53", y: "10", width: "2.6", height: "40", fill: "#b57a3d", opacity: "0.75" })
  ] });
}
function JohnnyOverlay() {
  const [items, setItems] = (0, import_react.useState)([]);
  const [modeActive, setModeActive] = (0, import_react.useState)(false);
  const [toastText, setToastText] = (0, import_react.useState)("");
  const toastTimer = (0, import_react.useRef)(0);
  const hintShown = (0, import_react.useRef)(false);
  const seqRef = (0, import_react.useRef)([]);
  const seqAt = (0, import_react.useRef)(0);
  const shakeRef = (0, import_react.useRef)({ prev: 0, hits: [], coolUntil: 0 });
  const posRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const showToast = (text, ms = 2800) => {
    setToastText(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(""), ms);
  };
  const quitJohnny = async () => {
    try {
      const r = await fetch(`${ROUTE}/off`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(composer.sessionId !== null ? { sessionId: composer.sessionId } : {})
      });
      const j = await r.json();
      if (j?.ok === true && j.disabled === true) {
        status.active = false;
        setModeActive(false);
        showToast("强尼：行吧，收摊了。");
        return;
      }
      if (j?.ok === true) showToast("强尼本来就没出摊。");
      else showToast(`收摊失败（${j?.code ?? "未知"}）。`);
    } catch {
      showToast("收摊失败：连不上宿主。");
    }
  };
  const updateItem = (id, patch) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it, ...patch };
      if (typeof next.x === "number" && typeof next.y === "number") posRef.current.set(id, { x: next.x, y: next.y });
      return next;
    }));
  };
  const removeItem = (id) => {
    posRef.current.delete(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };
  const spawnMoney = (cx, cy) => {
    setItems((prev) => {
      if (prev.length >= 4) return prev;
      const x = Math.min(Math.max(8, cx - MONEY_W / 2), (window.innerWidth || 360) - MONEY_W - 8);
      const y = Math.min(Math.max(8, cy - MONEY_H / 2), (window.innerHeight || 640) - MONEY_H - 8);
      const id = ++uid;
      posRef.current.set(id, { x, y });
      return [...prev, { id, x, y, phase: "idle", over: false }];
    });
    if (!hintShown.current) {
      hintShown.current = true;
      showToast("钱到手——把它拖到肥鱼身上。");
    }
  };
  const handleDrop = async (id, cx, cy) => {
    let hit = null;
    try {
      hit = fishHitAt(cx, cy);
    } catch {
      hit = null;
    }
    if (hit === null) {
      updateItem(id, { over: false });
      return;
    }
    const back = posRef.current.get(id) ?? { x: cx, y: cy };
    const tx = Math.min(Math.max(0, hit.left + hit.width / 2 - MONEY_W / 2), (window.innerWidth || 360) - MONEY_W);
    const ty = Math.min(Math.max(0, hit.top + hit.height / 2 - MONEY_H / 2), (window.innerHeight || 640) - MONEY_H);
    updateItem(id, { phase: "flying", over: false, x: tx, y: ty });
    let redeem = null;
    try {
      const r = await fetch(`${ROUTE}/redeem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(composer.sessionId !== null ? { sessionId: composer.sessionId } : {})
      });
      redeem = await r.json();
    } catch {
      redeem = null;
    }
    if (redeem === null || redeem.ok !== true) {
      updateItem(id, { phase: "returning", x: back.x, y: back.y });
      setTimeout(() => updateItem(id, { phase: "idle", over: false }), 520);
      if (redeem === null) showToast("交付失败：连不上宿主路由。");
      else if (redeem.code === "not-in-mode") showToast("鱼只跟强尼做买卖——先输入 /johnny 进模式。");
      else showToast(`交付失败（${redeem.code ?? "未知"}）。`);
      return;
    }
    const pet = status.pet;
    let petOk = false;
    try {
      await petCall(`${pet.base}/anim?pet=${encodeURIComponent(pet.id)}`, { name: pet.anim });
      let j = await petCall(
        `${pet.base}/broadcast?pet=${encodeURIComponent(pet.id)}`,
        pet.meme ? { text: pet.bubble, image: pet.meme } : { text: pet.bubble }
      );
      if (j && j.ok === false && pet.meme) {
        j = await petCall(`${pet.base}/broadcast?pet=${encodeURIComponent(pet.id)}`, { text: pet.bubble });
      }
      petOk = !(j && j.ok === false);
    } catch {
      petOk = false;
    }
    if (!petOk) showToast("鱼没吃到（接口没通），但账已付——真话马上到。");
    await sleep(260);
    removeItem(id);
  };
  const onPointerDown = (e, item) => {
    if (item.phase !== "idle") return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = item.x;
    const oy = item.y;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
    }
    const move = (ev) => {
      const nx = ox + (ev.clientX - sx);
      const ny = oy + (ev.clientY - sy);
      let over = false;
      try {
        over = fishHitAt(ev.clientX, ev.clientY) !== null;
      } catch {
        over = false;
      }
      updateItem(item.id, { x: nx, y: ny, over });
    };
    const up = (ev) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      void handleDrop(item.id, ev.clientX ?? item.x + MONEY_W / 2, ev.clientY ?? item.y + MONEY_H / 2);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  (0, import_react.useEffect)(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const r = await fetch(`${ROUTE}/status`);
        const j = await r.json();
        if (!alive || j?.ok !== true) return;
        status.active = j.active === true;
        if (Array.isArray(j.words) && j.words.length > 0) status.words = j.words;
        if (j.pet && typeof j.pet === "object") status.pet = { ...status.pet, ...j.pet };
        setModeActive(status.active);
      } catch {
      }
    };
    void refresh();
    const t = setInterval(refresh, 4e3);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  (0, import_react.useEffect)(() => {
    const onDown = (e) => {
      if (!status.active) return;
      const now = performance.now();
      if (now - seqAt.current > 1500) seqRef.current = [];
      seqAt.current = now;
      const seq = seqRef.current;
      seq.push(e.button);
      while (seq.length > 4) seq.shift();
      if (seq.length === 4 && seq[0] === 0 && seq[1] === 0 && seq[2] === 2 && seq[3] === 2) {
        seqRef.current = [];
        spawnMoney(e.clientX, e.clientY);
      }
    };
    const onMenu = (e) => {
      if (!status.active) return;
      const seq = seqRef.current;
      if (seq.length >= 3 && seq[0] === 0 && seq[1] === 0 && seq[2] === 2) e.preventDefault();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("contextmenu", onMenu, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("contextmenu", onMenu, true);
    };
  }, []);
  (0, import_react.useEffect)(() => {
    const onMotion = (e) => {
      if (!status.active) return;
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      const st = shakeRef.current;
      const now = performance.now();
      if (now < st.coolUntil) {
        st.prev = mag;
        return;
      }
      const delta = Math.abs(mag - st.prev);
      st.prev = mag;
      if (delta > 16) {
        st.hits = st.hits.filter((t) => now - t < 900);
        st.hits.push(now);
        if (st.hits.length >= 2) {
          st.hits = [];
          st.coolUntil = now + 1800;
          spawnMoney((window.innerWidth || 360) / 2, (window.innerHeight || 640) * 0.6);
        }
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);
  (0, import_react.useEffect)(() => {
    const restoreDraft = (text) => {
      try {
        if (composer.actions !== null && typeof composer.actions.setDraft === "function") composer.actions.setDraft(text);
      } catch {
      }
    };
    const askJohnny = async (text) => {
      try {
        const r = await fetch(`${ROUTE}/ask`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(composer.sessionId !== null ? { sessionId: composer.sessionId, text } : { text })
        });
        const j = await r.json();
        if (j?.ok === true) {
          const pet = status.pet;
          if (typeof j.anim === "string" && j.anim !== "") {
            petCall(`${pet.base}/anim?pet=${encodeURIComponent(pet.id)}`, { name: j.anim }).catch(() => {
            });
          }
          if (typeof j.bubble === "string" && j.bubble !== "") {
            petCall(`${pet.base}/broadcast?pet=${encodeURIComponent(pet.id)}`, { text: j.bubble }).catch(() => {
            });
          }
          return;
        }
        restoreDraft(text);
        if (j?.code === "not-in-mode") showToast("这个会话不在强尼模式——先输入 /johnny。");
        else showToast(`强尼没收下（${j?.code ?? "未知"}）。`);
      } catch {
        restoreDraft(text);
        showToast("发不出去：连不上宿主。");
      }
    };
    const intercept = (inputEl) => {
      const t = String(inputEl.textContent ?? "").trim();
      if (t === "" || t.startsWith("/")) return false;
      clearComposer(inputEl);
      if (isMoneyWord(t)) {
        spawnMoney((window.innerWidth || 360) / 2, (window.innerHeight || 640) * 0.62);
      } else {
        void askJohnny(t);
      }
      return true;
    };
    const onKey = (e) => {
      if (!status.active) return;
      if (e.key !== "Enter" || e.shiftKey || e.repeat || e.isComposing || e.keyCode === 229) return;
      const t = e.target;
      const inputEl = t && t.closest ? t.closest("[data-composer-input]") : null;
      if (inputEl === null || inputEl === void 0) return;
      if (intercept(inputEl)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    const onClick = (e) => {
      if (!status.active) return;
      const t = e.target;
      const card = t && t.closest ? t.closest("[data-composer-card]") : null;
      if (card === null || card === void 0) return;
      const btn = t.closest("button");
      if (btn === null || btn === void 0) return;
      const label = String(btn.getAttribute("aria-label") ?? "").toLowerCase();
      const isSend = label.includes("发送") || label.includes("send") || label.includes("queue") || label.includes("steer");
      if (!isSend) return;
      const inputEl = card.querySelector("[data-composer-input]");
      if (inputEl === null) return;
      if (intercept(inputEl)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-johnny-layer", children: [
    modeActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-johnny-chipgroup", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-johnny-chip",
          title: "强尼模式已开启",
          onClick: () => showToast("敲钱三式：桌面=鼠标左左·右右；手机=摇一摇；或输入「发钱」。钱拖给肥鱼。"),
          children: "强尼模式"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsh-johnny-quit", title: "退出强尼模式", onClick: quitJohnny, children: "×" })
    ] }) : null,
    items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        className: "dsh-johnny-money" + (it.phase === "flying" ? " is-flying" : "") + (it.phase === "returning" ? " is-returning" : "") + (it.over ? " is-over" : ""),
        style: { transform: `translate3d(${it.x}px, ${it.y}px, 0)` },
        onPointerDown: (e) => onPointerDown(e, it),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoneySVG, {})
      },
      it.id
    )),
    toastText !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-johnny-toast", children: toastText }) : null
  ] });
}
var CSS = `
.dsh-johnny-layer{position:fixed;inset:0;pointer-events:none;z-index:12000}
.dsh-johnny-money{position:absolute;left:0;top:0;width:92px;height:62px;pointer-events:auto;touch-action:none;
  cursor:grab;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.28));will-change:transform}
.dsh-johnny-money.is-over{filter:drop-shadow(0 8px 14px rgba(0,0,0,.32)) drop-shadow(0 0 12px rgba(255,200,60,.9))}
.dsh-johnny-money.is-flying{pointer-events:none;transition:transform .45s cubic-bezier(.5,-.2,.7,1.2),opacity .45s ease;opacity:.15}
.dsh-johnny-money.is-returning{transition:transform .5s ease}
.dsh-johnny-chipgroup{position:fixed;left:12px;bottom:14px;display:flex;align-items:center;gap:6px;pointer-events:auto}
.dsh-johnny-chip{height:26px;padding:0 10px;border-radius:13px;border:1px solid rgba(200,150,40,.55);
  background:rgba(255,246,220,.92);color:#8a5a12;font-size:12px;cursor:pointer}
.dsh-johnny-quit{width:22px;height:22px;padding:0;border-radius:50%;border:1px solid rgba(209,36,47,.65);
  background:rgba(209,36,47,.94);color:#fff;font-size:14px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.dsh-johnny-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);max-width:86vw;padding:8px 14px;
  border-radius:10px;background:rgba(28,32,40,.92);color:#fff;font-size:13px;pointer-events:none;white-space:pre-wrap}
`;
var inject = ["slots"];
async function apply(ctx) {
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.id = "dsh-johnny-style";
    tag.dataset.plugin = "dsh-johnny";
    tag.textContent = CSS;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, "dsh-johnny: styles");
  ctx.slots.inject("shell.overlay", () => {
    const dispose = ctx.slots.register({ name: "shell.overlay", id: "johnny", order: 900 }, JohnnyOverlay);
    return () => dispose();
  });
  ctx.slots.inject("conversation.input.dock", () => {
    const dispose = ctx.slots.register(
      {
        name: "conversation.input.dock",
        id: "johnny-bridge",
        order: 90,
        inject: (sessionId) => ({ johnnySessionId: sessionId })
      },
      ComposerBridge
    );
    return () => dispose();
  });
}

		return module.exports;
	}
});
