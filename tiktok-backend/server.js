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
    redirect_uri: 'https://xmansea51-web.github.io/index.html'
};

// ===== 健康检查（Render 必备） =====
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'tiktok-auth-backend',
        time: new Date().toISOString()
    });
});

// ===== 获取授权 URL（可选） =====
app.get('/api/auth/url', (req, res) => {
    const url =
        'https://www.tiktok.com/v2/auth/authorize/?' +
        'client_key=' + TIKTOK_CONFIG.client_key +
        '&scope=user.info.profile' +
        '&response_type=code' +
        '&redirect_uri=' + encodeURIComponent(TIKTOK_CONFIG.redirect_uri) +
        '&state=game_login';

    res.json({ url });
});

// ===== 用 code 换 token（核心接口） =====
app.post('/api/auth/token', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'Authorization code missing'
        });
    }

    try {
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
                message: tokenData.error_description
            });
        }

        // 获取用户信息
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

        const user = userResponse.data.data.user;

        res.json({
            success: true,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            user: {
                open_id: tokenData.open_id,
                name: user.display_name,
                avatar: user.avatar_url
            }
        });

    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);

        res.status(500).json({
            success: false,
            message: 'Token exchange failed'
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

// ===== 启动服务器 =====
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
