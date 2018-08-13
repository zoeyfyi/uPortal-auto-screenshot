#!/usr/bin/env node

const puppeteer = require('puppeteer');
const args = require('args');
const fs = require("fs");
const rl = require("readline");
const ProgressBar = require('progress');
require('colors');

let browser;

const prompt = question => {
    const r = rl.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    return new Promise((resolve, error) => {
        r.question(question, answer => {
            r.close();
            resolve(answer);
        });
    })
};

const loginTask = async (options) => {
    // Open browser
    let browserOptions = {};
    if (options.auth === "manual") {
        browserOptions.headless = false;
    }
    browser = await puppeteer.launch(browserOptions);

    // Login
    const page = await browser.newPage();
    if (options.auth === "local") {
        const target = `${options.url}/uPortal/Login?username=${options.username}&password=${options.password}`;
        await page.goto(target, { waitUntil: 'networkidle2' });
        await page.close();
    } else if (options.auth === "manual") {
        const target = `${options.url}/uPortal`;
        await page.goto(target, { waitUntil: 'networkidle2' });

        const r = rl.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const answer = await prompt("Press <enter> after logging in");
        r.close();
    } else if (options.auth === "cas") {
        // Go to cas
        await page.goto(options.loginUrl, { waitUntil: 'networkidle2' });
        await page.type(options.usernameSelector, options.username);
        await page.type(options.passwordSelector, options.password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click(options.submitSelector),
        ]);
    } else {
        throw new Error(`Unrecognized authentication option '${options.auth}', valid options are: local|manual`)
    }
}

const getPortletsTask = async (url) => {
    const page = await browser.newPage();
    const target = `${url}/uPortal/api/marketplace/entries.json`;
    await page.goto(target, { waitUntil: 'networkidle2' });
    
    const content = await page.content();
    const portlets = await page.evaluate(() => {
        return JSON.parse(document.querySelector("body").innerText);
    })
    
    await page.close();
    
    return portlets.portlets;
}

const catureScreenshotTasks = async (url, portlet) => {
    // Open portlet
    const page = await browser.newPage();
    await page.goto(`${url}${portlet.renderUrl}`, { waitUntil: 'networkidle2' });
    
    // Get bounding rect
    const rect = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        const { x, y, width, height } = element.getBoundingClientRect();
        return { left: x, top: y, width, height, id: element.id };
    }, '.up-portlet-wrapper-inner');
    
    // Screenshot element
    await page.screenshot({
        path: `screenshots/${portlet.title}.png`,
        clip: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        }
    });
    
    // Close page
    await page.close();
}
    
args
    .command('capture', 'Capture screenshots of portlets', async (name, sub, options) => {
        const { url, username, overwrite } = options;

        console.log('Logging in');
        await loginTask(options);
        console.log(`Logged in as '${username}'`);

        console.log(`Fetching list of portlets`);
        let portlets = await getPortletsTask(url);
        const portletCount = portlets.length;
        console.log(`Found ${portletCount} portlets`);

        if (!overwrite) {
            portlets = portlets.filter(portlet => {
                return !fs.existsSync(`screenshots/${portlet.title}.png`);
            });

            if (portlets.length !== portletCount) {
                console.log(`Skipping ${portletCount - portlets.length}, to overwrite screenshots use --overwrite`);
            }
        }

        const captureBar = new ProgressBar('capturing [:bar] :percent :etas', { 
            total: portlets.length,
            complete: '=',
            incomplete: ' '
        });

        let failed = [];

        for (let portlet of portlets) {
            try {
                await catureScreenshotTasks(url, portlet);
                captureBar.interrupt(`captured '${portlet.title}'`.green);
            } catch (err) {
                failed.push({
                    portlet,
                    err,
                })
                captureBar.interrupt(`failed to capture '${portlet.title}'`.red);
            }
            captureBar.tick();
        }

        if (failed.length !== 0) {
            console.error(`${failed.length} failures`);
            for (let fail of failed) {
                console.error(`Portlet '${fail.portlet.title}' failed.\n${fail.err}\n`);
            }
        }

        await browser.close();
    }, [])
    .option("url", "URL of uPortal instance", "http://localhost:8080")
    .option("loginUrl", "URL of cas (for cas authentication)", "http://localhost:8080/cas/login?service=http://localhost:8080/uPortal/Login")
    .option("auth", "Type of authentication: local|manual|cas", "local")
    .option("username", "Username of local uPortal user", "admin")
    .option("password", "Password of local uPortal user", "admin")
    .option("usernameSelector", "Selector for the username textbox (for cas authentication)", "#username")
    .option("passwordSelector", "Selector for the password textbox (for cas authentication)", "#password")
    .option("submitSelector", "Selector for the submit button (for cas authentication)", "input[type='submit']")
    .option("overwrite", "Overwrites existing screenshots", false)
    .parse(process.argv);
