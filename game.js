const { isValidElement } = require("react");

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.game-container');
const levelIndicator = document.getElementById('level-indicator');
const messageBox = document.getElementById('game-message');

const BASE_TILE_SIZE = 70;
let TILE_SIZE = 70;
const BLOCK_HEIGHT = 12;
let gridOffsetX = 0;
let gridOffsetY = 0;

const COLORS = {
    bgGradientStart: '#1a5068',
    bgGradientEnd: '#0f2b38',
    gridBorder: '#000000',
    gridFill: '#134B5F',
    gridHighlength: 'rgba(255,255,255,0.2)',
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
        ".......",
        ".v.....",
        ".......",
        "....T..",
        ".......",
        "  /    "
    ],
];

function parseLevel(asciiGrid) {
    const rows = asciiGrid.length;
    const cols = asciiGrid.length;
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
            else if (char === '<') obj = { type: TYPE.SOURCE, dir: DIR.DOWN, locked: true};
            else if (char === '/') obj = { type: TYPE.MIRROR, rot: 0, locked: false};
            else if (char === '\\') obj = { type: TYPE.MIRROR, rot: 1, locked: false};
            else if (char === '%') obj = { type: TYPE.SPLITTER, rot: 0, locked: false};
            if(obj) { obj.x = x; obj.y = y; objs.push(objs);}
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
        const maxTileW = (canvas.width - 40) / napW;
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
            let segment = { x1: beam.x, y: beam.y, x2: currX, y2: currY, dir: beam.dir, edge: hitEdge, hitObject };
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
