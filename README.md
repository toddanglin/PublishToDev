# PublishTo.Dev
This repo contains the source for the PublishTo.Dev project.

## What is it?
PublishTo.Dev is a simple utility that enables authors on the dev.to platform to schedule post publishing. Authors draft a post on DevTo, use the PublishTo.Dev browser extension to schedule the post, and then PublishTo.Dev makes the post live on the selected date and time using [Azure cloud functions](https://cda.ms/10P).

## How do I use it?
Any dev.to author can use this service to schedule post publishing using the following steps:

1. **Install the PublishTo.Dev browser extension**
    - Availble for Chrome and Edge (Chromium)
    - Packed: [Chrome Web Store](https://chrome.google.com/webstore/detail/publishtodev-extension/bohbnpnialpdpgnibbddaaoaklmnjoaa)
    - Unpacked: [Github source](https://github.com/toddanglin/PublishToDev/tree/master/publishtodev-extension)
0. **Configure the browser extension with your unique DevTo API access token** 
    - Available from the DevTo [account settings page](https://dev.to/settings/account)
0. **Write a post on dev.to and save as draft**
0. **From the saved draft page, use the browser extension to choose a date and time to schedule publishing**
0. **Visit [PublishTo.Dev](https://www.publishto.dev) to see all scheduled posts**
    - Scheduled posts can be cancelled
    - To reschedule, simply repeat Step 3
    - NOTE: Posts do **not** have to be cancelled before rescheduling. Scheduling the same post again overrides any previous schedule.

### Using the "unpacked" browser extension
To use the unpacked browser extension, simply follow these steps:

1. Clone this repo
0. From a terminal or command prompt, navigate to the `publishtodev-extension` folder in this repo
0. Initialize the project with `$ npm install`
0. Build the extension project with `$ npm run build`
    - This will create a new sub-directory called `dist`
0. Open a Chrome or Edge (Chromium) browser and navigate to the extensions management tab
    - Chrome: `chrome://extensions`
    - Edge: `edge://extensions`
0. At the top of the page, click the **Load unpacked** button and navigate to the `dist` folder  created previously
0. Choose this folder and you're done!

## How was it built?
There are two major components to this repo:

1. [Azure Serverless Functions](https://github.com/toddanglin/PublishToDev/tree/master/functions)
2. [Chrome(ium) Browser Extension](https://github.com/toddanglin/PublishToDev/tree/master/publishtodev-extension) 

### Backend
On the backend, this project leans heavily on [Azure Durable Functions](https://cda.ms/10G) and [Azure Table Storage](https://cda.ms/10F).

When a request is made to the primary HTTP endpoint, a new durable function orchestrator is kicked-off. This orchestrator schedules the publishing code to run at the user specified time and ensure details about the schedule are saved to storage.

Visit the `functions` sub folder for more details.

## Frontend
On the frontend, this project uses the Chrome browser extension format to create a browser plugin that grabs an article ID from the DevTo website and sends a request to the serverless function endpoint for publishing. The Chrome browser extension format works in most Chromium-based browsers, including [Microsoft Edge (Preview)](https://cda.ms/10R) on Windows and Mac.

Visit the `publishtodev-extension` folder for more details.

## Trouble? Feedback? Questions?
Open an issue or submit a PR.

## License
All code used in this project is MIT licensed.
