const supabase = supabaseJs.createClient(
    'YOUR_SUPABASE_URL',
    'YOUR_SUPABASE_ANON_KEY'
)

let mp3Files = [];
let currentFileIndex = 0;
let ratings = {};

// Add these new constants
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

// Record a new vote
async function recordVote(winnerUrl, loserUrl) {
    // Add the vote
    const { error: voteError } = await supabase
        .from('votes')
        .insert([{ 
            winner_video_url: winnerUrl, 
            loser_video_url: loserUrl 
        }]);

    // Update the summary for winner
    const { error: winnerError } = await supabase
        .from('results_summary')
        .upsert({ 
            video_url: winnerUrl,
            wins: supabase.raw('wins + 1'),
            total_matches: supabase.raw('total_matches + 1'),
            last_updated: new Date()
        });

    // Update the summary for loser
    const { error: loserError } = await supabase
        .from('results_summary')
        .upsert({ 
            video_url: loserUrl,
            total_matches: supabase.raw('total_matches + 1'),
            last_updated: new Date()
        });

    if (voteError || winnerError || loserError) {
        console.error('Error recording vote:', voteError || winnerError || loserError);
    }
}

// Get current results
async function getResults() {
    const { data, error } = await supabase
        .from('results_summary')
        .select('*')
        .order('wins', { ascending: false });
    
    if (error) {
        console.error('Error fetching results:', error);
        return [];
    }
    
    return data;
}

// Test function to check if database is connected and working
async function testDatabaseConnection() {
    try {
        // Try to add a test video result
        const testData = {
            video_url: "test_url",
            title: "Test Video",
        };

        const { data, error } = await supabase
            .from('results_summary')
            .upsert(testData);

        if (error) {
            console.error("Database test failed:", error);
            return false;
        }

        console.log("Database connection successful!");
        return true;
    } catch (e) {
        console.error("Database test failed:", e);
        return false;
    }
}

// Test function to record a sample vote
async function testRecordVote() {
    try {
        await recordVote(
            "test_video_1", 
            "test_video_2"
        );
        console.log("Test vote recorded successfully!");
        
        // Get and display results
        const results = await getResults();
        console.log("Current results:", results);
    } catch (e) {
        console.error("Test vote failed:", e);
    }
}

// Run tests when page loads
window.onload = async function() {
    await testDatabaseConnection();
    await testRecordVote();
}
