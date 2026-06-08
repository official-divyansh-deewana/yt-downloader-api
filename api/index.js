const axios = require('axios');

module.exports = async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // Handling ?=url logic
    const fullQuery = url.search.substring(1); 
    let youtubeUrl = fullQuery.startsWith('=') ? fullQuery.substring(1) : url.searchParams.get('url');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (!youtubeUrl) {
        return res.status(400).json({
            success: false,
            error: "YouTube link required! Example: ?=https://youtu.be/xxx",
            developer: { Owner: "Divyansh Deewana", TG: "@tera_paglu" }
        });
    }

    // Cleaning YouTube URL
    youtubeUrl = decodeURIComponent(youtubeUrl);

    try {
        // Step 1: Extract Video ID
        let videoId = "";
        if (youtubeUrl.includes('youtu.be/')) {
            videoId = youtubeUrl.split('youtu.be/')[1].split(/[?#&]/)[0];
        } else if (youtubeUrl.includes('v=')) {
            videoId = youtubeUrl.split('v=')[1].split('&')[0];
        } else if (youtubeUrl.includes('shorts/')) {
            videoId = youtubeUrl.split('shorts/')[1].split(/[?#&]/)[0];
        }

        // Step 2: Hit the Downloader Backend
        const apiResponse = await axios.post('https://app.ytdown.to/proxy.php', 
            new URLSearchParams({ url: youtubeUrl }).toString(), 
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://app.ytdown.to/'
                }
            }
        );

        const data = apiResponse.data;

        if (!data || !data.api || !data.api.mediaItems) {
            throw new Error("Target site did not return media items. It might be rate-limited.");
        }

        const videoFormats = [];
        const audioFormats = [];

        // Step 3: Process Media Items
        for (const item of data.api.mediaItems) {
            // Quality mapping
            let quality = item.mediaQuality || (item.mediaRes ? item.mediaRes.split('x')[1] + 'p' : '360p');
            
            // Link Polling (Ytdown requires hitting the mediaUrl to get the final link)
            let finalLink = item.mediaUrl;
            
            // Cleaning download links
            if (finalLink && !finalLink.startsWith('http')) {
                finalLink = 'https:' + finalLink;
            }

            const format = {
                quality: quality,
                extension: item.mediaExtension || (item.type === 'Audio' ? 'mp3' : 'mp4'),
                size: item.mediaFileSize || 'Unknown',
                downloadUrl: finalLink
            };

            if (item.type === 'Audio') {
                audioFormats.push(format);
            } else {
                videoFormats.push(format);
            }
        }

        // Final Response
        return res.status(200).json({
            success: true,
            developer: {
                Owner: "Divyansh Deewana",
                TG: "@tera_paglu"
            },
            video: {
                title: data.api.title || "YouTube Video",
                thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                duration: data.api.mediaItems[0]?.mediaDuration || "Unknown",
                videoId: videoId
            },
            links: {
                video: videoFormats,
                audio: audioFormats
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch download links. The backend provider might be down.",
            error: err.message,
            developer: { Owner: "Divyansh Deewana" }
        });
    }
};
