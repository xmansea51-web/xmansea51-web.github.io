// ========== 修改 game.handleTikTokCallback() 部分 ==========

// TikTok回调处理 - 真实code处理，调用后端换取token
handleTikTokCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || state !== "game_login") return;

    // 显示正在处理
    this.showToast("🔄 正在登录...");
    
    // 调用后端API换取真实token
    this.exchangeTokenWithBackend(code);
    
    // 清除URL参数
    window.history.replaceState({}, document.title, window.location.pathname);
},

// 调用后端换取真实token
async exchangeTokenWithBackend(code) {
    try {
        // 替换为您的后端API地址
        const response = await fetch('https://your-backend.com/api/tiktok/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 保存真实的access_token和用户信息
            localStorage.setItem('tiktok_access_token', data.access_token);
            localStorage.setItem('tiktok_user', JSON.stringify(data.user));
            localStorage.setItem('tiktok_refresh_token', data.refresh_token);
            
            this.showLoginSuccess(data.user);
            this.showToast("✅ 登录成功");
        } else {
            this.showToast("❌ 登录失败: " + data.message);
        }
    } catch (error) {
        console.error('Token exchange failed:', error);
        this.showToast("❌ 网络错误，请重试");
    }
}