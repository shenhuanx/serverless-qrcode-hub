const banPath = [
    //'login', 'admin', '__total_count',
    // static files
    'qrcode.html', 
    //'login.html',
    'daisyui@5.css', 'tailwindcss@4.js',
    'qr-code-styling.js', 'zxing.js',
    'robots.txt', 'wechat.svg',
    'favicon.svg',
];

document.addEventListener('DOMContentLoaded', function () {
    // 初始化页面
    initializePage();
    // 移除自动生成短链
    // generateShortLink();
});

// 生成短链函数
function generateShortLink() {
    const now = new Date();
    const timestamp = now.getTime();
    const shortLink = `q${timestamp}`;
    document.getElementById('newPath').value = shortLink;
}

// 获取浏览器指纹
async function getFingerprint() {
    const components = await Fingerprint2.getPromise();
    const values = components.map(component => component.value);
    return Fingerprint2.x64hash128(values.join(''), 31);
}

// 添加指纹到所有请求头
async function addFingerprintToHeaders() {
    const fingerprint = await getFingerprint();
    const headers = new Headers();
    headers.append('X-Fingerprint', fingerprint);
    return headers;
}

// 修改所有fetch请求
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    const headers = await addFingerprintToHeaders();
    if (options.headers) {
        Object.keys(options.headers).forEach(key => {
            headers.append(key, options.headers[key]);
        });
    }
    options.headers = headers;
    return originalFetch(url, options);
};

// 页面初始化函数
function initializePage() {
    // 将原有的初始化代码移到这里
    //document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('addMappingBtn').addEventListener('click', addMapping);
    setupQRUpload();

    // 加载短链二维码数据
    loadMappings();

    // 添加全局错误处理
    setupErrorHandling();

    // 添加筛选按钮状态管理
    const filterButtons = {
        showAllBtn: { element: document.getElementById('showAllBtn'), class: 'btn-primary' },
        showExpiringBtn: { element: document.getElementById('showExpiringBtn'), class: 'btn-warning' },
        showExpiredBtn: { element: document.getElementById('showExpiredBtn'), class: 'btn-error' }
    };

    function updateFilterButtonStates(activeButtonId) {
        Object.entries(filterButtons).forEach(([id, { element, class: buttonClass }]) => {
            if (id === activeButtonId) {
                element.classList.add(buttonClass);
            } else {
                element.classList.remove(buttonClass);
            }
        });
    }

    // 修改筛选按钮的点击事件
    document.getElementById('showAllBtn').addEventListener('click', async () => {
        currentPage = 1; // 重置页码
        const btn = document.getElementById('showAllBtn');
        const expiringBtn = document.getElementById('showExpiringBtn');
        const expiredBtn = document.getElementById('showExpiredBtn');
        
        btn.classList.add('btn-primary');
        expiringBtn.classList.remove('btn-warning');
        expiredBtn.classList.remove('btn-error');
        
        await loadMappings();
    });

    document.getElementById('showExpiringBtn').addEventListener('click', async () => {
        currentPage = 1; // 重置页码
        const btn = document.getElementById('showExpiringBtn');
        const allBtn = document.getElementById('showAllBtn');
        const expiredBtn = document.getElementById('showExpiredBtn');
        
        btn.classList.add('btn-warning');
        allBtn.classList.remove('btn-primary');
        expiredBtn.classList.remove('btn-error');
        
        await loadExpiringMappings('expiring');
    });

    document.getElementById('showExpiredBtn').addEventListener('click', async () => {
        currentPage = 1; // 重置页码
        const btn = document.getElementById('showExpiredBtn');
        const allBtn = document.getElementById('showAllBtn');
        const expiringBtn = document.getElementById('showExpiringBtn');
        
        btn.classList.add('btn-error');
        allBtn.classList.remove('btn-primary');
        expiringBtn.classList.remove('btn-warning');
        
        await loadExpiringMappings('expired');
    });

    // 添加微信二维码开关事件监听
    //document.getElementById('newIsWechat').addEventListener('change', function(e) {
        // const targetInput = document.getElementById('newTarget');
        // //const decodedText = document.getElementById('decoded-text').textContent;
        
        // if (e.target.checked) {
        //     // 如果启用微信二维码，设置为只读并使用二维码识别的内容
        //     targetInput.readOnly = true;
        //     //if (decodedText) {
        //     //    targetInput.value = decodedText;
        //     //}
        // } else {
        //     // 如果禁用微信二维码，恢复可编辑状态
        //     targetInput.readOnly = false;
        // }
    //});
    
    // 初始禁用微信二维码开关
    //document.getElementById('newIsWechat').disabled = true;
}

// 添加全局错误处理
function setupErrorHandling() {
    window.addEventListener('unhandledrejection', function (event) {
        if (event.reason.status === 401) {
            window.location.href = '/login';
        }
    });
}

// 二维码上传和识别相关
function setupQRUpload() {
    const uploadArea = document.getElementById('qr-upload-area');
    const fileInput = document.getElementById('qr-file');
    //const copyBtn = document.getElementById('copy-btn');
    const qrResult = document.getElementById('qr-result');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('bg-base-200');
    });
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('bg-base-200');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('bg-base-200');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    //copyBtn.addEventListener('click', copyDecodedText);
}

function handleFiles(files) {
    if (files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
        showAlert('请上传图片文件');
        return;
    }

    // 清除之前的二维码数据
    document.getElementById('qrCodeData').value = '';
    document.getElementById('qr-result').classList.add('hidden');
    document.getElementById('newTarget').value = '';
    
    // 重置并禁用微信二维码开关
    // const wechatToggle = document.getElementById('newIsWechat');
    // wechatToggle.checked = false;
    // wechatToggle.disabled = true;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            decodeQR(img);
            // 保存原始二维码数据用于微信二维码
            document.getElementById('qrCodeData').value = e.target.result;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function decodeQR(img) {
    try {
        console.log('开始识别二维码');
        const codeReader = new ZXing.BrowserMultiFormatReader();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 调整画布大小，确保图像质量
        const maxSize = 1024; // 限制最大尺寸
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        console.log('原始图片尺寸:', width, 'x', height);

        // 保持宽高比进行缩放
        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = Math.floor(height * (maxSize / width));
                width = maxSize;
            } else {
                width = Math.floor(width * (maxSize / height));
                height = maxSize;
            }
        }

        console.log('调整后尺寸:', width, 'x', height);

        // 设置画布尺寸
        canvas.width = width;
        canvas.height = height;

        // 绘制图片到画布
        ctx.drawImage(img, 0, 0, width, height);

        // 创建新的 Blob 并进行解码
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
        const imageUrl = URL.createObjectURL(blob);

        try {
            const result = await codeReader.decodeFromImageUrl(imageUrl);
            URL.revokeObjectURL(imageUrl);

            if (result && result.text) {
                // 生成时间戳短链
                const timestamp = new Date().getTime();
                const shortLink = `q${timestamp}`;
                
                // 设置短链和目标URL
                document.getElementById('newPath').value = shortLink;
                document.getElementById('newTarget').value = result.text;
                document.getElementById('qr-result').classList.remove('hidden');
                
                // 启用微信二维码开关
                // const wechatToggle = document.getElementById('newIsWechat');
                // wechatToggle.disabled = false;
                
                showAlert('二维码识别成功', 'success');
            } else {
                throw new Error('未能识别二维码内容');
            }
        } catch (decodeError) {
            // 如果第一次识别失败，尝试不同的图像处理方式
            try {
                // 重置画布
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // 尝试反转颜色
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];         // 红
                    data[i + 1] = 255 - data[i + 1]; // 绿
                    data[i + 2] = 255 - data[i + 2]; // 蓝
                }
                ctx.putImageData(imageData, 0, 0);

                const newBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
                const newImageUrl = URL.createObjectURL(newBlob);

                const result = await codeReader.decodeFromImageUrl(newImageUrl);
                URL.revokeObjectURL(newImageUrl);

                if (result && result.text) {
                    // 生成时间戳短链
                    const timestamp = new Date().getTime();
                    const shortLink = `q${timestamp}`;
                    
                    // 设置短链和目标URL
                    document.getElementById('newPath').value = shortLink;
                    document.getElementById('newTarget').value = result.text;
                    document.getElementById('qr-result').classList.remove('hidden');
                    
                    // 启用微信二维码开关
                    //const wechatToggle = document.getElementById('newIsWechat');
                    //wechatToggle.disabled = false;
                    
                    showAlert('二维码识别成功', 'success');
                } else {
                    throw new Error('未能识别二维码内容');
                }
            } catch (finalError) {
                console.error('二维码识别错误:', finalError);
                showAlert('无法识别二维码，请确保图片清晰且包含有效的二维码');
                document.getElementById('qr-result').classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('图像处理错误:', error);
        showAlert('处理图片时出错，请重试');
        document.getElementById('qr-result').classList.add('hidden');
    }
}

function copyDecodedText() {
    //const text = document.getElementById('decoded-text').textContent;
    const text = document.getElementById('newTarget').value;
    navigator.clipboard.writeText(text)
        .then(() => {
            // 复制成功后自动填充到目标 URL 输入框
            document.getElementById('newTarget').value = text;
            // 滚动到添加短链二维码区域
            document.getElementById('addNewRow').scrollIntoView({ behavior: 'smooth' });
            showAlert('复制成功', 'success');
        })
        .catch(err => {
            console.error('复制失败:', err);
            showAlert('复制失败，请手动复制');
        });
}

// 修改 showAlert 函数，支持更多类型
function showAlert(message, type = 'error') {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');

    const alertClass = type === 'error' ? 'alert alert-error' : 'alert alert-success';
    alert.className = `${alertClass} mb-4 shadow-lg min-w-[300px]`;

    alert.innerHTML = `
        <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="${type === 'error'
                ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'}"/>
            </svg>
            <span>${message}</span>
        </div>
    `;

    alert.style.opacity = '0';
    alertContainer.appendChild(alert);

    setTimeout(() => {
        alert.style.transition = 'opacity 0.3s ease-in-out';
        alert.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 300);
    }, 3000);
}

async function loadMappings() {
    const tableBody = document.getElementById('mappingsTableBody');
    //const skeleton = document.getElementById('skeleton');

    // 显示骨架屏，隐藏表格内容
    tableBody.style.display = 'none';
    //skeleton.classList.remove('hidden');

    try {
        const response = await fetch(`/api/mappings?page=${currentPage}&pageSize=${pageSize}`);

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            throw new Error('加载数据失败');
        }

        const data = await response.json();
        allMappings = Object.entries(data.mappings);
        
        // 等待一小段时间再更新DOM
        await new Promise(resolve => setTimeout(resolve, 300));

        // 更新表格内容
        renderCurrentPage();

        // 更新分页信息
        currentPage = data.page;
        const totalPages = data.totalPages;
        document.getElementById('currentPage').textContent = currentPage;
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages;

        // 设置页面大小选择器的当前值
        document.getElementById('pageSize').value = pageSize;

    } catch (error) {
        console.error('加载数据失败:', error);
        showAlert('加载数据失败，请刷新页面重试');
    } finally {
        // 隐藏骨架屏，显示表格内容
        //skeleton.classList.add('hidden');
        tableBody.style.display = '';
    }
}

function renderCurrentPage() {
    const table = document.getElementById('mappingsTableBody');
    // 清空现有内容
    table.innerHTML = '';

    const fragment = document.createDocumentFragment();

    // 直接遍历所有映射
    for (const [path, mapping] of allMappings) {
        const row = createMappingRow(path, mapping);
        fragment.appendChild(row);
    }

    table.appendChild(fragment);
}

// 修改添加短链按钮的处理函数
async function addMapping() {
    const name = document.getElementById('newName').value.trim();
    const path = document.getElementById('newPath').value.trim();
    const target = document.getElementById('newTarget').value.trim();
    const expiry = document.getElementById('newExpiry').value;
    //const enabled = document.getElementById('newEnabled').checked;
    const qrCodeData = document.getElementById('qrCodeData').value;

    // 验证是否已上传二维码
    if (!path || !target) {
        showAlert('请先上传二维码');
        return;
    }

    try {
        // 获取浏览器指纹
        const fingerprint = await getFingerprint();
        
        const response = await fetch('/api/mapping', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Fingerprint': fingerprint
            },
            body: JSON.stringify({ 
                name, 
                path, 
                target, 
                expiry: expiry || null,
                enabled: true,
                qrCodeData: qrCodeData
            })
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const data = await response.json();
            console.error('添加失败:', data);
            showAlert(data.message || data.error || '添加失败，请重试');
            return;
        }

        showAlert('添加成功', 'success');
        
        // 重置表单
        resetForm();
        
        // 重新加载数据
        await loadMappings();
        
        // 自动弹出二维码查看窗口
        generateQRForMapping(window.location.origin + '/' + path, name, path);
        
    } catch (error) {
        console.error('添加短链二维码失败:', error);
        showAlert('添加失败，请检查网络连接后重试');
    }
}

async function deleteMapping(path) {
    const modal = document.getElementById('delete-confirm-modal');
    const confirmBtn = document.getElementById('confirm-delete-btn');

    // 创建一个 Promise 来处理用户的选择
    return new Promise((resolve) => {
        const handleConfirm = async () => {
            try {
                const response = await fetch('/api/mapping', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });

                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }

                if (!response.ok) {
                    const data = await response.json();
                    showAlert(data.message || data.error || '删除失败，请重试');
                    return;
                }

                showAlert('删除成功', 'success');
                
                // 不再刷新整个页面，而是重新加载表格数据
                await loadMappings();
                
                // 如果当前在过期或即将过期的视图中，重新加载相应的数据
                const expiringBtn = document.getElementById('showExpiringBtn');
                const expiredBtn = document.getElementById('showExpiredBtn');
                
                if (expiringBtn.classList.contains('btn-warning')) {
                    await loadExpiringMappings('expiring');
                } else if (expiredBtn.classList.contains('btn-error')) {
                    await loadExpiringMappings('expired');
                }

                // 关闭模态框
                modal.close();
            } catch (error) {
                console.error('删除失败:', error);
                showAlert('删除失败，请检查网络连接后重试');
            } finally {
                // 清理事件监听器
                confirmBtn.removeEventListener('click', handleConfirm);
                resolve();
            }
        };

        // 添加确认按钮的点击事件
        confirmBtn.addEventListener('click', handleConfirm);

        // 显示模态框
        modal.showModal();
    });
}

// 添加全局变量
let qrCode = null;

// 修改生成二维码的函数
function generateQRForMapping(url, name, newPath) {
    const modal = document.getElementById('qr-modal');
    const container = document.getElementById('qr-container');
    const downloadBtn = document.getElementById('qr-download');
    const showLogoCheckbox = document.getElementById('qr-show-logo');
    const dotsStyleSelect = document.getElementById('qr-dots-style');

    // 清空之前的内容
    container.innerHTML = '';

    // 从 localStorage 获取保存的设置
    const savedShowLogo = localStorage.getItem('qr-show-logo');
    const savedDotsStyle = localStorage.getItem('qr-dots-style');
    
    // 应用保存的设置
    if (savedShowLogo !== null) {
        showLogoCheckbox.checked = savedShowLogo === 'true';
    }
    if (savedDotsStyle) {
        dotsStyleSelect.value = savedDotsStyle;
    }

    // 创建二维码容器
    const qrWrapper = document.createElement('div');
    qrWrapper.className = 'flex flex-col items-center gap-2';
    
    // 创建二维码画布容器
    const qrCanvas = document.createElement('div');
    qrCanvas.id = 'qr-canvas';
    qrWrapper.appendChild(qrCanvas);
    
    // 只在有名称为创建名称显示区域
    if (name) {
        const nameDisplay = document.createElement('div');
        nameDisplay.className = 'text-center text-lg font-bold mt-2';
        nameDisplay.textContent = name;
        qrWrapper.appendChild(nameDisplay);
    }
    
    // 将包装器添加到容器
    container.appendChild(qrWrapper);

    // 基础 QR 配置
    const getQRConfig = (showLogo, dotsType) => ({
        width: 300,
        height: 300,
        type: 'canvas',
        data: url,
        dotsOptions: {
            color: "#000000",
            type: dotsType
        },
        cornersSquareOptions: {
            type: 'rounded'
        },
        cornersDotOptions: {
            type: 'rounded'
        },
        backgroundOptions: {
            color: "#FFFFFF"
        },
        qrOptions: {
            errorCorrectionLevel: 'H'
        },
        ...(showLogo ? {
            image: "/wechat.svg",
            imageOptions: {
                hideBackgroundDots: true,
                imageSize: 0.23,
                margin: 5
            }
        } : {})
    });

    // 创建新的二维码
    qrCode = new QRCodeStyling(getQRConfig(showLogoCheckbox.checked, dotsStyleSelect.value));
    qrCode.append(qrCanvas);

    // 监听复选框和选择器变化
    const updateQRCode = () => {
        qrCanvas.classList.add('switching');

        setTimeout(() => {
            qrCanvas.innerHTML = '';
            qrCode = new QRCodeStyling(getQRConfig(showLogoCheckbox.checked, dotsStyleSelect.value));
            qrCode.append(qrCanvas);

            // 保存设置到 localStorage
            localStorage.setItem('qr-show-logo', showLogoCheckbox.checked);
            localStorage.setItem('qr-dots-style', dotsStyleSelect.value);

            requestAnimationFrame(() => {
                qrCanvas.classList.remove('switching');
            });
        }, 200);
    };

    showLogoCheckbox.onchange = updateQRCode;
    dotsStyleSelect.onchange = updateQRCode;

    // 更新下载按钮点击事件
    downloadBtn.onclick = () => {
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .replace('Z', '');
        const fileName = `qr-${name || newPath}-${timestamp}`;

        // 创建一个新的画布来组合二维码和文字
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置画布大小，为文字和装饰预留空间
        const padding = 40; // 内边距
        const qrSize = 300; // 二维码大小
        const textHeight = name ? 60 : 0; // 只在有名称为预留文字区域高度
        canvas.width = qrSize + padding * 2;
        canvas.height = qrSize + padding * 2 + textHeight;
        
        // 绘制白色背景
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制圆角矩形背景
        ctx.fillStyle = '#F8F9FA';
        ctx.beginPath();
        ctx.roundRect(padding/2, padding/2, qrSize + padding, qrSize + padding + textHeight, 20);
        ctx.fill();
        
        // 添加阴影效果
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        
        // 获取二维码画布
        const qrCanvas = document.querySelector('#qr-canvas canvas');
        
        // 绘制二维码
        ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize);
        
        // 重置阴影
        ctx.shadowColor = 'transparent';
        
        // 只在有名称为绘制分隔线和文字
        if (name) {
            // 绘制分隔线
            ctx.beginPath();
            ctx.strokeStyle = '#E9ECEF';
            ctx.lineWidth = 2;
            ctx.moveTo(padding, qrSize + padding + 10);
            ctx.lineTo(qrSize + padding, qrSize + padding + 10);
            ctx.stroke();
            
            // 设置文字样式
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 绘制文字
            ctx.fillText(name, canvas.width / 2, qrSize + padding + textHeight/2);
        }
        
        // 添加水印
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.font = '12px Arial';
        ctx.fillText('永久二维码生成器', canvas.width / 2, canvas.height - 10);
        
        // 创建下载链接
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    };

    // 显示模态框
    modal.showModal();
    
    // 确保广告加载
    loadAds();
}

// 修改创建短链二维码行的函数中的二维码按钮部分
function createMappingRow(path, mapping) {
    const row = document.createElement('tr');
    
    // 保存完整的原始数据到 row 的 dataset
    row.dataset.originalData = JSON.stringify({
        name: mapping.name || '',
        path: path,
        target: mapping.target,
        expiry: mapping.expiry || '',
        enabled: mapping.enabled,
        isWechat: mapping.isWechat,
        qrCodeData: mapping.qrCodeData
    });

    // 使用数组和 map 来优化单元格创建
    const cellsData = [
        { text: mapping.name || '-', data: mapping.name || '-' },
        { text: path, data: path },
        { text: mapping.target, data: mapping.target },
        { text: mapping.expiry || '永久有效', data: mapping.expiry || '' }
    ];

    cellsData.forEach(({ text, data }, index) => {
        const cell = document.createElement('td');
        if (index === 2) { // 目标URL单元格
            cell.classList.add('whitespace-normal', 'break-words', 'max-w-xs');
            cell.style.wordBreak = 'break-all';
            cell.style.minWidth = '200px';
        }
        cell.textContent = text;
        cell.dataset.original = data;
        row.appendChild(cell);
    });

    // 添加状态列
    const statusCell = document.createElement('td');
    statusCell.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="badge ${mapping.enabled ? 'badge-success' : 'badge-error'}">
                ${mapping.enabled ? '启用' : '禁用'}
            </span>
            ${mapping.isWechat ? '<span class="badge badge-info">微信</span>' : ''}
        </div>
    `;
    row.appendChild(statusCell);

    const actionsCell = document.createElement('td');
    actionsCell.innerHTML = `
        <div class="join">
            <button class="join-item btn btn-error btn-sm">删除</button>
            <button class="join-item btn btn-info btn-sm">查看</button>
        </div>
    `;

    // 添加事件监听器
    const [deleteBtn, qrBtn] = actionsCell.querySelectorAll('button');
    deleteBtn.onclick = (e) => {
        e.preventDefault();
        deleteMapping(path);
    };
    qrBtn.onclick = () => {
        // 参数顺序：url, name, path
        generateQRForMapping(window.location.origin + '/' + path, mapping.name, path);
    };

    row.appendChild(actionsCell);
    return row;
}

// 添加切换编辑模式的函数
// async function toggleEditMode(row) {
//     const isEditing = row.classList.toggle('editing');
//     const cells = row.cells;
//     const originalData = JSON.parse(row.dataset.originalData);

//     if (isEditing) {
//         try {
//             // 获取当前行的完整数据
//             const response = await fetch(`/api/mapping?path=${originalData.path}`);
//             if (!response.ok) {
//                 throw new Error('获取数据失败');
//             }
//             const mappingData = await response.json();

//             // 切换到编辑模式
//             cells[0].innerHTML = `<input type="text" class="input input-bordered input-sm w-full" value="${mappingData.name || ''}">`;
//             cells[1].innerHTML = `<input type="text" class="input input-bordered input-sm w-full" value="${mappingData.path}">`;
//             cells[2].innerHTML = `<textarea class="textarea textarea-bordered textarea-sm w-full h-24" style="resize:none; word-break:break-all;">${mappingData.target}</textarea>`;
//             cells[3].innerHTML = `<input type="date" class="input input-bordered input-sm w-full" value="${mappingData.expiry || ''}">`;
            
//             // 状态切换
//             cells[4].innerHTML = `
//                 <div class="flex flex-col gap-2">
//                     <label class="cursor-pointer label justify-start gap-2">
//                         <input type="checkbox" class="toggle toggle-primary toggle-sm" ${mappingData.enabled ? 'checked' : ''}>
//                         <span class="label-text">启用</span>
//                     </label>
//                     <label class="cursor-pointer label justify-start gap-2">
//                         <input type="checkbox" class="toggle toggle-primary toggle-sm" ${mappingData.isWechat ? 'checked' : ''}>
//                         <span class="label-text">微信</span>
//                     </label>
//                 </div>
//             `;

//             // 修改按钮组
//             const actionsCell = cells[5];
//             actionsCell.innerHTML = `
//                 <div class="join">
//                     <button class="join-item btn btn-success btn-sm">保存</button>
//                     <button class="join-item btn btn-primary btn-sm">取消</button>
//                     <button class="join-item btn btn-info btn-sm">二维码</button>
//                 </div>
//             `;

//             // 重新绑定事件监听器
//             const [saveBtn, cancelBtn, qrBtn] = actionsCell.querySelectorAll('button');
//             saveBtn.onclick = () => saveEdit(row);
//             cancelBtn.onclick = () => restoreRow(row);
//             qrBtn.onclick = () => generateQRForMapping(window.location.origin + '/' + originalData.path, originalData.name, originalData.path);
//         } catch (error) {
//             console.error('获取数据失败:', error);
//             showAlert('获取数据失败，请重试');
//             row.classList.remove('editing');
//         }
//     }
// }

async function saveEdit(row) {
    const cells = row.cells;
    const rowOriginalData = JSON.parse(row.dataset.originalData);

    const newName = cells[0].querySelector('input').value;
    const newPath = cells[1].querySelector('input').value;
    const newTarget = cells[2].querySelector('textarea').value;
    const newExpiry = cells[3].querySelector('input').value;
    //const enabledToggle = cells[4].querySelector('input[type="checkbox"]');
    //const isWechatToggle = cells[4].querySelectorAll('input[type="checkbox"]')[1];
    //const newEnabled = enabledToggle.checked;
    //const newIsWechat = isWechatToggle ? isWechatToggle.checked : false;

    // 检查是否有任何修改
    const hasChanges =
        newName !== rowOriginalData.name ||
        newPath !== rowOriginalData.path ||
        newTarget !== rowOriginalData.target ||
        newExpiry !== rowOriginalData.expiry; //||
        // newEnabled !== rowOriginalData.enabled;// ||
        //(isWechatToggle && newIsWechat !== rowOriginalData.isWechat);

    if (!hasChanges) {
        restoreRow(row);
        return;
    }

    try {
        // 获取原有数据
        const response = await fetch(`/api/mapping?path=${rowOriginalData.path}`);
        if (!response.ok) {
            throw new Error('获取原有数据失败');
        }
        const serverData = await response.json();

        // 保存更改
        const updateResponse = await fetch('/api/mapping', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                originalPath: rowOriginalData.path,
                path: newPath,
                target: newTarget,
                name: newName,
                expiry: newExpiry || null,
                //enabled: newEnabled,
                //isWechat: newIsWechat,
                qrCodeData: serverData.qrCodeData // 使用服务器返回的原始二维码数据
            })
        });

        if (!updateResponse.ok) {
            const data = await updateResponse.json();
            showAlert(data.message || data.error || '更新失败，请重试');
            return;
        }

        showAlert('更新成功', 'success');
        
        // 不再刷新整个页面，而是重新加载表格数据
        await loadMappings();
        
        // 如果当前在过期或即将过期的视图中，重新加载相应的数据
        const expiringBtn = document.getElementById('showExpiringBtn');
        const expiredBtn = document.getElementById('showExpiredBtn');
        
        if (expiringBtn.classList.contains('btn-warning')) {
            await loadExpiringMappings('expiring');
        } else if (expiredBtn.classList.contains('btn-error')) {
            await loadExpiringMappings('expired');
        }
    } catch (error) {
        console.error('更新失败:', error);
        showAlert('更新失败，请检查网络连接后重试');
    }
}

function restoreRow(row) {
    const cells = row.cells;
    const originalData = JSON.parse(row.dataset.originalData);

    // 恢复各个单元格的内容
    cells[0].textContent = originalData.name || '-';
    cells[1].textContent = originalData.path;
    cells[2].textContent = originalData.target;
    cells[3].textContent = originalData.expiry || '永久有效';

    // 恢复状态列
    cells[4].innerHTML = `
        <div class="flex items-center gap-2">
            <span class="badge ${originalData.enabled ? 'badge-success' : 'badge-error'}">
                ${originalData.enabled ? '启用' : '禁用'}
            </span>
            ${originalData.isWechat ? '<span class="badge badge-info">微信</span>' : ''}
        </div>
    `;

    // 恢复按钮组
    const actionsCell = cells[5];
    actionsCell.innerHTML = `
        <div class="join">
            <button class="join-item btn btn-error btn-sm">删除</button>
            <button class="join-item btn btn-info btn-sm">查看</button>
        </div>
    `;

    // 重新绑定事件监听器
    const [ deleteBtn, qrBtn] = actionsCell.querySelectorAll('button');
    deleteBtn.onclick = () => deleteMapping(originalData.path);
    qrBtn.onclick = () => generateQRForMapping(window.location.origin + '/' + originalData.path, originalData.name, originalData.path);

    row.classList.remove('editing');
}

async function updateMapping(mapping) {
    try {
        const response = await fetch('/api/mapping', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mapping)
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const data = await response.json();
            showAlert(data.message || data.error || '更新失败，请重试');
            return;
        }

        showAlert('更新成功', 'success');
        location.reload();
    } catch (error) {
        console.error('更新短链二维码失败:', error);
        showAlert('更新失败，请检查网络连接后重试');
    }
}

// 修改 toggleTheme 函数
// function toggleTheme() {
//     const html = document.documentElement;
//     const currentTheme = localStorage.getItem('theme') || 'system';
//     let newTheme;

//     // 循环切换：system -> light -> dark -> system
//     switch (currentTheme) {
//         case 'system':
//             newTheme = 'light';
//             break;
//         case 'light':
//             newTheme = 'dark';
//             break;
//         case 'dark':
//             newTheme = 'system';
//             break;
//         default:
//             newTheme = 'system';
//     }

//     localStorage.setItem('theme', newTheme);

//     // 设置实际主题
//     if (newTheme === 'system') {
//         const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
//         html.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
//     } else {
//         html.setAttribute('data-theme', newTheme);
//     }

//     updateThemeIcon(newTheme);
// }

// function updateThemeIcon(theme) {
//     const iconPath = themeToggleBtn.querySelector('path');
//     switch (theme) {
//         case 'system':
//             // 显示系统图标（电脑显示器）
//             iconPath.setAttribute('d', 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z');
//             break;
//         case 'dark':
//             // 显示月亮图标
//             iconPath.setAttribute('d', 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z');
//             break;
//         case 'light':
//             // 显示太阳图标
//             iconPath.setAttribute('d', 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z');
//             break;
//     }
// }

// 添加系统主题变化监听
// window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
//     if (localStorage.getItem('theme') === 'system') {
//         document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
//     }
// });

// 初始化主题图标
//updateThemeIcon(localStorage.getItem('theme') || 'system');

let allMappings = [];
let currentPage = 1;
let pageSize = 10;

// 添加分页和每页显示数量的事件监听器
document.getElementById('nextPage').addEventListener('click', async () => {
    const expiringBtn = document.getElementById('showExpiringBtn');
    const expiredBtn = document.getElementById('showExpiredBtn');
    
    currentPage++;
    
    if (expiringBtn.classList.contains('btn-warning')) {
        await loadExpiringMappings('expiring');
    } else if (expiredBtn.classList.contains('btn-error')) {
        await loadExpiringMappings('expired');
    } else {
        await loadMappings();
    }
});

document.getElementById('prevPage').addEventListener('click', async () => {
    if (currentPage > 1) {
        currentPage--;
        const expiringBtn = document.getElementById('showExpiringBtn');
        const expiredBtn = document.getElementById('showExpiredBtn');
        
        if (expiringBtn.classList.contains('btn-warning')) {
            await loadExpiringMappings('expiring');
        } else if (expiredBtn.classList.contains('btn-error')) {
            await loadExpiringMappings('expired');
        } else {
            await loadMappings();
        }
    }
});

document.getElementById('pageSize').addEventListener('change', async (e) => {
    pageSize = parseInt(e.target.value);
    currentPage = 1;
    
    // 根据当前视图状态重新加载数据
    const expiringBtn = document.getElementById('showExpiringBtn');
    const expiredBtn = document.getElementById('showExpiredBtn');
    
    if (expiringBtn.classList.contains('btn-warning')) {
        await loadExpiringMappings('expiring');
    } else if (expiredBtn.classList.contains('btn-error')) {
        await loadExpiringMappings('expired');
    } else {
        await loadMappings();
    }
});

async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            showAlert('登出失败，请重试');
            return;
        }

        window.location.href = '/login';
    } catch (error) {
        console.error('登出失败:', error);
        showAlert('登出失败，请检查网络连接后重试');
    }
}

// 添加加载即将过期映射的函数
async function loadExpiringMappings(type) {
    const tableBody = document.getElementById('mappingsTableBody');
    const skeleton = document.getElementById('skeleton');

    // 显示骨架屏，隐藏表格内容
    tableBody.style.display = 'none';
    skeleton.classList.remove('hidden');

    try {
        const response = await fetch(`/api/expiring-mappings?page=${currentPage}&pageSize=${pageSize}`);

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await response.json();
        
        // 获取今天的日期（去除时间部分）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 根据类型和过期时间筛选数据
        const mappingsArray = data[type];
        
        // 确保日期比较的准确性
        mappingsArray.forEach(mapping => {
            const expiryDate = new Date(mapping.expiry);
            expiryDate.setHours(0, 0, 0, 0); // 只比较日期部分
            mapping.isExpired = expiryDate < today;
        });
        
        // 根据类型过滤数据
        const filteredMappings = type === 'expired' 
            ? mappingsArray.filter(m => m.isExpired)
            : mappingsArray.filter(m => !m.isExpired);
            
        const total = filteredMappings.length;
        
        // 计算当前页的数据
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, total);
        const currentPageData = filteredMappings.slice(start, end);
        
        // 清空表格
        tableBody.innerHTML = '';
        
        // 渲染当前页数据
        currentPageData.forEach(mapping => {
            const row = createMappingRow(mapping.path, {
                name: mapping.name,
                target: mapping.target,
                expiry: mapping.expiry,
                enabled: mapping.enabled,
                isWechat: mapping.isWechat,
                qrCodeData: mapping.qrCodeData
            });
            tableBody.appendChild(row);
        });

        // 更新分页信息
        const totalPages = Math.ceil(total / pageSize);
        document.getElementById('currentPage').textContent = currentPage;
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages || total === 0;

    } catch (error) {
        console.error('加载数据失败:', error);
        showAlert('加载数据失败，请刷新页面重试');
    } finally {
        skeleton.classList.add('hidden');
        tableBody.style.display = '';
    }
}

// 在页面加载时初始化二维码设置
document.addEventListener('DOMContentLoaded', function() {
    // 初始化二维码设置
    const savedShowLogo = localStorage.getItem('qr-show-logo');
    const savedDotsStyle = localStorage.getItem('qr-dots-style');
    
    // 设置显示logo复选框
    if (savedShowLogo !== null) {
        document.getElementById('qr-show-logo').checked = savedShowLogo === 'true';
    }
    
    // 设置点样式下拉框
    if (savedDotsStyle) {
        document.getElementById('qr-dots-style').value = savedDotsStyle;
    }
    
    // 添加设置变更监听器
    document.getElementById('qr-show-logo').addEventListener('change', function(e) {
        localStorage.setItem('qr-show-logo', e.target.checked);
        // 如果二维码已经显示，则更新二维码
        if (qrCode) {
            updateQRCode();
        }
    });
    
    document.getElementById('qr-dots-style').addEventListener('change', function(e) {
        localStorage.setItem('qr-dots-style', e.target.value);
        // 如果二维码已经显示，则更新二维码
        if (qrCode) {
            updateQRCode();
        }
    });
});

// 更新生成二维码的函数，使用保存的设置
function updateQRCode() {
    const url = document.getElementById('qr-url').value;
    const showLogo = document.getElementById('qr-show-logo').checked;
    const dotsStyle = document.getElementById('qr-dots-style').value;
    
    const options = {
        width: 240,
        height: 240,
        data: url,
        margin: 10,
        qrOptions: {
            typeNumber: 0,
            mode: 'Byte',
            errorCorrectionLevel: 'H'
        },
        imageOptions: {
            hideBackgroundDots: true,
            imageSize: 0.4,
            margin: 4
        },
        dotsOptions: {
            type: dotsStyle,
            color: '#000000'
        },
        backgroundOptions: {
            color: '#ffffff'
        }
    };

    if (showLogo) {
        options.image = '/wechat.svg';
    }

    // 如果已经存在二维码实例，先移除旧的
    if (qrCode) {
        const container = document.getElementById('qr-container');
        container.classList.add('switching');
        
        setTimeout(() => {
            qrCode.update(options);
            container.classList.remove('switching');
        }, 200);
    } else {
        qrCode = new QRCodeStyling(options);
        qrCode.append(document.getElementById('qr-container'));
    }
}

// 修改二维码识别函数
async function decodeQRCode(file) {
    try {
        // 创建新的解码器实例
        const codeReader = new ZXing.BrowserMultiFormatReader();
        
        // 将文件转换为 base64
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
        
        // 创建图片元素
        const img = new Image();
        img.src = base64;
        
        // 等待图片加载
        await new Promise((resolve) => {
            img.onload = resolve;
        });
        
        // 创建 canvas 并绘制图片
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // 从 canvas 获取图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 使用图像数据解码
        const result = await codeReader.decodeFromImageData(imageData);
        
        // 清理资源
        canvas.remove();
        img.remove();
        
        // 生成时间戳短链
        const timestamp = new Date().getTime();
        const shortLink = `q${timestamp}`;
        
        // 设置短链和目标URL
        const newPathInput = document.getElementById('newPath');
        const newTargetInput = document.getElementById('newTarget');
        newPathInput.value = shortLink;
        newTargetInput.value = result.text;
        
        // 显示结果区域
        document.getElementById('qr-result').classList.remove('hidden');
        
        // 启用微信二维码开关
        const wechatToggle = document.getElementById('newIsWechat');
        wechatToggle.disabled = false;
        
        showAlert('二维码识别成功', 'success');
        
        return result.text;
    } catch (error) {
        console.error('二维码识别错误:', error);
        
        // 检查错误类型
        if (error.message.includes('No MultiFormat Readers')) {
            showAlert('无法识别二维码，请确保：\n1. 图片清晰\n2. 二维码完整\n3. 图片格式正确', 'error');
        } else if (error.message.includes('No image was provided')) {
            showAlert('请选择有效的图片文件', 'error');
        } else {
            showAlert('二维码识别失败，请重试', 'error');
        }
        
        // 重置上传区域
        resetUploadArea();
        return null;
    }
}

// 添加重置上传区域的函数
function resetUploadArea() {
    const uploadArea = document.getElementById('qr-upload-area');
    const resultArea = document.getElementById('qr-result');
    const fileInput = document.getElementById('qr-file');
    
    // 重置文件输入
    fileInput.value = '';
    
    // 隐藏结果区域
    resultArea.classList.add('hidden');
    
    // 恢复上传区域的样式
    uploadArea.classList.remove('bg-base-200');
    uploadArea.innerHTML = '<p class="text-lg">点击上传或拖拽二维码图片到此处</p>';
}

// 修改文件上传处理函数
function handleFileUpload(file) {
    const uploadArea = document.getElementById('qr-upload-area');
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
        showAlert('请上传图片文件', 'error');
        return;
    }
    
    // 检查文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
        showAlert('图片大小不能超过5MB', 'error');
        return;
    }
    
    // 显示加载状态
    uploadArea.innerHTML = '<span class="loading loading-spinner loading-lg"></span>';
    uploadArea.classList.add('bg-base-200');
    
    // 解码二维码
    decodeQRCode(file).finally(() => {
        // 恢复上传区域样式
        uploadArea.classList.remove('bg-base-200');
        uploadArea.innerHTML = '<p class="text-lg">点击上传或拖拽二维码图片到此处</p>';
    });
}

// 修改重置表单的函数
function resetForm() {
    // 清空输入框
    document.getElementById('newName').value = '';
    document.getElementById('newPath').value = '';
    document.getElementById('newTarget').value = '';
    document.getElementById('newExpiry').value = ''; 
    
    // 重置开关状态
    //document.getElementById('newEnabled').checked = true;
    //document.getElementById('newIsWechat').checked = false;
    //document.getElementById('newIsWechat').disabled = true;
    
    // 清空二维码数据
    document.getElementById('qrCodeData').value = '';
    document.getElementById('qr-result').classList.add('hidden');
}

// 加载广告
async function loadAds() {
    try {
        console.log('开始加载广告...');
        const response = await fetch('/api/ads');
        if (!response.ok) {
            throw new Error('加载广告失败');
        }
        const ads = await response.json();
        console.log('获取到的广告数据:', ads);
        
        // 按位置分类广告
        const adsByPosition = {
            top: [],
            middle: [],
            bottom: []
        };
        
        // 收集所有启用的广告
        ads.forEach(ad => {
            if (ad.enabled && adsByPosition[ad.position]) {
                console.log(`添加广告到位置 ${ad.position}:`, ad);
                adsByPosition[ad.position].push(ad);
            }
        });
        
        // 显示广告
        function showAds(containerId, position) {
            const container = document.getElementById(containerId);
            const positionAds = adsByPosition[position];
            console.log(`显示位置 ${position} 的广告:`, positionAds);
            
            if (positionAds && positionAds.length > 0) {
                // 为每个广告添加样式和间距
                container.innerHTML = positionAds.map(ad => `
                    <div class="ad-item mb-2 last:mb-0">
                        ${ad.content}
                    </div>
                `).join('');
                container.style.display = 'block';
                console.log(`位置 ${position} 的广告已显示`);
            } else {
                //container.style.display = 'none';
                console.log(`位置 ${position} 没有广告`);
            }
        }
        
        // 显示各个位置的广告
        showAds('ad-top', 'top');
        showAds('ad-middle', 'middle');
        showAds('ad-bottom', 'bottom');
        
    } catch (error) {
        console.error('加载广告失败:', error);
    }
}

// 在显示二维码模态框时加载广告
document.getElementById('qr-modal').addEventListener('show', () => {
    console.log('二维码模态框显示，开始加载广告...');
    loadAds();
});
