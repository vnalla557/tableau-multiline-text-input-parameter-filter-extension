console.log('=== configure.js loading ===');

'use strict';

// Debug mode
const DEBUG = true;

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
    
    // Verify buttons exist
    const saveBtn = document.getElementById('saveButton');
    const cancelBtn = document.getElementById('cancelButton');
    console.log('Save button exists:', !!saveBtn);
    console.log('Cancel button exists:', !!cancelBtn);
    
    // Load existing settings
    const settings = tableau.extensions.settings.getAll();
    debugLog('Initial settings load', settings);

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
    console.log('saveConfiguration function called');
    
    // Show saving status immediately
    showStatus('Saving settings...');
    
    try {
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
        console.error('Save failed:', error);
        throw error; // Re-throw to be handled by the click handler
    }
} 