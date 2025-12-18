import { Router } from 'express';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const AVATAR_AGENT_URL = process.env.AVATAR_AGENT_URL || 'http://localhost:8019';

/**
 * Avatar Teacher Agent Routes
 */

// Health check
router.get('/health', async (req, res) => {
    try {
        const response = await axios.get(`${AVATAR_AGENT_URL}/health`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Synthesize speech from text
router.post('/synthesize-speech', async (req, res) => {
    try {
        const { text, language = 'en', speed = 1.0, voice_type = 'neutral' } = req.body;

        const response = await axios.post(`${AVATAR_AGENT_URL}/api/synthesize-speech`, {
            text,
            language,
            speed,
            voice_type
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get audio file
router.get('/audio/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const response = await axios.get(`${AVATAR_AGENT_URL}/api/audio/${filename}`, {
            responseType: 'stream'
        });

        res.setHeader('Content-Type', 'audio/mpeg');
        response.data.pipe(res);
    } catch (error) {
        res.status(404).json({ error: 'Audio file not found' });
    }
});

// Present lesson with avatar
router.post('/present-lesson/:lessonId', async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { content, language = 'en', voice_type = 'neutral', speed = 1.0 } = req.body;

        const response = await axios.post(`${AVATAR_AGENT_URL}/api/present-lesson`, {
            lesson_id: parseInt(lessonId),
            content,
            language,
            voice_type,
            speed
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available gestures
router.get('/gestures', async (req, res) => {
    try {
        const response = await axios.get(`${AVATAR_AGENT_URL}/api/avatar/gestures`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available emotions
router.get('/emotions', async (req, res) => {
    try {
        const response = await axios.get(`${AVATAR_AGENT_URL}/api/avatar/emotions`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Customize avatar preferences
router.post('/customize', async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id || req.body.user_id;
        const {
            avatar_model = 'default_teacher',
            voice_type = 'neutral',
            voice_speed = 1.0,
            language = 'en',
            gesture_enabled = true,
            subtitle_enabled = true
        } = req.body;

        const response = await axios.post(`${AVATAR_AGENT_URL}/api/avatar/customize`, {
            user_id: userId,
            avatar_model,
            voice_type,
            voice_speed,
            language,
            gesture_enabled,
            subtitle_enabled
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available avatar models
router.get('/models', async (req, res) => {
    try {
        const response = await axios.get(`${AVATAR_AGENT_URL}/api/avatar/models`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get avatar stats
router.get('/stats', async (req, res) => {
    try {
        const response = await axios.get(`${AVATAR_AGENT_URL}/api/stats`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
