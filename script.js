// --- CONFIGURATION OBJECT ---
const config = {
    initialParticleCount: 5000, 
    particleColor: 'rgba(19, 42, 19, 0.7)', 

    magnetText: "BRANDON MARKWALDER", 

    attractionStrength: 0.7,        
    wallRepulsionThreshold: 5,      
    wallRepulsionStrength: 3.5,     
    internalRepelStrength: 3.0,     
    interParticleRepelRadius: 15,   
    interParticleRepelStrength: 0.1, 
    mouseRepelRadius: 80,           
    mouseRepelStrength: 0.5,        
    clickRepelRadius: 350,          
    clickRepelStrength: 5.0,        
    particleDamping: 0.9,           
    wallDamping: 0.7,               
    internalDamping: 0.5,           
    
    pixelSampleSkip: 2,             
    outlineAttractorCount: 80,      

    targetFPS: 58,                  
    minParticles: 1000,             
    maxParticles: 8000,             
    fpsCheckInterval: 60,           
    particleAdjustStep: 100,
    
    particleGrowthDuration: 120, 
    particleGrowthEasing: (t) => t * t * (3 - 2 * t) 
};

// --- Apply Config to HTML Elements ---
document.querySelector('.button-container').innerHTML = `<span>${config.magnetText}</span>`;

// --- Canvas Setup ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const magnet = document.getElementById('magnet');
let interactionMode = 0; 
const mouse = { x: null, y: null }; 

let pillShapeData = {}; 
let outlinePoints = []; 

const GRID_CELL_SIZE = 50; 
let particleGrid = {};     
let usedGridCells = [];    

let currentMagnetRect = {}; 

// --- Adaptive Particle Count Variables ---
let lastFrameTime = 0;
let frameCount = 0;
let fpsSum = 0;
let currentParticles = []; 
let targetParticleCount = config.initialParticleCount; 

/**
 * Calculates and thins outline points from the div, and gets pixel data for inside checks.
 */
function getOutlinePointsFromDiv(element) {
    const rect = element.getBoundingClientRect();

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    tempCanvas.width = rect.width;
    tempCanvas.height = rect.height;

    const computedStyle = window.getComputedStyle(element);
    const getRadius = (prop) => parseFloat(computedStyle[prop]);
    const radii = [
        getRadius('borderTopLeftRadius'),
        getRadius('borderTopRightRadius'),
        getRadius('borderBottomRightRadius'),
        getRadius('borderBottomLeftRadius')
    ];

    tempCtx.fillStyle = 'rgba(0, 0, 0, 1)'; 
    tempCtx.beginPath();
    tempCtx.roundRect(0, 0, rect.width, rect.height, radii);
    tempCtx.fill();
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const rawPoints = []; 
    const pixelSkip = config.pixelSampleSkip; 

    for (let y = 0; y < tempCanvas.height; y += pixelSkip) {
        for (let x = 0; x < tempCanvas.width; x += pixelSkip) {
            const index = (y * tempCanvas.width + x) * 4; 
            const alpha = imageData.data[index + 3]; 

            if (alpha > 128) { 
                rawPoints.push({ x: rect.left + x, y: rect.top + y }); 
            }
        }
    }

    const thinnedOutlinePoints = [];
    const targetAttractorCount = config.outlineAttractorCount;
    const totalRawPoints = rawPoints.length;

    if (totalRawPoints > targetAttractorCount) {
        const step = Math.floor(totalRawPoints / targetAttractorCount);
        if (step < 1) { 
            thinnedOutlinePoints.push(...rawPoints); 
        } else {
            for (let i = 0; i < totalRawPoints; i += step) {
                thinnedOutlinePoints.push(rawPoints[i]);
            }
            if (thinnedOutlinePoints.length === 0 && totalRawPoints > 0) {
                thinnedOutlinePoints.push(rawPoints[0]);
            }
        }
    } else {
        thinnedOutlinePoints.push(...rawPoints);
    }

    return {
        points: thinnedOutlinePoints, 
        tempCanvas: tempCanvas,       
        imageData: imageData,         
        rect: rect                    
    };
}

// --- Event Listeners (Combined Mouse & Touch) ---

document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (interactionMode !== 1 && interactionMode !== 2) {
        interactionMode = 0; 
    }
});
document.addEventListener('touchmove', (e) => {
    e.preventDefault(); 
    if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    }
    if (interactionMode !== 1 && interactionMode !== 2) {
        interactionMode = 0; 
    }
}, { passive: false });

magnet.addEventListener('mouseenter', () => {
    if (window.innerWidth > 768) { 
        interactionMode = 1; 
    }
});
magnet.addEventListener('mouseleave', () => {
    if (window.innerWidth > 768) { 
        interactionMode = 0; 
        mouse.x = null; 
        mouse.y = null;
    }
});

magnet.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    interactionMode = (interactionMode === 1) ? 2 : 1; 

    if (interactionMode === 2) { 
        const rect = magnet.getBoundingClientRect();
        mouse.x = rect.left + rect.width / 2;
        mouse.y = rect.top + rect.height / 2;
        setTimeout(() => {
            if (interactionMode === 2) { 
                interactionMode = 1; 
            }
        }, 1000); 
    } else { 
        mouse.x = null; 
        mouse.y = null;
    }
}, { passive: false });

document.addEventListener('touchend', () => {
    interactionMode = 0; 
    mouse.x = null;
    mouse.y = null;
});
document.addEventListener('touchcancel', () => { 
    interactionMode = 0;
    mouse.x = null;
    mouse.y = null;
});

magnet.addEventListener('click', () => {
    interactionMode = (interactionMode === 1) ? 2 : 1; 

    if (interactionMode === 2) {
        const rect = magnet.getBoundingClientRect();
        mouse.x = rect.left + rect.width / 2;
        mouse.y = rect.top + rect.height / 2;
        setTimeout(() => {
            if (interactionMode === 2) {
                interactionMode = 1;
            }
        }, 1000);
    } else {
        mouse.x = null;
        mouse.y = null;
    }
});


// --- Particle Class Definition ---
class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5; 
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = 1 + Math.random() * 2; 
        this.life = 0; 
        this.initialSize = this.size; 
    }

    update(grid, magnetRect) {
        if (this.life < config.particleGrowthDuration) {
            this.life++;
        }

        let target = null; 
        if (interactionMode === 1 && outlinePoints.length > 0) {
            let minDistSq = Infinity;
            for (let i = 0; i < outlinePoints.length; i++) {
                const dx = this.x - outlinePoints[i].x;
                const dy = this.y - outlinePoints[i].y;
                const distSq = dx * dx + dy * dy; 
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    target = outlinePoints[i];
                }
            }
        }

        if (interactionMode === 2) { 
            const centerX = magnetRect.left + magnetRect.width / 2;
            const centerY = magnetRect.top + magnetRect.height / 2;

            const dx = this.x - centerX;
            const dy = this.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy); 

            if (dist < config.clickRepelRadius) {
                this.vx += (dx / dist) * config.clickRepelStrength;
                this.vy += (dy / dist) * config.clickRepelStrength;
            }
        }
        else if (interactionMode === 1 && target) { 
            const dx = this.x - target.x;
            const dy = this.y - target.y;
            const dist = Math.sqrt(dx * dx + dy * dy); 

            if (dist > config.wallRepulsionThreshold) {
                this.vx += (-dx / dist) * config.attractionStrength;
                this.vy += (-dy / dist) * config.attractionStrength;
            } else {
                this.vx += (dx / dist) * config.wallRepulsionStrength;
                this.vy += (dy / dist) * config.wallRepulsionStrength;
                this.vx *= config.wallDamping; 
                this.vy *= config.wallDamping;
            }

            const { imageData, rect: shapeRect } = pillShapeData; 
            if (imageData && shapeRect) {
                const localX = Math.round(this.x - shapeRect.left);
                const localY = Math.round(this.y - shapeRect.top);

                if (localX >= 0 && localX < shapeRect.width && localY >= 0 && localY < shapeRect.height) {
                    const index = (localY * shapeRect.width + localX) * 4;
                    const alpha = imageData.data[index + 3];

                    if (alpha > 128) { 
                        const centerX = shapeRect.width / 2;
                        const centerY = shapeRect.height / 2;
                        const rx = localX - centerX;
                        const ry = localY - centerY;
                        const rdist = Math.sqrt(rx * rx + ry * ry);

                        if (rdist > 0) {
                            this.vx += (rx / rdist) * config.internalRepelStrength;
                            this.vy += (ry / rdist) * config.internalRepelStrength;
                            this.vx *= config.internalDamping; 
                            this.vy *= config.internalDamping;
                        } else { 
                            this.vx = (Math.random() - 0.5) * config.internalRepelStrength;
                            this.vy = (Math.random() - 0.5) * config.internalRepelStrength;
                        }
                    }
                }
            }

            const interParticleRepelRadiusSq = config.interParticleRepelRadius * config.interParticleRepelRadius;
            const myCellX = Math.floor(this.x / GRID_CELL_SIZE);
            const myCellY = Math.floor(this.y / GRID_CELL_SIZE);

            for (let dyOffset = -1; dyOffset <= 1; dyOffset++) {
                for (let dxOffset = -1; dxOffset <= 1; dxOffset++) {
                    const checkCellKey = `${myCellX + dxOffset}_${myCellY + dyOffset}`;
                    if (grid[checkCellKey]) {
                        grid[checkCellKey].forEach(otherP => {
                            if (this === otherP) return;
                            const pdx = this.x - otherP.x;
                            const pdy = this.y - otherP.y;
                            const pdistSq = pdx * pdx + pdy * pdy;
                            if (pdistSq < interParticleRepelRadiusSq) {
                                const pdist = Math.sqrt(pdistSq);
                                if (pdist > 0) {
                                    const repelForce = config.interParticleRepelStrength * (1 - (pdist / config.interParticleRepelRadius));
                                    this.vx += (pdx / pdist) * repelForce;
                                    this.vy += (pdy / pdist) * repelForce;
                                }
                            }
                        });
                    }
                }
            }
        }
        else { 
            if (mouse.x !== null && mouse.y !== null) {
                const mdx = this.x - mouse.x;
                const mdy = this.y - mouse.y;
                const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

                if (mdist < config.mouseRepelRadius) {
                    this.vx += (mdx / mdist) * config.mouseRepelStrength;
                    this.vy += (mdy / mdist) * config.mouseRepelStrength;
                }
            }
        }

        this.vx *= config.particleDamping; 
        this.vy *= config.particleDamping;

        this.x += this.vx;
        this.y += this.vy;

        if (this.x < -this.size || this.x > canvas.width + this.size || this.y < -this.size || this.y > canvas.height + this.size) {
            if (currentParticles.length <= targetParticleCount) { 
                 this.reset();
            }
        }
    }

    draw() {
        const t = Math.min(1, this.life / config.particleGrowthDuration);
        const easedT = config.particleGrowthEasing(t);
        const currentSize = this.initialSize * easedT;

        if (currentSize > 0.1) { 
            ctx.moveTo(this.x + currentSize, this.y); 
            ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2); 
        }
    }
}

// --- Particle Initialization ---
function setupParticles(count) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
    return particles;
}

// --- Animation Loop ---
function animate() {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    const currentFPS = 1000 / deltaTime;

    frameCount++;
    fpsSum += currentFPS;

    if (frameCount >= config.fpsCheckInterval) {
        const averageFPS = fpsSum / frameCount;
        
        if (averageFPS < config.targetFPS - 2 && targetParticleCount > config.minParticles) {
            targetParticleCount = Math.max(config.minParticles, targetParticleCount - config.particleAdjustStep);
        } else if (averageFPS > config.targetFPS + 2 && targetParticleCount < config.maxParticles) {
            targetParticleCount = Math.min(config.maxParticles, targetParticleCount + config.particleAdjustStep);
        }

        while (currentParticles.length < targetParticleCount) {
            currentParticles.push(new Particle()); 
        }
        while (currentParticles.length > targetParticleCount) {
            currentParticles.pop();
        }
        
        frameCount = 0;
        fpsSum = 0;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    currentMagnetRect = magnet.getBoundingClientRect(); 

    for (const key of usedGridCells) {
        if (particleGrid[key]) {
            particleGrid[key].length = 0; 
        }
    }
    usedGridCells.length = 0; 

    currentParticles.forEach(p => {
        const cellX = Math.floor(p.x / GRID_CELL_SIZE);
        const cellY = Math.floor(p.y / GRID_CELL_SIZE);
        const cellKey = `${cellX}_${cellY}`;
        if (!particleGrid[cellKey]) {
            particleGrid[cellKey] = []; 
        }
        particleGrid[cellKey].push(p); 
        usedGridCells.push(cellKey); 
    });

    ctx.beginPath(); 
    ctx.fillStyle = config.particleColor; 

    currentParticles.forEach(p => {
        p.update(particleGrid, currentMagnetRect); 
        p.draw(); 
    });

    ctx.fill(); 

    requestAnimationFrame(animate); 
}

// --- Initial Setup and Event Handling ---
function initializeOutlinePoints() {
    pillShapeData = getOutlinePointsFromDiv(magnet);
    outlinePoints = pillShapeData.points; 
}

initializeOutlinePoints(); 

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initializeOutlinePoints(); 
    targetParticleCount = config.minParticles; 
    while (currentParticles.length > targetParticleCount) {
        currentParticles.pop(); 
    }
    while (currentParticles.length < config.initialParticleCount) {
        currentParticles.push(new Particle());
    }
});

currentParticles = setupParticles(config.initialParticleCount); 
lastFrameTime = performance.now(); 
animate();
