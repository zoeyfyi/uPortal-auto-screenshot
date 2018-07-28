#!/usr/bin/env node

const Listr = require('listr');
const puppeteer = require('puppeteer');
const fs = require("fs");

let browser;

const [, , url, username, password] = process.argv;
if (url === undefined ||
    username === undefined ||
    password === undefined) {
    console.log("uportal-auto-screenshot [url] [username] [password]");
} else {
    const getPortletsTask = new Listr([
        {
            title: 'Open browser',
            task: async ctx => {
                browser = await puppeteer.launch();
            }
        },
        {
            title: `Login as ${username}`,
            task: async ctx => {
                const page = await browser.newPage();
                const target = `${url}/uPortal/Login?username=${username}&password=${password}`;
                console.log(target)
                await page.goto(target, { waitUntil: 'networkidle2' });
                await page.close();
            }
        },
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
                title: 'Open browser',
                task: async ctx => {
                    ctx[portlet.id] = {}
                    ctx[portlet.id].browser = await puppeteer.launch();
                }
            },
            {
                title: `Login as ${username}`,
                task: async ctx => {
                    const page = await ctx[portlet.id].browser.newPage();
                    const target = `${url}/uPortal/Login?username=${username}&password=${password}`;
                    console.log(target)
                    await page.goto(target, { waitUntil: 'networkidle2' });
                    await page.close();
                }
            },
            {
                title: 'Open portlet',
                task: async ctx => {
                    ctx[portlet.id].page = await ctx[portlet.id].browser.newPage();
                    await ctx[portlet.id].page.goto(`${url}${portlet.renderUrl}`, { waitUntil: 'networkidle2' });
                }
            },
            {
                title: 'Get bounding rect',
                task: async ctx => {
                    ctx[portlet.id].rect = await ctx[portlet.id].page.evaluate(selector => {
                        const element = document.querySelector(selector);
                        const { x, y, width, height } = element.getBoundingClientRect();
                        return { left: x, top: y, width, height, id: element.id };
                    }, '.up-portlet-wrapper-inner');
                }
            },
            {
                title: 'Screenshot element',
                task: async ctx => {
                    await ctx[portlet.id].page.screenshot({
                        path: `screenshots/${portlet.title}.png`,
                        clip: {
                            x: ctx[portlet.id].rect.left,
                            y: ctx[portlet.id].rect.top,
                            width: ctx[portlet.id].rect.width,
                            height: ctx[portlet.id].rect.height
                        }
                    });
                }
            }
        ]);
    }

    getPortletsTask.run()
        .then(async ctx => {
            const captureAllTasks = new Listr(ctx.portlets.portlets
                .map(portlet => {
                    return {
                        title: `Capture ${portlet.title}`,
                        task: () => catureScreenshotTasks(portlet)
                    };
                }), {
                    concurrent: 4,
                    exitOnError: false,
                });
            await browser.close();

            captureAllTasks.run().then(async ctx => {
                await browser.close();
            }).catch(err => {
                console.error(err);
            });
        })
        .catch(err => {
            console.error(err);
        });
}
