// Google Drive API configuration
const CLIENT_ID = 'YOUR_CLIENT_ID';
const API_KEY = 'YOUR_API_KEY';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let mp3Files = [];
let currentFileIndex = 0;
let ratings = {};

// Add these new constants
const FOLDER_ID = 'YOUR_FOLDER_ID'; // Add your Google Drive folder ID here
let currentPair = [];
let roundRobinResults = {};

document.addEventListener('DOMContentLoaded', () => {
    // Load the Google API client
    gapi.load('client:auth2', initClient);
});

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(() => {
        // Listen for sign-in state changes
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        
        // Handle the initial sign-in state
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        
        document.getElementById('authorizeButton').onclick = handleAuthClick;
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        document.querySelector('.google-auth-section').style.display = 'none';
        document.querySelector('.player-section').style.display = 'block';
        listMP3Files();
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

async function listMP3Files() {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${FOLDER_ID}' in parents and mimeType contains 'audio/mp3'`,
            fields: 'files(id, name, webContentLink)'
        });

        mp3Files = response.result.files;
        // Initialize round-robin scoring
        mp3Files.forEach(file => {
            roundRobinResults[file.id] = {
                wins: 0,
                total: 0
            };
        });
        
        document.getElementById('totalFiles').textContent = 
            `${mp3Files.length * (mp3Files.length - 1) / 2}`; // Total number of comparisons
        
        if (mp3Files.length > 0) {
            loadNextPair();
        }
    } catch (error) {
        console.error('Error listing files:', error);
    }
}

function loadNextPair() {
    if (currentFileIndex >= mp3Files.length * (mp3Files.length - 1) / 2) {
        showResults();
        return;
    }

    // Calculate the next pair of indices
    let n = mp3Files.length;
    let k = currentFileIndex;
    let i = 0;
    let j = 1;
    
    // Find the next pair that hasn't been compared
    while (k >= (n - i)) {
        k -= (n - i);
        i++;
        j = i + 1;
    }
    j += k;

    currentPair = [mp3Files[i], mp3Files[j]];
    
    // Update the UI to show both files
    document.getElementById('currentFile').textContent = 
        `Comparing: ${currentPair[0].name} vs ${currentPair[1].name}`;
    
    // Set up audio players for both files
    setupAudioPlayers(currentPair);
}

function setupAudioPlayers(pair) {
    const playerSection = document.querySelector('.player-section');
    playerSection.innerHTML = `
        <div class="comparison-container">
            <div class="audio-choice">
                <p>Option A: ${pair[0].name}</p>
                <audio controls src="${pair[0].webContentLink}"></audio>
                <button class="choice-btn" data-index="0">Choose A</button>
            </div>
            <div class="audio-choice">
                <p>Option B: ${pair[1].name}</p>
                <audio controls src="${pair[1].webContentLink}"></audio>
                <button class="choice-btn" data-index="1">Choose B</button>
            </div>
        </div>
        <p>Progress: <span id="filesRated">0</span>/<span id="totalFiles">0</span></p>
    `;

    // Set up choice buttons
    document.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const winnerIndex = parseInt(button.dataset.index);
            recordResult(winnerIndex);
        });
    });
}

function recordResult(winnerIndex) {
    const winner = currentPair[winnerIndex];
    const loser = currentPair[1 - winnerIndex];
    
    roundRobinResults[winner.id].wins++;
    roundRobinResults[winner.id].total++;
    roundRobinResults[loser.id].total++;
    
    currentFileIndex++;
    document.getElementById('filesRated').textContent = currentFileIndex;
    
    loadNextPair();
}

function showResults() {
    document.querySelector('.player-section').style.display = 'none';
    document.querySelector('.results-section').style.display = 'block';
    
    // Sort files by win percentage
    const sortedFiles = mp3Files.sort((a, b) => {
        const aScore = roundRobinResults[a.id].wins / roundRobinResults[a.id].total;
        const bScore = roundRobinResults[b.id].wins / roundRobinResults[b.id].total;
        return bScore - aScore;
    });
    
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '';
    
    sortedFiles.forEach(file => {
        const result = roundRobinResults[file.id];
        const winPercentage = ((result.wins / result.total) * 100).toFixed(1);
        const li = document.createElement('li');
        li.textContent = `${file.name} - Win rate: ${winPercentage}% (${result.wins}/${result.total})`;
        resultsList.appendChild(li);
    });
}