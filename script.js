// Конфигурация
const CONFIG = {
    username: 'DanielTop',
    // Репозитории, которые НЕ являются играми (исключаем из каталога)
    excludeRepos: ['Catalog', 'DanielTop.github.io'],
    // Иконки для игр (можно настроить для каждой игры)
    gameIcons: {
        'default': '🎮',
        // Пример: 'snake': '🐍', 'tetris': '🧱'
    }
};

// DOM элементы
const gamesGrid = document.getElementById('games-grid');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const catalog = document.getElementById('catalog');
const gameContainer = document.getElementById('game-container');
const gameFrame = document.getElementById('game-frame');
const gameTitle = document.getElementById('game-title');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const backBtn = document.getElementById('back-btn');

// Загрузка списка игр
async function loadGames() {
    loading.style.display = 'block';
    errorDiv.style.display = 'none';
    gamesGrid.innerHTML = '';

    try {
        // Получаем список репозиториев пользователя
        const response = await fetch(
            `https://api.github.com/users/${CONFIG.username}/repos?sort=updated&per_page=100`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch repos');
        }

        const repos = await response.json();

        // Фильтруем репозитории (исключаем каталог и другие не-игровые)
        const gameRepos = repos.filter(repo =>
            !CONFIG.excludeRepos.includes(repo.name) &&
            !repo.fork && // Исключаем форки
            repo.has_pages // Только репозитории с GitHub Pages
        );

        loading.style.display = 'none';

        if (gameRepos.length === 0) {
            showEmptyState();
            return;
        }

        // Отображаем карточки игр
        gameRepos.forEach(repo => {
            const card = createGameCard(repo);
            gamesGrid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading games:', error);
        loading.style.display = 'none';
        errorDiv.style.display = 'block';
    }
}

// Создание карточки игры
function createGameCard(repo) {
    const card = document.createElement('div');
    card.className = 'game-card';

    const icon = CONFIG.gameIcons[repo.name.toLowerCase()] || CONFIG.gameIcons.default;
    const description = repo.description || 'A web game';
    const gameUrl = `https://${CONFIG.username}.github.io/${repo.name}/`;

    card.innerHTML = `
        <div class="game-preview">${icon}</div>
        <div class="game-info">
            <h3>${formatGameName(repo.name)}</h3>
            <p>${description}</p>
            <div class="game-meta">
                <span>⭐ ${repo.stargazers_count}</span>
                <span>📅 ${formatDate(repo.updated_at)}</span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openGame(repo.name, gameUrl));

    return card;
}

// Форматирование имени игры
function formatGameName(name) {
    return name
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Открытие игры
function openGame(name, url) {
    catalog.style.display = 'none';
    gameContainer.style.display = 'flex';

    gameTitle.textContent = formatGameName(name);
    gameFrame.src = url;
    fullscreenBtn.href = url;

    // Обновляем URL без перезагрузки
    history.pushState({ game: name }, '', `?game=${name}`);
}

// Закрытие игры
function closeGame() {
    gameContainer.style.display = 'none';
    catalog.style.display = 'block';
    gameFrame.src = '';

    // Возвращаем URL
    history.pushState({}, '', window.location.pathname);
}

// Пустое состояние
function showEmptyState() {
    gamesGrid.innerHTML = `
        <div class="empty-state">
            <h3>No games found</h3>
            <p>Make sure your game repositories have GitHub Pages enabled</p>
        </div>
    `;
}

// Обработка навигации браузера
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.game) {
        const gameUrl = `https://${CONFIG.username}.github.io/${event.state.game}/`;
        openGame(event.state.game, gameUrl);
    } else {
        closeGame();
    }
});

// Обработка URL при загрузке страницы
function handleInitialUrl() {
    const params = new URLSearchParams(window.location.search);
    const game = params.get('game');

    if (game) {
        const gameUrl = `https://${CONFIG.username}.github.io/${game}/`;
        openGame(game, gameUrl);
    }
}

// События
backBtn.addEventListener('click', closeGame);

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadGames();
    handleInitialUrl();
});
