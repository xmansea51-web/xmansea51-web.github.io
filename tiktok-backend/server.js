// server.js - TikTok OAuth 后端服务
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
    origin: 'https://xmansea51-web.github.io', // 只允许您的游戏域名
    credentials: true
}));
app.use(express.json());

// TikTok 配置
const TIKTOK_CONFIG = {
    client_key: process.env.TIKTOK_CLIENT_KEY || 'awrjc36v2o7a2owa',
    client_secret: process.env.TIKTOK_CLIENT_SECRET, // 从 .env 读取
    redirect_uri: 'https://xmansea51-web.github.io/index.html'
};

// ===== 1. 生成授权URL（可选，前端也可以自己拼） =====
app.get('/api/auth/url', (req, res) => {
    const authUrl = 'https://www.tiktok.com/v2/auth/authorize/?' +
        'client_key=' + TIKTOK_CONFIG.client_key +
        '&scope=user.info.profile' +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(TIKTOK_CONFIG.redirect_uri) +
        '&state=game_login';
    
    res.json({ url: authUrl });
});

// ===== 2. 用 code 换取 access_token（核心接口） =====
app.post('/api/auth/token', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ 
            success: false, 
            error: 'missing_code',
            message: 'Authorization code is required' 
        });
    }
    
    try {
        console.log('Exchanging code for token...');
        
        // 调用 TikTok OAuth API 换取 token
        const tokenResponse = await axios.post(
            'https://open.tiktokapis.com/v2/oauth/token/',
            new URLSearchParams({
                client_key: TIKTOK_CONFIG.client_key,
                client_secret: TIKTOK_CONFIG.client_secret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: TIKTOK_CONFIG.redirect_uri
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        const tokenData = tokenResponse.data;
        
        if (tokenData.error) {
            return res.status(400).json({
                success: false,
                error: tokenData.error,
                message: tokenData.error_description
            });
        }
        
        // 用 access_token 获取用户信息
        const userResponse = await axios.get(
            'https://open.tiktokapis.com/v2/user/info/',
            {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`
                },
                params: {
                    fields: 'open_id,display_name,avatar_url'
                }
            }
        );
        
        const userData = userResponse.data.data.user;
        
        // 返回给前端
        res.json({
            success: true,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            user: {
                open_id: tokenData.open_id,
                name: userData.display_name,
                avatar: userData.avatar_url
            }
        });
        
    } catch (error) {
        console.error('Token exchange error:', error.response?.data || error.message);
        
        // 给前端友好的错误信息
        res.status(500).json({
            success: false,
            error: 'server_error',
            message: 'Failed to exchange token. Please try again.'
        });
    }
});

// ===== 3. 刷新 token（可选，用于长期登录） =====
app.post('/api/auth/refresh', async (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
        return res.status(400).json({ 
            success: false, 
            message: 'Refresh token required' 
        });
    }
    
    try {
        const response = await axios.post(
            'https://open.tiktokapis.com/v2/oauth/token/',
            new URLSearchParams({
                client_key: TIKTOK_CONFIG.client_key,
                client_secret: TIKTOK_CONFIG.client_secret,
                refresh_token: refresh_token,
                grant_type: 'refresh_token'
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        res.json({
            success: true,
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_in: response.data.expires_in
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Refresh failed' 
        });
    }
});

// ===== 4. 健康检查 =====
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'TikTok Auth Backend'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`✅ TikTok Auth Server running on port ${PORT}`);
    console.log(`🌍 Health check: http://localhost:${PORT}/api/health`);
});