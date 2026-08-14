const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const TILE = 48;
const WORLD_W = 100000;
const WORLD_H = 100000;

// مقادیر تراکم با تغییرات جدید
const CONFIG = {
  SPAWN_RADIUS: 800,       // شعاع اسپاون پویا دور بازیکن
  DESPAWN_RADIUS: 1200,    // شعاع پاکسازی دور بازیکن
  MAX_RABBITS: 8,          // بدون تغییر
  MAX_WOLVES: 6,           // کمتر از قبل
  MAX_COWS_SHEEP: 12,      // بدون تغییر
  TREE_TARGET: 60,         // کمتر از قبل
  BUSH_TARGET: 180,        // کمی بیشتر از قبل
  CHEST_SPAWN_TIME: 7,     // تغییر به ۷ ثانیه حرکت برای اسپاون صندوقچه
  WOLF_ATTACK_COOLDOWN: 1.0 // آسیب گرگ در هر ۱ ثانیه
};

const assets = {};
const assetFiles = {
  knight: "assets/knight.png",
  tree: "assets/tree.png",
  bush: "assets/bush.png",
  cow: "assets/cow.png",
  sheep: "assets/sheep.png",
  rabbit_white: "assets/rabbit_white.png",
  rabbit_brown: "assets/rabbit_brown.png",
  rabbit_black: "assets/rabbit_black.png",
  wolf_white: "assets/wolf_white.png",
  wolf_gray: "assets/wolf_gray.png",
  meat: "assets/meat.png",
  iron_sword: "assets/iron_sword.png",
  golden_sword: "assets/golden_sword.png",
  chest: "assets/chest.png",
  gold_ore: "assets/gold_ore.png",
  purple_gem: "assets/purple_gem.png",
  heart: "assets/heart.png",
  heart_empty: "assets/heart_empty.png",
  potion: "assets/potion.png",
  potion_empty: "assets/potion_empty.png",
  star: "assets/star.png",
};

function loadAssets(cb) {
  let loaded = 0;
  const keys = Object.keys(assetFiles);
  keys.forEach(key => {
    const img = new Image();
    img.src = assetFiles[key];
    img.onload = () => {
      loaded++;
      if (loaded === keys.length) cb();
    };
    img.onerror = () => {
      loaded++;
      if (loaded === keys.length) cb();
    };
    assets[key] = img;
  });
}

const topLeft = document.getElementById("topLeft");
const topRight = document.getElementById("topRight");
const starCountEl = document.getElementById("starCount");
const levelBox = document.getElementById("levelBox");
const slots = [...document.querySelectorAll(".slot")];
const messageBox = document.getElementById("messageBox");
const modal = document.getElementById("modal");
const chestModal = document.getElementById("chestModal");
const modalLeft = document.getElementById("modalLeft");
const chestItemsEl = document.getElementById("chestItems");

const game = {
  keys: {},
  entities: [],
  itemsOnGround: [],
  trees: [],
  bushes: [],
  chests: [],
  timePlayed: 0,
  lastStarTick: 0,
  selectedSlot: 0,
  messageTimer: null,
  lastEnterTime: 0,
  chestLoot: [],
  currentChest: null,
  
  // تایمرها و متغیرهای جدید درخواستی
  runTimeAccumulator: 0,    // محاسبه ثانیه‌های دویدن بازیکن
  movementTimeAccumulator: 0 // محاسبه زمان حرکت بازیکن جهت اسپاون صندوقچه
};

const player = {
  x: 50000, // موقعیت شروع در مرکز نقشه صدهزار تایی
  y: 50000,
  size: 38,
  speed: 6,
  hearts: 10,
  maxHearts: 10,
  potions: 10,
  maxPotions: 10,
  level: 1,
  inventory: {
    iron_sword: 1,
    meat: 0,
    golden_sword: 0,
    gold_ore: 0,
    purple_gem: 0
  },
  hotbar: ["iron_sword", null, null, null],
};

function showMessage(text, duration = 20000) {
  messageBox.textContent = text;
  messageBox.classList.add("show");
  if (game.messageTimer) clearTimeout(game.messageTimer);
  game.messageTimer = setTimeout(() => {
    messageBox.classList.remove("show");
  }, duration);
}

function hideMessage() {
  messageBox.classList.remove("show");
  if (game.messageTimer) clearTimeout(game.messageTimer);
}

function checkDoubleEnter() {
  const now = Date.now();
  if (now - game.lastEnterTime < 500) hideMessage();
  game.lastEnterTime = now;
}

function updateHUD() {
  topLeft.innerHTML = "";
  topRight.innerHTML = "";

  for (let i = 0; i < player.maxHearts; i++) {
    const img = document.createElement("img");
    img.className = "hud-icon";
    img.src = i < player.hearts ? "assets/heart.png" : "assets/heart_empty.png";
    topLeft.appendChild(img);
  }

  for (let i = 0; i < player.maxPotions; i++) {
    const img = document.createElement("img");
    img.className = "hud-icon";
    img.src = i < player.potions ? "assets/potion.png" : "assets/potion_empty.png";
    topRight.appendChild(img);
  }

  starCountEl.textContent = Math.floor(game.timePlayed / 30);
  levelBox.textContent = `Lv.${player.level}`;

  renderHotbar();
}

function renderHotbar() {
  slots.forEach((slot, i) => {
    slot.innerHTML = "";
    if (i === game.selectedSlot) slot.classList.add("selected");
    else slot.classList.remove("selected");

    const key = player.hotbar[i];
    if (key && player.inventory[key] > 0) {
      const img = document.createElement("img");
      img.src = assetFiles[key];
      slot.appendChild(img);

      const count = document.createElement("div");
      count.className = "count";
      count.textContent = player.inventory[key];
      slot.appendChild(count);
    }
  });
}

function renderInventoryModal() {
  modalLeft.innerHTML = "";
  Object.entries(player.inventory).forEach(([key, count]) => {
    if (count > 0) {
      const div = document.createElement("div");
      div.className = "inventoryItem";
      div.innerHTML = `<img src="${assetFiles[key]}" alt=""><span>${count}</span>`;
      modalLeft.appendChild(div);
    }
  });
}

function addItem(name, count = 1) {
  if (!player.inventory[name]) player.inventory[name] = 0;
  player.inventory[name] += count;

  if (!player.hotbar.includes(name)) {
    const emptyIndex = player.hotbar.indexOf(null);
    if (emptyIndex !== -1) player.hotbar[emptyIndex] = name;
  }

  checkLevelProgress();
  updateHUD();
}

// تغییر مکانیزم مصرف گوشت بر اساس فرمول درخواستی جدید
function consumeSelectedItem() {
  const item = player.hotbar[game.selectedSlot];
  if (!item || player.inventory[item] <= 0) return;

  if (item === "meat") {
    // فقط در صورتی گوشت مصرف می‌شود که حداقل یکی از مقادیر قلب یا معجون از حد پیش‌فرض کمتر باشد
    if (player.hearts >= player.maxHearts && player.potions >= player.maxPotions) return;

    // ترمیم همزمان نصف قلب و یک عدد معجون
    player.hearts = Math.min(player.maxHearts, player.hearts + 0.5);
    player.potions = Math.min(player.maxPotions, player.potions + 1);

    player.inventory.meat--;
    if (player.inventory.meat <= 0) {
      const idx = player.hotbar.indexOf("meat");
      if (idx !== -1) player.hotbar[idx] = null;
    }
  }

  updateHUD();
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// تابع تغییر یافته برای تولید جهان اولیه به صورت متعادل در موقعیت بازیکن
function spawnWorld() {
  game.entities = [];
  game.itemsOnGround = [];
  game.trees = [];
  game.bushes = [];
  game.chests = [];
  
  // اسپاون بار اول پیرامون مختصات شروع
  manageDynamicSpawns();
}

// تولید تصادفی موقعیت در اطراف بازیکن
function getRandomSpawnPos(minRadius, maxRadius) {
  const angle = Math.random() * Math.PI * 2;
  const radius = rand(minRadius, maxRadius);
  return {
    x: player.x + Math.cos(angle) * radius,
    y: player.y + Math.sin(angle) * radius
  };
}

// مدیریت و بارگذاری پویای اجزای بازی در اطراف بازیکن هنگام جابجایی
function manageDynamicSpawns() {
  // عدم حذف موارد اسپاون شده جهت ثابت ماندن و پاک نشدن آن‌ها در جهان بازی

  // اسپاون سریع و پویای درختان بر اساس تعداد درختان موجود در شعاع دید بازیکن
  const localTrees = game.trees.filter(t => dist(player, t) < CONFIG.SPAWN_RADIUS);
  let treeCount = localTrees.length;
  while (treeCount < CONFIG.TREE_TARGET) {
    const pos = getRandomSpawnPos(150, CONFIG.SPAWN_RADIUS);
    game.trees.push({
      x: pos.x,
      y: pos.y,
      trunkRadius: 18,
      crownRadius: 48
    });
    treeCount++;
  }

  // اسپاون سریع و پویای بوته‌ها بر اساس تعداد بوته‌های موجود در شعاع دید بازیکن
  const localBushes = game.bushes.filter(b => dist(player, b) < CONFIG.SPAWN_RADIUS);
  let bushCount = localBushes.length;
  while (bushCount < CONFIG.BUSH_TARGET) {
    const pos = getRandomSpawnPos(100, CONFIG.SPAWN_RADIUS);
    game.bushes.push({
      x: pos.x,
      y: pos.y,
      size: 24
    });
    bushCount++;
  }

  // شمارش و اسپاون حیوانات در اطراف بازیکن بدون حذف حیوانات قبلی در فواصل دور
  let rabbits = 0;
  let wolves = 0;
  let cowsSheep = 0;

  game.entities.forEach(e => {
    if (dist(player, e) < CONFIG.SPAWN_RADIUS) {
      if (e.type === "rabbit") rabbits++;
      else if (e.type === "wolf") wolves++;
      else if (e.type === "cow" || e.type === "sheep") cowsSheep++;
    }
  });

  // اسپاون پویای خرگوش‌ها
  while (rabbits < CONFIG.MAX_RABBITS) {
    const pos = getRandomSpawnPos(100, CONFIG.SPAWN_RADIUS);
    const colors = ["rabbit_white", "rabbit_brown", "rabbit_black"];
    game.entities.push(makeAnimalAt("rabbit", colors[Math.floor(Math.random() * colors.length)], 7, 15, pos.x, pos.y));
    rabbits++;
  }

  // اسپاون پویای گرگ‌ها
  while (wolves < CONFIG.MAX_WOLVES) {
    const pos = getRandomSpawnPos(200, CONFIG.SPAWN_RADIUS);
    const colors = ["wolf_white", "wolf_gray"];
    game.entities.push(makeAnimalAt("wolf", colors[Math.floor(Math.random() * colors.length)], 4, 5, pos.x, pos.y));
    wolves++;
  }

  // اسپاون پویای گاو و گوسفندها
  while (cowsSheep < CONFIG.MAX_COWS_SHEEP) {
    const pos = getRandomSpawnPos(100, CONFIG.SPAWN_RADIUS);
    if (Math.random() > 0.5) {
      game.entities.push(makeAnimalAt("cow", "cow", 3, 4, pos.x, pos.y));
    } else {
      game.entities.push(makeAnimalAt("sheep", "sheep", 3, 4, pos.x, pos.y));
    }
    cowsSheep++;
  }
}

function makeAnimalAt(type, sprite, hp, speed, x, y) {
  return {
    type,
    sprite,
    x,
    y,
    size: 34,
    hp,
    speed,
    dirX: rand(-1, 1),
    dirY: rand(-1, 1),
    moveTimer: rand(1, 4),
    attackCooldown: 0,
    hitFlash: 0
  };
}

function spawnGroundItem(x, y, type, count = 1) {
  game.itemsOnGround.push({ x, y, type, count, size: 22 });
}

// اسپاون صندوقچه جدید در محدوده متناسب (نه خیلی دور و نه خیلی نزدیک)
function spawnChestNearPlayer() {
  const pos = getRandomSpawnPos(200, 380);
  game.chests.push({
    x: pos.x,
    y: pos.y,
    size: 34,
    opened: false,
    loot: null
  });
}

function openChest(chest) {
  if (!chest.loot) {
    // حذف شمشیر طلا از صندوقچه
    const possible = [
      { type: "meat", min: 1, max: 5, chance: 0.8 },
      { type: "gold_ore", min: 1, max: 2, chance: 0.5 },
      { type: "purple_gem", min: 1, max: 3, chance: 0.55 },
    ];

    chest.loot = [];
    possible.forEach(p => {
      if (Math.random() < p.chance) {
        chest.loot.push({
          type: p.type,
          count: Math.floor(rand(p.min, p.max + 1))
        });
      }
    });

    if (chest.loot.length === 0) {
      chest.loot.push({ type: "meat", count: 1 });
    }
  }

  game.currentChest = chest;
  game.chestLoot = chest.loot;
  renderChestUI();
  chestModal.classList.remove("hidden");
}

// تولید پویای آیتم‌ها در پنل صندقچه با قابلیت کلیک چپ مجزا روی تک‌تک آن‌ها
function renderChestUI() {
  chestItemsEl.innerHTML = "";
  if (!game.currentChest || !game.currentChest.loot) return;

  game.currentChest.loot.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "inventoryItem";
    div.style.cursor = "pointer";
    div.innerHTML = `<img src="${assetFiles[item.type]}" alt=""><span>${item.count}</span>`;
    
    // کلیک چپ روی هر آیتم صندوقچه: آن را به اینونتوری اضافه کرده و از صندوق خارج می‌کند
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      addItem(item.type, item.count);
      game.currentChest.loot.splice(index, 1);
      game.chestLoot = game.currentChest.loot;

      if (game.currentChest.loot.length === 0) {
        game.chests = game.chests.filter(c => c !== game.currentChest);
        chestModal.classList.add("hidden");
        game.currentChest = null;
        game.chestLoot = [];
        chestItemsEl.innerHTML = "";
        return;
      }

      renderChestUI();
    });
    
    chestItemsEl.appendChild(div);
  });
}

function takeChestLoot() {
  if (!game.currentChest || !game.currentChest.loot) return;

  game.currentChest.loot.forEach(item => addItem(item.type, item.count));
  game.currentChest.loot = [];
  game.chests = game.chests.filter(c => c !== game.currentChest);
  game.chestLoot = [];
  chestItemsEl.innerHTML = "";
  chestModal.classList.add("hidden");
  game.currentChest = null;
}

function attack() {
  const weapon = player.hotbar[game.selectedSlot];
  if (weapon !== "iron_sword" && weapon !== "golden_sword") return;

  const damage = weapon === "golden_sword" ? 2 : 1;

  game.entities.forEach(e => {
    const d = dist(player, e);
    if (d < 58) {
      e.hp -= damage;
      e.hitFlash = 0.15;

      if (e.type === "cow" || e.type === "sheep") {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const len = Math.hypot(dx, dy) || 1;
        e.x += (dx / len) * 26;
        e.y += (dy / len) * 26;
      }

      if (e.hp <= 0) {
        if (e.type === "sheep") spawnGroundItem(e.x, e.y, "meat", 1);
        if (e.type === "cow") spawnGroundItem(e.x, e.y, "meat", 2);
        e.dead = true;
      }
    }
  });

  game.entities = game.entities.filter(e => !e.dead);
}

function checkLevelProgress() {
  const stars = Math.floor(game.timePlayed / 30);

  if (player.level === 1 && stars >= 30) {
    addItem("golden_sword", 1);
    player.level = 2;
    showMessage("برای این که به سطح 3 برسی باید 3 تا جواهر بنفش به علاوه 10 تا گوشت و 1 عدد طلا جمع کنی که تمامیی این آیتم ها بصورت تصادفی درون سندوقچه ها میباشد");
  }

  if (
    player.level === 2 &&
    (player.inventory.purple_gem || 0) >= 3 &&
    (player.inventory.meat || 0) >= 10 &&
    (player.inventory.gold_ore || 0) >= 1
  ) {
    player.level = 3;
    showMessage("برای رسیدن به سطح 4 باید 10 تا جواهر بنفش جمع کنی تا برات دروازه دنیای جدید باز بشه");
  }

  updateHUD();
}

function update(dt) {
  let mx = 0, my = 0;
  if (game.keys["w"]) my -= 1;
  if (game.keys["s"]) my += 1;
  if (game.keys["a"]) mx -= 1;
  if (game.keys["d"]) mx += 1;

  const isMoving = mx !== 0 || my !== 0;
  
  // بررسی مکانیزم دویدن با دکمه اسپیس (در صورت داشتن معجون)
  const isRunning = game.keys["space"] && player.potions > 0;
  const currentSpeed = isRunning ? player.speed * 2 : player.speed;

  if (isMoving) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;

    let nextX = player.x + mx * currentSpeed;
    let nextY = player.y + my * currentSpeed;

    let blocked = false;
    for (const tree of game.trees) {
      const d = Math.hypot(nextX - tree.x, nextY - tree.y);
      if (d < tree.trunkRadius + player.size * 0.35) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      player.x = nextX;
      player.y = nextY;
    }

    // مدیریت زمان دویدن و مصرف معجون (هر ۳۰ ثانیه ۱ معجون کم می‌شود)
    if (isRunning) {
      game.runTimeAccumulator += dt;
      if (game.runTimeAccumulator >= 30) {
        player.potions = Math.max(0, player.potions - 1);
        game.runTimeAccumulator = 0;
        updateHUD();
      }
    } else {
      game.runTimeAccumulator = 0;
    }

    // تایمر حرکت مداوم بازیکن برای اسپاون یک صندوقچه در اطراف
    game.movementTimeAccumulator += dt;
    if (game.movementTimeAccumulator >= CONFIG.CHEST_SPAWN_TIME) {
      spawnChestNearPlayer();
      game.movementTimeAccumulator = 0;
    }

    // اجرای اسپاون و مدیریت پویای اجزای بازی حین جابجایی
    manageDynamicSpawns();
  } else {
    game.runTimeAccumulator = 0;
  }

  game.entities.forEach(e => {
    e.moveTimer -= dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    if (e.type === "rabbit") {
      const d = dist(player, e);
      if (d < 140) {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const len = Math.hypot(dx, dy) || 1;
        e.x += (dx / len) * e.speed * dt * TILE / 6;
        e.y += (dy / len) * e.speed * dt * TILE / 6;
      } else {
        if (e.moveTimer <= 0) {
          e.dirX = rand(-1, 1);
          e.dirY = rand(-1, 1);
          e.moveTimer = rand(1, 3);
        }
        e.x += e.dirX * e.speed * dt * 10;
        e.y += e.dirY * e.speed * dt * 10;
      }
    } else if (e.type === "wolf") {
      const d = dist(player, e);
      // تغییر شرط فاصله حمله به ۶ برابر اندازه حیوان (6 * 34)
      if (d < 6 * 34) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        e.x += (dx / len) * e.speed * dt * 10;
        e.y += (dy / len) * e.speed * dt * 10;

        e.attackCooldown -= dt;
        // حمله گرگ: هر ۱ ثانیه، نصف یک قلب از بازیکن کم می‌کند
        if (d < 42 && e.attackCooldown <= 0) {
          player.hearts = Math.max(0, player.hearts - 0.5);
          e.attackCooldown = CONFIG.WOLF_ATTACK_COOLDOWN;
          updateHUD();
        }
      } else {
        if (e.moveTimer <= 0) {
          e.dirX = rand(-1, 1);
          e.dirY = rand(-1, 1);
          e.moveTimer = rand(1, 3);
        }
        e.x += e.dirX * e.speed * dt * 10;
        e.y += e.dirY * e.speed * dt * 10;
      }
    } else {
      if (e.moveTimer <= 0) {
        e.dirX = rand(-1, 1);
        e.dirY = rand(-1, 1);
        e.moveTimer = rand(1, 3);
      }
      e.x += e.dirX * e.speed * dt * 10;
      e.y += e.dirY * e.speed * dt * 10;
    }
  });

  game.itemsOnGround = game.itemsOnGround.filter(item => {
    if (dist(player, item) < 40) {
      addItem(item.type, item.count);
      return false;
    }
    return true;
  });

  game.timePlayed += dt;
  checkLevelProgress();
}

function drawWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#58a84f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  function sx(x) { return x - camX; }
  function sy(y) { return y - camY; }

  for (const bush of game.bushes) {
    ctx.drawImage(assets.bush, sx(bush.x - 16), sy(bush.y - 16), 32, 32);
  }

  for (const item of game.itemsOnGround) {
    ctx.drawImage(assets[item.type], sx(item.x - 12), sy(item.y - 12), 24, 24);
  }

  for (const chest of game.chests) {
    ctx.drawImage(assets.chest, sx(chest.x - 20), sy(chest.y - 20), 40, 40);
  }

  for (const e of game.entities) {
    if (e.hitFlash > 0) ctx.globalAlpha = 0.7;
    ctx.drawImage(assets[e.sprite], sx(e.x - 18), sy(e.y - 18), 36, 36);
    ctx.globalAlpha = 1;
  }

  for (const tree of game.trees) {
    const underTree = Math.hypot(player.x - tree.x, player.y - tree.y) < tree.crownRadius;
    if (underTree) ctx.globalAlpha = 0.45;
    ctx.drawImage(assets.tree, sx(tree.x - 48), sy(tree.y - 64), 96, 96);
    ctx.globalAlpha = 1;
  }

  ctx.drawImage(assets.knight, canvas.width / 2 - 24, canvas.height / 2 - 24, 48, 48);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  drawWorld();
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  
  if (k === " ") {
    game.keys["space"] = true;
  } else {
    game.keys[k] = true;
  }

  if (["1","2","3","4"].includes(k)) {
    game.selectedSlot = parseInt(k) - 1;
    updateHUD();
  }

  if (k === "e") {
    modal.classList.remove("hidden");
    renderInventoryModal();
  }

  // مدیریت باز و بسته کردن صندوقچه ها فقط با کلید r
  if (k === "r") {
    if (!chestModal.classList.contains("hidden")) {
      chestModal.classList.add("hidden");
      game.currentChest = null;
      game.chestLoot = [];
    } else {
      const nearbyChest = game.chests.find(c => Math.hypot(player.x - c.x, player.y - c.y) < 60);
      if (nearbyChest) {
        openChest(nearbyChest);
      }
    }
  }

  if (e.key === "Enter") checkDoubleEnter();
});

document.addEventListener("keyup", e => {
  const k = e.key.toLowerCase();
  if (k === " ") {
    game.keys["space"] = false;
  } else {
    game.keys[k] = false;
  }
});

// تغییر تعامل کلیک‌ها: کلیک چپ برای مصرف آیتم هات‌بار / کلیک راست فقط برای حمله
canvas.addEventListener("mousedown", e => {
  if (e.button === 0) {
    // کلیک چپ: مصرف آیتم در هات‌بار
    consumeSelectedItem();
  } else if (e.button === 2) {
    // کلیک راست: فقط حمله با شمشیر
    e.preventDefault();
    attack();
  }
});

canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
});

document.getElementById("menuButton").addEventListener("click", e => {
  e.preventDefault();
});

document.getElementById("menuButton").addEventListener("contextmenu", e => {
  e.preventDefault();
});

document.getElementById("siteBtn").addEventListener("click", () => {
  window.open("https://github.com/tree-leve-010/asdASD", "_blank");
});

document.getElementById("tgBtn").addEventListener("click", () => {
  window.open("https://t.me/Amir_Magic_TS", "_blank");
});

document.getElementById("mailBtn").addEventListener("click", () => {
  window.location.href = "mailto:pixel_knight_survival@gmail.com";
});

document.getElementById("takeChestLoot").addEventListener("click", takeChestLoot);

modal.addEventListener("click", e => {
  if (e.target === modal) modal.classList.add("hidden");
});

slots.forEach((slot, i) => {
  slot.addEventListener("click", () => {
    game.selectedSlot = i;
    updateHUD();
  });
});

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

loadAssets(() => {
  spawnWorld();
  updateHUD();
  showMessage("سلام دوستان . به بازی بقا با شوالیه پیکسلی خوش آمدین . و ماموریت الان شما برای رفتن به سطح 2 این هست که 30 دقیقه بازی کنید و بعد از 30 دقیقه بازی 30تا ستاره جمع میشود و به شما شمشیر طلایی داده میشود .و با دو بار کلیک بر روی اینتر بزنید تا این پییام رد شود .");
  requestAnimationFrame(loop);
});
