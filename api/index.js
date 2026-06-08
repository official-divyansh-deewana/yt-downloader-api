const axios = require('axios');

module.exports = async (req, res) => {
    // 1. Headers Setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. ULTIMATE URL EXTRACTION (Fix for Vercel/Android)
    let youtubeUrl = "";
    
    // Sabse pehle pura URL nikalna (Original URL headers se)
    const fullUrl = req.headers['x-now-route-matches'] || req.url || "";
    
    // Check Case 1: /?=https://...
    if (fullUrl.includes('?=')) {
        youtubeUrl = fullUrl.substring(fullUrl.indexOf('?=') + 2);
    } 
    // Check Case 2: Standard Query ?url=...
    else if (fullUrl.includes('?url=')) {
        youtubeUrl = fullUrl.split('?url=')[1];
    }
    // Check Case 3: Vercel req.query (Empty key)
    else if (req.query && req.query['']) {
        youtubeUrl = req.query[''];
    }

    // Cleaning and Decoding
    youtubeUrl = decodeURIComponent(youtubeUrl).trim();

    // Debugging (Taaki aapko dikhe ki server ko kya mila)
    if (!youtubeUrl || !youtubeUrl.startsWith('http')) {
        return res.status(400).json({
            success: false,
            message: "YouTube link required!",
            format_needed: "/?=https://www.youtube.com/watch?v=xxxx",
            received_url_debug: youtubeUrl || "empty",
            server_path_debug: fullUrl,
            developer: "Divyansh Deewana"
        });
    }

    try {
        // 3. Hitting the Proxy Backend
        const apiResponse = await axios.post('https://app.ytdown.to/proxy.php', 
            new URLSearchParams({ url: youtubeUrl }).toString(), 
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://app.ytdown.to/',
                    'Origin': 'https://app.ytdown.to'
                },
                timeout: 15000 // 15 seconds timeout
            }
        );

        const data = apiResponse.data;

        if (data && data.api && data.api.mediaItems) {
            const videoLinks = [];
            const audioLinks = [];

            data.api.mediaItems.forEach(item => {
                const quality = item.mediaRes ? item.mediaRes.split('x')[1] + 'p' : (item.mediaQuality || "N/A");
                const format = {
                    quality: quality,
                    extension: item.mediaExtension || (item.type === 'Audio' ? 'mp3' : 'mp4'),
                    size: item.mediaFileSize || 'Unknown',
                    downloadUrl: item.mediaUrl.startsWith('http') ? item.mediaUrl : 'https:' + item.mediaUrl
                };

                if (item.type === 'Audio') {
                    audioLinks.push(format);
                } else {
                    videoLinks.push(format);
                }
            });

            // Extract Video ID for Thumbnail
            const videoIdMatch = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandaymq\?v=))([\w-]{11})/);
            const videoId = videoIdMatch ? videoIdMatch[1] : "";

            return res.status(200).json({
                success: true,
                video_info: {
                    title: data.api.title || "YouTube Video",
                    thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "",
                    duration: data.api.mediaItems[0]?.mediaDuration || "Unknown"
                },
                links: {
                    video: videoLinks,
                    audio: audioLinks
                },
                developer: "Divyansh Deewana",
                tg: "@tera_paglu"
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "Download links not found for this video.",
                apiOwner: "Divyansh Deewana"
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: "Backend Fetch Error",
            message: error.message
        });
    }
};
