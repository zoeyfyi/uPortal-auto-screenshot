#!/usr/bin/env node

const Listr = require('listr');
const puppeteer = require('puppeteer');
const fs = require("fs");

const [, , url, username, password] = process.argv;
let browser;

if (url === undefined ||
    username === undefined ||
    password === undefined) {
    console.log("uportal-auto-screenshot [url] [username] [password]");
} else {
    const loginTask = new Listr([
        {
            title: 'Open browser',
            task: async () => {
                browser = await puppeteer.launch();
            }
        },
        {
            title: `Login as ${username}`,
            task: async () => {
                const page = await browser.newPage();
                const target = `${url}/uPortal/Login?username=${username}&password=${password}`;
                console.log(target)
                await page.goto(target, { waitUntil: 'networkidle2' });
                await page.close();
            }
        }
    ]);

    const getPortletsTask = new Listr([
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

    const catureScreenshotTasks = portlet => {
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

    (async () => {
        console.log(`Log in to ${url} with username: '${username}' and password: '${password}'`);
        await loginTask.run();
        console.log(`Fetch list of portlets`)
        let ctx = await getPortletsTask.run();
        console.log(`${ctx.portlets.portlets.length} portlets found`);

        try {
            await new Listr(ctx.portlets.portlets
                .map(portlet => {
                    return {
                        title: `Capture ${portlet.title}`,
                        task: () => catureScreenshotTasks(portlet)
                    };
                }), {
                    concurrent: 2,
                    exitOnError: false,
                }).run();
        } catch (err) {
            console.error(err);
        }

        await browser.close();
    })();
}
