const STORAGE_KEY = "damasPlayoffs32State";
const HISTORY_KEY = "damasPlayoffs32History";
const MAX_PLAYERS = 32;
const REALTIME_ENABLED = location.protocol === "http:" || location.protocol === "https:";
const DEFAULT_PLAYERS = [
  "Elison Vicente - Gravata",
  "Douglas Rodrigues - Gravata",
  "Lameque Lima - Gravata",
  "Danylo Magalhaes - Cajazeiras",
  "Grayce Rodrigues - Gravata",
  "Ailton Rodrigues - Gravata",
  "Hugo Silva - Cajazeiras",
  "Daniel Rodrigues - Cajazeiras",
  "Isaac Mendes - Gravata",
  "Sebastiao Balbino - Gravata",
  "Eva Soares - Gravata",
  "Antonio Pereira - Gravata",
  "Mariana Soares - Gravata",
  "Ana Beatriz - Gravata",
  "Lindonilson Lima - Gravata",
  "Victor Rian - Gravata",
  "Franquisnaldo Nobrega",
  "Josue Morais - Nucleo 1",
  "Josino Morais - Gravata",
  "Leonan Luiz - Gravata",
  "Junior Lins - Gravata",
  "Kleberson Soares - Gravata",
  "Gleidson Carvalho - Gravata",
  "Daniel Rodrigues - Gravata",
  "Nalvinha - Gravata",
  "Cicero Cesar - Gravata",
  "Renan Soares - Gravata",
  "Mariana Carvalho - Gravata",
  "Jucilene Rodrigues - Gravata",
  "Iranildo Bezerra - Nazarezinho",
  "Pierry Domingos - Gravata",
  "Francenildo Nogueira - Gravata"
];

const roundNames = [
  "32 jogadores",
  "Oitavas",
  "Quartas",
  "Semifinal",
  "Final",
  "Campeão"
];

const state = loadState();
let confettiAnimation = null;
let slideRoundIndex = 0;
let suppressSync = false;
let syncTimer = null;

const els = {
  stage: document.getElementById("stage"),
  bracket: document.getElementById("bracket"),
  registeredCount: document.getElementById("registeredCount"),
  completedCount: document.getElementById("completedCount"),
  tournamentStatus: document.getElementById("tournamentStatus"),
  playerForm: document.getElementById("playerForm"),
  playerName: document.getElementById("playerName"),
  playerList: document.getElementById("playerList"),
  playerLimit: document.getElementById("playerLimit"),
  mainDrawBtn: document.getElementById("mainDrawBtn"),
  drawBtn: document.getElementById("drawBtn"),
  redrawBtn: document.getElementById("redrawBtn"),
  resetBtn: document.getElementById("resetBtn"),
  matchControlList: document.getElementById("matchControlList"),
  adminPanel: document.getElementById("adminPanel"),
  adminOpenBtn: document.getElementById("adminOpenBtn"),
  adminCloseBtn: document.getElementById("adminCloseBtn"),
  adminBackdrop: document.getElementById("adminBackdrop"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  participantsOpenBtn: document.getElementById("participantsOpenBtn"),
  participantsPage: document.getElementById("participantsPage"),
  participantsBackdrop: document.getElementById("participantsBackdrop"),
  participantsCloseBtn: document.getElementById("participantsCloseBtn"),
  participantsGrid: document.getElementById("participantsGrid"),
  drawOverlay: document.getElementById("drawOverlay"),
  championSpotlight: document.getElementById("championSpotlight"),
  championName: document.getElementById("championName"),
  confettiCanvas: document.getElementById("confettiCanvas"),
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn")
};

function createEmptyRounds() {
  return [
    Array.from({ length: 16 }, (_, index) => createMatch(0, index)),
    Array.from({ length: 8 }, (_, index) => createMatch(1, index)),
    Array.from({ length: 4 }, (_, index) => createMatch(2, index)),
    Array.from({ length: 2 }, (_, index) => createMatch(3, index)),
    Array.from({ length: 1 }, (_, index) => createMatch(4, index))
  ];
}

function createMatch(round, index, players = ["", ""]) {
  return {
    id: `${round}-${index}`,
    round,
    index,
    players,
    winner: "",
    completed: false
  };
}

function loadState() {
  const fallback = {
    players: [...DEFAULT_PLAYERS],
    rounds: createEmptyRounds(),
    drawn: false,
    champion: ""
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.players) || !Array.isArray(parsed.rounds)) {
      return fallback;
    }
    if (!parsed.players.length) {
      parsed.players = [...DEFAULT_PLAYERS];
    }
    return {
      players: parsed.players.slice(0, MAX_PLAYERS),
      rounds: normalizeRounds(parsed.rounds),
      drawn: Boolean(parsed.drawn),
      champion: parsed.champion || ""
    };
  } catch {
    return fallback;
  }
}

function normalizeRounds(rounds) {
  const empty = createEmptyRounds();
  return empty.map((round, roundIndex) => {
    return round.map((match, matchIndex) => {
      const saved = rounds[roundIndex]?.[matchIndex];
      return {
        ...match,
        players: Array.isArray(saved?.players) ? [saved.players[0] || "", saved.players[1] || ""] : ["", ""],
        winner: saved?.winner || "",
        completed: Boolean(saved?.completed)
      };
    });
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueStateSync();
}

function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  queueStateSync();
}

function render() {
  renderBracket();
  renderPlayers();
  renderParticipantsPage();
  renderMatchControls();
  renderStats();
  renderChampion();
  renderHistory();
  saveState();
}

function exportAppState() {
  return {
    players: [...state.players],
    rounds: state.rounds,
    drawn: state.drawn,
    champion: state.champion,
    history: loadHistory()
  };
}

function applyRemoteState(remoteState) {
  if (!remoteState || !Array.isArray(remoteState.players) || !Array.isArray(remoteState.rounds)) return;

  suppressSync = true;
  state.players = remoteState.players.slice(0, MAX_PLAYERS);
  state.rounds = normalizeRounds(remoteState.rounds);
  state.drawn = Boolean(remoteState.drawn);
  state.champion = remoteState.champion || "";

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (Array.isArray(remoteState.history)) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(remoteState.history));
  }

  render();
  suppressSync = false;
}

function queueStateSync() {
  if (!REALTIME_ENABLED || suppressSync) return;
  clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncStateToServer, 120);
}

async function syncStateToServer() {
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(exportAppState())
    });
  } catch {
    // A pagina continua funcionando localmente mesmo sem servidor.
  }
}

async function loadServerState() {
  if (!REALTIME_ENABLED) return;

  try {
    const response = await fetch("/api/state");
    if (!response.ok) return;
    const remoteState = await response.json();
    if (remoteState?.players) {
      applyRemoteState(remoteState);
    } else {
      queueStateSync();
    }
  } catch {
    // Sem servidor ativo, usa o estado local.
  }
}

function connectRealtimeUpdates() {
  if (!REALTIME_ENABLED || !window.EventSource) return;

  const events = new EventSource("/events");
  events.addEventListener("state", (event) => {
    try {
      applyRemoteState(JSON.parse(event.data));
    } catch {
      // Ignora mensagens invalidadas.
    }
  });
}

function renderBracket() {
  els.bracket.innerHTML = "";

  state.rounds.forEach((round, roundIndex) => {
    const roundEl = document.createElement("div");
    roundEl.className = `round${roundIndex === slideRoundIndex ? " is-focus" : ""}`;
    roundEl.innerHTML = `<div class="round-title">${roundNames[roundIndex]}</div>`;

    const body = document.createElement("div");
    body.className = "round-body";

    round.forEach((match) => body.appendChild(createMatchNode(match)));
    roundEl.appendChild(body);
    els.bracket.appendChild(roundEl);
  });

  const championCol = document.createElement("div");
  championCol.className = `round champion-column${slideRoundIndex === 5 ? " is-focus" : ""}`;
  championCol.innerHTML = `<div class="round-title">${roundNames[5]}</div>`;

  const body = document.createElement("div");
  body.className = "round-body";
  const championMatch = document.createElement("div");
  championMatch.className = "match champion-match";
  championMatch.innerHTML = `
    <div class="champion-inner">
      <span class="trophy">🏆</span>
      <strong>CAMPEÃO DO TORNEIO</strong>
      <p>${escapeHtml(state.champion || "Aguardando final")}</p>
    </div>
  `;
  body.appendChild(championMatch);
  championCol.appendChild(body);
  els.bracket.appendChild(championCol);
}

function createMatchNode(match) {
  const node = document.createElement("article");
  node.className = "match";
  node.dataset.matchId = match.id;

  match.players.forEach((player, index) => {
    const slot = document.createElement("div");
    slot.className = "player-slot";
    if (!player) slot.classList.add("is-empty");
    if (match.winner && match.winner === player) slot.classList.add("is-winner");

    const score = match.completed && match.winner === player ? "✓" : "";
    slot.innerHTML = `
      <span class="player-name">${escapeHtml(player || "A definir")}</span>
      <span class="player-score">${score}</span>
    `;
    node.appendChild(slot);
  });

  return node;
}

function renderPlayers() {
  els.playerList.innerHTML = "";
  els.playerLimit.textContent = `${state.players.length} de ${MAX_PLAYERS}`;

  if (!state.players.length) {
    els.playerList.innerHTML = `<li class="empty-state">Nenhum jogador cadastrado.</li>`;
    return;
  }

  state.players.forEach((player, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span>${escapeHtml(player)}</span>
      <button class="remove-player" type="button" title="Remover jogador" data-remove="${index}">×</button>
    `;
    els.playerList.appendChild(item);
  });
}

function renderParticipantsPage() {
  els.participantsGrid.innerHTML = "";

  if (!state.players.length) {
    els.participantsGrid.innerHTML = `<li class="empty-state">Nenhum jogador cadastrado.</li>`;
    return;
  }

  state.players.forEach((player, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span>${escapeHtml(player)}</span>
    `;
    els.participantsGrid.appendChild(item);
  });
}

function renderMatchControls() {
  els.matchControlList.innerHTML = "";
  const allMatches = state.rounds.flat();

  if (!state.drawn) {
    els.matchControlList.innerHTML = `<div class="empty-state">Cadastre 32 jogadores e realize o sorteio para controlar as partidas.</div>`;
    return;
  }

  allMatches.forEach((match) => {
    const card = document.createElement("article");
    card.className = "match-control-card";
    const canClassify = Boolean(match.players[0] && match.players[1]);
    const status = match.completed ? `Vencedor: ${match.winner}` : canClassify ? "Aguardando resultado" : "Aguardando classificados";

    card.innerHTML = `
      <div class="match-control-title">
        <strong>${roundNames[match.round]} - Partida ${String(match.index + 1).padStart(2, "0")}</strong>
        <span>${escapeHtml(status)}</span>
      </div>
      <div class="versus">
        <b>${escapeHtml(match.players[0] || "A definir")}</b>
        <small>VS</small>
        <b>${escapeHtml(match.players[1] || "A definir")}</b>
      </div>
      <div class="winner-actions">
        <button class="winner-button" type="button" data-winner-round="${match.round}" data-winner-match="${match.index}" data-player-index="0" ${canClassify ? "" : "disabled"}>
          Classificar ${escapeHtml(match.players[0] || "jogador")}
        </button>
        <button class="winner-button" type="button" data-winner-round="${match.round}" data-winner-match="${match.index}" data-player-index="1" ${canClassify ? "" : "disabled"}>
          Classificar ${escapeHtml(match.players[1] || "jogador")}
        </button>
      </div>
      ${match.completed ? `
        <button class="correction-button" type="button" data-correct-round="${match.round}" data-correct-match="${match.index}">
          Corrigir resultado
        </button>
      ` : ""}
    `;
    els.matchControlList.appendChild(card);
  });
}

function renderStats() {
  const completed = state.rounds.flat().filter((match) => match.completed).length;
  els.registeredCount.textContent = `${state.players.length}/${MAX_PLAYERS}`;
  els.completedCount.textContent = `${completed}/31`;

  if (state.champion) {
    els.tournamentStatus.textContent = "Campeão definido";
  } else if (state.drawn) {
    els.tournamentStatus.textContent = "Em andamento";
  } else if (state.players.length === MAX_PLAYERS) {
    els.tournamentStatus.textContent = "Pronto para sorteio";
  } else {
    els.tournamentStatus.textContent = "Cadastro";
  }
}

function renderChampion() {
  els.championName.textContent = state.champion || "Aguardando final";
  els.championSpotlight.classList.toggle("is-visible", Boolean(state.champion));
  if (state.champion) {
    launchConfetti();
  } else {
    stopConfetti();
  }
}

function renderHistory() {
  const history = loadHistory();
  els.historyList.innerHTML = "";

  if (!history.length) {
    els.historyList.innerHTML = `<li class="empty-state">Nenhum campeão registrado ainda.</li>`;
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${escapeHtml(entry.name)}</strong>
      <span>${escapeHtml(entry.date)}</span>
    `;
    els.historyList.appendChild(item);
  });
}

function addPlayer(name) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (!cleanName) return;
  if (state.players.length >= MAX_PLAYERS) {
    alert("O limite de 32 jogadores já foi atingido.");
    return;
  }
  if (state.players.some((player) => player.toLowerCase() === cleanName.toLowerCase())) {
    alert("Esse jogador já está cadastrado.");
    return;
  }
  state.players.push(cleanName);
  render();
}

function removePlayer(index) {
  if (state.drawn && !confirm("Remover um jogador vai limpar o sorteio atual. Continuar?")) return;
  state.players.splice(index, 1);
  clearBracket(false);
  render();
}

function drawMatches(options = {}) {
  const { confirmExisting = true } = options;
  if (state.players.length !== MAX_PLAYERS) {
    alert("Cadastre exatamente 32 jogadores antes de sortear os confrontos.");
    return;
  }

  const hasResults = state.rounds.flat().some((match) => match.completed);
  if (confirmExisting && state.drawn && hasResults && !confirm("Sortear novamente vai apagar os resultados atuais. Continuar?")) {
    return;
  }

  els.drawOverlay.classList.add("is-visible");

  window.setTimeout(() => {
    const shuffled = shuffle([...state.players]);
    state.rounds = createEmptyRounds();

    for (let i = 0; i < 16; i += 1) {
      state.rounds[0][i].players = [shuffled[i * 2], shuffled[i * 2 + 1]];
    }

    state.drawn = true;
    state.champion = "";
    els.drawOverlay.classList.remove("is-visible");
    render();
    switchTab("matches");
  }, 1200);
}

function classifyWinner(roundIndex, matchIndex, playerIndex) {
  const match = state.rounds[roundIndex][matchIndex];
  const winner = match.players[playerIndex];
  if (!winner) return;
  if (match.completed && match.winner === winner) return;

  clearDescendants(roundIndex, matchIndex);
  match.winner = winner;
  match.completed = true;

  if (roundIndex === state.rounds.length - 1) {
    state.champion = winner;
    recordChampion(winner);
    render();
    launchConfetti();
    return;
  }

  const nextMatchIndex = Math.floor(matchIndex / 2);
  const nextPlayerIndex = matchIndex % 2;
  const nextMatch = state.rounds[roundIndex + 1][nextMatchIndex];
  nextMatch.players[nextPlayerIndex] = winner;
  nextMatch.winner = "";
  nextMatch.completed = false;

  state.champion = "";
  render();
}

function correctMatchResult(roundIndex, matchIndex) {
  const match = state.rounds[roundIndex][matchIndex];
  if (!match.completed) return;

  if (!confirm("Corrigir esse resultado vai limpar os classificados das fases seguintes ligados a essa partida. Continuar?")) {
    return;
  }

  clearDescendants(roundIndex, matchIndex);
  match.winner = "";
  match.completed = false;
  state.champion = "";
  render();
}

function clearDescendants(roundIndex, matchIndex) {
  let nextRound = roundIndex + 1;
  let nextMatchIndex = Math.floor(matchIndex / 2);
  let nextPlayerIndex = matchIndex % 2;

  while (nextRound < state.rounds.length) {
    const match = state.rounds[nextRound][nextMatchIndex];
    match.players[nextPlayerIndex] = "";
    match.winner = "";
    match.completed = false;

    nextPlayerIndex = nextMatchIndex % 2;
    nextMatchIndex = Math.floor(nextMatchIndex / 2);
    nextRound += 1;
  }

  state.champion = "";
}

function recordChampion(name) {
  const history = loadHistory();
  const latest = history[0];
  if (latest?.name === name && latest?.tournamentId === state.rounds[0].map((m) => m.players.join("x")).join("|")) {
    return;
  }

  history.unshift({
    name,
    date: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date()),
    tournamentId: state.rounds[0].map((match) => match.players.join("x")).join("|")
  });
  saveHistory(history.slice(0, 20));
}

function clearBracket(keepPlayers = true) {
  if (!keepPlayers) state.players = [];
  state.rounds = createEmptyRounds();
  state.drawn = false;
  state.champion = "";
}

function resetTournament() {
  if (!confirm("Reiniciar o campeonato atual? O histórico de campeões será mantido.")) return;
  clearBracket(true);
  render();
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function launchConfetti() {
  if (confettiAnimation) return;

  const canvas = els.confettiCanvas;
  const ctx = canvas.getContext("2d");
  const rect = els.stage.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const colors = ["#f6c85f", "#ffd166", "#24d8ff", "#ffffff", "#4df0a4", "#ff5f77"];

  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const pieces = Array.from({ length: 460 }, (_, index) => {
    const sideBurst = index % 5 === 0;
    const fromLeft = Math.random() > 0.5;
    return {
      x: sideBurst ? (fromLeft ? -20 : rect.width + 20) : Math.random() * rect.width,
      y: sideBurst ? rect.height * (0.2 + Math.random() * 0.35) : -30 - Math.random() * rect.height * 0.75,
      size: 5 + Math.random() * 12,
      speed: 2.8 + Math.random() * 6.5,
      vx: sideBurst ? (fromLeft ? 4 + Math.random() * 7 : -4 - Math.random() * 7) : -2.2 + Math.random() * 4.4,
      gravity: 0.03 + Math.random() * 0.06,
      angle: Math.random() * Math.PI,
      spin: -0.24 + Math.random() * 0.48,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  });

  function animate() {
    ctx.clearRect(0, 0, rect.width, rect.height);

    pieces.forEach((piece) => {
      piece.y += piece.speed;
      piece.x += piece.vx + Math.sin(piece.angle) * 1.1;
      piece.speed += piece.gravity;
      piece.angle += piece.spin;

      if (piece.y > rect.height + 30) {
        piece.y = -30 - Math.random() * 80;
        piece.x = Math.random() * rect.width;
        piece.speed = 2.8 + Math.random() * 5.5;
      }

      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.angle);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * (0.45 + Math.random() * 0.35));
      ctx.restore();
    });

    if (state.champion) {
      confettiAnimation = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height);
      confettiAnimation = null;
    }
  }

  confettiAnimation = requestAnimationFrame(animate);
}

function stopConfetti() {
  if (!confettiAnimation) return;
  cancelAnimationFrame(confettiAnimation);
  confettiAnimation = null;

  const canvas = els.confettiCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function toggleAdmin(show) {
  els.adminPanel.classList.toggle("is-open", show);
  els.adminPanel.setAttribute("aria-hidden", String(!show));
  if (show) els.playerName.focus();
}

function toggleParticipantsPage(show) {
  els.participantsPage.classList.toggle("is-open", show);
  els.participantsPage.setAttribute("aria-hidden", String(!show));
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });
}

function togglePresentation() {
  const isPresentation = els.stage.classList.toggle("presentation");
  if (isPresentation) {
    slideRoundIndex = 0;
    updateSlideFocus();
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    els.stage.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateSlideFocus() {
  document.querySelectorAll(".round").forEach((round, index) => {
    round.classList.toggle("is-focus", index === slideRoundIndex);
  });
}

function requestAdminAccess() {
  if (sessionStorage.getItem("damasAdminUnlocked") === "true") return true;
  const password = prompt("Digite a senha administrativa");
  if (password === "1234" || password?.toLowerCase() === "admin") {
    sessionStorage.setItem("damasAdminUnlocked", "true");
    return true;
  }
  if (password !== null) alert("Senha incorreta.");
  return false;
}

els.playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addPlayer(els.playerName.value);
  els.playerName.value = "";
  els.playerName.focus();
});

els.playerList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  removePlayer(Number(button.dataset.remove));
});

els.drawBtn.addEventListener("click", () => drawMatches({ confirmExisting: true }));
els.redrawBtn.addEventListener("click", () => {
  drawMatches({ confirmExisting: true });
});
els.mainDrawBtn.addEventListener("click", () => drawMatches({ confirmExisting: true }));
els.resetBtn.addEventListener("click", resetTournament);

els.matchControlList.addEventListener("click", (event) => {
  const correctionButton = event.target.closest("[data-correct-round]");
  if (correctionButton) {
    correctMatchResult(
      Number(correctionButton.dataset.correctRound),
      Number(correctionButton.dataset.correctMatch)
    );
    return;
  }

  const button = event.target.closest("[data-winner-round]");
  if (!button) return;
  classifyWinner(
    Number(button.dataset.winnerRound),
    Number(button.dataset.winnerMatch),
    Number(button.dataset.playerIndex)
  );
});

els.adminOpenBtn.addEventListener("click", () => {
  if (requestAdminAccess()) toggleAdmin(true);
});
els.adminCloseBtn.addEventListener("click", () => toggleAdmin(false));
els.adminBackdrop.addEventListener("click", () => toggleAdmin(false));
els.participantsOpenBtn.addEventListener("click", () => toggleParticipantsPage(true));
els.participantsCloseBtn.addEventListener("click", () => toggleParticipantsPage(false));
els.participantsBackdrop.addEventListener("click", () => toggleParticipantsPage(false));
els.fullscreenBtn.addEventListener("click", toggleFullscreen);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

els.clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("Limpar todo o histórico de campeões?")) return;
  saveHistory([]);
  renderHistory();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    toggleParticipantsPage(false);
    toggleAdmin(false);
    if (els.stage.classList.contains("presentation")) togglePresentation();
  }

  if (els.stage.classList.contains("presentation") && event.key === "ArrowRight") {
    slideRoundIndex = Math.min(slideRoundIndex + 1, 5);
    updateSlideFocus();
  }

  if (els.stage.classList.contains("presentation") && event.key === "ArrowLeft") {
    slideRoundIndex = Math.max(slideRoundIndex - 1, 0);
    updateSlideFocus();
  }
});

render();
loadServerState();
connectRealtimeUpdates();
