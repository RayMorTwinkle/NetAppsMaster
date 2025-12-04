// --- 核心数据 ---
let cards = [];
let originalCards = [];
let currentIndex = 0;
let isShuffle = false;
let fileName = "";

// --- 视图配置 ---
const SLOT_COUNT = 5; 
const slots = []; 

// DOM 引用
let stage, fileInput, mainUI, uploadScreen;

// 初始化 DOM 引用
function initDOMReferences() {
    stage = document.getElementById('stage');
    fileInput = document.getElementById('file-input');
    mainUI = document.getElementById('main-interface');
    uploadScreen = document.getElementById('upload-screen');
}

// 初始化 5 个卡片槽
function initSlots() {
    stage.innerHTML = '';
    slots.length = 0;
    
    for (let i = 0; i < SLOT_COUNT; i++) {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'card-slot';
        
        // 内部结构：Flashcard (Front/Back)
        slotDiv.innerHTML = `
            <div class="flashcard">
                <div class="card-face card-front">
                    <div class="card-label">Question</div>
                    <div class="card-content"></div>
                </div>
                <div class="card-face card-back">
                    <div class="card-label" style="color: var(--accent)">Answer</div>
                    <div class="card-content"></div>
                </div>
            </div>
        `;
        
        // 点击事件
        slotDiv.onclick = (e) => handleSlotClick(i);
        
        stage.appendChild(slotDiv);
        slots.push({
            el: slotDiv,
            cardEl: slotDiv.querySelector('.flashcard'),
            qEl: slotDiv.querySelector('.card-front .card-content'),
            aEl: slotDiv.querySelector('.card-back .card-content')
        });
    }
}

// --- CSV 解析 (加强版：支持引号内换行) ---
function parseCSV(text) {
    const result = [];
    // 标准化换行符
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    let currentRow = [];
    let currentCell = '';
    let inQuote = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (inQuote) {
            if (char === '"') {
                if (nextChar === '"') {
                    // 两个双引号转义为一个双引号
                    currentCell += '"';
                    i++; // 跳过下一个引号
                } else {
                    // 结束引号
                    inQuote = false;
                }
            } else {
                currentCell += char; // 引号内的内容（包括换行符）都保留
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if (char === '\n') {
                currentRow.push(currentCell.trim());
                if (currentRow.length >= 2) {
                     result.push({ q: currentRow[0], a: currentRow[1] });
                }
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
    }
    // 处理最后一行
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.length >= 2) {
            result.push({ q: currentRow[0], a: currentRow[1] });
        }
    }
    return result;
}

// --- 核心逻辑：渲染 CoverFlow ---
function updateView() {
    // 1. 更新顶部统计和进度条
    document.getElementById('current-index').textContent = currentIndex + 1;
    document.getElementById('total-count').textContent = cards.length;
    const progress = ((currentIndex + 1) / cards.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    
    // 保存进度
    if (!isShuffle && fileName) {
        localStorage.setItem(`flashcard_progress_${fileName}`, currentIndex);
    }

    // 2. 更新 Slot 状态和内容
    const slotCount = slots.length;
    
    slots.forEach((slotObj, slotIndex) => {
        // 计算距离
        let dist = slotIndex - (currentIndex % slotCount);
        if (dist > 2) dist -= slotCount;
        if (dist < -2) dist += slotCount;

        // 清除旧类
        slotObj.el.className = 'card-slot';
        
        // 添加新类
        if (dist === 0) slotObj.el.classList.add('center');
        else if (dist === -1) slotObj.el.classList.add('left');
        else if (dist === 1) slotObj.el.classList.add('right');
        else if (dist < -1) slotObj.el.classList.add('hidden-left');
        else if (dist > 1) slotObj.el.classList.add('hidden-right');

        // 翻转归位
        if (dist !== 0) {
            slotObj.cardEl.classList.remove('flipped');
        }

        // 填充内容
        let dataIndex = currentIndex + dist;
        
        if (dataIndex >= 0 && dataIndex < cards.length) {
            slotObj.el.style.visibility = 'visible';
            const cardData = cards[dataIndex];
            if (slotObj.qEl.innerText !== cardData.q) {
                slotObj.qEl.innerText = cardData.q;
                slotObj.aEl.innerText = cardData.a;
            }
        } else {
            slotObj.el.style.visibility = 'hidden';
        }
    });
}

// --- 交互控制 ---
function handleSlotClick(slotIndex) {
    const slotCount = slots.length;
    let dist = slotIndex - (currentIndex % slotCount);
    if (dist > 2) dist -= slotCount;
    if (dist < -2) dist += slotCount;

    if (dist === 0) {
        flipCurrent();
    } else if (dist === -1) {
        prevCard();
    } else if (dist === 1) {
        nextCard();
    }
}

function flipCurrent() {
    const currentSlotIndex = currentIndex % slots.length;
    slots[currentSlotIndex].cardEl.classList.toggle('flipped');
}

function nextCard() {
    if (currentIndex < cards.length - 1) {
        currentIndex++;
        updateView();
    } else {
        stage.style.transform = "translateX(-15px)";
        setTimeout(() => stage.style.transform = "translateX(0)", 150);
    }
}

function prevCard() {
    if (currentIndex > 0) {
        currentIndex--;
        updateView();
    } else {
        stage.style.transform = "translateX(15px)";
        setTimeout(() => stage.style.transform = "translateX(0)", 150);
    }
}

function jumpToCard() {
    const input = document.getElementById('jump-box');
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 1 && val <= cards.length) {
        currentIndex = val - 1;
        updateView();
        input.value = '';
        input.blur();
    }
}

// --- 文件加载处理 ---
function loadCSVFile(file) {
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const text = ev.target.result;
        const parsed = parseCSV(text);
        
        if (parsed.length === 0) { 
            alert("无法解析文件或文件为空"); 
            return; 
        }
        
        originalCards = parsed;
        cards = [...originalCards];
        
        initSlots();
        
        const saved = localStorage.getItem(`flashcard_progress_${fileName}`);
        if (saved) currentIndex = parseInt(saved);
        if (currentIndex >= cards.length) currentIndex = 0;

        uploadScreen.style.opacity = 0;
        setTimeout(() => {
            uploadScreen.style.display = 'none';
            mainUI.style.display = 'flex';
            updateView();
            // 添加返回主界面按钮
            addBackToMainButton();
        }, 500);
    };
    reader.readAsText(file);
}

// --- 预设文件加载 ---
function loadPresetFile(filename, csvContent) {
    fileName = filename;
    const parsed = parseCSV(csvContent);
    
    if (parsed.length === 0) { 
        alert("预设文件内容为空或格式错误"); 
        return; 
    }
    
    originalCards = parsed;
    cards = [...originalCards];
    
    initSlots();
    
    const saved = localStorage.getItem(`flashcard_progress_${fileName}`);
    if (saved) currentIndex = parseInt(saved);
    if (currentIndex >= cards.length) currentIndex = 0;

    uploadScreen.style.opacity = 0;
    setTimeout(() => {
        uploadScreen.style.display = 'none';
        mainUI.style.display = 'flex';
        updateView();
        // 添加返回主界面按钮
        addBackToMainButton();
    }, 500);
}

// --- 添加返回主界面按钮 ---
function addBackToMainButton() {
    // 移除已存在的按钮
    const existingButton = document.querySelector('.back-to-main');
    if (existingButton) {
        existingButton.remove();
    }
    
    const backButton = document.createElement('button');
    backButton.className = 'back-to-main';
    backButton.innerHTML = '<i class="fas fa-home"></i> 返回主界面';
    backButton.onclick = backToMain;
    
    document.querySelector('.app-container').appendChild(backButton);
}

// --- 返回主界面 ---
function backToMain() {
    if (confirm("确定要返回主界面吗？当前进度将保存。")) {
        // 隐藏主界面
        mainUI.style.display = 'none';
        
        // 显示上传界面
        uploadScreen.style.display = 'flex';
        setTimeout(() => {
            uploadScreen.style.opacity = 1;
        }, 10);
        
        // 移除返回按钮
        const backButton = document.querySelector('.back-to-main');
        if (backButton) {
            backButton.remove();
        }
        
        // 重置状态（可选，根据需求）
        // cards = [];
        // currentIndex = 0;
    }
}

// --- 乱序 & 重置 ---
function toggleShuffle() {
    isShuffle = !isShuffle;
    document.getElementById('shuffle-btn').classList.toggle('active');
    if (isShuffle) {
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        currentIndex = 0;
    } else {
        cards = [...originalCards];
        currentIndex = 0;
    }
    // 乱序后清空 DOM 显示，强制刷新
    slots.forEach(s => { s.qEl.innerText = ''; }); 
    updateView();
}

function resetApp() {
    if(confirm("重新上传文件？")) location.reload();
}

// --- 事件监听器设置 ---
function setupEventListeners() {
    // 文件上传事件
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        loadCSVFile(file);
    });

    // 全局键盘事件
    document.addEventListener('keydown', (e) => {
        if (mainUI.style.display === 'none') return;
        if (document.activeElement.tagName === 'INPUT') {
            if(e.key === 'Enter') jumpToCard();
            return;
        }

        switch(e.code) {
            case 'Space':
                e.preventDefault();
                flipCurrent();
                break;
            case 'ArrowRight':
            case 'Enter':
            case 'NumpadEnter':
                nextCard();
                break;
            case 'ArrowLeft':
                prevCard();
                break;
        }
    });

    // 乱序按钮
    document.getElementById('shuffle-btn').addEventListener('click', toggleShuffle);

    // 跳转输入框
    document.getElementById('jump-box').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') jumpToCard();
    });

    // 触摸滑动支持
    let ts = 0;
    document.addEventListener('touchstart', e => ts = e.touches[0].clientX);
    document.addEventListener('touchend', e => {
        let te = e.changedTouches[0].clientX;
        if (ts - te > 50) nextCard();
        if (te - ts > 50) prevCard();
    });
}

// --- 初始化应用 ---
function initApp() {
    initDOMReferences();
    setupEventListeners();
    
    // 检查是否有预设文件并添加按钮
    checkAndAddPresetFiles();
}

// --- 检查并添加预设文件 ---
function checkAndAddPresetFiles() {
    // 添加示例词汇预设文件
    addPresetFileButton('示例词汇', '示例词汇.csv', getExampleCSVContent());
    
    // 尝试加载本地flashcards.csv文件
    loadLocalPresetFile();
}

// --- 加载本地预设文件 ---
function loadLocalPresetFile() {
    // 使用fetch API尝试加载本地CSV文件
    fetch('flashcards.csv')
        .then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('本地预设文件不存在');
        })
        .then(csvContent => {
            // 成功加载本地文件，添加预设按钮
            addPresetFileButton('计算机知识题库', 'flashcards.csv', csvContent);
        })
        .catch(error => {
            console.log('本地预设文件未找到：', error.message);
            // 如果本地文件不存在，仍然添加一个示例按钮
            addPresetFileButton('计算机知识题库', 'flashcards.csv', getExampleCSVContent());
        });
}

// --- 添加预设文件按钮 ---
function addPresetFileButton(displayName, filename, csvContent) {
    const presetContainer = document.createElement('div');
    presetContainer.className = 'preset-files';
    
    const title = document.createElement('div');
    title.className = 'preset-title';
    title.textContent = '或选择预设文件：';
    
    const button = document.createElement('button');
    button.className = 'preset-btn';
    button.textContent = displayName;
    button.onclick = () => loadPresetFile(filename, csvContent);
    
    presetContainer.appendChild(title);
    presetContainer.appendChild(button);
    
    document.querySelector('.upload-box').appendChild(presetContainer);
}

// --- 示例CSV内容 ---
function getExampleCSVContent() {
    return `单词,释义
Hello,你好
World,世界
JavaScript,一种编程语言
HTML,超文本标记语言
CSS,层叠样式表
Git,版本控制系统
GitHub,代码托管平台
React,前端框架
Node.js,JavaScript运行环境
Python,编程语言`;
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);