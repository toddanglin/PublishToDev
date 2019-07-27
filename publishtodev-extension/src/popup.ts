// import * as moment from 'moment';
import * as moment from 'moment-timezone';
import flatpickr from "flatpickr";
require("flatpickr/dist/flatpickr.min.css")
declare var window;

let articleId = "";
let title = "";
let userapikey = "";
let now = moment(new Date());
let minDate = now.toDate();
let maxDate = now.add(30, 'days').toDate(); //Limit to 30 days max (for now)
const zone = moment.tz.guess();

const elePanel = document.querySelector('#panel');
const eleMsg = document.querySelector('#msg');
const eleBody = document.querySelector('body');
const elePubTime = <HTMLInputElement>document.querySelector('#pubtime');
const eleCloseBtn = document.querySelector('#btnMsgClose');

(() => {
  const queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.executeScript({
    code: 'document.querySelector(".body").dataset["articleId"]'
  }, (result) => {
    articleId = <any>result || "";
    init();
  })

  function init() {
    chrome.tabs.query(queryInfo, function (tabs) {
      let url = tabs[0].url;

      // Validate on DevTo site
      if (!url.startsWith('https://dev.to')) {
        showError('Sorry. This extension only works on the dev.to site.');
        return;
      }

      console.log(articleId);

      if (articleId == undefined || articleId == "") {
        showError("Oops. A DevTo article ID was not found on this page. Please navigate to an unpublished post and try again.");
        return;
      }

      document.querySelector('#id').textContent = articleId;
      title = tabs[0].title.substr(0, tabs[0].title.lastIndexOf("-") - 1);
      // Remove the DevTo "- Dev Community" added to title attribute
      document.querySelector('#title').textContent = title;
    });

    // Validate apikey setting is set
    chrome.storage.sync.get({
      apikey: ""
    }, (items: { apikey }) => {
      if (items.apikey == "") {
        showError("Please configure your dev.to user API key in the extension settings.")
        return;
      } else {
        userapikey = items.apikey;
      }
    });
  }

  async function schedulePost() {
    // Validate that the selected date is in the future
    if (elePubTime.value == "") {
      alert("Please choose a date and time before continuing.");
      return;
    }
    let pubtime = new Date(elePubTime.value);

    // Show progress message/spinner and make REST call
    eleBody.classList.add('msg');
    eleBody.classList.add('progress');
    eleMsg.textContent = "Scheduling post...";
    const postdata = {
      id: articleId.toString(),
      apikey: userapikey,
      pubtime: pubtime.getTime(),
      title: title
    }
    const request_options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postdata)
    }
    const url = "https://publishto-dev.azurewebsites.net/api/schedulePost";
    try {
      let resp = await fetch(url, request_options);
      if (resp.status !== 200) {
        throw Error(await resp.text());
      }

      eleBody.classList.remove('progress');
      eleBody.classList.add('success');
      eleMsg.textContent = `All set! Your post is scheduled to publish on ${moment.tz(pubtime, zone).format("Do MMMM YYYY, h:mm A z")}`;
    } catch (err) {
      showError(err, true);
    }
  }

  function showError(msg, showCloseButton?) {
    eleBody.className = "";
    eleBody.classList.add('msg');
    eleBody.classList.add('error');
    eleMsg.textContent = msg || "Something is not right";

    if (showCloseButton) {
      eleCloseBtn.setAttribute('style', 'display:block;');
    }
  }

  function closeMsg() {
    eleBody.className = "";
  }

  eleCloseBtn.addEventListener("click", closeMsg);
  document.querySelector('#schedule').addEventListener("click", schedulePost);
  document.addEventListener('DOMContentLoaded', () => {
    // HACK CITY -- Couldn't for the life of me get the stupid date picker it init
    // I assume it has something to do with the way Chrome extension scripts/html are loaded
    setTimeout(() => { flatpickr('#pubtime', {}) }, 50);
    setTimeout(() => {
      window.flatpickr('#pubtime', {
        minDate: minDate,
        maxDate: maxDate,
        inline: true,
        enableTime: true,
        defaultHour: 9,
        defaultMinute: 30,
        dateFormat: 'd M Y, h:i K'
      })
    }, 100);

    let tz = document.querySelector('#timezone');
    tz.textContent = `(${zone} ${moment.tz(new Date(), zone).format("Z z")})`;
  });
})();