export default async function handler(req, res) {
    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    // URL se ?=https://... wala part nikalna
    const urlObj = new URL(req.url, `https://${req.headers.get('host')}`);
    const fullQuery = urlObj.search.substring(1);
    let youtubeUrl = fullQuery.startsWith('=') ? fullQuery.substring(1) : urlObj.searchParams.get('url');

    if (!youtubeUrl) {
        return new Response(JSON.stringify({
            success: false,
            message: "YouTube link required! Example: ?=https://youtu.be/xxxx",
            apiOwner: "Divyansh Deewana"
        }), { status: 400, headers });
    }

    try {
        // Step 1: Extract Video ID safely
        let videoId = "";
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = youtubeUrl.match(regExp);
        videoId = (match && match[7].length == 11) ? match[7] : "";

        // Step 2: Hit the Downloader Proxy
        const apiResponse = await fetch('https://app.ytdown.to/proxy.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://app.ytdown.to/'
            },
            body: new URLSearchParams({ url: youtubeUrl })
        });

        const data = await apiResponse.json();

        if (!data || !data.api || !data.api.mediaItems) {
            return new Response(JSON.stringify({
                success: false,
                message: "No media items found for this video.",
                apiOwner: "Divyansh Deewana"
            }), { status: 200, headers });
        }

        const videoLinks = [];
        const audioLinks = [];

        // Step 3: Parse Links
        data.api.mediaItems.forEach(item => {
            const format = {
                quality: item.mediaQuality || (item.mediaRes ? item.mediaRes.split('x')[1] + 'p' : 'Unknown'),
                extension: item.mediaExtension || (item.type === 'Audio' ? 'mp3' : 'mp4'),
                size: item.mediaFileSize || 'N/A',
                downloadUrl: item.mediaUrl.startsWith('http') ? item.mediaUrl : 'https:' + item.mediaUrl
            };

            if (item.type === 'Audio') {
                audioLinks.push(format);
            } else {
                videoLinks.push(format);
            }
        });

        // Step 4: Final Success Response
        return new Response(JSON.stringify({
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
            developer: "Divyansh Deewana",
            channel: "https://t.me/tera_paglu"
        }), { status: 200, headers });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: "System busy or IP Blocked by provider.",
            debug: error.message
        }), { status: 500, headers });
    }
}
