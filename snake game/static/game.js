/* ========================================
   SERPENT — EVOLVED  |  game.js
   Full Snake engine with levels & effects
   ======================================== */

// ── Constants ──────────────────────────────
const GRID = 20;         // cells per row/col
const CELL = 480 / GRID; // pixels per cell
const BASE_SPEED = 120;  // ms per tick (level 1)

// Level thresholds: score needed to reach level N
const LEVEL_THRESHOLDS = [0, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
// Speed per level (ms per tick — lower = faster)
const LEVEL_SPEEDS = [0, 120, 105, 90, 78, 68, 58, 48, 38, 28, 18];
const LEVEL_LABELS = ['', 'NOVICE', 'APPRENTICE', 'ADEPT', 'SKILLED', 'EXPERT',
    'MASTER', 'GRANDMASTER', 'LEGEND', 'MYTHIC', 'GOD MODE'];
const LEVEL_COLORS = ['', '#00ff88', '#44ffaa', '#88ffcc', '#ffdd00', '#ffaa00',
    '#ff7700', '#ff4400', '#ff2200', '#ff0088', '#ff00ff'];

// ── Canvas setup ───────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = canvas.height = 480;

// ── State ──────────────────────────────────
let snake, dir, nextDir, food, bonusFood;
let score, hiScore, level, gameRunning, gamePaused;
let loopTimer, particles2d;
let levelConfig = {};

// ── DOM refs ───────────────────────────────
const $ = id => document.getElementById(id);
const elScore = $('display-score');
const elLevel = $('display-level');
const elHi = $('display-hi');
const elBadge = $('level-badge');
const elBar = $('level-bar');
const elHint = $('level-hint');
const elSpeed = $('speed-display');
const elLength = $('snake-length');
const elStatus = $('status-text');
const elLed = $('led-dot');
const elGoScore = $('go-score');
const elGoLevel = $('go-level');
const elGoLength = $('go-length');
const elGoTitle = $('go-title');
const elRank = $('rank-display');
const elNameRow = $('name-row');

const overlayStart = $('overlay-start');
const overlayGO = $('overlay-gameover');
const overlayLU = $('overlay-levelup');
const overlayLB = $('overlay-leaderboard');

// ── Helpers ────────────────────────────────
function rnd(n) { return Math.floor(Math.random() * n); }
function pad(n) { return String(n).padStart(3, '0'); }

function showOverlay(el) {
    [overlayStart, overlayGO, overlayLU, overlayLB].forEach(o => {
        if (o !== el) o.classList.add('hidden');
    });
    el.classList.remove('hidden');
}
function hideOverlay(el) { el.classList.add('hidden'); }

// ── Floating particles (background) ────────
(function initParticles() {
    const container = $('particles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = rnd(100) + '%';
        p.style.animationDuration = (6 + rnd(14)) + 's';
        p.style.animationDelay = (rnd(15)) + 's';
        p.style.opacity = 0;
        container.appendChild(p);
    }
})();

// ── Canvas particles (eating effect) ───────
particles2d = [];
function spawnParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        particles2d.push({
            x: x * CELL + CELL / 2,
            y: y * CELL + CELL / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color,
            size: 2 + Math.random() * 3
        });
    }
}
function updateParticles() {
    particles2d = particles2d.filter(p => p.life > 0);
    for (const p of particles2d) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.life -= 0.05;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ── Food placement ─────────────────────────
function randomCell() {
    let pos;
    do {
        pos = { x: rnd(GRID), y: rnd(GRID) };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
}

function spawnBonus() {
    if (bonusFood) return;
    if (Math.random() < 0.2) { // 20% chance per eat
        bonusFood = randomCell();
        bonusFood.timer = 60; // disappears after 60 ticks
    }
}

// ── Draw ───────────────────────────────────
function drawGrid() {
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // subtle grid lines
    ctx.strokeStyle = 'rgba(0,255,136,0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
    }
}

function drawFood() {
    const t = Date.now() / 400;
    const pulse = Math.abs(Math.sin(t)) * 0.3 + 0.7;
    const grd = ctx.createRadialGradient(
        food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, 0,
        food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.7
    );
    grd.addColorStop(0, '#ff4466');
    grd.addColorStop(1, 'transparent');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff2244';
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // stem
    ctx.strokeStyle = '#66ff88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(food.x * CELL + CELL / 2, food.y * CELL + CELL * 0.15);
    ctx.lineTo(food.x * CELL + CELL * 0.65, food.y * CELL);
    ctx.stroke();
}

function drawBonusFood() {
    if (!bonusFood) return;
    const t = Date.now() / 200;
    const flash = (Math.sin(t) + 1) / 2;
    ctx.globalAlpha = 0.7 + flash * 0.3;
    ctx.fillStyle = '#ffdd00';
    ctx.shadowColor = '#ffdd00';
    ctx.shadowBlur = 20;

    // star shape
    const cx = bonusFood.x * CELL + CELL / 2;
    const cy = bonusFood.y * CELL + CELL / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Date.now() / 300);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const b = ((i * 4 + 2) * Math.PI / 5) - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * CELL * 0.38, Math.sin(a) * CELL * 0.38);
        ctx.lineTo(Math.cos(a) * CELL * 0.38, Math.sin(a) * CELL * 0.38);
        ctx.lineTo(Math.cos(b) * CELL * 0.18, Math.sin(b) * CELL * 0.18);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function drawSnake() {
    const lvlColor = LEVEL_COLORS[level] || '#00ff88';
    const headColor = lvlColor;

    snake.forEach((seg, i) => {
        const isHead = i === 0;
        const t = i / snake.length;
        const alpha = 1 - t * 0.5;

        // Glow for head
        if (isHead) {
            ctx.shadowColor = headColor;
            ctx.shadowBlur = 20;
        } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }

        // Body gradient
        const r = CELL * (isHead ? 0.44 : 0.38 - t * 0.08);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = isHead ? headColor : interpolateColor(lvlColor, '#003322', t * 0.7);
        roundRect(ctx, seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, isHead ? 6 : 4);
        ctx.fill();

        // Segment shine
        if (!isHead) {
            ctx.globalAlpha = alpha * 0.2;
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, seg.x * CELL + 2, seg.y * CELL + 2, CELL - 4, (CELL - 4) * 0.4, 3);
            ctx.fill();
        }

        // Eyes on head
        if (isHead) {
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            drawEyes(seg);
        }
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function drawEyes(head) {
    let ex1, ey1, ex2, ey2;
    const o = CELL * 0.22;
    const eo = CELL * 0.28;
    if (dir === 'R') { ex1 = ex2 = head.x * CELL + CELL - 8; ey1 = head.y * CELL + eo; ey2 = head.y * CELL + CELL - eo; }
    else if (dir === 'L') { ex1 = ex2 = head.x * CELL + 8; ey1 = head.y * CELL + eo; ey2 = head.y * CELL + CELL - eo; }
    else if (dir === 'U') { ey1 = ey2 = head.y * CELL + 8; ex1 = head.x * CELL + eo; ex2 = head.x * CELL + CELL - eo; }
    else { ey1 = ey2 = head.y * CELL + CELL - 8; ex1 = head.x * CELL + eo; ex2 = head.x * CELL + CELL - eo; }

    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(ex1, ey1, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey2, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex1 - 0.8, ey1 - 0.8, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2 - 0.8, ey2 - 0.8, 1.5, 0, Math.PI * 2); ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function interpolateColor(c1, c2, t) {
    const p = (h) => parseInt(h.slice(1), 16);
    const a = p(c1), b = p(c2);
    const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return `rgb(${r},${g},${bl})`;
}

function drawScore() {
    // Draw score on canvas top-right
    ctx.fillStyle = 'rgba(0,255,136,0.5)';
    ctx.font = '700 13px "Orbitron", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${score}`, canvas.width - 8, 18);
    ctx.textAlign = 'left';
}

// ── Render loop ────────────────────────────
function render() {
    drawGrid();
    drawFood();
    drawBonusFood();
    drawSnake();
    updateParticles();
    drawScore();
}

// ── Game loop ──────────────────────────────
function tick() {
    if (!gameRunning || gamePaused) return;

    // Move
    dir = nextDir;
    const head = {
        x: snake[0].x + (dir === 'R' ? 1 : dir === 'L' ? -1 : 0),
        y: snake[0].y + (dir === 'D' ? 1 : dir === 'U' ? -1 : 0)
    };

    // Wall collision
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { endGame(); return; }
    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) { endGame(); return; }

    snake.unshift(head);

    let ate = false;
    if (head.x === food.x && head.y === food.y) {
        ate = true;
        score++;
        spawnParticles(food.x, food.y, '#ff4466');
        food = randomCell();
        spawnBonus();
    } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
        ate = true;
        score += 3;
        spawnParticles(bonusFood.x, bonusFood.y, '#ffdd00');
        bonusFood = null;
        flashStatus('BONUS +3!');
    } else {
        snake.pop();
    }

    // Bonus timer
    if (bonusFood) {
        bonusFood.timer--;
        if (bonusFood.timer <= 0) bonusFood = null;
    }

    if (ate) updateUI();
    render();
    checkLevelUp();
}

// ── Level system ───────────────────────────
let lastLevel = 1;
function checkLevelUp() {
    for (let l = 10; l >= 1; l--) {
        if (score >= LEVEL_THRESHOLDS[l]) {
            if (l !== level) {
                level = l;
                onLevelUp();
            }
            break;
        }
    }
}

function onLevelUp() {
    // Flash level-up overlay briefly
    $('levelup-text').textContent = `LEVEL ${level}`;
    $('levelup-name').textContent = LEVEL_LABELS[level];
    $('levelup-name').style.color = LEVEL_COLORS[level];
    showOverlay(overlayLU);
    gamePaused = true;
    setTimeout(() => {
        hideOverlay(overlayLU);
        gamePaused = false;
        restartLoop();
    }, 1200);
    updateUI();
}

function restartLoop() {
    clearInterval(loopTimer);
    const speed = LEVEL_SPEEDS[level] || BASE_SPEED;
    loopTimer = setInterval(tick, speed);
}

// ── UI updates ─────────────────────────────
function updateUI() {
    // Score
    elScore.textContent = pad(score);
    triggerAnimation(elScore, 'score-pop');
    if (score > hiScore) {
        hiScore = score;
        elHi.textContent = pad(hiScore);
    }

    // Level
    elLevel.textContent = level;
    elBadge.textContent = LEVEL_LABELS[level];
    elBadge.style.color = LEVEL_COLORS[level];

    // Progress bar
    const lo = LEVEL_THRESHOLDS[level] || 0;
    const hi = LEVEL_THRESHOLDS[level + 1] || lo + 5;
    const pct = level >= 10 ? 100 : Math.min(100, ((score - lo) / (hi - lo)) * 100);
    elBar.style.width = pct + '%';
    elBar.style.background = `linear-gradient(90deg, ${LEVEL_COLORS[level]}, ${LEVEL_COLORS[Math.min(level + 1, 10)]})`;
    elBar.style.boxShadow = `0 0 8px ${LEVEL_COLORS[level]}`;

    // Next level hint
    if (level < 10) {
        elHint.textContent = `Next: ${hi - score} pts`;
    } else {
        elHint.textContent = 'MAX LEVEL!';
    }

    // Speed dots
    const dots = '●'.repeat(level) + '○'.repeat(10 - level);
    elSpeed.textContent = dots;
    elSpeed.style.color = LEVEL_COLORS[level];

    // Snake length
    elLength.textContent = snake.length;

    // LED
    elLed.className = 'led';
    elStatus.textContent = 'RUNNING';
}

function triggerAnimation(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

let statusFlashTimer;
function flashStatus(msg) {
    elStatus.textContent = msg;
    clearTimeout(statusFlashTimer);
    statusFlashTimer = setTimeout(() => {
        if (gameRunning && !gamePaused) elStatus.textContent = 'RUNNING';
    }, 1000);
}

// ── Start / End / Reset ────────────────────
function initGame() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = 'R';
    nextDir = 'R';
    food = randomCell();
    bonusFood = null;
    score = 0;
    level = 1;
    particles2d = [];
    gameRunning = true;
    gamePaused = false;

    elScore.textContent = '000';
    elLevel.textContent = '1';
    elLength.textContent = '3';
    elBadge.textContent = 'NOVICE';
    elBadge.style.color = LEVEL_COLORS[1];
    elBar.style.width = '0%';
    elHint.textContent = 'Next: 5 pts';
    elSpeed.textContent = '●○○○○○○○○○';
    elStatus.textContent = 'RUNNING';
    elLed.className = 'led';

    hideOverlay(overlayStart);
    hideOverlay(overlayGO);
    restartLoop();
    render();
}

function endGame() {
    gameRunning = false;
    clearInterval(loopTimer);

    // Flash snake red
    ctx.fillStyle = 'rgba(255,0,80,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setTimeout(() => {
        elGoScore.textContent = score;
        elGoLevel.textContent = level;
        elGoLength.textContent = snake.length;
        elGoTitle.textContent = score > 30 ? 'LEGENDARY' : score > 15 ? 'WELL DONE' : 'TERMINATED';
        elNameRow.classList.remove('hidden');
        elRank.classList.add('hidden');
        $('player-name').value = '';
        showOverlay(overlayGO);
        elStatus.textContent = 'OFFLINE';
        elLed.className = 'led danger';
    }, 400);
}

// ── Controls ───────────────────────────────
document.addEventListener('keydown', e => {
    if (!gameRunning) return;
    const map = {
        ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R',
        w: 'U', s: 'D', a: 'L', d: 'R',
        W: 'U', S: 'D', A: 'L', D: 'R'
    };
    const nd = map[e.key];
    if (!nd) {
        if (e.key === ' ' || e.key === 'Escape') togglePause();
        return;
    }
    e.preventDefault();
    const opp = { U: 'D', D: 'U', L: 'R', R: 'L' };
    if (nd !== opp[dir]) nextDir = nd;

    // Highlight ctrl buttons
    const dirMap = { U: 'ctrl-up', D: 'ctrl-down', L: 'ctrl-left', R: 'ctrl-right' };
    document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
    const btn = $(dirMap[nd]);
    if (btn) { btn.classList.add('active'); setTimeout(() => btn.classList.remove('active'), 150); }
});

// On-screen buttons
['ctrl-up', 'ctrl-down', 'ctrl-left', 'ctrl-right'].forEach(id => {
    const el = $(id);
    const map = { 'ctrl-up': 'U', 'ctrl-down': 'D', 'ctrl-left': 'L', 'ctrl-right': 'R' };
    el.addEventListener('click', () => {
        if (!gameRunning) return;
        const nd = map[id];
        const opp = { U: 'D', D: 'U', L: 'R', R: 'L' };
        if (nd !== opp[dir]) nextDir = nd;
    });
});

// Touch support
let touchStart = null;
canvas.addEventListener('touchstart', e => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', e => {
    if (!touchStart || !gameRunning) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const opp = { U: 'D', D: 'U', L: 'R', R: 'L' };
    let nd;
    if (Math.abs(dx) > Math.abs(dy)) nd = dx > 0 ? 'R' : 'L';
    else nd = dy > 0 ? 'D' : 'U';
    if (nd !== opp[dir]) nextDir = nd;
    touchStart = null;
    e.preventDefault();
}, { passive: false });

// Pause
function togglePause() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;
    if (gamePaused) {
        elStatus.textContent = 'PAUSED';
        elLed.className = 'led paused';
        $('btn-pause').textContent = '▶ RESUME';
        // Draw paused overlay text
        ctx.fillStyle = 'rgba(5,8,16,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,255,136,0.8)';
        ctx.font = '700 32px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left';
    } else {
        elStatus.textContent = 'RUNNING';
        elLed.className = 'led';
        $('btn-pause').textContent = '⏸ PAUSE';
        restartLoop();
    }
}
$('btn-pause').addEventListener('click', togglePause);

// ── Buttons ────────────────────────────────
$('btn-start').addEventListener('click', initGame);
$('btn-restart').addEventListener('click', () => { hideOverlay(overlayGO); initGame(); });

$('btn-submit').addEventListener('click', async () => {
    const name = $('player-name').value.trim() || 'ANONYMOUS';
    try {
        const res = await fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score, level })
        });
        const data = await res.json();
        elNameRow.classList.add('hidden');
        if (data.rank) {
            elRank.textContent = `RANK #${data.rank} — SUBMITTED`;
            elRank.classList.remove('hidden');
        }
    } catch (e) {
        elNameRow.classList.add('hidden');
        elRank.textContent = 'SCORE SAVED LOCALLY';
        elRank.classList.remove('hidden');
    }
});

$('btn-leaderboard-show').addEventListener('click', () => loadLeaderboard(true));
$('btn-go-leaderboard').addEventListener('click', () => loadLeaderboard(false));
$('btn-lb-close').addEventListener('click', () => {
    hideOverlay(overlayLB);
    if (!gameRunning) showOverlay(overlayStart);
});

async function loadLeaderboard(fromStart) {
    const tbody = $('lb-body');
    tbody.innerHTML = '<tr><td colspan="4" style="color:#4a6a8a;padding:20px">Loading...</td></tr>';
    showOverlay(overlayLB);
    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="color:#4a6a8a;padding:20px">No scores yet!</td></tr>';
            return;
        }
        tbody.innerHTML = data.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${e.name}</td>
        <td>${e.score}</td>
        <td>${e.level}</td>
      </tr>
    `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:#ff0088;padding:20px">Could not load scores</td></tr>';
    }
}

// ── Hi score from localStorage ─────────────
hiScore = parseInt(localStorage.getItem('serpent_hi') || '0');
elHi.textContent = pad(hiScore);

window.addEventListener('beforeunload', () => {
    localStorage.setItem('serpent_hi', hiScore);
});

// ── Initial render ─────────────────────────
(function initialDraw() {
    drawGrid();
    // draw title snake decoration
    const demoSnake = [];
    for (let i = 8; i >= 0; i--) demoSnake.push({ x: i + 6, y: 10 });
    snake = demoSnake; dir = 'R';
    drawSnake();
    // food
    food = { x: 15, y: 10 };
    drawFood();
    snake = []; // reset
})();