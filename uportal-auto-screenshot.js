#!/usr/bin/env node

const Listr = require('listr');
const puppeteer = require('puppeteer');
var args = require('args');
const fs = require("fs");
const rl = require("readline");

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

const loginTask = (auth, url, username, password) => new Listr([
    {
        title: 'Open browser',
        task: async () => {
            let options = {};
            if (auth === "manual") {
                options.headless = false;
            }
            browser = await puppeteer.launch(options);
        }
    },
    {
        title: `Login`,
        task: async (ctx, task) => {
            const page = await browser.newPage();

            if (auth === "local") {
                const target = `${url}/uPortal/Login?username=${username}&password=${password}`;
                await page.goto(target, { waitUntil: 'networkidle2' });
                await page.close();
            } else if (auth === "manual") {
                const target = `${url}/uPortal`;
                await page.goto(target, { waitUntil: 'networkidle2' });

                const r = rl.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                task.title = "Press <enter> when logged in";
                const answer = await prompt(task.title);
                r.close();
            } else {
                throw new Error(`Unrecognized authentication option '${auth}', valid options are: local|manual`)
            }
        }
    }
]);

const getPortletsTask = (url) => new Listr([
    {
        title: 'Fetch list of portlets',
        task: async ctx => {
            const page = await browser.newPage();
            const target = `${url}/uPortal/api/marketplace/entries.json`;
            await page.goto(target, { waitUntil: 'networkidle2' });
            const content = await page.content();
            ctx.portlets = await page.evaluate(() => {
                return JSON.parse(document.querySelector("body").innerText);
            })
            await page.close();
        }
    },
    // {
    //     title: 'Fetch list of portlets',
    //     task: async ctx => {
    //         const page = await browser.newPage();
    //         page.on('response', async response => {
    //             ctx.portlets = await response.buffer()
    //         });
    //         const target = `${url}/uPortal/api/marketplace/entries.json`;
    //         await page.goto(target, { waitUntil: 'networkidle2' });
    //         await page.close();
    //     }
    // },
    // {
    //     title: 'Parse portlet list',
    //     task: ctx => {
    //         try {
    //             ctx.portlets = JSON.parse();
    //         } catch(err) {
    //             throw new Error("ctx.portlets : " + ctx.portlets.toString());
    //         }
    //     }
    // }
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
        const { auth, url, username, password } = options;

        console.log(`Log in to ${url} with username: '${username}' and password: '${password}'\n`);
        await loginTask(auth, url, username, password).run();

        console.log(`\nFetch list of portlets\n`)
        let ctx = await getPortletsTask(url).run();
        console.log(`\n${ctx.portlets.portlets.length} portlets found\n`);

        try {
            await new Listr(ctx.portlets.portlets
                .map(portlet => {
                    return {
                        title: `Capture ${portlet.title}`,
                        task: () => catureScreenshotTasks(url, portlet),
                        skip: () => fs.existsSync(`screenshots/${portlet.title}.png`) ? !options.overwrite : false,
                    };
                }), {
                    concurrent: 1,
                    exitOnError: false,
                }).run();
        } catch (err) {
            console.error(err);
        }

        await browser.close();
    }, [])
    .option("url", "URL of uPortal instance", "http://localhost:8080")
    .option("auth", "Type of authentication: local|manual", "local")
    .option("username", "Username of local uPortal user", "admin")
    .option("password", "Password of local uPortal user", "admin")
    .option("overwrite", "Overwrites existing screenshots", false)
    .parse(process.argv);
