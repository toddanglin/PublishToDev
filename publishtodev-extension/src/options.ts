
// Saves options to chrome.storage.sync.
function save_options() {
  let apiKey = (<HTMLInputElement>document.querySelector('#apikey')).value;

  chrome.storage.sync.set({
    apikey: apiKey
  }, function() {
    // Update status to let user know options were saved.
    var status = document.querySelector('#status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = "";
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    apikey: ""
  }, function(items: {apikey}) {
    (<HTMLInputElement>document.querySelector('#apikey')).value = items.apikey;
  });
}

document.querySelector('#save').addEventListener("click", save_options);
document.addEventListener('DOMContentLoaded', restore_options);

