const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.game-container');
const levelIndicator = document.getElementById('level-indicator');
const messageBox = document.getElementById('game-message');
const modal = document.getElementById('level-modal');
const levelGrid = document.getElementById('level-grid');
const btnClose = document.getElementById('btn-close-modal');

const BASE_TILE_SIZE = 70;
let TILE_SIZE = 70;
let maxUnlockedLevel = 1;
const BLOCK_HEIGHT = 12;
let gridOffsetX = 0;
let gridOffsetY = 0;

const COLORS = {
    bgGradientStart: '#1a5068',
    bgGradientEnd: '#0f2b38',
    gridBorder: '#000000',
    gridFill: '#134B5F',
    gridHighlight: 'rgba(255,255,255,0.2)',
    blockTop: '#ecf0f1',
    blockSide: '#bdc3c7',
    wallTop: '#34495e',
    wallSide: '#2c3e50',
    mirrorFace: '#3498db',
    splitterFace: '#9b59b6',
    laserCore: '#ffffff',
    laserMid: '#ff3333',
    laserGlow: '#ff0000',
    source: '#e74c3c',
    target: '#f1c40f',
    targetActive: '#ffffff',
    selection: '#2ecc71',
    dragShadow: 'rgba(0,0,0,0.5)'
};

const TYPE = { EMPTY: 0, WALL: 1, MIRROR: 2, SOURCE: 4, TARGET: 5, SPLITTER: 6};
const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3};

let currentLevelIdx = 0;
let levelMap = [];
let objects = [];
let lasers = [];
let particles = [];

//animate
let currentLaserLength = 0;
let totalCalculatedLength = 0;
let animationFrameId;

//drag
let isDragging = false;
let dragObj = null;
let dragOffset = {x: 0, y: 0};
let dragPos = {x: 0, y: 0};

const asciiLevels = [
    [
        ".......",
        ".>.....",
        ".......",
        "....T..",
        ".......",
        "  /    ",
    ],
    [
        "....T....",
        ".........",
        "........T",
        "T........",
        "....^....",
        " % / \\  "
    ],
    [
        "....T.T.T",
        "..T.....T",
        ".........",
        ".........",
        ".^...^...",
        "  / % \\  "
    ],
    [
        ".T.....T.",
        ".........",
        ".........",
        ".>.....>.",
        ".........",
        "   /  \\ "
    ],
    [
        "WWWWWWWWW",
        "W.T...T.W",
        "W.......W",
        "W...>...W",
        "W.......W",
        "WWWWWWWWW",
        " / \\ / \\"
    ],
    [
        "T.......T",
        ".........",
        "T.......T",
        ".........",
        "T.......T",
        ".........",
        "....^....",
        " % % / \\ "
    ],
    [
        "WWWW..WWW",
        "W..T..W.W",
        "W..W..W.W",
        "W..W..W.W",
        "W..W..W.W",
        "W.....>.W",
        "WWWWWWWWW",
        "  / \\ /  "
    ],
    [
        ".T.T.T.T.",
        ".........",
        ".........",
        ".>.......",
        ".........",
        ".........",
        " % / \\ / "
    ],
    [
        "wwwwwwwwwwwww",
        "W.T.......T.W",
        "W.W.......W.W",
        "W.W.......W.W",
        "W...>...<...W",
        "W...........W",
        "WWWWWWWWWWWWW",
        "  % % / \\ /  "
    ],
    [
        ".....T.....",
        ".W.......W.",
        ".W.......W.",
        ".....^.....",
        ".W.......W.",
        ".T.......T.",
        "...........",
        " % % / \\ / "
    ]
];

function parseLevel(asciiGrid) {
    const rows = asciiGrid.length;
    const cols = asciiGrid[0].length;
    let map = [], objs = [];
    for(let y = 0; y < rows; y++){
        let mapRow = [];
        let rowStr = asciiGrid[y];
        for(let x = 0; x < cols; x++){
            let char = rowStr[x] || ' ';
            if(char === ' '){ mapRow.push(0); continue; } else { mapRow.push(1); }
            let obj = null;
            if (char === 'W') obj = { type: TYPE.WALL, locked: true };
            else if (char === 'T') obj = { type: TYPE.TARGET, locked: true};
            else if (char === '^') obj = { type: TYPE.SOURCE, dir: DIR.UP, locked: true};
            else if (char === '>') obj = { type: TYPE.SOURCE, dir: DIR.RIGHT, locked: true};
            else if (char === 'v') obj = { type: TYPE.SOURCE, dir: DIR.DOWN, locked: true};
            else if (char === '<') obj = { type: TYPE.SOURCE, dir: DIR.LEFT, locked: true};
            else if (char === '/') obj = { type: TYPE.MIRROR, rot: 0, locked: false};
            else if (char === '\\') obj = { type: TYPE.MIRROR, rot: 1, locked: false};
            else if (char === '%') obj = { type: TYPE.SPLITTER, rot: 0, locked: false};
            if(obj) { obj.x = x; obj.y = y; objs.push(obj);}
        }
        map.push(mapRow);
    }
    return { map, objs };
}

function resizeCanvas(){
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (levelMap.length > 0) {
        const mapH = levelMap.length;
        const mapW = levelMap[0].length;
        const maxTileW = (canvas.width - 40) / mapW;
        const maxTileH = (canvas.height - 40) / mapH;
        TILE_SIZE = Math.min(BASE_TILE_SIZE, maxTileW, maxTileH);
        gridOffsetX = (canvas.width - (mapW * TILE_SIZE)) / 2;
        gridOffsetY = (canvas.height - (mapH * TILE_SIZE)) / 2;
    }
    draw();
}
window.addEventListener('resize', resizeCanvas);

function initLevel(idx){
    if(idx >= asciiLevels.length) idx = 0;
    currentLevelIdx = idx;
    levelIndicator.innerText = (currentLevelIdx + 1).toString().padStart(2, '0');
    messageBox.classList.add('hidden');
    isLevelComplete = false;
    selectedObj = null;
    isDragging = false;
    dragObj = null;
    const parsed = parseLevel(asciiLevels[currentLevelIdx]);
    levelMap = parsed.map;
    objects = parsed.objs;
    particles = [];
    resizeCanvas();
    calculateLaser();
    if(!animationFrameId) renderLoop();
}

function calculateLaser(){
    lasers = [];
    objects.filter(o => o.type === TYPE.TARGET).forEach(t => t.active = false);
    const activeObjects = objects.filter(o => o !== dragObj);

    let beams = activeObjects.filter(o => o.type === TYPE.SOURCE).map(s => ({
        x: s.x, y: s.y, dir: s.dir
    }));

    let processedSteps = 0;
    while(beams.length > 0 && processedSteps < 100){
        let beam = beams.shift();
        processedSteps++;
        let currX = beam.x, currY = beam.y;
        let dx = 0, dy = 0;

        if(beam.dir === DIR.UP) dy = -1;
        else if(beam.dir === DIR.RIGHT) dx = 1;
        else if(beam.dir === DIR.DOWN) dy = 1;
        else if(beam.dir === DIR.LEFT) dx = -1;

        let hitObject = null, hitEdge = false, steps = 0;

        while(true) {
            let nextX = currX + dx;
            let nextY = currY + dy;
            if(nextY < 0 || nextY >= levelMap.length || nextX < 0 || nextX >= levelMap[0].length || levelMap[nextY][nextX] !== 1){
                hitEdge = true; break;
            }
            currX = nextX; currY = nextY; steps++;
            let obj = activeObjects.find(o => o.x === currX && o.y === currY);
            if(obj) {
                if(obj.type === TYPE.TARGET) { obj.active = true; }
                else { hitObject = obj; break; }
            }
        }
        if(steps > 0 || hitObject || hitEdge){
            let segment = { x1: beam.x, y1: beam.y, x2: currX, y2: currY, dir: beam.dir, edge: hitEdge, hitObject };
            lasers.push(segment);
            if(hitObject){
                if(hitObject.type === TYPE.MIRROR){
                    let newDir = reflect(beam.dir, hitObject.rot);
                    if(newDir !== -1) beams.push({x: currX, y: currY, dir: newDir});
                } else if(hitObject.type === TYPE.SPLITTER){
                    beams.push({ x: currX, y: currY, dir: beam.dir});
                    let newDir = reflect(beam.dir, hitObject.rot);
                    if(newDir !== -1) beams.push({x: currX, y: currY, dir: newDir});
                }
            }
        }
    }
    totalCalculatedLength = 0;
    lasers.forEach(l => {
        const c = getVisualCoords(l);
        totalCalculatedLength += Math.sqrt(Math.pow(c.x2-c.x1, 2) + Math.pow(c.y2-c.y1, 2));
    });
    currentLaserLength = 0;
    if (totalCalculatedLength === 0) totalCalculatedLength = 1;
    if(!isDragging) checkWin();
}

function getVisualCoords(l){
    let x1 = gridOffsetX + l.x1 * TILE_SIZE + TILE_SIZE/2;
    let y1 = gridOffsetY + l.y1 * TILE_SIZE + TILE_SIZE/2 - BLOCK_HEIGHT/2;
    let x2 = gridOffsetX + l.x2 * TILE_SIZE + TILE_SIZE/2;
    let y2 = gridOffsetY + l.y2 * TILE_SIZE + TILE_SIZE/2 - BLOCK_HEIGHT/2;
    
    if(l.edge){
        let dist = TILE_SIZE/2;
        if(l.dir === DIR.UP) y2 -= dist;
        else if(l.dir === DIR.RIGHT) x2 += dist;
        else if(l.dir === DIR.DOWN) y2 += dist;
        else if(l.dir === DIR.LEFT) x2 += dist;
    }
    return { x1, y1, x2, y2 };
}

function reflect(inDir, rot){
    if(rot === 0){
        if(inDir === DIR.UP) return DIR.RIGHT;
        if(inDir === DIR.RIGHT) return DIR.UP;
        if(inDir === DIR.DOWN) return DIR.LEFT;
        if(inDir === DIR.LEFT) return DIR.DOWN;
    } else {
        if(inDir === DIR.UP) return DIR.LEFT;
        if(inDir === DIR.LEFT) return DIR.UP;
        if(inDir === DIR.DOWN) return DIR.RIGHT;
        if(inDir === DIR.RIGHT) return DIR.DOWN;
    }
    return -1;
}

function checkWin(){
    const target = objects.filter(o => o.type === TYPE.TARGET);
    if(target.length > 0 && target.every(t => t.active)) {
        if(!isLevelComplete){
            isLevelComplete = true;

            if(currentLevelIdx + 1 >= maxUnlockedLevel){
                maxUnlockedLevel = currentLevelIdx + 2;
            }
            setTimeout(() => {
                messageBox.classList.remove('hidden');
                setTimeout(() => {
                    initLevel(currentLevelIdx + 1);
                }, 2000);
            }, 1500);
        }
    }
}

function spawnSparks(x, y){
    for(let i = 0; i<2; i++){
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
            color: `hsl(${Math.random()*40 + 340}, 100%, 75%)`
        });
    }
}
function updateAndDrawParticles(){
    ctx.globalCompositeOperation = 'lighter';
    for(let i = particles.length - 1; i >= 0; i--){
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.05;
        if(p.life <= 0){ particles.splice(i, 1); }
        else {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
}

//render
function renderLoop(){
    const speed = TILE_SIZE * 0.8;
    if(currentLaserLength < totalCalculatedLength){
        currentLaserLength += speed;
    } else {
        currentLaserLength = totalCalculatedLength;
    }
    draw();
    animationFrameId = requestAnimationFrame(renderLoop);
}

function draw(){
    let grad = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 50,
        canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)
    );
    grad.addColorStop(0, COLORS.bgGradientStart);
    grad.addColorStop(1, COLORS.bgGradientEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for(let y=0; y<levelMap.length; y++){
        for(let x=0; x<levelMap[y].length; x++){
            if(levelMap[y][x] === 1) drawGridTile(x, y);
        }
    }
    if(isDragging){
        const hX = Math.round((dragPos.x - gridOffsetX - TILE_SIZE/2) / TILE_SIZE);
        const hY = Math.round((dragPos.y - gridOffsetY - TILE_SIZE/2) / TILE_SIZE);
        if(isValidMove(hX, hY)){
            const px = gridOffsetX + hX * TILE_SIZE;
            const py = gridOffsetY + hY * TILE_SIZE;
            ctx.fillStyle = COLORS.gridHighlight;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#fff'; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
    }
    drawAnimatedLasers();
    updateAndDrawParticles();

    const staticObjs = objects.filter(o => o !== dragObj).sort((a,b) => a.y - b.y);
    staticObjs.forEach(obj => {
        const cx = gridOffsetX + obj.x * TILE_SIZE + TILE_SIZE/2;
        const cy = gridOffsetY + obj.y * TILE_SIZE + TILE_SIZE/2;
        drawObject3D(obj, cx, cy);
    });
    if(selectedObj && !isDragging){
        const px = gridOffsetX + selectedObj.x * TILE_SIZE;
        const py = gridOffsetY + selectedObj.y * TILE_SIZE;
        ctx.strokeStyle = COLORS.selection; ctx.lineWidth = 3; ctx.setLineDash([10, 5]);
        ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8); ctx.setLineDash([]);
    }
    if(isDragging && dragObj){
        ctx.fillStyle = COLORS.dragShadow;
        ctx.beginPath(); ctx.ellipse(dragPos.x, dragPos.y + TILE_SIZE*0.4, TILE_SIZE/3, TILE_SIZE/5, 0, 0, Math.PI*2); ctx.fill();
        drawObject3D(dragObj, dragPos.x, dragPos.y - 10, true);
    }
}
function drawAnimatedLasers(){
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let remainingDrawLen = currentLaserLength;
    let activePath = [];
    let endPoint = null;

    for(let i = 0; i<lasers.length; i++){
        const l = lasers[i];
        const coords = getVisualCoords(l);
        let segmentLen = Math.sqrt(Math.pow(coords.x2-coords.x1, 2) + Math.pow(coords.y2-coords.y1, 2));

        if(remainingDrawLen >= segmentLen){
            activePath.push(coords);
            remainingDrawLen -= segmentLen;
        } else {
            let percent = remainingDrawLen / segmentLen;
            let pX = coords.x1 + (coords.x2 - coords.x1) * percent;
            let pY = coords.y1 + (coords.y2 - coords.y1) * percent;
            activePath.push({x1: coords.x1, y1: coords.y1 ,x2: pX, y2: pY});
            endPoint = { x: pX, y: pY};
            remainingDrawLen = 0;
            break; 
        }
        if(i === lasers.length - 1 && remainingDrawLen >= 0){
            endPoint = {x: coords.x2, y: coords.y2};
        }
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 15; ctx.shadowColor = COLORS.laserGlow; ctx.strokeStyle = COLORS.laserGlow; ctx.lineWidth = TILE_SIZE / 6;
    ctx.beginPath(); activePath.forEach(p => { ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); }); ctx.stroke();
    ctx.shadowBlur = 5; ctx.strokeStyle = COLORS.laserMid; ctx.lineWidth = TILE_SIZE / 12;
    ctx.beginPath(); activePath.forEach(p => { ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); }); ctx.stroke();

    ctx.shadowBlur = 2; ctx.shadowColor = '#fff'; ctx.strokeStyle = COLORS.laserCore; ctx.lineWidth = TILE_SIZE / 30;
    ctx.beginPath(); activePath.forEach(p => { ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); }); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;

    if(endPoint){
        spawnSparks(endPoint.x, endPoint.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#fff'; ctx.shadowColor = COLORS.laserMid; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(endPoint.x, endPoint.y, TILE_SIZE/10, 0, Math.PI*2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    }
}

function drawGridTile(x, y){
    const px = gridOffsetX + x * TILE_SIZE;
    const py = gridOffsetY + y * TILE_SIZE;
    ctx.fillStyle = COLORS.gridFill;
    ctx.strokeStyle = COLORS.gridBorder;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.rect(px, py, TILE_SIZE, TILE_SIZE); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.strokeRect(px+5, py+5, TILE_SIZE-10, TILE_SIZE-10);
}

function drawObject3D(obj, cx, cy, lifted = false){
    const size = TILE_SIZE * 0.7;
    const half = size / 2;
    const baseY = lifted ? cy : cy + 5;
    const baseX = cx;

    if(!lifted){
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(baseX, baseY + half, half, half*0.4, 0, 0, Math.PI*2); ctx.fill();
    }
    if(obj.type === TYPE.TARGET){
        ctx.beginPath(); ctx.arc(cx, cy, size/3, 0, Math.PI*2);
        ctx.fillStyle = obj.active ? COLORS.targetActive : COLORS.target; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        if(obj.active) { ctx.shadowColor = COLORS.target; ctx.shadowBlur = 20; ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowBlur = 0; }
        return;
    }
    const topY = baseY - BLOCK_HEIGHT;
    if(obj.type === TYPE.WALL){
        ctx.fillStyle = COLORS.wallSide; roundRect(ctx, baseX - half, baseY - half, size, size, 8, true);
        ctx.fillStyle = COLORS.wallTop; roundRect(ctx, baseX - half, topY - half, size, size, 8, true);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(baseX - half + 10, topY - half + 10); ctx.lineTo(baseX + half - 10, topY + half - 10);
        ctx.moveTo(baseX + half - 10, topY - half + 10); ctx.lineTo(baseX - half + 10); ctx.stroke();
        return;
    }
    ctx.fillStyle = COLORS.blockSide; roundRect(ctx, baseX - half, baseY - half, size, size, 8, true);
    ctx.fillStyle = COLORS.blockTop;
    if(selectedObj === obj && !isDragging) ctx.fillStyle = '#d1f2eb';
    if(isDragging && dragObj === obj) ctx.fillStyle = '#abebc6';
    roundRect(ctx, baseX - half, topY - half, size, size, 8, true);

    if(obj.type === TYPE.SOURCE){
        ctx.fillStyle = COLORS.source; ctx.beginPath(); ctx.arc(baseX, topY, size/5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(baseX, topY, size/12, 0, Math.PI*2); ctx.fill();
    }
    else if(obj.type === TYPE.MIRROR) drawMirrorFace(baseX, topY, size, obj.rot);
    else if(obj.type === TYPE.SPLITTER) drawSplitterFace(baseX, topY, size, obj.rot);
}
function drawMirrorFace(x, y, size, rot){
    ctx.strokeStyle = COLORS.mirrorFace; ctx.lineWidth = size/10; ctx.lineCap = 'round';
    ctx.beginPath(); const offset = size * 0.3;
    if(rot === 0){ ctx.moveTo(x-offset, y + offset); ctx.lineTo(x + offset, y - offset); }
    else { ctx.moveTo(x - offset, y - offset); ctx.lineTo(x + offset, y + offset); }
    ctx.stroke();
    ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.arc(x, y, size/15, 0, Math.PI*2); ctx.fill();
}

function drawSplitterFace(x, y, size, rot){
    ctx.fillStyle = COLORS.splitterFace;
    ctx.beginPath(); const s = size/4;
    ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); const offset = s;
    if(rot === 0) { ctx.moveTo(x - offset, y + offset); ctx.lineTo(x + offset, y - offset); }
    else { ctx.moveTo(x - offset, y - offset); ctx.lineTo(x + offset, y + offset); }
    ctx.stroke();
}

function roundRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
    if(fill) ctx.fill();
}

//Input
function getGridPos(e){
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - gridOffsetX;
    const my = e.clientY - rect.top - gridOffsetY;
    return { x: Math.floor(mx / TILE_SIZE), y: Math.floor(my / TILE_SIZE), mx: e.clientX - rect.left, my: e.clientY - rect.top };
}
canvas.addEventListener('mousedown', (e) => {
    if(isLevelComplete) return;
    const pos = getGridPos(e);
    const obj = objects.find(o => o.x === pos.x && o.y === pos.y);
    if(obj && !obj.locked){
        isDragging = true; dragObj = obj; selectedObj = obj;
        const objScreenX = gridOffsetX + obj.x * TILE_SIZE + TILE_SIZE/2;
        const objScreenY = gridOffsetY + obj.y * TILE_SIZE + TILE_SIZE/2;
        dragOffset.x = objScreenX - pos.mx; dragOffset.y = objScreenY - pos.my;
        dragPos.x = pos.mx + dragOffset.x; dragPos.y = pos.my + dragOffset.y;
        calculateLaser();
    } else if (obj) selectedObj = null;
});
canvas.addEventListener('mousemove', (e) => {
    if(isDragging && dragObj){
        const rect = canvas.getBoundingClientRect();
        dragPos.x = (e.clientX - rect.left) + dragOffset.x;
        dragPos.y = (e.clientY - rect.top) + dragOffset.y;
    }
});
canvas.addEventListener('mouseup', (e) => {
    if(isDragging && dragObj){
        const dropX = Math.round((dragPos.x - gridOffsetX - TILE_SIZE/2) / TILE_SIZE);
        const dropY = Math.round((dragPos.y - gridOffsetY - TILE_SIZE/2) / TILE_SIZE);
        if(isValidMove(dropX, dropY)){ dragObj.x = dropX; dragObj.y = dropY; }
        isDragging = false; dragObj = null; calculateLaser();
    }
});
function isValidMove(x, y){
    if(y < 0 || y >= levelMap.length || x < 0 || x >= levelMap[0].length) return false;
    if(levelMap[y][x] !== 1) return false;

    //space is occupied or not
    const occupant = objects.find(o => o.x === x && o.y === y && o !== dragObj);
    if(occupant) return false;
    return true;
}
document.addEventListener('keydown', (e) => {
    if(!selectedObj || isLevelComplete || isDragging) return;
    let changed = false;
    if((e.key === 'ArrowRight' || e.key === 'd') && !selectedObj.locked) { selectedObj.rot = selectedObj.rot === 0 ? 1 : 0; changed = true}
    else if((e.key === 'ArrowLeft' || e.key === 'a') && !selectedObj.locked) { selectedObj.rot = selectedObj.rot === 0 ? 1 : 0; changed = true}
    if(changed) calculateLaser();
});

function openLevelMenu(){
    levelGrid.innerHTML = '';
    asciiLevels.forEach((_, index) => {
        const btn = document.createElement('button');
        const levelNum = index + 1;
        btn.className = 'level-btn';

        if(levelNum <= maxUnlockedLevel){
            btn.innerText = levelNum;
            btn.onclick = () => {
                initLevel(index);
                modal.classList.add('hidden');
            };
        } else {
            btn.classList.add('locked');
            btn.innerHTML = `<svg class="lock-icon" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.234 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm6 10v8H6v-8h12zm-9-3v-2c0-1.654 1.346-3 3-3s3 1.346 3 3v2H9z"></path></svg>`;
        }
        levelGrid.appendChild(btn);
    });
    modal.classList.remove('hidden');
}
btnClose.onclick = () => modal.classList.add('hidden');
document.getElementById('btn-select-level').addEventListener('click', openLevelMenu);
// document.getElementById('btn-select-level').addEventListener('click', () => {
//     let lvl = prompt("Enter level (1-10):");
//     if(lvl && !isNaN(lvl)) initLevel(parseInt(lvl) - 1);
// });
document.getElementById('btn-how-to').addEventListener('click', () => alert("Controls:\n1. DRAG mirror to grid.\n2. CLICK to select.\n3. ARROW KEYS to rotate."));
initLevel(0);