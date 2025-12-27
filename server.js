const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// ==================== БАЛАНС ====================
const BALANCE = {
    startGold: 50,
    baseIncome: 8,
    incomePerLevel: 4,
    baseHp: 1500,
    baseHpPerUpgrade: 300,

    turret: {
        baseCooldown: 1800,
        cooldownReduction: 150,
        minCooldown: 800,
        baseDamage: 15,
        damagePerLevel: 10,
        damagePerEra: 6,
        range: 350,
        maxLevel: 5
    },

    upgrades: {
        turret: { baseCost: 100, costMultiplier: 2.2 },
        income: { baseCost: 120, costMultiplier: 2.5 },
        baseHp: { baseCost: 150, costMultiplier: 2.3 }
    },
    maxUpgradeLevel: 5,

    unitUpgrades: {
        attack: { baseCost: 80, costMultiplier: 2.0, bonusPerLevel: 0.15 },
        health: { baseCost: 80, costMultiplier: 2.0, bonusPerLevel: 0.15 },
        regen: { baseCost: 100, costMultiplier: 2.2, regenPerLevel: 2 }
    },
    maxUnitUpgradeLevel: 5,

    special: {
        cost: 250,
        cooldown: 45000,
        unitDamage: 100,
        baseDamage: 50
    },

    xp: {
        perDamageToUnit: 0.15,
        perDamageToBase: 0.25,
        perKill: 5
    }
};

// ==================== ЭРЫ ====================
const ERAS = [
    {
        name: 'Каменный век',
        units: [
            { name: 'Дубинщик', cost: 20, hp: 60, damage: 10, speed: 1.8, range: 30, attackSpeed: 800, color: '#8B4513', size: 20 },
            { name: 'Копейщик', cost: 40, hp: 90, damage: 15, speed: 1.3, range: 45, attackSpeed: 1000, color: '#A0522D', size: 22 },
            { name: 'Камнемёт', cost: 55, hp: 45, damage: 22, speed: 1.0, range: 120, attackSpeed: 1400, color: '#6B4423', size: 18 }
        ],
        xpRequired: 0
    },
    {
        name: 'Средневековье',
        units: [
            { name: 'Мечник', cost: 30, hp: 100, damage: 18, speed: 1.6, range: 35, attackSpeed: 850, color: '#4169E1', size: 22 },
            { name: 'Рыцарь', cost: 75, hp: 200, damage: 28, speed: 1.1, range: 40, attackSpeed: 1200, color: '#C0C0C0', size: 28 },
            { name: 'Лучник', cost: 50, hp: 55, damage: 24, speed: 1.3, range: 160, attackSpeed: 1300, color: '#228B22', size: 20 }
        ],
        xpRequired: 120
    },
    {
        name: 'Эпоха пороха',
        units: [
            { name: 'Мушкетёр', cost: 45, hp: 80, damage: 32, speed: 1.4, range: 180, attackSpeed: 1500, color: '#8B0000', size: 22 },
            { name: 'Кавалерия', cost: 90, hp: 160, damage: 38, speed: 2.0, range: 40, attackSpeed: 1000, color: '#DAA520', size: 30 },
            { name: 'Канонир', cost: 120, hp: 100, damage: 55, speed: 0.7, range: 200, attackSpeed: 2200, color: '#2F4F4F', size: 25 }
        ],
        xpRequired: 350
    },
    {
        name: 'Современность',
        units: [
            { name: 'Солдат', cost: 55, hp: 100, damage: 42, speed: 1.7, range: 200, attackSpeed: 1100, color: '#556B2F', size: 22 },
            { name: 'Танк', cost: 180, hp: 400, damage: 65, speed: 0.8, range: 150, attackSpeed: 1800, color: '#3D5C3D', size: 40 },
            { name: 'Снайпер', cost: 100, hp: 60, damage: 90, speed: 1.0, range: 280, attackSpeed: 2000, color: '#708090', size: 20 }
        ],
        xpRequired: 700
    },
    {
        name: 'Будущее',
        units: [
            { name: 'Киборг', cost: 80, hp: 150, damage: 55, speed: 1.9, range: 200, attackSpeed: 900, color: '#00CED1', size: 24 },
            { name: 'Мех', cost: 250, hp: 550, damage: 85, speed: 0.9, range: 180, attackSpeed: 1600, color: '#9400D3', size: 45 },
            { name: 'Дрон', cost: 130, hp: 75, damage: 110, speed: 2.2, range: 250, attackSpeed: 1700, color: '#FF4500', size: 18 }
        ],
        xpRequired: 1200
    }
];

// ==================== КОМНАТЫ ====================
const rooms = new Map();
let nextUnitId = 0;

function createRoom(roomId) {
    return {
        id: roomId,
        players: [],
        game: null,
        gameLoop: null,
        lastUpdate: Date.now()
    };
}

function createGameState() {
    return {
        players: {
            1: createPlayerState(1),
            2: createPlayerState(2)
        },
        units: [],
        projectiles: [],
        gameTime: 0,
        winner: null,
        paused: false
    };
}

function createPlayerState(playerNum) {
    const isP1 = playerNum === 1;
    return {
        num: playerNum,
        gold: BALANCE.startGold,
        xp: 0,
        era: 0,
        income: BALANCE.baseIncome,
        base: {
            hp: BALANCE.baseHp,
            maxHp: BALANCE.baseHp,
            x: isP1 ? 50 : 950,
            turretCooldown: 0
        },
        turretLevel: 1,
        incomeLevel: 1,
        baseHpLevel: 1,
        unitAttackLevel: 1,
        unitHealthLevel: 1,
        unitRegenLevel: 0,
        specialCooldown: 0,
        kills: 0
    };
}

// ==================== ИГРОВАЯ ЛОГИКА ====================
function spawnUnit(game, playerNum, unitIndex) {
    const player = game.players[playerNum];
    const era = ERAS[player.era];
    const unitDef = era.units[unitIndex];

    if (!unitDef || player.gold < unitDef.cost) return false;

    player.gold -= unitDef.cost;

    // Применяем апгрейды
    const attackMult = 1 + (player.unitAttackLevel - 1) * BALANCE.unitUpgrades.attack.bonusPerLevel;
    const healthMult = 1 + (player.unitHealthLevel - 1) * BALANCE.unitUpgrades.health.bonusPerLevel;

    const isP1 = playerNum === 1;
    const unit = {
        id: nextUnitId++,
        owner: playerNum,
        x: isP1 ? 80 : 920,
        y: 320,
        hp: Math.floor(unitDef.hp * healthMult),
        maxHp: Math.floor(unitDef.hp * healthMult),
        damage: Math.floor(unitDef.damage * attackMult),
        speed: unitDef.speed,
        range: unitDef.range,
        attackSpeed: unitDef.attackSpeed,
        attackCooldown: 0,
        color: isP1 ? unitDef.color : shiftColor(unitDef.color),
        size: unitDef.size,
        direction: isP1 ? 1 : -1,
        regen: player.unitRegenLevel * BALANCE.unitUpgrades.regen.regenPerLevel,
        name: unitDef.name
    };

    game.units.push(unit);
    return true;
}

function shiftColor(hex) {
    // Сдвигаем цвет в красную сторону для игрока 2
    let r = parseInt(hex.slice(1,3), 16);
    let g = parseInt(hex.slice(3,5), 16);
    let b = parseInt(hex.slice(5,7), 16);
    r = Math.min(255, r + 60);
    g = Math.max(0, g - 30);
    return `rgb(${r},${g},${b})`;
}

function getUpgradeCost(type, level) {
    const cfg = BALANCE.upgrades[type];
    return Math.floor(cfg.baseCost * Math.pow(cfg.costMultiplier, level - 1));
}

function getUnitUpgradeCost(type, level) {
    const cfg = BALANCE.unitUpgrades[type];
    return Math.floor(cfg.baseCost * Math.pow(cfg.costMultiplier, level - 1));
}

function doUpgrade(game, playerNum, upgradeType) {
    const player = game.players[playerNum];

    if (upgradeType === 'turret' && player.turretLevel < BALANCE.maxUpgradeLevel) {
        const cost = getUpgradeCost('turret', player.turretLevel);
        if (player.gold >= cost) {
            player.gold -= cost;
            player.turretLevel++;
            return true;
        }
    }
    else if (upgradeType === 'income' && player.incomeLevel < BALANCE.maxUpgradeLevel) {
        const cost = getUpgradeCost('income', player.incomeLevel);
        if (player.gold >= cost) {
            player.gold -= cost;
            player.incomeLevel++;
            player.income = BALANCE.baseIncome + (player.incomeLevel - 1) * BALANCE.incomePerLevel;
            return true;
        }
    }
    else if (upgradeType === 'baseHp' && player.baseHpLevel < BALANCE.maxUpgradeLevel) {
        const cost = getUpgradeCost('baseHp', player.baseHpLevel);
        if (player.gold >= cost) {
            player.gold -= cost;
            player.baseHpLevel++;
            const addHp = BALANCE.baseHpPerUpgrade;
            player.base.maxHp += addHp;
            player.base.hp += addHp;
            return true;
        }
    }
    else if (upgradeType === 'attack' && player.unitAttackLevel < BALANCE.maxUnitUpgradeLevel) {
        const cost = getUnitUpgradeCost('attack', player.unitAttackLevel);
        if (player.gold >= cost) {
            player.gold -= cost;
            player.unitAttackLevel++;
            return true;
        }
    }
    else if (upgradeType === 'health' && player.unitHealthLevel < BALANCE.maxUnitUpgradeLevel) {
        const cost = getUnitUpgradeCost('health', player.unitHealthLevel);
        if (player.gold >= cost) {
            player.gold -= cost;
            player.unitHealthLevel++;
            return true;
        }
    }
    else if (upgradeType === 'regen' && player.unitRegenLevel < BALANCE.maxUnitUpgradeLevel) {
        const cost = getUnitUpgradeCost('regen', player.unitRegenLevel);
        if (player.gold >= cost) {
            player.gold -= cost;
            player.unitRegenLevel++;
            return true;
        }
    }

    return false;
}

function doEvolve(game, playerNum) {
    const player = game.players[playerNum];
    if (player.era >= ERAS.length - 1) return false;

    const nextEra = ERAS[player.era + 1];
    if (player.xp >= nextEra.xpRequired) {
        player.era++;
        return true;
    }
    return false;
}

function doSpecial(game, playerNum) {
    const player = game.players[playerNum];
    if (player.gold < BALANCE.special.cost || player.specialCooldown > 0) return false;

    player.gold -= BALANCE.special.cost;
    player.specialCooldown = BALANCE.special.cooldown;

    // Наносим урон всем вражеским юнитам
    const enemyNum = playerNum === 1 ? 2 : 1;
    game.units.forEach(unit => {
        if (unit.owner === enemyNum) {
            unit.hp -= BALANCE.special.unitDamage;
        }
    });

    // Урон вражеской базе
    game.players[enemyNum].base.hp -= BALANCE.special.baseDamage;

    return true;
}

function updateGame(room, deltaTime) {
    const game = room.game;
    if (!game || game.winner || game.paused) return;

    game.gameTime += deltaTime;

    // Обновляем обоих игроков
    for (const playerNum of [1, 2]) {
        const player = game.players[playerNum];

        // Доход
        player.gold += player.income * (deltaTime / 1000);

        // Кулдаун спецспособности
        if (player.specialCooldown > 0) {
            player.specialCooldown = Math.max(0, player.specialCooldown - deltaTime);
        }

        // Кулдаун турели
        if (player.base.turretCooldown > 0) {
            player.base.turretCooldown -= deltaTime;
        }

        // Стрельба турели
        if (player.base.turretCooldown <= 0) {
            const enemyNum = playerNum === 1 ? 2 : 1;
            const target = findTurretTarget(game, player, enemyNum);
            if (target) {
                const dmg = BALANCE.turret.baseDamage +
                    (player.turretLevel - 1) * BALANCE.turret.damagePerLevel +
                    player.era * BALANCE.turret.damagePerEra;
                target.hp -= dmg;

                // XP за урон
                player.xp += dmg * BALANCE.xp.perDamageToUnit;

                game.projectiles.push({
                    x: player.base.x,
                    y: 280,
                    targetX: target.x,
                    targetY: target.y,
                    owner: playerNum,
                    life: 200
                });

                const cd = Math.max(BALANCE.turret.minCooldown,
                    BALANCE.turret.baseCooldown - (player.turretLevel - 1) * BALANCE.turret.cooldownReduction);
                player.base.turretCooldown = cd;
            }
        }
    }

    // Обновляем юнитов
    const toRemove = [];
    for (const unit of game.units) {
        // Регенерация
        if (unit.regen > 0 && unit.hp < unit.maxHp) {
            unit.hp = Math.min(unit.maxHp, unit.hp + unit.regen * (deltaTime / 1000));
        }

        // Кулдаун атаки
        if (unit.attackCooldown > 0) {
            unit.attackCooldown -= deltaTime;
        }

        // Поиск цели
        const enemyNum = unit.owner === 1 ? 2 : 1;
        const enemyBase = game.players[enemyNum].base;
        const target = findTarget(game, unit, enemyNum, enemyBase);

        if (target) {
            // Атакуем
            if (unit.attackCooldown <= 0) {
                let dmg = unit.damage;
                if (target.isBase) {
                    target.hp -= dmg;
                    game.players[unit.owner].xp += dmg * BALANCE.xp.perDamageToBase;
                } else {
                    target.hp -= dmg;
                    game.players[unit.owner].xp += dmg * BALANCE.xp.perDamageToUnit;

                    if (target.hp <= 0) {
                        game.players[unit.owner].kills++;
                        game.players[unit.owner].xp += BALANCE.xp.perKill;
                    }
                }
                unit.attackCooldown = unit.attackSpeed;
            }
        } else {
            // Движемся
            unit.x += unit.speed * unit.direction * (deltaTime / 16);
        }

        // Удаляем мёртвых
        if (unit.hp <= 0) {
            toRemove.push(unit);
        }
    }

    game.units = game.units.filter(u => !toRemove.includes(u));

    // Обновляем снаряды
    game.projectiles = game.projectiles.filter(p => {
        p.life -= deltaTime;
        return p.life > 0;
    });

    // Проверяем победу
    if (game.players[1].base.hp <= 0) {
        game.winner = 2;
    } else if (game.players[2].base.hp <= 0) {
        game.winner = 1;
    }
}

function findTurretTarget(game, player, enemyNum) {
    let closest = null;
    let closestDist = BALANCE.turret.range;

    for (const unit of game.units) {
        if (unit.owner !== enemyNum) continue;
        const dist = Math.abs(unit.x - player.base.x);
        if (dist < closestDist) {
            closestDist = dist;
            closest = unit;
        }
    }
    return closest;
}

function findTarget(game, unit, enemyNum, enemyBase) {
    // Ищем вражеских юнитов
    for (const enemy of game.units) {
        if (enemy.owner !== enemyNum) continue;
        const dist = Math.abs(enemy.x - unit.x);
        if (dist <= unit.range) {
            return enemy;
        }
    }

    // Если дошли до базы
    const distToBase = Math.abs(unit.x - enemyBase.x);
    if (distToBase <= unit.range) {
        return { ...enemyBase, isBase: true };
    }

    return null;
}

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('joinGame', () => {
        // Ищем комнату с 1 игроком или создаём новую
        let room = null;
        for (const [id, r] of rooms) {
            if (r.players.length === 1 && !r.game) {
                room = r;
                break;
            }
        }

        if (!room) {
            const roomId = 'room_' + Date.now();
            room = createRoom(roomId);
            rooms.set(roomId, room);
        }

        const playerNum = room.players.length + 1;
        room.players.push({ socket, num: playerNum });
        socket.roomId = room.id;
        socket.playerNum = playerNum;
        socket.join(room.id);

        socket.emit('joined', { playerNum, waiting: room.players.length < 2 });
        console.log(`Player ${playerNum} joined room ${room.id}`);

        // Если 2 игрока - начинаем!
        if (room.players.length === 2) {
            room.game = createGameState();
            io.to(room.id).emit('gameStart', { game: room.game });

            // Запускаем игровой цикл
            room.lastUpdate = Date.now();
            room.gameLoop = setInterval(() => {
                const now = Date.now();
                const delta = now - room.lastUpdate;
                room.lastUpdate = now;

                updateGame(room, delta);
                io.to(room.id).emit('gameState', room.game);

                if (room.game.winner) {
                    io.to(room.id).emit('gameOver', { winner: room.game.winner });
                    clearInterval(room.gameLoop);
                }
            }, 1000 / 30); // 30 FPS
        }
    });

    socket.on('action', (data) => {
        const room = rooms.get(socket.roomId);
        if (!room || !room.game) return;

        const { type, payload } = data;

        switch (type) {
            case 'spawnUnit':
                spawnUnit(room.game, socket.playerNum, payload.unitIndex);
                break;
            case 'upgrade':
                doUpgrade(room.game, socket.playerNum, payload.upgradeType);
                break;
            case 'evolve':
                doEvolve(room.game, socket.playerNum);
                break;
            case 'special':
                doSpecial(room.game, socket.playerNum);
                break;
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const room = rooms.get(socket.roomId);
        if (room) {
            if (room.gameLoop) clearInterval(room.gameLoop);

            // Уведомляем другого игрока
            socket.to(room.id).emit('opponentLeft');
            rooms.delete(room.id);
        }
    });
});

const PORT = process.env.PORT || 3456;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Age of Wars server running on port ${PORT}`);
});
