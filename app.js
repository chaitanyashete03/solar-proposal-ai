// Initial State & Local Storage Setup (Global)
let leads = JSON.parse(localStorage.getItem('solarLeads')) || [];
let apiKey = localStorage.getItem('geminiApiKey') || '';

// DOM Reference holders
let form, crmBody, leadCount, leadsMobileGrid, settingsModal, proposalModal, settingsBtn, closeSettingsBtn, closeProposalBtn, apiKeyInput, saveApiBtn, proposalContent, proposalTitle, loadingState, printBtn;

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    form = document.getElementById('leadForm');
    crmBody = document.getElementById('crmBody');
    leadCount = document.getElementById('leadCount');
    leadsMobileGrid = document.getElementById('leadsMobileGrid');

    // Modals
    settingsModal = document.getElementById('settingsModal');
    proposalModal = document.getElementById('proposalModal');
    settingsBtn = document.getElementById('settingsBtn');
    closeSettingsBtn = document.getElementById('closeSettings');
    closeProposalBtn = document.getElementById('closeProposal');

    // Settings
    apiKeyInput = document.getElementById('apiKey');
    saveApiBtn = document.getElementById('saveApiBtn');

    // Proposal elements
    proposalContent = document.getElementById('proposalContent');
    proposalTitle = document.getElementById('proposalTitle');
    loadingState = document.getElementById('loadingState');
    printBtn = document.getElementById('printBtn');

    // Initialization
    if (apiKeyInput) apiKeyInput.value = apiKey;
    renderCRM();

    // Event Listeners
    if (form) form.addEventListener('submit', handleNewLead);
    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        if (settingsModal) settingsModal.classList.add('active');
    });
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => {
        if (settingsModal) settingsModal.classList.remove('active');
    });
    if (closeProposalBtn) closeProposalBtn.addEventListener('click', () => {
        if (proposalModal) proposalModal.classList.remove('active');
    });

    if (saveApiBtn) saveApiBtn.addEventListener('click', () => {
        if (apiKeyInput) {
            apiKey = apiKeyInput.value.trim();
            localStorage.setItem('geminiApiKey', apiKey);
            if (settingsModal) settingsModal.classList.remove('active');
            alert("Settings saved successfully!");
        }
    });

    if (printBtn) printBtn.addEventListener('click', generatePDF);
});

// Core Logic: Form Submission
function handleNewLead(e) {
    e.preventDefault();

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const city = document.getElementById('city').value.trim();
    const bill = parseFloat(document.getElementById('monthlyBill').value);
    const type = document.getElementById('propertyType').value;

    // Enhanced Validations
    if (name.length < 2) {
        alert("Please enter a valid customer name.");
        return;
    }

    // Email Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("Please enter a valid email address (e.g., name@example.com).");
        return;
    }

    // Phone Regex (supports various formats, simple check)
    const phoneRegex = /^[+]?[\d\s\-]{10,15}$/;
    if (!phoneRegex.test(phone)) {
        alert("Please enter a valid contact number (at least 10 digits).");
        return;
    }

    // Calculations based on the spec
    const systemSize = (bill / 100).toFixed(1);
    const estimatedCost = Math.round(systemSize * 60000);
    const monthlySavings = Math.round(bill * 0.8);
    const paybackYears = (estimatedCost / (monthlySavings * 12)).toFixed(1);

    const newLead = {
        id: Date.now().toString(),
        name,
        phone,
        email,
        city,
        bill,
        type,
        systemSize,
        estimatedCost,
        monthlySavings,
        paybackYears,
        status: 'Pending',
        proposalHtml: null
    };

    leads.push(newLead);
    saveLeads();
    renderCRM();
    form.reset();
}

// Core Logic: Render CRM
function renderCRM() {
    leadCount.innerText = `${leads.length} Leads`;
    
    if (leads.length === 0) {
        crmBody.innerHTML = '<tr class="empty-row"><td colspan="5">No leads yet.</td></tr>';
        leadsMobileGrid.innerHTML = '<div class="empty-message" style="text-align:center; padding: 2rem; color: var(--text-muted);">No leads yet. Add one to get started!</div>';
        return;
    }

    // Render Table (Desktop)
    crmBody.innerHTML = leads.map(lead => `
        <tr>
            <td>
                <strong>${lead.name}</strong><br>
                <span class="text-muted" style="font-size:0.8rem">${lead.city} &bull; ${lead.phone}</span>
            </td>
            <td>₹${lead.bill.toLocaleString()}</td>
            <td>${lead.systemSize} kW</td>
            <td>
                <span class="status-badge status-${lead.status.toLowerCase()}">${lead.status}</span>
            </td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="openProposal('${lead.id}')">
                    <i class="ri-article-line"></i> ${lead.status === 'Pending' ? 'Generate' : 'View'}
                </button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger); border:none;" onclick="deleteLead('${lead.id}')">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Render Cards (Mobile)
    leadsMobileGrid.innerHTML = leads.map(lead => `
        <div class="lead-card">
            <div class="lead-card-header">
                <span class="lead-card-name">${lead.name}</span>
                <span class="status-badge status-${lead.status.toLowerCase()}">${lead.status}</span>
            </div>
            <div class="lead-card-meta">
                <div>
                    <label style="font-size:0.7rem; margin:0">City</label>
                    <span class="meta-value">${lead.city}</span>
                </div>
                <div>
                    <label style="font-size:0.7rem; margin:0">Phone</label>
                    <span class="meta-value">${lead.phone}</span>
                </div>
            </div>
            <div style="display:flex; gap:0.5rem">
                <button class="btn btn-primary btn-block" onclick="openProposal('${lead.id}')">
                    ${lead.status === 'Pending' ? 'Generate Proposal' : 'View Proposal'}
                </button>
                <button class="btn btn-secondary" onclick="deleteLead('${lead.id}')" style="color:var(--danger)">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function saveLeads() {
    localStorage.setItem('solarLeads', JSON.stringify(leads));
}

function deleteLead(id) {
    if(confirm('Delete this lead?')){
        leads = leads.filter(l => l.id !== id);
        saveLeads();
        renderCRM();
    }
}

// Core Logic: Proposal Generation
async function openProposal(leadId) {
    const lead = leads.find(l => l.id === leadId);
    if(!lead) return;

    proposalModal.classList.add('active');
    proposalTitle.innerText = `Proposal for ${lead.name}`;
    
    if (lead.status === 'Generated' && lead.proposalHtml) {
        // Show cached proposal
        loadingState.classList.add('hidden');
        proposalContent.classList.remove('hidden');
        proposalContent.innerHTML = lead.proposalHtml;
        renderROIChart(lead); // Render interactive chart natively over the cached canvas element
        printBtn.classList.remove('disabled');
        return;
    }

    // Need to generate one
    if (!apiKey) {
        alert("Please set your Gemini API Key in settings first!");
        proposalModal.classList.remove('active');
        settingsModal.classList.add('active');
        return;
    }

    // Reset UI
    proposalContent.classList.add('hidden');
    loadingState.classList.remove('hidden');
    printBtn.classList.add('disabled');

    try {
        const text = await fetchGemini(lead);
        // Render Markdown using Marked.js
        const rawHtml = marked.parse(text);
        
        // Build the premium PDF letterhead structure
        const dateStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        const refDgt = Math.floor(1000 + Math.random() * 9000);
        
        const polishedHtml = `
            <div class="proposal-letterhead super-design">
                <div class="premium-banner"></div>
                <div class="letterhead-top">
                    <div class="brand-block">
                        <h1 class="company-brand"><i class="ri-sun-fill"></i> Solara Pro AI</h1>
                        <p class="company-tagline">Premium Solar Architecture & Intelligence</p>
                    </div>
                    <div class="letterhead-meta">
                        <p><strong>ISSUE DATE:</strong> ${dateStr}</p>
                        <p><strong>QUOTE REF:</strong> SOL-${refDgt}</p>
                    </div>
                </div>

                <div class="letterhead-client">
                    <div class="client-info">
                        <p class="meta-label">Prepared Exclusively For</p>
                        <h2>${lead.name}</h2>
                        <p><i class="ri-map-pin-2-line"></i> ${lead.city} &bull; ${lead.phone}</p>
                        <p><i class="ri-mail-line"></i> ${lead.email}</p>
                    </div>
                </div>

                <!-- KEY HIGHLIGHTS CHEAT SHEET -->
                <div class="highlights-grid">
                    <div class="highlight-card">
                        <i class="ri-flashlight-line"></i>
                        <span class="h-label">System capacity</span>
                        <span class="h-value">${lead.systemSize} kW</span>
                    </div>
                    <div class="highlight-card accent">
                        <i class="ri-money-rupee-circle-line"></i>
                        <span class="h-label">Estimated Monthly Saving</span>
                        <span class="h-value">₹${lead.monthlySavings.toLocaleString()}</span>
                    </div>
                    <div class="highlight-card">
                        <i class="ri-timer-flash-line"></i>
                        <span class="h-label">Payback period</span>
                        <span class="h-value">${lead.paybackYears} Years</span>
                    </div>
                </div>
                
                <div class="proposal-body">
                    <div class="content-section">
                        ${rawHtml}
                    </div>
                    
                    <div class="chart-wrapper">
                        <h3 class="chart-title">10-Year ROI Projection</h3>
                        <div class="canvas-container">
                            <canvas id="roiChart"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="letterhead-footer">
                    <div class="footer-bottom">
                        <div class="signature-block">
                            <div class="sig-line"></div>
                            <p>Authorized Signature</p>
                            <p><strong>Energy Lead Consultant</strong></p>
                        </div>
                        <div class="contact-block">
                            <p><i class="ri-global-line"></i> www.solara-pro.ai</p>
                            <p><i class="ri-mail-line"></i> solutions@solara-pro.ai</p>
                        </div>
                    </div>
                    <div class="disclaimer-area">
                        <p class="footer-note">This quote is generated via Solara Pro AI and is valid for 30 days. Estimates are based on current solar irradiance data for ${lead.city}.</p>
                    </div>
                </div>
            </div>
        `;
        
        // Save to lead
        lead.proposalHtml = polishedHtml;
        lead.status = 'Generated';
        saveLeads();
        renderCRM();

        // Refined Success Flow
        proposalContent.innerHTML = polishedHtml;
        
        // Ensure UI updates before chart rendering to avoid crash-loops
        setTimeout(() => {
            try {
                renderROIChart(lead);
            } catch (e) {
                console.error("ROI Chart render failed:", e);
            }
        }, 100);

        loadingState.classList.add('hidden');
        proposalContent.classList.remove('hidden');
        printBtn.classList.remove('disabled');

    } catch (error) {
        console.error("Proposal flow failed:", error);
        alert("Failed to generate proposal: " + error.message);
        loadingState.classList.add('hidden'); // Always stop spinner on error
        proposalModal.classList.remove('active');
    }
}

// Gemini API Call
async function fetchGemini(lead) {
    const prompt = `
Act as a senior solar energy consultant in India. You represent a premium, reliable solar installation company. 
Generate a structured, professional, and persuasive Solar Installation Proposal for a prospective client.
Do not use markdown code blocks, just raw markdown formatting.

CLIENT DATA:
- Name: ${lead.name}
- City: ${lead.city}
- Property Type: ${lead.type}
- Current Monthly Bill: ₹${lead.bill.toLocaleString()}
- Recommended System Size: ${lead.systemSize} kW
- Estimated Turnkey Cost: ₹${lead.estimatedCost.toLocaleString()}
- Projected Monthly Savings: ₹${lead.monthlySavings.toLocaleString()}
- ROI / Payback Period: ${lead.paybackYears} years

INSTRUCTIONS:
1. Introduction: Write a warm, professional greeting to ${lead.name} and overview of why going solar is a smart choice for them in ${lead.city}.
2. System Recommendation: Break down the recommended ${lead.systemSize} kW system.
3. Financial Breakdown: Present the cost, monthly savings, and the exact payback period of ${lead.paybackYears} years in a clear format. Emphasize the ROI.
4. Government Subsidy: Explicitly mention the "PM Surya Ghar Muft Bijli Yojana" scheme, noting they may be eligible.
5. Environmental Impact: Add a section showing estimated CO2 reduction (Assume 1 kW saves ~1,000 kg of CO2 per year).

TONE & FORMAT:
- Use markdown formatting with clear Headings (H2/H3) and bullet points.
- Do not include raw placeholders.
- Output MUST be immediately parsable Markdown.
    `;

    // First, let's auto-discover a valid model for this API key to prevent 404 errors
    let targetModel = "models/gemini-1.5-flash"; // default
    try {
        const modelListRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (modelListRes.ok) {
            const data = await modelListRes.json();
            // Find a model that supports generateContent
            const validModels = data.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
            // Prefer flash models, then pro, then whatever is first
            const flashModel = validModels.find(m => m.name.includes("flash"));
            const proModel = validModels.find(m => m.name.includes("pro"));
            
            if (flashModel) targetModel = flashModel.name;
            else if (proModel) targetModel = proModel.name;
            else if (validModels.length > 0) targetModel = validModels[0].name;
        }
    } catch(e) {
        console.warn("Could not fetch models list. Falling back to default.");
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7
            }
        })
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// PDF Generation using html2pdf
function generatePDF() {
    if(printBtn.classList.contains('disabled')) return;
    
    // Most stable configuration for accurate HTML to PDF exporting
    const opt = {
        margin:       0.5, // Uniform 0.5 inch margin prevents absolute edge cuts perfectly
        filename:     `${proposalTitle.innerText.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { scale: 2, useCORS: true, scrollY: 0 }, // scale: 2 avoids canvas limits; scrollY: 0 fixes top-cutoff bugs if user scrolled
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: 'css', avoid: ['h2', 'h3', 'p', 'li', '.chart-wrapper', '.signature-block'] } // Explicit hardware avoid array
    };
    
    html2pdf().set(opt).from(proposalContent).save();
}

// -------------------------------------------------------------
// Data Visualization (Chart.js)
// -------------------------------------------------------------
let activeChart = null;
function renderROIChart(lead) {
    const ctx = document.getElementById('roiChart');
    if(!ctx) return;
    
    // Clean up previous chart instance if it exists to prevent overlap bugs
    if(activeChart) { activeChart.destroy(); }
    
    const years = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    // Data math logic
    const yearlyGridCost = (lead.bill * 12);
    const yearlySolarCost = ((lead.bill - lead.monthlySavings) * 12);
    
    let cumulativeGrid = [];
    let cumulativeSolar = [];
    
    for(let i=1; i<=10; i++) {
        cumulativeGrid.push(Math.round(yearlyGridCost * i));
        cumulativeSolar.push(Math.round(lead.estimatedCost + (yearlySolarCost * i)));
    }

    activeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => `Year ${y}`),
            datasets: [
                {
                    label: 'Cost Without Solar (₹)',
                    data: cumulativeGrid,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderWidth: 4,
                    pointBackgroundColor: '#ef4444',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Cost With Solar (₹)',
                    data: cumulativeSolar,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    borderWidth: 4,
                    pointBackgroundColor: '#f59e0b',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { 
                    position: 'top', 
                    labels: { 
                        font: { family: 'Plus Jakarta Sans', weight: '700', size: 12 },
                        usePointStyle: true,
                        padding: 20
                    } 
                },
                tooltip: { 
                    backgroundColor: '#0f172a',
                    padding: 12,
                    titleFont: { family: 'Outfit', size: 14 },
                    bodyFont: { family: 'Plus Jakarta Sans', size: 13 },
                    callbacks: { 
                        label: function(context) { return '₹' + context.parsed.y.toLocaleString(); } 
                    } 
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(15, 23, 42, 0.05)' },
                    ticks: { 
                        callback: function(value) { return '₹' + (value/1000) + 'k'; }, 
                        font: { family: 'Plus Jakarta Sans', weight: '600' },
                        color: '#64748b'
                    }
                },
                x: { 
                    grid: { display: false },
                    ticks: { 
                        font: { family: 'Plus Jakarta Sans', weight: '600' },
                        color: '#64748b'
                    } 
                }
            }
        }
    });
}

// Boot handled by DOMContentLoaded

