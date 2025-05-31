console.log('=== configure.js loading ===');

'use strict';

// Debug mode
const DEBUG = true;

// License key validation
const VALID_LICENSE_PREFIX = 'MLTIP-'; // Multiline Text Input Parameter
const LICENSE_KEY_LENGTH = 25; // Including prefix

function validateLicenseKey(key) {
    console.log('Validating key:', key);
    
    if (!key) {
        console.log('Key is empty');
        return false;
    }
    
    console.log('Checking prefix. Key starts with:', key.substring(0, 6));
    if (!key.startsWith(VALID_LICENSE_PREFIX)) {
        console.log('Invalid prefix');
        return false;
    }
    
    console.log('Checking length. Key length:', key.length, 'Expected:', LICENSE_KEY_LENGTH);
    if (key.length !== LICENSE_KEY_LENGTH) {
        console.log('Invalid length');
        return false;
    }
    
    // Simple validation - check format and allowed characters
    const licenseBody = key.substring(VALID_LICENSE_PREFIX.length);
    console.log('Checking license body:', licenseBody);
    const validCharsRegex = /^[A-Z0-9]+$/;
    const isValid = validCharsRegex.test(licenseBody);
    console.log('License validation result:', isValid);
    return isValid;
}

function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = VALID_LICENSE_PREFIX;
    
    // Generate random characters
    for (let i = 0; i < LICENSE_KEY_LENGTH - VALID_LICENSE_PREFIX.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        key += char;
    }
    
    return key;
}

// Immediate check for save button
const saveButton = document.getElementById('saveButton');
console.log('Found save button:', saveButton);

function debugLog(message, data) {
    if (DEBUG) {
        console.log(`DEBUG - ${message}:`, data);
    }
}

function showStatus(message, isError = false) {
    console.log('Status Message:', message, isError ? '(ERROR)' : '');
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = 'status-message ' + (isError ? 'error' : 'info');
    statusDiv.style.display = 'block';  // Ensure status is visible
}

// Initialize the configuration
console.log('About to initialize dialog...');
showStatus('Initializing...');

// Debug: Check if tableau object exists
console.log('Tableau object exists:', !!window.tableau);
console.log('Tableau extensions object exists:', !!(window.tableau && tableau.extensions));

tableau.extensions.initializeDialogAsync().then(async () => {
    console.log('=== Configuration dialog initialized successfully ===');
    showStatus('Loading settings...');
    
    // Load existing settings
    const settings = tableau.extensions.settings.getAll();
    debugLog('Initial settings load', settings);

    // Check for existing license key
    const savedLicenseKey = settings.licenseKey;
    const licenseKeyInput = document.getElementById('licenseKey');
    const licenseCollapsed = document.getElementById('licenseCollapsed');
    const licenseDetails = document.getElementById('licenseDetails');
    const configSection = document.getElementById('configSection');

    if (savedLicenseKey && validateLicenseKey(savedLicenseKey)) {
        licenseKeyInput.value = savedLicenseKey;
        licenseCollapsed.style.display = 'block';
        licenseDetails.style.display = 'none';
        configSection.style.display = 'block';
    } else {
        licenseCollapsed.style.display = 'none';
        licenseDetails.style.display = 'block';
    }

    // Add license key validation handler
    licenseKeyInput.addEventListener('input', function() {
        const key = this.value.trim().toUpperCase();
        console.log('License key input:', key);
        this.value = key;
        
        // Clear any previous error messages
        clearStatus();
        
        const isValid = validateLicenseKey(key);
        console.log('Validation result:', isValid);
        
        if (isValid) {
            // Show collapsed view
            document.getElementById('licenseCollapsed').style.display = 'block';
            document.getElementById('licenseDetails').style.display = 'none';
            configSection.style.display = 'block';
            document.getElementById('saveButton').disabled = false;
        } else {
            // Show expanded view with error
            document.getElementById('licenseCollapsed').style.display = 'none';
            document.getElementById('licenseDetails').style.display = 'block';
            licenseStatus.textContent = 'Invalid license key';
            licenseStatus.className = 'status-message error';
            licenseStatus.style.display = 'block';
            configSection.style.display = 'none';
        }
    });

    // Handle SQL Prevention setting - default to true if not set
    const sqlPreventionSetting = settings.sqlPreventionEnabled;
    debugLog('SQL Prevention setting loaded as', {
        raw: sqlPreventionSetting,
        parsed: sqlPreventionSetting === 'true'
    });
    
    if (sqlPreventionSetting === undefined) {
        debugLog('SQL Prevention undefined, setting default to true', true);
        await tableau.extensions.settings.set('sqlPreventionEnabled', 'true');
        await tableau.extensions.settings.saveAsync();
    }

    // Set existing heading text if it exists
    if (settings.headingText) {
        document.getElementById('headingText').value = settings.headingText;
    }

    // Set existing placeholder text if it exists
    if (settings.placeholderText) {
        document.getElementById('placeholderText').value = settings.placeholderText;
    }

    // Set existing separator if it exists
    if (settings.separator) {
        document.getElementById('separator').value = settings.separator;
    }

    // Handle SQL prevention checkbox - default to checked
    const checkbox = document.getElementById('sqlPreventionEnabled');
    const checkboxState = sqlPreventionSetting === undefined ? true : sqlPreventionSetting === 'true';
    checkbox.checked = checkboxState;
    debugLog('Setting checkbox state', {
        settingValue: sqlPreventionSetting,
        parsedValue: checkboxState,
        finalCheckboxState: checkbox.checked
    });

    // Load the parameters and populate the dropdown
    loadParameters();
    
    // Add event listeners to buttons with verification
    const saveButton = document.getElementById('saveButton');
    if (!saveButton) {
        console.error('Save button not found in DOM!');
        showStatus('Error: Save button not found', true);
        return;
    }

    console.log('Attaching click handler to save button');
    saveButton.addEventListener('click', async (event) => {
        console.log('Save button clicked - preventing default closure');
        event.preventDefault();
        
        // Disable the save button to prevent double-clicks
        saveButton.disabled = true;
        
        try {
            await saveConfiguration();
            console.log('Save configuration completed');
        } catch (error) {
            console.error('Error during save:', error);
            showStatus('Failed to save settings: ' + error.message, true);
            saveButton.disabled = false;
        }
    });

    // Log button state
    console.log('Save button state:', {
        disabled: saveButton.disabled,
        visible: saveButton.offsetParent !== null,
        id: saveButton.id,
        hasClickListener: saveButton.onclick !== null
    });

    document.getElementById('cancelButton').addEventListener('click', closeDialog);
}).catch(error => {
    console.error('=== Error initializing dialog ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    showStatus('Failed to initialize: ' + error.toString(), true);
});

// Load parameters into the dropdown
async function loadParameters() {
    try {
        console.log('=== Starting to load parameters... ===');
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        
        // Only log relevant dashboard properties
        console.log('Dashboard available:', !!dashboard);
        if (dashboard) {
            console.log('Dashboard properties:', {
                name: dashboard.name,
                id: dashboard.id
            });
        }
        
        if (!dashboard) {
            throw new Error('Could not access dashboard object');
        }

        showStatus('Loading parameters...');  // Changed from 'Fetching parameters'
        console.log('Calling getParametersAsync...');
        const parameters = await dashboard.getParametersAsync();
        
        // Log only relevant parameter properties
        if (parameters) {
            console.log('Number of parameters:', parameters.length);
            console.log('Parameters:', parameters.map(p => ({
                name: p.name,
                id: p.id,
                dataType: p.dataType,
                currentValue: p.currentValue
            })));
        } else {
            console.log('No parameters found');
        }
        
        const select = document.getElementById('parameterSelect');
        console.log('Select element found:', !!select);
        
        // Get the currently selected parameter ID from settings
        const settings = tableau.extensions.settings.getAll();
        console.log('Current settings:', settings);
        const currentParameterId = settings.selectedParameterId;
        console.log('Current parameter ID:', currentParameterId);
        
        // Clear existing options
        select.innerHTML = '';
        console.log('Cleared existing options');
        
        // Add parameters to dropdown
        if (parameters && parameters.length > 0) {
            console.log(`Adding ${parameters.length} parameters to dropdown`);
            const paramCount = parameters.length;
            const paramWord = paramCount === 1 ? 'parameter' : 'parameters';
            showStatus(`Found ${paramCount} ${paramWord}`);  // Changed message format
            
            parameters.forEach(parameter => {
                const paramInfo = {
                    name: parameter.name,
                    id: parameter.id,
                    dataType: parameter.dataType
                };
                console.log('Processing parameter:', paramInfo);
                
                const option = document.createElement('option');
                option.value = parameter.id;
                option.text = `${parameter.name} (${parameter.dataType})`;
                option.selected = parameter.id === currentParameterId;
                select.appendChild(option);
            });
            
            // Enable save button
            document.getElementById('saveButton').disabled = false;
            console.log('Save button enabled');
        } else {
            console.log('No parameters found in the dashboard');
            showStatus('No parameters found in the dashboard. Please create at least one parameter.', true);
            select.innerHTML = '<option value="">No parameters available - Create a parameter in Tableau first</option>';
            document.getElementById('saveButton').disabled = true;
            console.log('Save button disabled');
        }
    } catch (error) {
        console.error('=== Error in loadParameters ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        showStatus('Error loading parameters: ' + error.message, true);
        const select = document.getElementById('parameterSelect');
        select.innerHTML = '<option value="">Error loading parameters</option>';
        document.getElementById('saveButton').disabled = true;
    }
}

// Close the dialog
function closeDialog() {
    const finalSettings = tableau.extensions.settings.getAll();
    debugLog('Final settings at close', finalSettings);
    tableau.extensions.ui.closeDialog('apply');  // Signal to trigger apply
}

// Add this function to clear status messages
function clearStatus() {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.style.display = 'none';
    statusDiv.textContent = '';
    statusDiv.className = 'status-message';
}

// Save the configuration
async function saveConfiguration() {
    try {
        clearStatus(); // Clear any previous status messages
        
        const licenseKey = document.getElementById('licenseKey').value.trim();
        const saveButton = document.getElementById('saveButton');
        
        if (!validateLicenseKey(licenseKey)) {
            showStatus('Please enter a valid license key', true);
            saveButton.disabled = false;
            return;
        }

        // Disable save button while saving
        saveButton.disabled = true;
        showStatus('Saving configuration...');
        
        // Save license key
        await tableau.extensions.settings.set('licenseKey', licenseKey);
        
        const select = document.getElementById('parameterSelect');
        const selectedParameterId = select.value;
        
        if (!selectedParameterId) {
            showStatus('Please select a parameter', true);
            saveButton.disabled = false;
            return;
        }

        const headingText = document.getElementById('headingText').value;
        const placeholderText = document.getElementById('placeholderText').value;
        const separator = document.getElementById('separator').value || ',';
        const checkbox = document.getElementById('sqlPreventionEnabled');
        
        // Create settings object
        const newSettings = {
            selectedParameterId,
            headingText,
            placeholderText,
            separator,
            sqlPreventionEnabled: checkbox.checked ? 'true' : 'false'
        };
        
        // Save each setting
        for (const [key, value] of Object.entries(newSettings)) {
            await tableau.extensions.settings.set(key, value);
        }
        
        // Save all settings
        await tableau.extensions.settings.saveAsync();
        
        // Show success and close dialog
        showStatus('Settings saved successfully!');
        setTimeout(() => {
            tableau.extensions.ui.closeDialog('save');
        }, 1000);
        
    } catch (error) {
        console.error('Error saving configuration:', error);
        showStatus('Error saving configuration: ' + error.message, true);
        document.getElementById('saveButton').disabled = false;
    }
}

// Add toggle function for license details
function toggleLicenseDetails() {
    const licenseDetails = document.getElementById('licenseDetails');
    const expandButton = document.querySelector('.expand-button');
    
    if (licenseDetails.style.display === 'none') {
        licenseDetails.style.display = 'block';
        expandButton.classList.add('expanded');
    } else {
        licenseDetails.style.display = 'none';
        expandButton.classList.remove('expanded');
    }
} 