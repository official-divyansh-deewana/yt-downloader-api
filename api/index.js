// Native Node.js Fetch (Node 18+ supports this by default)
module.exports = async (req, res) => {
    // CORS Headers setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // URL Parsing Logic for Format: /?=https://youtube.com/...
    const fullUrl = req.url;
    let youtubeUrl = "";

    if (fullUrl.includes('?=')) {
        youtubeUrl = fullUrl.split('?=')[1];
    } else {
        const urlParams = new URL(fullUrl, `https://${req.headers.host}`);
        youtubeUrl = urlParams.searchParams.get('url');
    }

    if (!youtubeUrl) {
        return res.status(400).json({
            success: false,
            message: "YouTube link required! Example: https://yourdomain.app/?=https://youtu.be/xxxx",
            developer: "Divyansh Deewana"
        });
    }

    try {
        // Cleaning the URL
        youtubeUrl = decodeURIComponent(youtubeUrl);

        // Fetching from the downloader proxy
        const apiResponse = await fetch('https://app.ytdown.to/proxy.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://app.ytdown.to/'
            },
            body: new URLSearchParams({ url: youtubeUrl })
        });

        const data = await apiResponse.json();

        if (data && data.api && data.api.mediaItems) {
            const videoLinks = [];
            const audioLinks = [];

            data.api.mediaItems.forEach(item => {
                const format = {
                    quality: item.mediaRes ? item.mediaRes.split('x')[1] + 'p' : (item.mediaQuality || "N/A"),
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

            // Video ID extraction for Thumbnail
            const videoId = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandaymq\?v=))([\w-]{11})/)?.[1] || "";

            return res.status(200).json({
                success: true,
                video_info: {
                    title: data.api.title || "YouTube Video",
                    thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "",
                    videoId: videoId
                },
                links: {
                    video: videoLinks,
                    audio: audioLinks
                },
                developer: {
                    name: "Divyansh Deewana",
                    tg: "@tera_paglu"
                }
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "No download links found. The video might be private or unavailable.",
                apiOwner: "Divyansh Deewana"
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: "Internal Server Error or Proxy Blocked.",
            details: error.message
        });
    }
};
