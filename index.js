require("dotenv").config({ quiet: true });
const { WebhookClient } = require("discord.js");
const https = require("node:https");
const fs = require("node:fs");

const client = new WebhookClient({ url: process.env.WEBHOOK_URL });
const steamAppIdList = JSON.parse(process.env.STEAM_APP_ID);
const interval = parseInt(process.env.INTERVAL);
const timeout = parseInt(process.env.TIMEOUT);
const newsCount = parseInt(process.env.NEWS_COUNT);

let latest = {};
loadLatest();

console.log(`[${new Date().toISOString()}]: Started listening for ${steamAppIdList.toString()}`);

let mainRunning = false;

setInterval(async () => {
    if (mainRunning) {
        console.warn("Previous run is still active");
        return;
    }

    mainRunning = true;
    try {
        await main();
    } finally {
        mainRunning = false;
    }
}, interval);

async function main() {
    for (const appId of steamAppIdList) {
        let newsItems;

        try {
            const response = await fetchNews(appId);
            const fetchedNews = JSON.parse(response);
            newsItems = fetchedNews?.appnews?.newsitems;

            if (!Array.isArray(newsItems)) {
                throw new Error("Steam response did not contain news items");
            }
        } catch (error) {
            console.error(`Failed to fetch news for ${appId}:`, error);
            continue;
        }

        const newItems = newsItems
            .filter(newsItem => isNewNewsItem(newsItem, latest[appId]))
            .sort((first, second) => first.date - second.date);

        for (const newsItem of newItems) {
            try {
                await sendWebhook(newsItem);

                latest[appId] = {
                    gid: newsItem.gid,
                    date: newsItem.date
                };

                saveLatest();

                console.log(`[${new Date().toISOString()}] ${appId}: ${newsItem.title}`);
            } catch (error) {
                console.error(`Failed to publish ${appId}:`, error);
                break;
            }
        }
    }
}


async function fetchNews(appId) {
    return new Promise((resolve, reject) => {
        let data = "";

        const request = https.request({
            hostname: "api.steampowered.com",
            path: `/ISteamNews/GetNewsForApp/v2?appid=${appId}&count=${newsCount}`,
            method: "GET"
        }, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                res.resume();
                reject(new Error(`Steam API returned HTTP ${res.statusCode}`));
                return;
            }

            res.on("data", chunk => data += chunk);
            res.on("end", () => resolve(data));
            res.on("error", reject);
        });

        request.setTimeout(timeout, () => {
            request.destroy(new Error(`Request timed out after ${timeout} ms`));
        });

        request.on("error", reject);
        request.end();
    });
}

async function sendWebhook(newsitem) {
    return client.send({
        content: `[**${newsitem.title}**](${newsitem.url})\n<t:${newsitem.date}:F>`.slice(0, 2000)
    });
}

function isNewNewsItem(newsItem, latestNewsItem) {
    if (!latestNewsItem) {
        return true;
    }

    return (
        newsItem.gid !== latestNewsItem.gid &&
        newsItem.date > latestNewsItem.date
    );
}

function loadLatest() {
    try {
        latest = JSON.parse(fs.readFileSync("data.json", "utf8"));
    } catch {
        latest = {};
    }
}

function saveLatest() {
    fs.writeFileSync(
        "data.json",
        JSON.stringify(latest, null, 4),
        "utf8"
    );
}