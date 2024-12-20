// ==UserScript==
// @name         Magnet Link to Torbox 
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Check instant availability with Torbox API using Auth Token and add a button to send magnet links to Torbox.
// @author       Sanket
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    const apiBase = 'https://api.torbox.app';
    const apiVersion = 'v1';
    const authToken = 'Enter_your_own_key';

    function showTemporaryMessage(message, color) {
        const msgDiv = document.createElement('div');
        msgDiv.textContent = message;
        msgDiv.style.position = 'fixed';
        msgDiv.style.bottom = '20px';
        msgDiv.style.left = '20px';
        msgDiv.style.backgroundColor = color;
        msgDiv.style.color = 'white';
        msgDiv.style.padding = '10px';
        msgDiv.style.borderRadius = '5px';
        msgDiv.style.zIndex = 10000;
        document.body.appendChild(msgDiv);
        setTimeout(() => { msgDiv.remove(); }, 3000);
    }

    function getMagnetHash(magnetLink) {
        const magnetUri = new URL(magnetLink);
        const hashParam = magnetUri.searchParams.get('xt');
        return hashParam ? hashParam.split(':').pop().toLowerCase() : null;
    }

function sendToTorbox(magnetLink) {
    GM_xmlhttpRequest({
        method: 'POST',
        url: `${apiBase}/${apiVersion}/api/torrents/createtorrent`,
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: `magnet=${encodeURIComponent(magnetLink)}&seed=1&allow_zip=false`,
        onload: function(response) {
            try {
                const data = JSON.parse(response.responseText);
                if (response.status >= 200 && response.status < 300) {
                    showTemporaryMessage('Magnet link added to Torbox successfully!', 'green');
                } else {
                    showTemporaryMessage(`Failed to add magnet: ${data.error || 'Unknown error'}`, 'red');
                }
            } catch (error) {
                showTemporaryMessage('Error parsing response from Torbox', 'red');
            }
        },
        onerror: function() {
            showTemporaryMessage('Error adding magnet to Torbox.', 'red');
        }
    });
}


    function createIconsForMagnetLinks(magnetLinks, availabilityResults) {
        magnetLinks.forEach(link => {
            const iconContainer = document.createElement('span');
            iconContainer.style.display = 'inline-flex';
            iconContainer.style.alignItems = 'center';
            iconContainer.style.marginLeft = '25px';

            const torboxIcon = document.createElement('img');
            torboxIcon.src = 'https://torbox.app/assets/logo-57adbf99.svg';
            torboxIcon.style.cursor = 'pointer';
            torboxIcon.style.width = '50px';
            torboxIcon.style.height = '50px';
            torboxIcon.title = 'Send to Torbox';
            torboxIcon.style.marginRight = '10px';
            torboxIcon.addEventListener('click', () => {
                sendToTorbox(link.href);
            });
            iconContainer.appendChild(torboxIcon);

            const availabilityIcon = document.createElement('span');
            availabilityIcon.style.width = '25px';
            availabilityIcon.style.height = '25px';
            availabilityIcon.style.borderRadius = '50%';
            availabilityIcon.style.marginLeft = '25px';
            availabilityIcon.style.display = 'inline-flex';
            availabilityIcon.style.justifyContent = 'center';
            availabilityIcon.style.alignItems = 'center';
            availabilityIcon.style.fontWeight = 'bold';
            availabilityIcon.style.fontSize = '16px';
            availabilityIcon.style.color = 'white';

            const hash = getMagnetHash(link.href);
            if (availabilityResults[hash]) {
                availabilityIcon.textContent = '✓';
                availabilityIcon.style.backgroundColor = 'green';
                availabilityIcon.title = 'Instantly available';
            } else {
                availabilityIcon.textContent = '✗';
                availabilityIcon.style.backgroundColor = 'red';
                availabilityIcon.title = 'Not available';
            }

            iconContainer.appendChild(availabilityIcon);
            link.insertAdjacentElement('afterend', iconContainer);
        });
    }

    let hideUnavailable = false;
    function toggleUnavailableLinks(magnetLinks, availabilityResults) {
        magnetLinks.forEach(link => {
            const hash = getMagnetHash(link.href);
            const available = !!availabilityResults[hash];
            const rowOrDiv = link.closest('tr') || link.closest('div.torrent_magnet')?.parentElement?.parentElement?.parentElement || link.closest('li');
            if (rowOrDiv) {
                rowOrDiv.style.display = (!available && hideUnavailable) ? 'none' : '';
            }
        });

        const toggleButton = document.getElementById('toggle-unavailable-btn');
        toggleButton.textContent = hideUnavailable ? 'Show Unavailable Links' : 'Hide Unavailable Links';
    }

    function createToggleButton(magnetLinks, availabilityResults) {
        if (magnetLinks.length === 0) return;
        const button = document.createElement('button');
        button.id = 'toggle-unavailable-btn';
        button.textContent = 'Hide Unavailable Links';
        button.style.position = 'fixed';
        button.style.top = '10px';
        button.style.right = '10px';
        button.style.zIndex = '1000';
        button.style.padding = '10px';
        button.style.backgroundColor = '#007bff';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';

        button.addEventListener('click', () => {
            hideUnavailable = !hideUnavailable;
            toggleUnavailableLinks(magnetLinks, availabilityResults);
        });

        document.body.appendChild(button);
    }

    function batchCheckInstantAvailability(magnetLinks) {
        return new Promise((resolve) => {
            const hashes = magnetLinks.map(link => getMagnetHash(link.href));
            const url = `${apiBase}/${apiVersion}/api/torrents/checkcached?hash=${hashes.join(',')}&format=object&list_files=false`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                onload: function(response) {
                    try {
                        const json = JSON.parse(response.responseText);
                        const data = json.data || {};
                        const results = {};
                        hashes.forEach(h => {
                            results[h] = data[h] ? true : false;
                        });
                        resolve(results);
                    } catch (e) {
                        const results = {};
                        hashes.forEach(h => { results[h] = false; });
                        resolve(results);
                    }
                },
                onerror: function() {
                    const results = {};
                    hashes.forEach(h => { results[h] = false; });
                    resolve(results);
                }
            });
        });
    }

    async function main() {
        const magnetLinks = Array.from(document.querySelectorAll('a[href*="magnet:"]'));
        if (magnetLinks.length > 0) {
            const availabilityResults = await batchCheckInstantAvailability(magnetLinks);
            createToggleButton(magnetLinks, availabilityResults);
            toggleUnavailableLinks(magnetLinks, availabilityResults);
            createIconsForMagnetLinks(magnetLinks, availabilityResults);
        }
    }

    main();
})();
