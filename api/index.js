export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  // ?=url logic: query string se pehla part nikalna
  const fullQuery = url.search.substring(1); 
  const youtubeUrl = fullQuery.startsWith('=') ? fullQuery.substring(1) : url.searchParams.get('url');
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers });

  if (!youtubeUrl) {
    return new Response(JSON.stringify({
      success: false,
      error: "YouTube link required! Use: ?=YOUR_LINK",
      developer: { Owner: "Divyansh Deewana", TG: "@tera_paglu" }
    }, null, 2), { status: 400, headers });
  }

  try {
    // Step 1: Target the Proxy API
    const apiResponse = await fetch('https://app.ytdown.to/proxy.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://app.ytdown.to/',
        'Origin': 'https://app.ytdown.to'
      },
      body: new URLSearchParams({ url: youtubeUrl })
    });

    const data = await apiResponse.json();

    if (data && data.api && data.api.mediaItems) {
      const videoFormats = [];
      const audioFormats = [];
      
      let videoId = "";
      if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
      } else {
        const vParam = youtubeUrl.match(/[?&]v=([^&]+)/);
        videoId = vParam ? vParam[1] : "";
      }
      
      for (const item of data.api.mediaItems) {
        let quality = 'Unknown';
        if (item.mediaRes && typeof item.mediaRes === 'string') {
          quality = item.mediaRes.split('x')[1] ? item.mediaRes.split('x')[1] + 'p' : item.mediaRes;
        }
        if (item.type === 'Audio') quality = item.mediaQuality || '128kbps';
        
        let realDownloadUrl = null;
        // Polling logic for direct links
        for (let attempt = 0; attempt < 3; attempt++) {
            const checkRes = await fetch(item.mediaUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }});
            const contentType = checkRes.headers.get('Content-Type') || '';
            
            if (contentType.includes('application/json')) {
              const jsonData = await checkRes.json();
              if (jsonData.status === 'completed' && jsonData.fileUrl) {
                realDownloadUrl = jsonData.fileUrl;
                break;
              }
              await new Promise(r => setTimeout(r, 1000));
            } else {
              realDownloadUrl = item.mediaUrl;
              break;
            }
        }

        if (realDownloadUrl) {
          const format = {
            quality: quality,
            extension: item.mediaExtension || (item.type === 'Audio' ? 'mp3' : 'mp4'),
            size: item.mediaFileSize || 'Unknown',
            downloadUrl: realDownloadUrl
          };
          item.type === 'Audio' ? audioFormats.push(format) : videoFormats.push(format);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        developer: { Owner: "Divyansh Deewana", TG: "@tera_paglu" },
        video: {
          title: data.api.title || "YouTube Video",
          thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : "",
          videoId: videoId
        },
        formats: { video: videoFormats, audio: audioFormats }
      }, null, 2), { status: 200, headers });
      
    } else {
      throw new Error('Video not found or link unsupported');
    }

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      developer: { Owner: "Divyansh Deewana" }
    }), { status: 500, headers });
  }
}
