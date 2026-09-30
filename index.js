require("dotenv").config({ quiet: true });
const { WebhookClient } = require("discord.js");
const https = require("node:https");
const fs = require("node:fs");

const client = new WebhookClient({ url: process.env.WEBHOOK_URL });
const steam_app_id_list = JSON.parse(process.env.STEAM_APP_ID);
const interval = parseInt(process.env.INTERVAL);
const timeout = parseInt(process.env.TIMEOUT);

let latest = {};
loadLatest();

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
    for (let appId of steam_app_id_list) {
        try {
            let fetchedNewsString = await fetchNews(appId);
            let fetchedNews = JSON.parse(fetchedNewsString);
            let newsitem = fetchedNews?.appnews?.newsitems?.[0];
            if (!newsitem || checkIfAlreadyPosted(newsitem, latest[appId])) continue;

            console.log(`[${new Date().toISOString()}] ${appId}: ${newsitem.title}`);
            await sendWebhook(newsitem);

            latest[appId] = {
                gid: newsitem.gid,
                date: newsitem.date
            }
            saveLatest();
        } catch (error) {
            console.error(`Failed for ${appId}:\n`, error);
        }
    }
}

async function fetchNews(appId) {
    return new Promise((resolve, reject) => {
        let data = "";

        const request = https.request({
            hostname: "api.steampowered.com",
            path: `/ISteamNews/GetNewsForApp/v2?appid=${appId}&count=1`,
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
        content: `[${newsitem.title}](${newsitem.url})\n<t:${newsitem.date}:F>`.slice(0, 2000)
    });
}

function checkIfAlreadyPosted(newsitem, latestnewsitem) {
    return newsitem?.gid === latestnewsitem?.gid || newsitem?.date < latestnewsitem?.date
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