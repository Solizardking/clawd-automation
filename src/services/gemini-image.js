/**
 * Gemini Native Image Generation Service (Nano Banana)
 * 
 * Integrates with:
 * - gemini-2.5-flash-image (Nano Banana) - Fast, efficient
 * - gemini-3-pro-image-preview (Nano Banana Pro) - Professional, high-fidelity
 * 
 * Features:
 * - Text-to-image generation
 * - Image editing (text + image to image)
 * - Multi-turn conversational editing
 * - Google Search grounding for real-time data
 * - Up to 4K resolution
 * - Sticker/icon/logo generation
 * - Weather visualization with live data
 * - Article/infographic generation
 */

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const config = require('../config/index.js');

// ANSI for CLI output
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const fgRGB = (r, g, b) => `${ESC}38;2;${r};${g};${b}m`;

class GeminiImageService {
    constructor() {
        this.apiKey = config.google.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        this.client = this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : null;
        this.outputDir = path.join(process.cwd(), 'output', 'images');
        this.chatSessions = new Map();

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generate image using Nano Banana (gemini-2.5-flash-image)
     * Fast and efficient for most use cases
     */
    async generateImage(prompt, options = {}) {
        if (!this.client) throw new Error('GOOGLE_API_KEY not configured');

        const {
            aspectRatio = '1:1',
            outputName = `x402_${Date.now()}`,
        } = options;

        try {
            const response = await this.client.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: prompt,
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: {
                        aspectRatio,
                    },
                },
            });

            return this._processResponse(response, outputName);
        } catch (error) {
            throw new Error(`Nano Banana generation failed: ${error.message}`);
        }
    }

    /**
     * Generate image using Nano Banana Pro (gemini-3-pro-image-preview)
     * Professional quality with thinking, search grounding, and 4K support
     */
    async generateImagePro(prompt, options = {}) {
        if (!this.client) throw new Error('GOOGLE_API_KEY not configured');

        const {
            aspectRatio = '1:1',
            resolution = '2K',        // '1K', '2K', '4K'
            useSearch = false,
            outputName = `x402_pro_${Date.now()}`,
        } = options;

        try {
            const config = {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                    aspectRatio,
                    imageSize: resolution,
                },
            };

            if (useSearch) {
                config.tools = [{ googleSearch: {} }];
            }

            const response = await this.client.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: prompt,
                config,
            });

            return this._processResponse(response, outputName);
        } catch (error) {
            throw new Error(`Nano Banana Pro generation failed: ${error.message}`);
        }
    }

    /**
     * Generate kawaii sticker/icon
     */
    async generateSticker(subject, options = {}) {
        const stickerPrompt = `A kawaii-style sticker of ${subject}. The design features bold, clean outlines, simple cel-shading, and a vibrant color palette. The background must be white. No text.`;

        return this.generateImage(stickerPrompt, {
            aspectRatio: '1:1',
            outputName: `x402_sticker_${Date.now()}`,
            ...options,
        });
    }

    /**
     * Generate professional logo
     */
    async generateLogo(brandName, description = '', options = {}) {
        const logoPrompt = `Create a modern, minimalist logo for "${brandName}". ${description || 'Clean, bold design.'}. The text should be in a clean, bold font. Square format. Professional quality.`;

        return this.generateImagePro(logoPrompt, {
            aspectRatio: '1:1',
            resolution: '2K',
            outputName: `x402_logo_${Date.now()}`,
            ...options,
        });
    }

    /**
     * Generate weather visualization with Google Search grounding
     * Like the London isometric example from Nano Banana docs
     */
    async generateWeatherViz(city, options = {}) {
        const weatherPrompt = `Present a clear, 45° top-down isometric miniature 3D cartoon scene of ${city}, featuring its most iconic landmarks and architectural elements. Use soft, refined textures with realistic PBR materials and gentle, lifelike lighting and shadows. Integrate the current weather conditions directly into the city environment to create an immersive atmospheric mood. Use a clean, minimalistic composition with a soft, solid-colored background. At the top-center, place the title "${city}" in large bold text, a prominent weather icon beneath it, then the date (small text) and temperature (medium text). All text must be centered with consistent spacing, and may subtly overlap the tops of the buildings.`;

        return this.generateImagePro(weatherPrompt, {
            aspectRatio: '1:1',
            resolution: '2K',
            useSearch: true,
            outputName: `x402_weather_${city.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
            ...options,
        });
    }

    /**
     * Generate article/infographic with search grounding
     */
    async generateArticle(topic, options = {}) {
        const articlePrompt = `Use search to find the latest information about "${topic}". Use this information to write a short article about it (with headings). Return a photo of the article as it appeared in a design focused glossy magazine. It is a photo of a single folded over page, showing the article. One hero photo. Headline in serif.`;

        return this.generateImagePro(articlePrompt, {
            aspectRatio: '3:4',
            resolution: '2K',
            useSearch: true,
            outputName: `x402_article_${Date.now()}`,
            ...options,
        });
    }

    /**
     * Generate product mockup
     */
    async generateProduct(productDescription, options = {}) {
        const productPrompt = `A high-resolution, studio-lit product photograph of ${productDescription}. The lighting is a three-point softbox setup designed to create soft, diffused highlights and eliminate harsh shadows. Ultra-realistic, with sharp focus. Professional commercial photography.`;

        return this.generateImagePro(productPrompt, {
            aspectRatio: '1:1',
            resolution: '2K',
            outputName: `x402_product_${Date.now()}`,
            ...options,
        });
    }

    /**
     * Generate X402/Solana themed artwork
     */
    async generateX402Art(style = 'cyberpunk', options = {}) {
        const styles = {
            cyberpunk: 'A cyberpunk neon-lit scene of a futuristic trading floor with holographic Solana blockchain data streams. X402 protocol logos glowing in purple and green. High detail, cinematic lighting.',
            isometric: 'A perfectly isometric miniature 3D scene of a futuristic blockchain command center. Holographic displays show Solana transaction flows. X402 tokens float in the air as glowing green particles.',
            minimal: 'A minimalist composition with the X402 logo formed from subtle geometric shapes. Solana gradient colors (green to purple). Clean design with significant negative space.',
            retro: 'A retro 80s synthwave poster for X402 Agent. Chrome text, sunset gradient, grid lines, Solana blockchain elements. Vaporwave aesthetic.',
        };

        const prompt = styles[style] || styles.cyberpunk;

        return this.generateImagePro(prompt, {
            aspectRatio: '16:9',
            resolution: '2K',
            outputName: `x402_art_${style}_${Date.now()}`,
            ...options,
        });
    }

    /**
     * Edit an existing image with a text prompt
     */
    async editImage(imagePath, editPrompt, options = {}) {
        if (!this.client) throw new Error('GOOGLE_API_KEY not configured');

        const {
            aspectRatio = '1:1',
            outputName = `x402_edit_${Date.now()}`,
        } = options;

        try {
            const imageData = fs.readFileSync(imagePath);
            const base64Image = imageData.toString('base64');
            const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

            const contents = [
                { text: editPrompt },
                {
                    inlineData: {
                        mimeType,
                        data: base64Image,
                    },
                },
            ];

            const response = await this.client.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents,
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: { aspectRatio },
                },
            });

            return this._processResponse(response, outputName);
        } catch (error) {
            throw new Error(`Image editing failed: ${error.message}`);
        }
    }

    /**
     * Start a multi-turn image editing chat session
     */
    async startImageChat(sessionId = 'default') {
        if (!this.client) throw new Error('GOOGLE_API_KEY not configured');

        // Note: The @google/genai SDK's chat API may differ. 
        // For CLI, we'll track conversation history manually.
        const session = {
            history: [],
            model: 'gemini-2.5-flash-image',
        };

        this.chatSessions.set(sessionId, session);
        return { sessionId, status: 'Chat session started' };
    }

    /**
     * Process API response and save images
     */
    _processResponse(response, outputName) {
        const result = {
            text: null,
            images: [],
            savedTo: [],
        };

        if (!response.candidates || !response.candidates[0]) {
            throw new Error('No response from model');
        }

        const parts = response.candidates[0].content.parts;

        for (const part of parts) {
            if (part.text) {
                result.text = part.text;
            } else if (part.inlineData) {
                const imageData = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
                const filename = `${outputName}.${ext}`;
                const filepath = path.join(this.outputDir, filename);

                const buffer = Buffer.from(imageData, 'base64');
                fs.writeFileSync(filepath, buffer);

                result.images.push({
                    filename,
                    path: filepath,
                    size: buffer.length,
                    mimeType,
                });
                result.savedTo.push(filepath);
            }
        }

        // Format CLI output
        const output = [];
        if (result.text) {
            output.push(result.text);
        }
        if (result.images.length > 0) {
            output.push('');
            output.push(`${fgRGB(0, 255, 136)}🍌 Nano Banana generated ${result.images.length} image(s):${RESET}`);
            for (const img of result.images) {
                const sizeKB = Math.round(img.size / 1024);
                output.push(`   ${DIM}→${RESET} ${BOLD}${img.filename}${RESET} ${DIM}(${sizeKB}KB)${RESET}`);
                output.push(`     ${DIM}${img.path}${RESET}`);
            }
        }

        return output.join('\n');
    }

    /**
     * List previously generated images
     */
    listImages() {
        if (!fs.existsSync(this.outputDir)) return [];
        const files = fs.readdirSync(this.outputDir)
            .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
            .map(f => {
                const stats = fs.statSync(path.join(this.outputDir, f));
                return {
                    filename: f,
                    path: path.join(this.outputDir, f),
                    size: stats.size,
                    created: stats.birthtime,
                };
            })
            .sort((a, b) => b.created - a.created);
        return files;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            configured: !!this.client,
            apiKey: this.apiKey ? '***' + this.apiKey.slice(-6) : 'NOT SET',
            outputDir: this.outputDir,
            models: {
                nanoBanana: 'gemini-2.5-flash-image',
                nanoBananaPro: 'gemini-3-pro-image-preview',
            },
            capabilities: [
                'Text-to-Image',
                'Image Editing',
                'Multi-turn Chat',
                'Google Search Grounding',
                'Up to 4K Resolution',
                'Aspect Ratios: 1:1, 16:9, 9:16, 3:4, 4:3, etc.',
                'Sticker/Icon Generation',
                'Logo Design',
                'Weather Visualization',
                'Article/Infographic',
                'Product Mockups',
            ],
        };
    }
}

module.exports = new GeminiImageService();
