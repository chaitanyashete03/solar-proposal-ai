// Initial State & Local Storage Setup
let leads = JSON.parse(localStorage.getItem('solarLeads')) || [];
let apiKey = localStorage.getItem('geminiApiKey') || '';

// DOM Elements
const form = document.getElementById('leadForm');
const crmBody = document.getElementById('crmBody');
const leadCount = document.getElementById('leadCount');

// Modals
const settingsModal = document.getElementById('settingsModal');
const proposalModal = document.getElementById('proposalModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettings');
const closeProposalBtn = document.getElementById('closeProposal');
const leadsMobileGrid = document.getElementById('leadsMobileGrid');

// Settings Elements
const apiKeyInput = document.getElementById('apiKey');
const saveApiBtn = document.getElementById('saveApiBtn');

// Proposal Elements
const proposalContent = document.getElementById('proposalContent');
const proposalTitle = document.getElementById('proposalTitle');
const loadingState = document.getElementById('loadingState');
const printBtn = document.getElementById('printBtn');

// Initialize app
function init() {
    apiKeyInput.value = apiKey;
    renderCRM();
}

// Event Listeners
form.addEventListener('submit', handleNewLead);
settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
closeProposalBtn.addEventListener('click', () => proposalModal.classList.remove('active'));

saveApiBtn.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    localStorage.setItem('geminiApiKey', apiKey);
    settingsModal.classList.remove('active');
});

printBtn.addEventListener('click', generatePDF);

// Core Logic: Form Submission
function handleNewLead(e) {
    e.preventDefault();

    const name = document.getElementById('customerName').value;
    const info = document.getElementById('contactInfo').value;
    const city = document.getElementById('city').value;
    const bill = parseFloat(document.getElementById('monthlyBill').value);
    const type = document.getElementById('propertyType').value;

    // Calculations based on the spec
    const systemSize = (bill / 100).toFixed(1); // Spec: Bill / 100
    const estimatedCost = Math.round(systemSize * 60000);
    const monthlySavings = Math.round(bill * 0.8);
    const paybackYears = (estimatedCost / (monthlySavings * 12)).toFixed(1);

    const newLead = {
        id: Date.now().toString(),
        name,
        info,
        city,
        bill,
        type,
        systemSize,
        estimatedCost,
        monthlySavings,
        paybackYears,
        status: 'Pending', // Pending | Generated
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
                <span class="text-muted" style="font-size:0.8rem">${lead.city} &bull; ${lead.type}</span>
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
                    <label style="font-size:0.7rem; margin:0">System Size</label>
                    <span class="meta-value">${lead.systemSize} kW</span>
                </div>
                <div>
                    <label style="font-size:0.7rem; margin:0">Monthly Bill</label>
                    <span class="meta-value">₹${lead.bill.toLocaleString()}</span>
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
            <div class="proposal-letterhead">
                <div class="letterhead-top">
                    <div>
                        <h1 class="company-brand"><i class="ri-sun-fill"></i> Solara Pro AI</h1>
                        <p class="company-tagline">Premium Solar Architecture</p>
                    </div>
                    <div class="letterhead-meta">
                        <p><strong>Date:</strong> ${dateStr}</p>
                        <p><strong>Ref:</strong> SOL-${refDgt}-${new Date().getFullYear()}</p>
                    </div>
                </div>
                <div class="letterhead-client">
                    <p class="meta-label">Prepared For:</p>
                    <h2>${lead.name}</h2>
                    <p>${lead.city} &bull; ${lead.type} Property</p>
                </div>
                
                <div class="proposal-body">
                    ${rawHtml}
                    
                    <div class="chart-wrapper" style="margin: 3rem 0; padding: 2rem; background: #ffffff; border: 1px solid var(--border-color); border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                        <h3 style="margin-top:0; color:#0f172a; text-align:center; font-family:'Outfit';">10-Year ROI Projection</h3>
                        <canvas id="roiChart" style="max-height: 350px;"></canvas>
                    </div>
                </div>
                
                <div class="letterhead-footer">
                    <div class="signature-block">
                        <div class="sig-line"></div>
                        <p>Authorized Signature</p>
                        <p><strong>Energy Consultant</strong></p>
                    </div>
                    <p class="footer-note">This quote is valid for 30 days from the date of issue.</p>
                </div>
            </div>
        `;
        
        // Save to lead
        lead.proposalHtml = polishedHtml;
        lead.status = 'Generated';
        saveLeads();
        renderCRM();

        // Update UI
        proposalContent.innerHTML = polishedHtml;
        renderROIChart(lead); // Initialize visually stunning dataviz chart
        
        loadingState.classList.add('hidden');
        proposalContent.classList.remove('hidden');
        printBtn.classList.remove('disabled');

    } catch (error) {
        alert("Failed to generate proposal: " + error.message);
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

// Boot up
init();
