// TikTok OAuth Backend - Production Ready
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ===== 安全中间件 =====
app.use(cors({
    origin: 'https://xmansea51-web.github.io',
    credentials: true
}));

app.use(express.json());

// ===== TikTok 配置（从环境变量读取） =====
const TIKTOK_CONFIG = {
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    redirect_uri: 'https://xmansea51-web.github.io/callback/'  // 保持一致
};

// ===== 健康检查 =====
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'tiktok-auth-backend',
        time: new Date().toISOString()
    });
});

// ===== 用 code 换 token =====
app.post('/api/auth/token', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'Authorization code missing'
        });
    }

    try {
        // 1. 用 code 换 token
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
                message: tokenData.error_description || tokenData.error
            });
        }

        // 2. 获取用户信息
        const userResponse = await axios.get(
            'https://open.tiktokapis.com/v2/user/info/',
            {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`
                },
                params: {
                    fields: 'open_id,display_name,avatar_url'
                }
            }
        );

        const userData = userResponse.data.data?.user || {};

        // 3. 返回数据
        res.json({
            success: true,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            user: {
                open_id: tokenData.open_id,
                name: userData.display_name || 'TikTok用户',
                avatar: userData.avatar_url || 'data:image/svg+xml,%3Csvg...'
            }
        });

    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);

        res.status(500).json({
            success: false,
            message: 'Token exchange failed',
            error: error.response?.data || error.message
        });
    }
});

// ===== 刷新 token =====
app.post('/api/auth/refresh', async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({
            success: false,
            message: 'Refresh token missing'
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});