const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

export const searchVideos = async (q) => {
    try {
        if (!q || typeof q !== 'string' || q.length > 200) {
            throw new Error('Invalid Query parameter "q"');
        }

        const educationalQuery = `${q} course tutorial`;

        const searchResponse = await fetch(
            `${YOUTUBE_SEARCH_URL}?part=snippet&maxResults=12&q=${encodeURIComponent(educationalQuery)}&type=video&order=viewCount&key=${YOUTUBE_API_KEY}`
        );
        const searchData = await searchResponse.json();

        if (searchData.error) throw new Error(searchData.error.message);

        const videoIds = (searchData.items || []).map(item => item?.id?.videoId).filter(Boolean).join(',');
        if (!videoIds) return [];

        const detailsResponse = await fetch(
            `${YOUTUBE_VIDEOS_URL}?part=snippet,contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
        );
        const detailsData = await detailsResponse.json();

        return (detailsData.items || []).map(item => {
            const durationIso = item?.contentDetails?.duration || 'PT0S';
            const durationArr = durationIso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            const h = durationArr?.[1], m = durationArr?.[2], s = durationArr?.[3];
            const readableDuration = (h ? h + ':' : '') + ((m ? (h ? m.padStart(2, '0') : m) : '0') + ':') + (s || '0').padStart(2, '0');

            const views = parseInt(item?.statistics?.viewCount || '0', 10);
            let formattedViews = views >= 1000000 ? (views / 1000000).toFixed(1) + 'M' : views >= 1000 ? (views / 1000).toFixed(1) + 'K' : views.toString();

            const likes = parseInt(item?.statistics?.likeCount || '0', 10);
            let formattedLikes = likes >= 1000000 ? (likes / 1000000).toFixed(1) + 'M' : likes >= 1000 ? (likes / 1000).toFixed(1) + 'K' : likes.toString();

            return {
                id: item?.id,
                title: item?.snippet?.title,
                thumbnail: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.default?.url,
                channel: item?.snippet?.channelTitle,
                duration: readableDuration,
                views: formattedViews,
                likes: formattedLikes,
                description: item?.snippet?.description,
                category: 'YouTube'
            };
        });
    } catch (error) {
        console.error(error);
        return [];
    }
};
