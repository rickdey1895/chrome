// This file contains the logic for the options page, allowing users to save and retrieve their preferences.

document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('save');
    const inputField = document.getElementById('inputField') as HTMLInputElement | null;

    if (!saveButton || !inputField) return;

    // Load saved preferences
    chrome.storage.sync.get(['userPreference'], (result: any) => {
        if (result && result.userPreference) {
            inputField.value = result.userPreference;
        }
    });

    // Save preferences on button click
    saveButton.addEventListener('click', () => {
        const userPreference = inputField.value;
        chrome.storage.sync.set({ userPreference }, () => {
            console.log('Preference saved:', userPreference);
        });
    });
});