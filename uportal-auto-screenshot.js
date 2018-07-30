#!/usr/bin/env node

const Listr = require('listr');
const puppeteer = require('puppeteer');
var args = require('args');
const fs = require("fs");

let browser;

const loginTask = (url, username, password) => new Listr([
    {
        title: 'Open browser',
        task: async () => {
            browser = await puppeteer.launch();
        }
    },
    {
        title: `Login`,
        task: async () => {
            const page = await browser.newPage();
            const target = `${url}/uPortal/Login?username=${username}&password=${password}`;
            console.log(target)
            await page.goto(target, { waitUntil: 'networkidle2' });
            await page.close();
        }
    }
]);

const getPortletsTask = (url) => new Listr([
    {
        title: 'Fetch list of portlets',
        task: async ctx => {
            const page = await browser.newPage();
            page.on('response', async response => {
                ctx.portlets = await response.buffer()
            });
            const target = `${url}/uPortal/api/marketplace/entries.json`;
            await page.goto(target, { waitUntil: 'networkidle2' });
            await page.close();
        }
    },
    {
        title: 'Parse portlet list',
        task: ctx => {
            ctx.portlets = JSON.parse(ctx.portlets.toString());
        }
    }
]);

const catureScreenshotTasks = (url, portlet) => {
    return new Listr([
        {
            title: 'Open portlet',
            task: async ctx => {
                ctx[portlet.title] = {};
                ctx[portlet.title].page = await browser.newPage();
                await ctx[portlet.title].page.goto(`${url}${portlet.renderUrl}`, { waitUntil: 'networkidle2' });
            }
        },
        {
            title: 'Get bounding rect',
            task: async ctx => {
                ctx[portlet.title].rect = await ctx[portlet.title].page.evaluate(selector => {
                    const element = document.querySelector(selector);
                    const { x, y, width, height } = element.getBoundingClientRect();
                    return { left: x, top: y, width, height, id: element.id };
                }, '.up-portlet-wrapper-inner');
            }
        },
        {
            title: 'Screenshot element',
            task: async ctx => {
                await ctx[portlet.title].page.screenshot({
                    path: `screenshots/${portlet.title}.png`,
                    clip: {
                        x: ctx[portlet.title].rect.left,
                        y: ctx[portlet.title].rect.top,
                        width: ctx[portlet.title].rect.width,
                        height: ctx[portlet.title].rect.height
                    }
                });
            }
        },
        {
            title: 'Close page',
            task: async ctx => {
                await ctx[portlet.title].page.close();
            }
        }
    ]);
}

args
    .command('capture', 'Capture screenshots of portlets', async (name, sub, options) => {
        const { url, username, password } = options;

        console.log(`Log in to ${url} with username: '${username}' and password: '${password}'`);
        await loginTask(url, username, password).run();
        console.log(`Fetch list of portlets`)
        let ctx = await getPortletsTask(url).run();
        console.log(`${ctx.portlets.portlets.length} portlets found`);

        try {
            await new Listr(ctx.portlets.portlets
                .map(portlet => {
                    return {
                        title: `Capture ${portlet.title}`,
                        task: () => catureScreenshotTasks(url, portlet)
                    };
                }), {
                    concurrent: 2,
                    exitOnError: false,
                }).run();
        } catch (err) {
            console.error(err);
        }

        await browser.close();
    }, [])
    .option("url", "URL of uPortal instance", "http://localhost:8080")
    .option("username", "Username of local uPortal user", "admin")
    .option("password", "Password of local uPortal user", "admin")
    .parse(process.argv);
