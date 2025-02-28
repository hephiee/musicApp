console.log('Script starting...');

// Supabase client
const supabaseClient = supabase.createClient(
    'https://xtwamtfxirypcxszldow.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0d2FtdGZ4aXJ5cGN4c3psZG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NTIwMzQsImV4cCI6MjA1NjAyODAzNH0.ZZRtoHPlie0FN5IAF1WVd4sRqWOWH_ZfP149Gorit1c'
);

// Show message function
function showMessage(type, message) {
    const element = document.getElementById(`${type}Message`);
    if (element) {
        if (!message) {
            element.classList.add('hidden');
            return;
        }
        element.textContent = message;
        element.classList.remove('hidden');
        element.classList.add('show');
        setTimeout(() => {
            element.classList.remove('show');
            element.classList.add('hidden');
        }, 5000);
    } else {
        console.error('Message element not found:', type);
    }
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

// Add this function to handle button state
function disableButton(buttonId, seconds) {
    const button = document.getElementById(buttonId);
    const originalText = button.textContent;
    button.disabled = true;
    
    let timeLeft = seconds;
    button.textContent = `Wait ${timeLeft}s...`;
    
    const timer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(timer);
            button.disabled = false;
            button.textContent = originalText;
        } else {
            button.textContent = `Wait ${timeLeft}s...`;
        }
    }, 1000);
}

// Modify the cooldown timer to be shorter and only activate after multiple attempts
let signupAttempts = 0;
const MAX_ATTEMPTS = 3;
const COOLDOWN_SECONDS = 30;

// Function to sign up
async function handleSignup() {
    const username = document.getElementById('signupUsername').value;
    const password = document.getElementById('signupPassword').value;
    const email = document.getElementById('signupEmail').value;

    // Clear any existing messages
    showMessage('signupError', '');
    showMessage('signupSuccess', '');

    // Validate inputs
    if (!username || !password || !email) {
        showMessage('signupError', 'Please fill in all fields');
        return;
    }

    // Validate password length
    if (password.length < 6) {
        showMessage('signupError', 'Password must be at least 6 characters long');
        return;
    }

    // Validate email format
    if (!email.includes('@')) {
        showMessage('signupError', 'Please enter a valid email address');
        return;
    }

    try {
        // First check if the username is available
        const { data: existingProfile } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('username', username)
            .maybeSingle();

        if (existingProfile) {
            showMessage('signupError', 'Username already taken');
            return;
        }

        // Create auth user
        console.log('Creating auth user with:', { email, passwordLength: password.length });
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (authError) {
            console.error('Auth error:', authError);
            showMessage('signupError', authError.message);
            return;
        }

        if (!authData?.user) {
            console.error('No user data returned');
            showMessage('signupError', 'Failed to create account');
            return;
        }

        console.log('Auth successful, creating profile for user:', authData.user.id);

        // First check if profile exists
        const { data: existingUserProfile } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('id', authData.user.id)
            .single();

        if (existingUserProfile) {
            console.log('Profile already exists, updating username');
            // Update existing profile
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update({ username: username })
                .eq('id', authData.user.id);

            if (updateError) {
                console.error('Profile update error:', updateError);
                showMessage('signupError', 'Error updating profile');
                return;
            }
        } else {
            // Create new profile
            const { error: insertError } = await supabaseClient
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    username: username
                });

            if (insertError) {
                console.error('Profile creation error:', insertError);
                showMessage('signupError', 'Error creating profile');
                return;
            }
        }

        console.log('Profile created/updated successfully');
        showMessage('signupSuccess', 'Account created! Please check your email to confirm your account.');
        
        // Clear form
        document.getElementById('signupUsername').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('signupEmail').value = '';

    } catch (error) {
        console.error('Unexpected error during signup:', error);
        showMessage('signupError', 'An unexpected error occurred');
    }
}

// Reset attempts after cooldown period
setInterval(() => {
    signupAttempts = 0;
}, COOLDOWN_SECONDS * 1000);

// Function to login
async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showMessage('loginError', 'Please enter both email and password');
        return;
    }

    try {
        const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (signInError) {
            console.error('Sign in error:', signInError);
            showMessage('loginError', 'Invalid email or password');
            return;
        }

        if (data?.user) {
            // Get the user's profile
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('username')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                console.error('Profile fetch error:', profileError);
                showMessage('loginError', 'Error fetching profile');
                return;
            }

            localStorage.setItem('musicUserLoggedIn', 'true');
            localStorage.setItem('musicUsername', profile.username);

            // Success animation and redirect
            document.getElementById('loginSection').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loginSection').classList.add('hidden');
                document.getElementById('contentSection').classList.remove('hidden');
                document.getElementById('contentSection').style.opacity = '1';
                document.getElementById('currentUser').textContent = profile.username;
                window.location.href = '/dashboard.html';
            }, 500);
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('loginError', 'Error during login');
    }
}

// Add session check function
async function checkSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
        console.error('Error checking session:', error);
        return null;
    }
    return session;
}

// Add logout function
async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        localStorage.removeItem('musicUserLoggedIn');
        localStorage.removeItem('musicUsername');
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Add these debug functions at the top after the Supabase client
async function testSupabaseConnection() {
    console.log('Testing Supabase connection...');
    try {
        // First, log the client configuration
        console.log('Supabase client config:', {
            url: supabaseClient.supabaseUrl,
            hasAnon: !!supabaseClient.supabaseKey
        });

        // Try a simple query
        const { data, error } = await supabaseClient
            .from('users')
            .select('count');

        if (error) {
            console.error('Connection test error:', error);
            return false;
        }

        console.log('Connection successful!');
        return true;
    } catch (error) {
        console.error('Connection test failed:', error);
        return false;
    }
}

async function checkDatabase() {
    console.log('Checking database contents...');
    try {
        // First test connection
        const connected = await testSupabaseConnection();
        if (!connected) {
            console.error('Failed to connect to Supabase');
            return;
        }

        // Try to get all users
        const { data, error } = await supabaseClient
            .from('users')
            .select('*');
            
        if (error) {
            console.error('Error checking database:', error);
            console.error('Error details:', {
                code: error.code,
                msg: error.message,
                details: error.details
            });
            return;
        }
        
        console.log('Raw database response:', data);
        console.log('Number of users found:', data ? data.length : 0);
        if (data && data.length > 0) {
            console.log('First user example:', data[0]);
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

function setupBackgroundSlider() {
    const images = document.querySelectorAll('.slider-img');
    console.log('Found images:', images.length);
    
    const directions = ['slide-left', 'slide-right', 'slide-top', 'slide-bottom'];
    let currentIndex = 0;
    let isAnimating = false;

    // Set initial styles
    images.forEach((img, index) => {
        img.style.opacity = '0';
        img.style.display = 'block'; // Make sure images are visible
        console.log(`Image ${index} initialized:`, img.src);
    });

    function animateNextImage() {
        if (isAnimating) return;
        isAnimating = true;

        console.log('Animating image:', currentIndex);

        // Clear all images
        images.forEach(img => {
            img.classList.remove(...directions);
            img.style.opacity = '0';
        });

        // Get random direction
        const randomDirection = directions[Math.floor(Math.random() * directions.length)];
        console.log('Using direction:', randomDirection);
        
        // Animate current image
        const currentImage = images[currentIndex];
        currentImage.style.display = 'block';
        currentImage.classList.add(randomDirection);
        
        // Update index for next image
        currentIndex = (currentIndex + 1) % images.length;
        
        // Wait for animation to complete (10 seconds) plus 3 seconds gap
        setTimeout(() => {
            currentImage.classList.remove(randomDirection);
            currentImage.style.opacity = '0';
            isAnimating = false;
            
            // Schedule next animation after 3 second gap
            setTimeout(animateNextImage, 3000);
        }, 10000);
    }

    // Start the animation sequence
    console.log('Starting animation sequence');
    animateNextImage();
}

// Update window.onload
window.onload = function() {
    console.log('Page loaded, initializing...');
    
    // Add event listeners
    document.getElementById('loginButton').addEventListener('click', handleLogin);
    document.getElementById('signupButton').addEventListener('click', handleSignup);
    
    // Setup background slider
    setupBackgroundSlider();
    console.log('Background slider initialized');
    
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
