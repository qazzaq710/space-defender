const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const footer = document.querySelector('.footer');

// Проверка DOM-элементов / Check for DOM elements
if (!canvas || !ctx || !footer) {
    console.error('Error: Missing DOM elements. Check index.html for #gameCanvas, .footer');
    alert('Game initialization failed. Check console for details.');
    throw new Error('Missing DOM elements');
}
console.log('Canvas and context initialized:', canvas, ctx);

// Установка размеров canvas, если не заданы / Set canvas size if not defined
if (!canvas.width || !canvas.height) {
    canvas.width = 800;
    canvas.height = 600;
    console.log('Canvas size set to 800x600');
}

// Состояние игры / Game state
let score = 0;
let lives = 3;
let heartAlphas = [1, 1, 1]; // Текущая прозрачность сердечек / Current alpha for hearts
let heartTargets = [1, 1, 1]; // Целевая прозрачность / Target alpha for hearts
let gameStarted = false; // Игра начата / Game started
let gameActive = false; // Игра активна / Game active
let invulnerable = false;
let invulnerableTimer = 0;
let frameCount = 0;
let canStartOrRestart = false; // Разрешить старт/рестарт / Allow start/restart
let gameOverDelay = 0; // Задержка после проигрыша (кадры) / Delay after game over (frames)
let gameTime = 0; // Время в игре (секунды) / Time in game (seconds)
let mouseOverButton = false; // Курсор над кнопкой Restart / Mouse over Restart button
let mouseOverDownload = false; // Курсор над кнопкой Save Score / Mouse over Save Score button
let lastScreenshot = null; // Последний скриншот (data URL) / Last screenshot (data URL)
let speedMultiplier = 1; // Множитель скорости для ускорения объектов / Speed multiplier for object acceleration

// Загрузка изображений / Load images
const playerImage = new Image();
playerImage.src = 'spaceship.png';
const enemyImage = new Image();
enemyImage.src = 'cube.png';
const asteroidImage = new Image();
asteroidImage.src = 'asteroid.png';

// Игрок / Player
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 50,
    width: 50,
    height: 50,
    speed: 5,
    bullets: []
};

// Враги и астероиды / Enemies and asteroids
let enemies = [];
let asteroids = [];
let particles = [];

// Управление / Controls
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    space: false,
    d: false // Клавиша D для скачивания / D key for downloading
};

// Web Audio API для звуков / Web Audio API for sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function createExplosionSound() {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

// Кинематографичный фон / Cinematic background
const stars = [];
const stars2 = [];
const stars3 = [];
for (let i = 0; i < 100; i++) {
    stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 2, speed: 0.5, alpha: 0.8 });
    stars2.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1.5, speed: 0.3, alpha: 0.5 });
    stars3.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1, speed: 0.1, alpha: 0.2 });
}
const noise = [];
for (let i = 0; i < 500; i++) {
    noise.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height });
}

// Создание врага с фазой пульсации / Create enemy with pulse phase
function createEnemy() {
    return {
        x: Math.random() * (canvas.width - 30),
        y: 0,
        width: 30,
        height: 30,
        speed: 2 * speedMultiplier,
        pulsePhase: Math.random() * Math.PI * 2 // Уникальная фаза для пульсации / Unique phase for pulsing
    };
}

// Создание частицы для врага / Create particle for enemy
function createEnemyParticle(enemy) {
    particles.push({
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height, // Исправлено: goose.y → enemy.y / Fixed: goose.y → enemy.y
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1,
        alpha: 0.5,
        color: 'rgba(150, 100, 100, ' // Пыльный серо-красный цвет / Dusty gray-red color
    });
}

// Функция скачивания скриншота / Download screenshot function
function downloadScreenshot() {
    console.log('downloadScreenshot called, lastScreenshot exists:', !!lastScreenshot); // Отладка / Debug
    if (!lastScreenshot) {
        console.warn('No screenshot available. Ensure game is running via http:// server (not file://) and images are local.');
        alert('Failed to download screenshot. Run the game via a local server (e.g., npx http-server) and ensure images are in the same folder.');
        return;
    }
    try {
        const link = document.createElement('a');
        link.href = lastScreenshot;
        link.download = `SpaceDefender_Score${score}_Time${Math.floor(gameTime / 60)}m${Math.floor(gameTime % 60)}s.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('Screenshot downloaded successfully');
    } catch (error) {
        console.error('Error downloading screenshot:', error.message);
        alert('Error downloading screenshot. Check console for details.');
    }
}

// Обработчики событий клавиатуры / Keyboard event listeners
document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'ArrowUp') keys.up = true;
    if (e.code === 'ArrowDown') keys.down = true;
    if (e.code === 'Space') {
        keys.space = true;
        console.log('Space pressed, canStartOrRestart:', canStartOrRestart);
    }
    if (e.code === 'KeyD') {
        keys.d = true;
        console.log('D pressed for downloading');
    }
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'ArrowUp') keys.up = false;
    if (e.code === 'ArrowDown') keys.down = false;
    if (e.code === 'Space') {
        keys.space = false;
        console.log('Space released');
    }
    if (e.code === 'KeyD') {
        keys.d = false;
        console.log('D released');
    }
});

// Обработчики событий мыши / Mouse event listeners
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    mouseOverButton = (!gameStarted || !gameActive) && mouseX >= 360 && mouseX <= 520 && mouseY >= 310 && mouseY <= 350;
    mouseOverDownload = !gameActive && mouseX >= 360 && mouseX <= 520 && mouseY >= 360 && mouseY <= 400;
    console.log('Mouse move: x=', mouseX, 'y=', mouseY, 'mouseOverButton:', mouseOverButton, 'mouseOverDownload:', mouseOverDownload);
});
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    console.log('Click at: x=', mouseX, 'y=', mouseY, 'canStartOrRestart:', canStartOrRestart, 'gameActive:', gameActive); // Отладка / Debug
    if (!gameStarted && canStartOrRestart && mouseX >= 360 && mouseX <= 520 && mouseY >= 310 && mouseY <= 350) {
        startGame();
        canStartOrRestart = false;
        console.log('Game started by mouse click');
    } else if (!gameActive && canStartOrRestart && mouseX >= 360 && mouseX <= 520 && mouseY >= 310 && mouseY <= 350) {
        restartGame();
        canStartOrRestart = false;
        console.log('Game restarted by mouse click');
    } else if (!gameActive && mouseX >= 360 && mouseX <= 520 && mouseY >= 360 && mouseY <= 400) {
        downloadScreenshot();
        console.log('Download triggered by mouse click');
    }
});

// Функции отрисовки / Draw functions
function drawBackground() {
    console.log('Drawing background, frame:', frameCount); // Отладка / Debug
    ctx.fillStyle = 'rgba(0, 0, 20, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const nebulaGradient = ctx.createRadialGradient(
        canvas.width / 2 + Math.sin(frameCount / 100) * 50,
        canvas.height / 2 + Math.cos(frameCount / 100) * 50,
        100,
        canvas.width / 2,
        canvas.height / 2,
        400
    );
    nebulaGradient.addColorStop(0, 'rgba(50, 0, 100, 0.4)');
    nebulaGradient.addColorStop(0.5, 'rgba(0, 50, 150, 0.3)');
    nebulaGradient.addColorStop(1, 'rgba(0, 0, 50, 0.1)');
    ctx.fillStyle = nebulaGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * (0.8 + Math.random() * 0.2)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    stars2.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * (0.8 + Math.random() * 0.2)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    stars3.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * (0.8 + Math.random() * 0.2)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    noise.forEach(point => {
        point.x += (Math.random() - 0.5) * 0.2;
        point.y += (Math.random() - 0.5) * 0.2;
        ctx.fillRect(point.x, point.y, 1, 1);
    });
    const vignetteGradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 1.5);
    vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPlayer() {
    if (!invulnerable || Math.floor(frameCount / 5) % 2 === 0) {
        if (playerImage.complete && playerImage.naturalWidth !== 0) {
            ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
        } else {
            ctx.fillStyle = 'cyan';
            ctx.fillRect(player.x, player.y, player.width, player.height);
        }
    }
}

function drawBullets() {
    player.bullets.forEach(bullet => {
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(bullet.x, bullet.y, 4, 10);
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.save();
        // Пульсация / Pulsing effect
        const pulse = 0.95 + 0.05 * Math.sin(frameCount / 20 + enemy.pulsePhase);
        ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
        ctx.scale(pulse, pulse);
        ctx.translate(-enemy.width / 2, -enemy.height / 2);
        // Кольцо как у Юпитера / Jupiter-like ring
        ctx.save();
        ctx.scale(1, 0.7); // Наклон для перспективы / Tilt for perspective
        ctx.beginPath();
        ctx.ellipse(enemy.width / 2, enemy.height / 2, enemy.width * 0.8, enemy.height * 0.8, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(150, 100, 100, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Лёгкая текстура шума / Light noise texture
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = enemy.width * 0.8;
            ctx.fillStyle = 'rgba(150, 100, 100, 0.2)';
            ctx.fillRect(
                enemy.width / 2 + Math.cos(angle) * radius - 1,
                enemy.height / 2 + Math.sin(angle) * radius * 0.7 - 1,
                1, 1
            );
        }
        ctx.restore();
        // Тень / Shadow effect
        ctx.shadowColor = 'rgba(100, 100, 100, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        // Отрисовка куба / Draw cube
        if (enemyImage.complete && enemyImage.naturalWidth !== 0) {
            ctx.drawImage(enemyImage, 0, 0, enemy.width, enemy.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, enemy.width, enemy.height);
        }
        ctx.restore();
    });
}

function drawAsteroids() {
    if (asteroidImage.complete && asteroidImage.naturalWidth !== 0) {
        asteroids.forEach(asteroid => {
            ctx.drawImage(asteroidImage, asteroid.x - asteroid.radius, asteroid.y - asteroid.radius, asteroid.radius * 2, asteroid.radius * 2);
        });
    } else {
        ctx.fillStyle = 'gray';
        asteroids.forEach(asteroid => {
            ctx.beginPath();
            ctx.arc(asteroid.x, asteroid.y, asteroid.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color ? `${p.color}${p.alpha})` : `rgba(255, 204, 0, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawUI() {
    ctx.font = '16px Orbitron'; // Уменьшенный шрифт для UI / Reduced font size for UI
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 25);
    // Таймер / Timer
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    ctx.fillText(`Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`, 10, 45);
    ctx.textAlign = 'right';
    let x = canvas.width - 70;
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = heartAlphas[i] > 0.5 ? `rgba(255, 255, 255, ${heartAlphas[i]})` : `rgba(100, 100, 100, ${heartAlphas[i]})`;
        ctx.fillText('❤️', x, 25);
        x += 30;
    }
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '40px Orbitron';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Space Defender', canvas.width / 2, canvas.height / 2 - 60);
    // Кнопка Start / Start button
    ctx.strokeStyle = (keys.space || mouseOverButton) && canStartOrRestart ? 'cyan' : 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvas.width / 2 - 80, canvas.height / 2 + 10, 160, 40);
    ctx.fillStyle = (keys.space || mouseOverButton) && canStartOrRestart ? 'cyan' : 'white';
    ctx.font = '20px Orbitron';
    ctx.fillText('Start', canvas.width / 2, canvas.height / 2 + 35);
}

function drawGameOver() {
    console.log('Drawing Game Over, attempting to create screenshot'); // Отладка / Debug
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '40px Orbitron';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 60);
    ctx.font = '20px Orbitron';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 - 20);
    // Кнопка Restart / Restart button
    ctx.strokeStyle = (keys.space || mouseOverButton) && canStartOrRestart ? 'cyan' : 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvas.width / 2 - 80, canvas.height / 2 + 10, 160, 40);
    ctx.fillStyle = (keys.space || mouseOverButton) && canStartOrRestart ? 'cyan' : 'white';
    ctx.fillText('Restart', canvas.width / 2, canvas.height / 2 + 35);
    // Кнопка Save Score / Save Score button
    ctx.strokeStyle = (keys.d || mouseOverDownload) ? 'cyan' : 'white';
    ctx.strokeRect(canvas.width / 2 - 80, canvas.height / 2 + 60, 160, 40);
    ctx.fillStyle = (keys.d || mouseOverDownload) ? 'cyan' : 'white';
    ctx.font = '14px Orbitron'; // Уменьшен шрифт для компактности / Smaller font for compactness
    ctx.fillText('Save Score (D)', canvas.width / 2, canvas.height / 2 + 85);
    // Создание скриншота / Create screenshot
    try {
        if (canvas.width > 0 && canvas.height > 0) {
            lastScreenshot = canvas.toDataURL('image/png');
            console.log('Screenshot created in drawGameOver:', lastScreenshot.length, 'bytes');
        } else {
            console.error('Canvas has invalid dimensions:', canvas.width, canvas.height);
            lastScreenshot = null;
        }
    } catch (error) {
        console.error('Error creating screenshot in drawGameOver:', error.message);
        lastScreenshot = null;
    }
}

// Функции обновления / Update functions
function update() {
    if (!gameStarted) {
        if (keys.space && canStartOrRestart) {
            startGame();
            canStartOrRestart = false;
            console.log('Game started by space');
        }
        return;
    }

    if (!gameActive) {
        if (gameOverDelay > 0) {
            gameOverDelay--;
            if (gameOverDelay === 0) {
                canStartOrRestart = true;
                console.log('Game over delay ended, canStartOrRestart set to true');
            }
            return;
        }
        if (keys.space && canStartOrRestart) {
            restartGame();
            canStartOrRestart = false;
            console.log('Restart triggered by space');
        }
        if (keys.d) {
            console.log('D key triggered download'); // Отладка / Debug
            downloadScreenshot();
        }
        return;
    }

    // Обновление таймера / Update timer
    gameTime += 1 / 60; // Добавляем 1/60 секунды за кадр / Add 1/60 seconds per frame

    // Ускорение объектов каждые 30 секунд / Accelerate objects every 30 seconds
    if (Math.floor(gameTime % 30) === 0 && Math.floor(gameTime) > 0 && speedMultiplier < 2.5) { // Ограничение до 2.5x
        speedMultiplier += 0.05; // Увеличение на 5% от базовой скорости / Increase by 5%
        console.log('Speed increased, new multiplier:', speedMultiplier);
    }

    if (invulnerable) {
        invulnerableTimer -= 1 / 60;
        if (invulnerableTimer <= 0) {
            invulnerable = false;
        }
    }

    if (keys.left && player.x > 0) player.x -= player.speed;
    if (keys.right && player.x < canvas.width - player.width) player.x += player.speed;
    if (keys.up && player.y > canvas.height / 2) player.y -= player.speed;
    if (keys.down && player.y < canvas.height - player.height) player.y += player.speed;

    if (keys.space && player.bullets.length < 10) {
        player.bullets.push({ x: player.x + player.width / 2 - 2, y: player.y, speed: 7 });
        playShootSound();
    }

    player.bullets = player.bullets.filter(bullet => bullet.y > 0);
    player.bullets.forEach(bullet => bullet.y -= bullet.speed);

    if (Math.random() < 0.01) { // Уменьшено в два раза вероятность появления кубов / Reduced enemy spawn chance by half
        enemies.push(createEnemy());
    }

    if (Math.random() < 0.03) {
        asteroids.push({
            x: Math.random() * canvas.width,
            y: 0,
            radius: 6 + Math.random() * 10, // Уменьшен радиус астероида для баланса / Reduced asteroid radius for balance
            speed: (1 + Math.random() * 2) * speedMultiplier
        });
    }

    enemies = enemies.filter(enemy => enemy.y < canvas.height);
    enemies.forEach(enemy => {
        enemy.y += enemy.speed;
        if (Math.random() < 0.01) {
            createEnemyParticle(enemy);
        }
    });

    asteroids = asteroids.filter(asteroid => asteroid.y < canvas.height);
    asteroids.forEach(asteroid => asteroid.y += asteroid.speed);

    particles = particles.filter(p => p.alpha > 0);
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
    });

    player.bullets.forEach(bullet => {
        enemies.forEach((enemy, eIndex) => {
            if (bullet.x > enemy.x && bullet.x < enemy.x + enemy.width &&
                bullet.y > enemy.y && bullet.y < enemy.y + enemy.height) {
                enemies.splice(eIndex, 1);
                player.bullets.splice(player.bullets.indexOf(bullet), 1);
                score += 10; // 10 очков за cube.png / 10 points for cube.png
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            }
        });
        asteroids.forEach((asteroid, aIndex) => {
            const dx = bullet.x - asteroid.x;
            const dy = bullet.y - asteroid.y;
            if (Math.sqrt(dx * dx + dy * dy) < asteroid.radius) {
                asteroids.splice(aIndex, 1);
                player.bullets.splice(player.bullets.indexOf(bullet), 1);
                score += 5; // 5 очков за asteroid.png / 5 points for asteroid.png
                createExplosion(asteroid.x, asteroid.y);
            }
        });
    });

    if (!invulnerable) {
        enemies.forEach(enemy => {
            if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x &&
                player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) {
                loseLife();
            }
        });
        asteroids.forEach(asteroid => {
            const dx = player.x + player.width / 2 - asteroid.x;
            const dy = player.y + player.height / 2 - asteroid.y;
            if (Math.sqrt(dx * dx + dy * dy) < asteroid.radius + player.width / 2) {
                loseLife();
            }
        });
    }

    // Интерполяция прозрачности сердечек / Interpolate heart alphas
    for (let i = 0; i < 3; i++) {
        heartAlphas[i] += (heartTargets[i] - heartAlphas[i]) * 0.1;
    }

    frameCount++;
}

function createExplosion(x, y) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x,
            y,
            radius: Math.random() * 3 + 1,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            alpha: 1
        });
    }
    createExplosionSound();
}

function loseLife() {
    lives = Math.max(0, lives - 1);
    if (lives < 3) {
        heartTargets[3 - lives - 1] = 0.3;
    }
    console.log('Life lost, lives:', lives, 'heartTargets:', heartTargets);
    if (lives <= 0) {
        gameActive = false;
        canStartOrRestart = false;
        gameOverDelay = 30;
        console.log('Game over, delay started');
    } else {
        player.x = canvas.width / 2 - 25;
        player.y = canvas.height - 50;
        invulnerable = true;
        invulnerableTimer = 2;
    }
}

function updateBackground() {
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) star.y = 0;
    });
    stars2.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) star.y = 0;
    });
    stars3.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) star.y = 0;
    });
}

function draw() {
    console.log('Drawing frame:', frameCount); // Отладка / Debug
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    if (!gameStarted) {
        drawStartScreen();
        return;
    }
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawAsteroids();
    drawParticles();
    drawUI();
    if (!gameActive) drawGameOver();
}

function gameLoop() {
    console.log('Game loop running, frame:', frameCount); // Отладка / Debug
    updateBackground();
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameStarted = true;
    gameActive = true;
    score = 0;
    lives = 3;
    gameTime = 0;
    heartAlphas = [1, 1, 1];
    heartTargets = [1, 1, 1];
    player.x = canvas.width / 2 - 25;
    player.y = canvas.height - 50;
    player.bullets = [];
    enemies = [];
    asteroids = [];
    particles = [];
    invulnerable = false;
    invulnerableTimer = 0;
    speedMultiplier = 1; // Сброс множителя скорости / Reset speed multiplier
    lastScreenshot = null; // Сброс скриншота / Reset screenshot
    console.log('Game started');
}

function restartGame() {
    gameActive = true;
    score = 0;
    lives = 3;
    gameTime = 0;
    heartAlphas = [1, 1, 1];
    heartTargets = [1, 1, 1];
    player.x = canvas.width / 2 - 25;
    player.y = canvas.height - 50;
    player.bullets = [];
    enemies = [];
    asteroids = [];
    particles = [];
    invulnerable = false;
    invulnerableTimer = 0;
    canStartOrRestart = false;
    gameOverDelay = 0;
    speedMultiplier = 1; // Сброс множителя скорости / Reset speed multiplier
    lastScreenshot = null; // Сброс скриншота / Reset screenshot
    console.log('Game restarted');
}

// Запуск игры с обработкой загрузки изображений / Start game with image loading handling
let imagesLoaded = 0;
const totalImages = 3;
function checkImagesLoaded() {
    imagesLoaded++;
    console.log(`Image loaded, count: ${imagesLoaded}/${totalImages}`);
    if (imagesLoaded >= totalImages) {
        console.log('All images processed, starting game loop');
        canStartOrRestart = true;
        gameLoop();
    }
}
playerImage.onload = checkImagesLoaded;
playerImage.onerror = () => {
    console.warn('Failed to load spaceship.png, using fallback');
    checkImagesLoaded();
};
enemyImage.onload = checkImagesLoaded;
enemyImage.onerror = () => {
    console.warn('Failed to load cube.png, using fallback');
    checkImagesLoaded();
};
asteroidImage.onload = checkImagesLoaded;
asteroidImage.onerror = () => {
    console.warn('Failed to load asteroid.png, using fallback');
    checkImagesLoaded();
};

// Запасной запуск / Fallback if images don't load in 5 seconds
setTimeout(() => {
    if (imagesLoaded < totalImages) {
        console.warn(`Only ${imagesLoaded}/${totalImages} images loaded, starting game with fallbacks`);
        canStartOrRestart = true;
        gameLoop();
    }
}, 5000);
