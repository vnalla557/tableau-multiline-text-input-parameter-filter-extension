console.log('=== script.js loading ===');
console.log('Tableau object exists:', !!window.tableau);
console.log('Tableau extensions object exists:', !!(window.tableau && tableau.extensions));

'use strict';

// Debug mode
const DEBUG = true;

function debugLog(message, data) {
    if (DEBUG) {
        console.log(`DEBUG - ${message}:`, data);
    }
}

// Function to apply text box settings
function setupTextBox() {
    const container = document.querySelector('.container');
    
    // Make container fill available height
    container.style.height = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.height = '100%';

    // Get settings
    const settings = tableau.extensions.settings.getAll();
    
    // Update or create heading
    let heading = document.getElementById('inputHeading');
    if (!heading) {
        heading = document.createElement('h3');
        heading.id = 'inputHeading';
        const textbox = document.getElementById('textInput');
        textbox.parentNode.insertBefore(heading, textbox);
    }
    heading.textContent = settings.headingText || 'Title';
    
    // Configure text box
    const textbox = document.getElementById('textInput');
    textbox.style.height = '100%';
    textbox.style.width = '100%';
    textbox.removeAttribute('rows');
    
    // Apply placeholder text from settings
    if (settings.placeholderText) {
        textbox.placeholder = settings.placeholderText;
    }
}

// Initialize the extension
console.log('About to initialize extension...');
tableau.extensions.initializeAsync({
    configure: function() {
        console.log('=== Configure callback triggered ===');
        // Get the URL for the configuration page
        const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
        const popupUrl = `${baseUrl}/configure.html`;
        debugLog('Configuration URLs', { baseUrl, popupUrl });
        
        // Display the configuration dialog
        tableau.extensions.ui.displayDialogAsync(popupUrl, '', {
            height: 650,  // Configuration window height
            width: 500   // Configuration window width
        }).then((closePayload) => {
            debugLog('Configuration dialog closed', closePayload);
            
            // Apply the new settings
            setupTextBox();
            
            // If closePayload is 'apply', trigger the parameter update
            if (closePayload === 'apply') {
                console.log('Configuration saved - triggering parameter update');
                setParameterValue();
            }
            
            // Check all settings after configuration
            const updatedSettings = tableau.extensions.settings.getAll();
            debugLog('Settings after configuration', {
                ...updatedSettings,
                sqlPreventionEnabled: updatedSettings.sqlPreventionEnabled,
                sqlPreventionEnabledParsed: updatedSettings.sqlPreventionEnabled === 'true'
            });
        }).catch((error) => {
            if (error.message === "Dialog closed by user." || 
                error.message === "dialog-closed-by-user: Extension dialog closed by user.") {
                debugLog('Dialog closed by user', error.message);
                
                const currentSettings = tableau.extensions.settings.getAll();
                debugLog('Settings after dialog close', currentSettings);
            } else {
                console.error('=== Error displaying configuration dialog ===');
                console.error('Error details:', error);
                console.error('Error stack:', error.stack);
                alert('Error opening configuration dialog: ' + error.toString());
            }
        });
    }
}).then(async () => {
    console.log('=== Extension initialized successfully ===');
    
    // Set up the text box
    setupTextBox();
    
    // Add event listener to the Set button
    document.getElementById('setButton').addEventListener('click', setParameterValue);
    debugLog('Event listeners setup', 'complete');
    
    // Check settings
    const settings = tableau.extensions.settings.getAll();
    debugLog('Initial extension settings', {
        ...settings,
        sqlPreventionEnabled: settings.sqlPreventionEnabled,
        sqlPreventionEnabledParsed: settings.sqlPreventionEnabled === 'true'
    });
}).catch(error => {
    console.error('=== Error initializing extension ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    alert('Failed to initialize extension: ' + error.toString());
});

// Function to sanitize input
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // Remove any SQL commands or special characters that could be used for injection
    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|INTO|FROM|WHERE|TABLE)\b/gi;
    let sanitized = input.replace(sqlKeywords, '');
    
    // Remove special SQL characters
    sanitized = sanitized.replace(/[;'"\\]/g, '');
    
    // Optional: Replace multiple spaces with single space
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    return sanitized.trim();
}

// Function to set the parameter value
async function setParameterValue() {
    try {
        console.log('=== Setting parameter value ===');
        // Get the text from the textarea and process multi-line input
        const textValue = document.getElementById('textInput').value;
        
        // Get all settings
        const settings = tableau.extensions.settings.getAll();
        console.log('Current settings when processing:', settings);
        
        // Get settings with defaults
        const separator = settings.separator || ',';
        const sqlPreventionEnabled = settings.sqlPreventionEnabled === undefined ? true : settings.sqlPreventionEnabled === 'true';
        
        console.log('Using settings:', {
            separator,
            sqlPreventionEnabled,
            rawSqlPreventionValue: settings.sqlPreventionEnabled
        });
        
        // Split by newlines, process each line, remove empty lines, and join with configured separator
        const processedValue = textValue
            .split('\n')
            .map(line => {
                const trimmed = line.trim();
                return sqlPreventionEnabled ? sanitizeInput(trimmed) : trimmed;
            })
            .filter(line => line.length > 0)
            .join(separator);
        
        console.log('Text processing:', {
            original: textValue,
            processed: processedValue,
            sqlPreventionWasApplied: sqlPreventionEnabled
        });
        
        // Get the selected parameter ID from settings
        console.log('Current settings:', settings);
        const selectedParameterId = settings.selectedParameterId;
        console.log('Selected parameter ID:', selectedParameterId);
        
        if (!selectedParameterId) {
            console.log('No parameter configured');
            alert('Please configure the extension by selecting a parameter first.');
            return;
        }
        
        // Get all parameters
        console.log('Getting parameters...');
        const parameters = await tableau.extensions.dashboardContent.dashboard.getParametersAsync();
        console.log('Available parameters:', parameters);
        console.log('Parameters array details:', parameters.map(p => ({
            name: p.name,
            id: p.id,
            dataType: p.dataType,
            allowableValues: p.allowableValues,
            currentValue: p.currentValue
        })));
        
        // Find the selected parameter
        const selectedParameter = parameters.find(p => p.id === selectedParameterId);
        console.log('Found selected parameter:', selectedParameter);
        
        if (selectedParameter) {
            // Change the parameter value
            console.log('Updating parameter value...');
            await selectedParameter.changeValueAsync(processedValue);
            console.log('Parameter value updated successfully');
        } else {
            console.error('Selected parameter not found in the dashboard');
            console.log('Available parameter IDs:', parameters.map(p => p.id));
            alert('The configured parameter was not found. Please reconfigure the extension.');
        }
    } catch (error) {
        console.error('=== Error setting parameter value ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        alert('Error setting parameter value: ' + error.toString());
    }
} 