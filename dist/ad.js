// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 检查登录状态
    const cookie = document.cookie;
    console.log('页面加载时的Cookie:', cookie);
    const authCookie = cookie.split(';').find(c => c.trim().startsWith('auth='));
    console.log('找到的auth cookie:', authCookie);
    const authValue = authCookie ? authCookie.split('=')[1].trim() : null;
    console.log('提取的auth值:', authValue);

    if (!authValue) {
        console.log('未检测到登录状态，跳转到登录页面');
        window.location.href = '/login.html';
        return;
    }

    // 加载广告列表
    loadAds();
});

// 加载广告列表
async function loadAds() {
    try {
        console.log('开始加载广告列表...');
        const response = await fetch('/api/ads');
        console.log('广告列表响应:', response);
        
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '加载广告失败');
        }

        const data = await response.json();
        console.log('广告列表数据:', data);
        
        // 确保 data 是数组
        const ads = Array.isArray(data) ? data : [];
        renderAds(ads);
    } catch (error) {
        console.error('加载广告失败:', error);
        showAlert('加载广告失败，请刷新页面重试');
    }
}

// 渲染广告列表
function renderAds(ads) {
    const tbody = document.getElementById('adsTableBody');
    tbody.innerHTML = '';

    ads.forEach(ad => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${ad.id}</td>
            <td>${getPositionText(ad.position)}</td>
            <td class="max-w-xs truncate">${ad.content}</td>
            <td>
                <span class="badge ${ad.enabled ? 'badge-success' : 'badge-error'}">
                    ${ad.enabled ? '启用' : '禁用'}
                </span>
            </td>
            <td>${formatDate(ad.created_at)}</td>
            <td>
                <div class="join">
                    <button class="join-item btn btn-warning btn-sm" onclick="showEditAdModal(${ad.id})">编辑</button>
                    <button class="join-item btn btn-error btn-sm" onclick="showDeleteModal(${ad.id})">删除</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 获取位置文本
function getPositionText(position) {
    const positions = {
        'top': '顶部',
        'middle': '中间',
        'bottom': '底部'
    };
    return positions[position] || position;
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 显示添加广告模态框
function showAddAdModal() {
    document.getElementById('modal-title').textContent = '添加广告';
    document.getElementById('ad-id').value = '';
    document.getElementById('ad-position').value = 'top';
    document.getElementById('ad-content').value = '';
    document.getElementById('ad-enabled').checked = true;
    document.getElementById('ad-modal').showModal();
}

// 显示编辑广告模态框
async function showEditAdModal(id) {
    try {
        const response = await fetch(`/api/ad/${id}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '获取广告信息失败');
        }

        const ad = await response.json();
        if (!ad) {
            throw new Error('广告不存在');
        }
        
        document.getElementById('modal-title').textContent = '编辑广告';
        document.getElementById('ad-id').value = ad.id;
        document.getElementById('ad-position').value = ad.position;
        document.getElementById('ad-content').value = ad.content;
        document.getElementById('ad-enabled').checked = ad.enabled;
        
        document.getElementById('ad-modal').showModal();
    } catch (error) {
        console.error('获取广告信息失败:', error);
        showAlert(error.message || '获取广告信息失败，请重试');
    }
}

// 关闭广告模态框
function closeAdModal() {
    document.getElementById('ad-modal').close();
}

// 处理广告表单提交
async function handleAdSubmit(event) {
    event.preventDefault();
    
    const id = document.getElementById('ad-id').value;
    const position = document.getElementById('ad-position').value;
    const content = document.getElementById('ad-content').value;
    const enabled = document.getElementById('ad-enabled').checked;
    
    try {
        const adData = {
            id: id || undefined,
            position,
            content,
            enabled
        };
        
        console.log('准备发送广告数据:', adData);

        const response = await fetch('/api/ad', {
            method: id ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adData)
        });

        console.log('服务器响应状态:', response.status);
        const result = await response.json();
        console.log('服务器响应数据:', result);

        if (!response.ok) {
            throw new Error(result.error || '保存广告失败');
        }

        showAlert('保存成功', 'success');
        closeAdModal();
        loadAds();
    } catch (error) {
        console.error('保存广告失败:', error);
        showAlert(error.message || '保存广告失败，请重试');
    }
}

// 显示删除确认模态框
function showDeleteModal(id) {
    const modal = document.getElementById('delete-modal');
    const confirmBtn = document.getElementById('confirm-delete');
    
    confirmBtn.onclick = async () => {
        try {
            console.log('准备删除广告:', id);
            const response = await fetch('/api/ad', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id })
            });

            console.log('删除响应状态:', response.status);
            const result = await response.json();
            console.log('删除响应数据:', result);

            if (!response.ok) {
                throw new Error(result.error || '删除广告失败');
            }

            showAlert('删除成功', 'success');
            closeDeleteModal();
            loadAds();
        } catch (error) {
            console.error('删除广告失败:', error);
            showAlert(error.message || '删除广告失败，请重试');
        }
    };
    
    modal.showModal();
}

// 关闭删除确认模态框
function closeDeleteModal() {
    document.getElementById('delete-modal').close();
}

// 显示提示框
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

// 退出登录
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