console.log('=== configure.js loading ===');

'use strict';

// Debug mode
const DEBUG = true;

// License key validation
const VALID_LICENSE_PREFIX = 'MLTIP-'; // Multiline Text Input Parameter
const LICENSE_KEY_LENGTH = 25; // Including prefix

function validateLicenseKey(key) {
    if (!key) return false;
    if (!key.startsWith(VALID_LICENSE_PREFIX)) return false;
    if (key.length !== LICENSE_KEY_LENGTH) return false;
    
    // Simple validation - check format and allowed characters
    const licenseBody = key.substring(VALID_LICENSE_PREFIX.length);
    const validCharsRegex = /^[A-Z0-9]+$/;
    return validCharsRegex.test(licenseBody);
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
    const licenseStatus = document.getElementById('licenseStatus');
    const configSection = document.getElementById('configSection');

    if (savedLicenseKey && validateLicenseKey(savedLicenseKey)) {
        licenseKeyInput.value = savedLicenseKey;
        licenseStatus.textContent = 'License validated';
        licenseStatus.className = 'status-message success';
        licenseStatus.style.display = 'block';
        configSection.style.display = 'block';
    }

    // Add license key validation handler
    licenseKeyInput.addEventListener('input', function() {
        const key = this.value.trim().toUpperCase();
        this.value = key;
        
        if (validateLicenseKey(key)) {
            licenseStatus.textContent = 'License key valid';
            licenseStatus.className = 'status-message success';
            configSection.style.display = 'block';
        } else {
            licenseStatus.textContent = 'Invalid license key';
            licenseStatus.className = 'status-message error';
            configSection.style.display = 'none';
        }
        licenseStatus.style.display = 'block';
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

// Save the configuration
async function saveConfiguration() {
    try {
        const licenseKey = document.getElementById('licenseKey').value.trim();
        
        if (!validateLicenseKey(licenseKey)) {
            showStatus('Please enter a valid license key', true);
            return;
        }

        showStatus('Saving configuration...');
        
        // Save license key
        await tableau.extensions.settings.set('licenseKey', licenseKey);
        
        const select = document.getElementById('parameterSelect');
        const selectedParameterId = select.value;
        const headingText = document.getElementById('headingText').value;
        const placeholderText = document.getElementById('placeholderText').value;
        const separator = document.getElementById('separator').value || ',';
        const checkbox = document.getElementById('sqlPreventionEnabled');
        
        console.log('Form values collected:', {
            selectedParameterId,
            headingText,
            placeholderText,
            separator,
            sqlPreventionEnabled: checkbox.checked
        });
        
        if (!selectedParameterId) {
            throw new Error('Please select a parameter.');
        }

        // Create settings object
        const newSettings = {
            selectedParameterId,
            headingText,
            placeholderText,
            separator,
            sqlPreventionEnabled: checkbox.checked ? 'true' : 'false'
        };
        
        console.log('Attempting to save settings:', newSettings);
        
        // Save each setting
        for (const [key, value] of Object.entries(newSettings)) {
            console.log(`Setting ${key}=${value}`);
            await tableau.extensions.settings.set(key, value);
        }
        
        // Save all settings
        console.log('Calling saveAsync...');
        await tableau.extensions.settings.saveAsync();
        
        // Verify settings were saved
        const savedSettings = tableau.extensions.settings.getAll();
        console.log('Saved settings:', savedSettings);
        
        // Show success
        showStatus('Settings saved successfully!');
        
        // Close dialog with signal to apply
        console.log('Closing dialog after successful save');
        closeDialog();
        
    } catch (error) {
        console.error('Error saving configuration:', error);
        showStatus('Error saving configuration: ' + error.message, true);
    }
} 