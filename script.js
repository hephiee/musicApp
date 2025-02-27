console.log('Script starting...');

// Supabase client
const supabaseClient = supabase.createClient(
    'https://xtwamtfxirypcxszldow.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0d2FtdGZ4aXJ5cGN4c3psZG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NTIwMzQsImV4cCI6MjA1NjAyODAzNH0.ZZRtoHPlie0FN5IAF1WVd4sRqWOWH_ZfP149Gorit1c'
);

// Show message function
function showMessage(type, message) {
    const element = document.getElementById(`${type}Message`);
    element.textContent = message;
    element.classList.remove('hidden');
    element.classList.add('show');
    setTimeout(() => {
        element.classList.remove('show');
        element.classList.add('hidden');
    }, 3000);
}

function showErrorWindow(type, message) {
    const errorWindow = document.getElementById(`${type}ErrorWindow`);
    errorWindow.classList.remove('hidden');
    
    // Add click handler to close button
    const closeButton = errorWindow.querySelector('.error-close');
    closeButton.onclick = () => {
        errorWindow.classList.add('hidden');
    };
}

// Function to create account
async function handleSignup() {
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;

    if (!username || !password) {
        showMessage('signupError', 'Please enter both username and password');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .insert([{ 
                username: username,
                password: password
            }]);

        if (error) {
            if (error.code === '23505') {  // Unique constraint violation
                showErrorWindow('signup');  // Show the error window
            } else {
                showMessage('signupError', 'Error creating account: ' + error.message);
            }
            return;
        }

        showMessage('signupSuccess', 'Account created successfully!');
        document.getElementById('signupUsername').value = '';
        document.getElementById('signupPassword').value = '';
    } catch (error) {
        console.error('Error:', error);
        showMessage('signupError', 'Error creating account');
    }
}

// Function to login
async function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showMessage('loginError', 'Please enter both username and password');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            showErrorWindow('login');
            return;
        }

        // Store user session data
        localStorage.setItem('musicUserLoggedIn', 'true');
        localStorage.setItem('musicUsername', username);
        
        // Successful login animation
        document.getElementById('loginSection').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('contentSection').classList.remove('hidden');
            document.getElementById('contentSection').style.opacity = '1';
            document.getElementById('currentUser').textContent = username;
            
            // Redirect after animations (you can change this URL)
            window.location.href = '/dashboard.html';
        }, 500);

        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        console.error('Error:', error);
        showMessage('loginError', 'Error during login');
    }
}

// Add event listeners when page loads
window.onload = function() {
    console.log('Page loaded, adding event listeners');
    document.getElementById('loginButton').addEventListener('click', handleLogin);
    document.getElementById('signupButton').addEventListener('click', handleSignup);
    
    // Add input animations
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        input.addEventListener('blur', () => {
            if (!input.value) {
                input.parentElement.classList.remove('focused');
            }
        });
    });
};
