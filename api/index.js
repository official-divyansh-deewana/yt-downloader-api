module.exports = async (req, res) => {
    // 1. Headers Setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Advanced Query Parsing (Fix for ?= format)
    // req.url typical format: "/?=https://youtu.be/xxx"
    const rawUrl = req.url || "";
    let youtubeUrl = "";

    if (rawUrl.includes('?=')) {
        // Ham 'index' ka use karenge taaki standard parsing fail na ho
        youtubeUrl = rawUrl.substring(rawUrl.indexOf('=') + 1);
    } else if (rawUrl.includes('?url=')) {
        youtubeUrl = rawUrl.split('?url=')[1];
    }

    // Agar url abhi bhi khali hai (Try searching in searchParams)
    if (!youtubeUrl) {
        try {
            const parsedUrl = new URL(rawUrl, `https://${req.headers.host}`);
            youtubeUrl = parsedUrl.searchParams.get('url') || "";
        } catch (e) {
            youtubeUrl = "";
        }
    }

    // Decoding URL (Important for special characters)
    youtubeUrl = decodeURIComponent(youtubeUrl).trim();

    if (!youtubeUrl || !youtubeUrl.startsWith('http')) {
        return res.status(400).json({
            success: false,
            message: "YouTube link required! Use format: /?=https://youtu.be/xxxx",
            debug_received_url: youtubeUrl || "none",
            developer: "Divyansh Deewana"
        });
    }

    try {
        // 3. Hitting the Downloader Proxy
        const apiResponse = await fetch('https://app.ytdown.to/proxy.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://app.ytdown.to/',
                'Origin': 'https://app.ytdown.to'
            },
            body: new URLSearchParams({ url: youtubeUrl })
        });

        const data = await apiResponse.json();

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

            // 4. Extract Video ID for Thumbnail
            const videoIdMatch = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandaymq\?v=))([\w-]{11})/);
            const videoId = videoIdMatch ? videoIdMatch[1] : "";

            return res.status(200).json({
                success: true,
                video_info: {
                    title: data.api.title || "YouTube Video",
                    thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "",
                    videoId: videoId,
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
                message: "No download links found. Video may be restricted.",
                apiOwner: "Divyansh Deewana"
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: "Backend Error",
            message: error.message
        });
    }
};
