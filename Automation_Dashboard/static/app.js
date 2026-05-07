let employees = [];
let sessionTimeout;
const SESSION_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds


// Privacy Login Intercept
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginScreen = document.getElementById('login-screen');
    const mainDashboard = document.getElementById('main-dashboard');
    const loginError = document.getElementById('login-error');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('login-user').value;
            const pass = document.getElementById('login-pass').value;

            if (user === 'Rohith01' && pass === 'Rk@123') {
                loginScreen.style.opacity = '0';
                setTimeout(() => {
                    loginScreen.style.display = 'none';
                    mainDashboard.style.display = 'flex';
                    // Trigger reflow for fade transition
                    void mainDashboard.offsetWidth;
                    mainDashboard.style.opacity = '1';
                    
                    // Start 15-minute session timer
                    startSessionTimer();

                    // Display Login Time
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const loginDisplay = document.getElementById('session-login-time');
                    if (loginDisplay) loginDisplay.textContent = `Logged in: ${timeStr}`;
                }, 400);
            } else {
                loginError.style.display = 'block';
                document.getElementById('login-pass').value = '';
                setTimeout(() => {
                    loginError.style.display = 'none';
                }, 3000);
            }
        });
    }

    // Global click listener to clear highlights/focus
    document.addEventListener('mousedown', (e) => {
        // If clicking outside of highlighted elements and not on trigger buttons
        if (!e.target.closest('.employee-detail-card') && 
            !e.target.closest('.view-btn-new') && 
            !e.target.closest('.clickable-stat') &&
            !e.target.closest('#reports-table')) {
            clearAllHighlights();
        }
    });

    // Close modals on background click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });

    // Inactivity Tracking
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
        document.addEventListener(event, resetSessionTimer);
    });
});

function resetSessionTimer() {
    const mainDashboard = document.getElementById('main-dashboard');
    if (mainDashboard && mainDashboard.style.display !== 'none') {
        startSessionTimer();
    }
}

function startSessionTimer() {
    if (sessionTimeout) clearTimeout(sessionTimeout);
    sessionTimeout = setTimeout(() => {
        logout();
    }, SESSION_DURATION);
}

function logout() {
    const loginScreen = document.getElementById('login-screen');
    const mainDashboard = document.getElementById('main-dashboard');
    
    mainDashboard.style.opacity = '0';
    setTimeout(() => {
        mainDashboard.style.display = 'none';
        loginScreen.style.display = 'flex';
        void loginScreen.offsetWidth;
        loginScreen.style.opacity = '1';
        
        // Clear sensitive data if needed
        document.getElementById('login-pass').value = '';
        const loginDisplay = document.getElementById('session-login-time');
        if (loginDisplay) loginDisplay.textContent = 'Logged in: --:--';

        alert("Session expired. Please login again for security.");
    }, 400);
}

function clearAllHighlights() {
    document.querySelectorAll('.highlight-top, .highlight-focus, .highlight-report-row, .report-highlight')
        .forEach(el => el.classList.remove('highlight-top', 'highlight-focus', 'highlight-report-row', 'report-highlight', 'highlight-green', 'highlight-red'));
}


// Initialize Dashboard Data
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

let allEmployees = [];
let currentMonth = ""; // Format: "YYYY-MM"
const HOLIDAYS = ['2026-03-19', '2026-03-20', '2026-03-27'];

function isNonWorkingDay(dateKey, statuses = []) {
    if (HOLIDAYS.includes(dateKey)) return true;
    if (statuses.some(s => {
        const lower = s.toLowerCase();
        return lower === 'sunday' || lower.includes('holiday');
    })) return true;
    return false;
}

function getWorkingDaysDenominator(monthStr) {
    if (monthStr === '2026-02') return 24;
    if (monthStr === '2026-03') return 23;
    if (monthStr === '2026-04') return 26;
    // Dynamic calculation for other months
    if (!allEmployees || allEmployees.length === 0) return 22;
    const monthDateKeys = Object.keys(allEmployees[0] || {}).filter(k => k.startsWith(monthStr));
    // Check actual statuses to identify sundays/holidays
    const workingDays = monthDateKeys.filter(d => {
        if (HOLIDAYS.includes(d)) return false;
        // Check if any employee has 'SUNDAY' or holiday marker for this date
        const statuses = allEmployees.map(emp => (emp[d] || '').toString().toLowerCase());
        if (statuses.some(s => s === 'sunday')) return false;
        if (statuses.some(s => s.includes('holiday'))) return false;
        return true;
    });
    return workingDays.length || 22;
}
function populateMonthSelectors(employees) {
    if (!employees || employees.length === 0) return;
    const dateKeys = Object.keys(employees[0]).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
    const uniqueMonths = [...new Set(dateKeys.map(d => d.substring(0, 7)))].sort().reverse();

    const monthSelector = document.getElementById('month-selector');
    const reportsMonthSelector = document.getElementById('reports-month-selector');

    [monthSelector, reportsMonthSelector].forEach(sel => {
        if (!sel) return;
        const previousVal = sel.value;
        sel.innerHTML = '';
        uniqueMonths.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            const [y, mm] = m.split('-');
            const date = new Date(y, parseInt(mm) - 1, 1);
            opt.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            sel.appendChild(opt);
        });
        // Restore selection if it still exists
        if (uniqueMonths.includes(previousVal)) {
            sel.value = previousVal;
        } else if (uniqueMonths.includes(currentMonth)) {
            sel.value = currentMonth;
        }
    });
}

async function initDashboard() {
    try {
        // Show loader immediately
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.style.display = 'flex';

        // Fetch fresh data from API
        const response = await fetch('/api/data');
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || 'Could not load data from API.');
        }
        allEmployees = await response.json();


        if (!allEmployees || allEmployees.length === 0) throw new Error('No employee data found');

        // Update Last Synced display
        const syncText = document.getElementById('last-updated-text');
        if (syncText) {
            const now = new Date();
            syncText.textContent = `Last Synced: ${now.toLocaleTimeString()}`;
        }

        populateMonthSelectors(allEmployees);


        // Set default month (latest) if not already set
        const dateKeys = Object.keys(allEmployees[0]).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
        const uniqueMonths = [...new Set(dateKeys.map(d => d.substring(0, 7)))].sort().reverse();
        
        if (!currentMonth) {
            currentMonth = uniqueMonths[0];
            const mSel = document.getElementById('month-selector');
            const rSel = document.getElementById('reports-month-selector');
            if (mSel) mSel.value = currentMonth;
            if (rSel) rSel.value = currentMonth;
        }


        // Initial Render
        updateDashboardView();
        
        // Refresh Button logic
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.classList.add('loading');
                refreshBtn.disabled = true;
                try {
                    // Force a fresh extraction on the backend
                    const response = await fetch('/api/data?force=true');
                    if (response.ok) {
                        const newData = await response.json();
                        if (newData && Array.isArray(newData)) {
                            allEmployees = newData;
                            populateMonthSelectors(allEmployees);
                            updateDashboardView();
                            
                            // Update Last Updated Text
                            const lut = document.getElementById('last-updated-text');
                            if (lut) {
                                const now = new Date();
                                const timeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
                                lut.textContent = `Updated: ${timeStr}`;
                            }
                            console.log("Dashboard forced sync successful.");
                        }
                    } else {
                        const errData = await response.json().catch(() => ({}));
                        const msg = errData.detail || 'Sync failed. Please try again.';
                        alert('Sync failed: ' + msg);
                    }
                } catch (e) {
                    console.error(e);
                    alert('Error refreshing data.');
                } finally {
                    refreshBtn.classList.remove('loading');
                    refreshBtn.disabled = false;
                }
            });
        }

        // Automatic Refresh every 1 minute
        setInterval(async () => {
            try {
                const response = await fetch('/api/data');
                if (response.ok) {
                    const newData = await response.json();
                    if (newData && Array.isArray(newData)) {
                        console.log("Data auto-synced.");
                        allEmployees = newData;
                        populateMonthSelectors(allEmployees);
                        updateDashboardView();
                    }
                }
            } catch (e) {
                console.error("Auto-refresh failed", e);
            }
        }, 60000);

        // 4. Setup Month Change Listeners
        const syncSelectors = (e) => {
            currentMonth = e.target.value;
            const mSel = document.getElementById('month-selector');
            const rSel = document.getElementById('reports-month-selector');
            if (mSel) mSel.value = currentMonth;
            if (rSel) rSel.value = currentMonth;
            updateDashboardView();
        };

        const mSel = document.getElementById('month-selector');
        const rSel = document.getElementById('reports-month-selector');
        if (mSel) mSel.addEventListener('change', syncSelectors);
        if (rSel) rSel.addEventListener('change', syncSelectors);


        // 5. Setup Sidebar Toggle
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebar && sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                // Optional: Trigger window resize to fix charts if needed
                setTimeout(() => window.dispatchEvent(new Event('resize')), 450);
            });
        }

        // 5. Setup Navigation
        setupNavigation(allEmployees);

        // 6. Setup Filters
        const searchInput = document.getElementById('employee-search');
        const departmentFilter = document.getElementById('department-filter');
        const attendanceFilter = document.getElementById('attendance-filter');

        // Populate Department Filter
        const departments = [...new Set(allEmployees.map(emp => emp.Branch))].filter(Boolean).sort();
        departmentFilter.innerHTML = '<option value="all">All Departments</option>';
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentFilter.appendChild(option);
        });

        const filterHandler = () => {
            updateDashboardView();
        };

        searchInput.addEventListener('input', filterHandler);
        departmentFilter.addEventListener('change', filterHandler);
        attendanceFilter.addEventListener('change', filterHandler);

        // Setup Search Icon Click
        const searchIcon = document.getElementById('search-icon');
        if (searchIcon) {
            searchIcon.addEventListener('click', () => {
                searchInput.focus();
            });
        }

        // 7. Setup Reports CSV Download
        document.getElementById('btn-download-csv').addEventListener('click', () => {
            const filtered = applyAttendanceFilters(allEmployees);
            if (!filtered || filtered.length === 0) {
                alert("No data available to download.");
                return;
            }
            const keys = Object.keys(filtered[0]);
            let csvContent = "data:text/csv;charset=utf-8," + keys.join(",") + "\n";
            filtered.forEach(rowObj => {
                const rowArray = keys.map(k => {
                    let val = rowObj[k] === null || rowObj[k] === undefined ? "" : String(rowObj[k]);
                    val = val.replace(/"/g, '""');
                    if (val.includes(",") || val.includes("\n") || val.includes('"')) val = `"${val}"`;
                    return val;
                });
                csvContent += rowArray.join(",") + "\n";
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `attendance_${currentMonth}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        // 8. Shortcuts
        document.getElementById('total-days').addEventListener('click', () => document.getElementById('nav-calendar').click());
        document.getElementById('total-employees').addEventListener('click', () => document.getElementById('nav-employees').click());

        // Remove Loader
        setTimeout(() => {
            const loader = document.getElementById('loading-overlay');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 500);
            }
        }, 800);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        // Ensure loader is removed so user can see error
        document.getElementById('loading-overlay').style.display = 'none';

        // Show error message in body
        const main = document.getElementById('main-dashboard');
        if (main) {
            main.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: white;">
                    <h2>Initialization Error</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary">Retry</button>
                </div>
            `;
            main.style.display = 'flex';
            main.style.opacity = '1';
        }
    }
}

function updateDashboardView() {
    // 1. Filter data by search/dept/attendance type
    const filtered = applyAttendanceFilters(allEmployees);

    // 2. Recalculate Monthly Stats for the filtered set (or all for global cards)
    const monthDateKeys = Object.keys(allEmployees[0]).filter(key => key.startsWith(currentMonth));

    // Total Working Days in this month
    const workingDays = getWorkingDaysDenominator(currentMonth);
    document.querySelector('#total-days .card-value').textContent = workingDays;

    // Average Attendance for this month
    const denominator = getWorkingDaysDenominator(currentMonth);
    let totalPresent = 0;
    allEmployees.forEach(emp => {
        const att = parseFloat(emp[`${currentMonth}-Attendence`]);
        if (!isNaN(att)) totalPresent += att;
    });
    const avgPerc = (totalPresent / (allEmployees.length * denominator)) * 100;
    document.querySelector('#avg-attendance .card-value').textContent = avgPerc.toFixed(1) + '%';

    // Top Performer for this month
    let topEmp = { name: '--', perc: -1, id: '' };
    allEmployees.forEach(emp => {
        const perc = parseFloat(emp[`${currentMonth}-Percentage`]);
        if (!isNaN(perc) && perc > topEmp.perc) {
            topEmp = { name: emp['Employee Name'], id: emp['Employee ID'], perc };
        }
    });
    document.querySelector('#top-perf .card-value').textContent = topEmp.name.split(' ')[0];

    // Total Employees active in this month
    const activeInMonth = allEmployees.filter(emp => {
        return monthDateKeys.some(date => {
            const s = (emp[date] || '').toString().toLowerCase();
            return s && s !== 'na' && s !== '--' && s !== 'sunday' && s !== '' && !s.includes('holiday');
        });
    }).length;
    document.querySelector('#total-employees .card-value').textContent = activeInMonth;

    // 3. Render Views
    renderTable(filtered);
    renderEmployeeDetails(filtered);
    renderReports(filtered);
    renderLeaveRoster(filtered);
    renderBigCalendar(allEmployees, ...currentMonth.split('-').map(Number).map((n, i) => i === 1 ? n - 1 : n));
    setupCharts(allEmployees); // Charts will use currentMonth inside

    // Link Top Performer card
    const topCard = document.getElementById('top-perf');
    if (topCard && topEmp.id) {
        topCard.style.cursor = 'pointer';
        topCard.onclick = () => {
            document.getElementById('nav-employees').click();
            setTimeout(() => {
                const card = document.getElementById(`emp-card-${topEmp.id}`);
                if (card) {
                    // Clear all highlights
                    document.querySelectorAll('.employee-detail-card').forEach(c => c.classList.remove('highlight-top', 'highlight-focus'));
                    card.classList.add('highlight-top');
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        };
    }
}

function applyAttendanceFilters(data) {
    const searchTerm = document.getElementById('employee-search').value.toLowerCase();
    const selectedDept = document.getElementById('department-filter').value;
    const selectedAttendance = document.getElementById('attendance-filter').value;
    const monthDateKeys = Object.keys(allEmployees[0]).filter(key => key.startsWith(currentMonth));

    return data.filter(emp => {
        const matchesSearch = (emp['Employee Name'] || '').toLowerCase().includes(searchTerm) ||
            (emp['Employee ID'] || '').toLowerCase().includes(searchTerm);
        const matchesDept = selectedDept === 'all' || emp.Branch === selectedDept;

        // Use data from sheet
        const daysPresent = parseFloat(emp[`${currentMonth}-Attendence`]) || 0;
        const perc = parseFloat(emp[`${currentMonth}-Percentage`]) || 0;
        
        let matchesAttendance = true;
        if (selectedAttendance === 'excellent') matchesAttendance = perc >= 90;
        else if (selectedAttendance === 'good') matchesAttendance = perc >= 75 && perc < 90;
        else if (selectedAttendance === 'low') matchesAttendance = perc < 75;

        return matchesSearch && matchesDept && matchesAttendance;
    });
}

function renderTable(data) {
    const listBody = document.getElementById('employee-list');
    listBody.innerHTML = '';
    const monthDateKeys = Object.keys(allEmployees[0]).filter(key => key.startsWith(currentMonth));

    data.forEach(emp => {
        const tr = document.createElement('tr');

        // Use data from sheet
        const denominator = getWorkingDaysDenominator(currentMonth);
        const daysPresent = emp[`${currentMonth}-Attendence`] || "0";
        const perc = parseFloat(emp[`${currentMonth}-Percentage`]) || 0;

        tr.innerHTML = `
            <td>
                <div class="emp-info">
                    <span>${emp['Employee Name']}</span>
                </div>
            </td>
            <td>${emp['Employee ID']}</td>
            <td>${emp['Branch']}</td>
            <td>${daysPresent} / ${denominator}</td>
            <td>
                <div class="perc-bar-container">
                    <div class="perc-bar" style="width: ${perc}%"></div>
                </div>
                ${perc.toFixed(1)}%
            </td>
            <td style="text-align: center;">
                <button class="view-btn-new" data-emp-id="${emp['Employee ID']}" title="View Details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
            </td>
        `;
        listBody.appendChild(tr);
    });
    // Delegation listener for the "View Details" button in the table
    if (!listBody.dataset.hasListener) {
        listBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn-new');
            if (btn) {
                const empId = btn.dataset.empId;
                document.getElementById('nav-employees').click();
                setTimeout(() => {
                    const card = document.getElementById(`emp-card-${empId}`);
                    if (card) {
                        // Clear all highlights
                        document.querySelectorAll('.employee-detail-card').forEach(c => c.classList.remove('highlight-top', 'highlight-focus'));
                        card.classList.add('highlight-focus');
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        });
        listBody.dataset.hasListener = 'true';
    }
}

function setupCharts(data) {
    const monthDateKeys = Object.keys(data[0]).filter(key => key.startsWith(currentMonth)).sort();

    const dailyCounts = monthDateKeys.map(date => {
        return data.filter(emp => {
            const s = (emp[date] || '').toString().toLowerCase();
            return s && s !== 'leave' && s !== 'na' && s !== '--' && s !== 'sunday' && !s.includes('holiday');
        }).length;
    });

    const dailyLeaves = monthDateKeys.map(date => {
        return data.filter(emp => (emp[date] || '').toString().toLowerCase() === 'leave').length;
    });

    const trendCanvas = document.getElementById('attendanceTrendChart');
    if (window.trendChart) window.trendChart.destroy();

    const trendCtx = trendCanvas.getContext('2d');
    window.trendChart = new Chart(trendCtx, {
        type: 'bar',
        data: {
            labels: monthDateKeys.map(d => d.split('-')[2]), // Day numbers
            datasets: [
                { label: 'Present', data: dailyCounts, backgroundColor: '#a78bfa', borderRadius: 4 },
                { label: 'Leave', data: dailyLeaves, backgroundColor: '#fca5a5', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
        }
    });

    // Distribution Chart
    let tP = dailyCounts.reduce((a, b) => a + b, 0);
    let tL = dailyLeaves.reduce((a, b) => a + b, 0);

    const distCanvas = document.getElementById('statusDistChart');
    if (window.distChart) window.distChart.destroy();

    const distCtx = distCanvas.getContext('2d');
    window.distChart = new Chart(distCtx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Leave'],
            datasets: [{
                data: [tP, tL],
                backgroundColor: ['#a78bfa', '#fca5a5'],
                borderWidth: 0
            }]
        },
        options: { cutout: '70%', plugins: { legend: { position: 'bottom' } } }
    });
}

function setupNavigation(data) {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.dashboard-view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.id.replace('nav-', 'view-');

            // Update nav active state
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Update view visibility
            views.forEach(v => {
                if (v.id === targetId) {
                    v.style.display = 'block';
                    v.classList.add('active');
                } else {
                    v.style.display = 'none';
                    v.classList.remove('active');
                }
            });
        });
    });
}

function renderEmployeeDetails(data) {
    const grid = document.getElementById('employee-details-grid');
    grid.innerHTML = '';
    const monthDateKeys = Object.keys(allEmployees[0]).filter(key => key.startsWith(currentMonth));

    data.forEach(emp => {
        const denominator = getWorkingDaysDenominator(currentMonth);
        let p = 0, l = 0;
        monthDateKeys.forEach(d => {
            const s = (emp[d] || '').toString().toLowerCase();
            if (!s || s === 'sunday' || s === 'na' || s === '--' || s.includes('holiday') || HOLIDAYS.includes(d)) return;
            if (s === 'leave') l++; else p++;
        });
        const perc = (p / denominator) * 100;

        const card = document.createElement('div');
        card.className = 'card employee-detail-card glass';
        card.id = `emp-card-${emp['Employee ID']}`;
        card.innerHTML = `
            <div class="emp-detail-header">
                <div class="emp-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div style="flex: 1;">
                    <div class="emp-detail-name">${emp['Employee Name']}</div>
                    <div class="emp-detail-id">ID: ${emp['Employee ID']}</div>
                </div>
            </div>
            <div class="emp-stats-row">
                <div class="emp-stat-box clickable-stat" data-emp-id="${emp['Employee ID']}" data-type="present" style="cursor: pointer;">
                    <span class="emp-stat-val stat-present">${p}</span>
                    <span class="emp-stat-label">Present</span>
                </div>
                <div class="emp-stat-box clickable-stat" data-emp-id="${emp['Employee ID']}" data-type="leave" style="cursor: pointer;">
                    <span class="emp-stat-val stat-leave">${l}</span>
                    <span class="emp-stat-label">Leaves</span>
                </div>
            </div>
            <div style="margin-top: 0.5rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                    <span>Attendance Rate</span>
                    <span>${perc.toFixed(1)}%</span>
                </div>
                <div class="perc-bar-container" style="width: 100%; height: 8px;">
                    <div class="perc-bar" style="width: ${perc}%"></div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // Add Stat Box Listener once
    if (!grid.dataset.hasListener) {
        grid.addEventListener('click', (e) => {
            const box = e.target.closest('.clickable-stat');
            if (box) {
                const empId = box.dataset.empId;
                const type = box.dataset.type;

                // 1. Switch to Reports
                document.getElementById('nav-reports').click();

                // 2. Highlight after render (delay for view switch animation)
                setTimeout(() => {
                    const row = document.getElementById(`report-row-${empId}`);
                    if (row) {
                        // Clear existing highlights
                        document.querySelectorAll('.report-highlight').forEach(cell => cell.classList.remove('report-highlight', 'highlight-green', 'highlight-red'));
                        document.querySelectorAll('.highlight-report-row').forEach(r => r.classList.remove('highlight-report-row'));

                        // Highlight THE ENTIRE ROW
                        row.classList.add('highlight-report-row');

                        // Highlight matching cells specifically
                        const cells = row.querySelectorAll('td');
                        cells.forEach(cell => {
                            const status = cell.dataset.status;
                            if (type === 'present' && status !== 'leave' && status !== 'na' && status !== '--' && status !== 'sunday' && status !== '') {
                                cell.classList.add('report-highlight', 'highlight-green');
                            } else if (type === 'leave' && status === 'leave') {
                                cell.classList.add('report-highlight', 'highlight-red');
                            }
                        });

                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        });
        grid.dataset.hasListener = 'true';
    }
}

function renderReports(data) {
    const head = document.getElementById('reports-head');
    const body = document.getElementById('reports-body');
    if (!data || data.length === 0) return;

    // 1. Identify relevant columns (Exclude summary columns like -Attendence and -Percentage)
    const allKeys = Object.keys(data[0]);
    const metaKeys = ["Sr.No.", "Employee Name", "Employee ID", "Branch"];
    const monthKeys = allKeys.filter(k => 
        k.startsWith(currentMonth) && 
        !k.endsWith('-Attendence') && 
        !k.endsWith('-Percentage') &&
        /^\d{4}-\d{2}-\d{2}$/.test(k)
    ).sort();

    // Combine meta and month-specific keys
    const displayKeys = [...metaKeys, ...monthKeys];


    // Header
    let headHtml = '<tr>';
    displayKeys.forEach(k => {
        let label = k;
        if (k.includes('-')) label = k.split('-')[2]; // Just day for date columns
        headHtml += `<th>${label}</th>`;
    });
    headHtml += '</tr>';
    head.innerHTML = headHtml;

    // Body
    let bodyHtml = '';
    data.forEach(emp => {
        bodyHtml += `<tr id="report-row-${emp['Employee ID']}">`;
        displayKeys.forEach(k => {
            let val = emp[k] || '';
            const lowerVal = val.toString().toLowerCase();
            let cls = '';
            let detailsHtml = '';

            // Check for daily details (Login, Logout, etc.)
            const details = emp.daily_details ? emp.daily_details[k] : null;

            if (lowerVal === 'leave') {
                cls = 'class="cell-leave"';
                val = 'Leave';
            } else if (lowerVal === 'na') {
                cls = 'class="cell-na"';
            } else if (lowerVal === 'sunday') {
                cls = 'class="cell-sunday"';
                val = 'Sunday';
            } else if (lowerVal.includes('holiday')) {
                cls = 'class="cell-holiday"';
            } else if (HOLIDAYS.includes(k)) {
                cls = 'class="cell-holiday"';
                val = 'Holiday';
            } else {
                cls = '';
                // It's a working day. We only want to show the total Working Hours.
                if (details && details.total) {
                    val = details.total;
                }
            }

            let mainValHtml = val ? `<span class="cell-main-val">${val}</span>` : '';

            bodyHtml += `<td ${cls} data-status="${lowerVal}">
                <div class="cell-content-wrapper">
                    ${mainValHtml}
                    ${detailsHtml}
                </div>
            </td>`;

        });
        bodyHtml += '</tr>';
    });
    body.innerHTML = bodyHtml;
}

function renderLeaveRoster(data) {
    const roster = document.getElementById('leave-roster');
    if (!roster) return;

    // Get all calendar dates for current month
    const monthDateKeys = Object.keys(data[0]).filter(key => key.startsWith(currentMonth)).sort();

    // Map dates to employees on leave
    const leaveByDate = [];
    monthDateKeys.forEach(date => {
        const onLeave = data.filter(emp => {
            const status = (emp[date] || '').toString().toLowerCase();
            return status === 'leave';
        }).map(emp => emp['Employee Name']);

        if (onLeave.length > 0) {
            leaveByDate.push({ date: date, names: onLeave });
        }
    });

    if (leaveByDate.length === 0) {
        roster.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No leaves found for this period.</div>';
        return;
    }

    // Render
    let html = '';
    leaveByDate.forEach(item => {
        const d = new Date(item.date);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        html += `
            <div class="roster-date-group">
                <div class="roster-date">${dateStr}</div>
                <div class="roster-names">
                    ${item.names.map(name => `<span class="roster-name-badge">${name}</span>`).join('')}
                </div>
            </div>
        `;
    });
    roster.innerHTML = html;
}

/* ── Big Interactive Calendar ────────────────────────────────── */
function renderBigCalendar(employees, year, month) {
    const grid = document.getElementById('big-cal-grid');
    if (!grid) return;

    // Use latest data month or today
    // Use all available date keys
    const dateKeys = Object.keys(employees[0]).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    if (year === undefined || month === undefined) {
        if (dateKeys.length > 0) {
            const lastDate = new Date(dateKeys[dateKeys.length - 1]);
            year = lastDate.getFullYear();
            month = lastDate.getMonth();
        } else {
            const today = new Date();
            year = today.getFullYear();
            month = today.getMonth();
        }
    }

    const titleStr = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('big-cal-title').textContent = titleStr;

    // Build lookup
    const lookup = {};
    dateKeys.forEach(dateKey => {
        let presentCount = 0, leaveCount = 0, naCount = 0, sunday = false, holiday = false;
        const dayList = [];
        employees.forEach(emp => {
            const statusRaw = emp[dateKey];
            const s = (statusRaw || '').toString().toLowerCase();
            if (s === 'sunday') sunday = true;
            else if (s.includes('holiday')) holiday = true;
            else if (s === 'leave') { leaveCount++; dayList.push({ emp, status: 'leave' }); }
            else if (s === 'na' || s === '--') { naCount++; dayList.push({ emp, status: 'na' }); }
            else if (s) { presentCount++; dayList.push({ emp, status: 'present' }); }
        });
        lookup[dateKey] = { presentCount, leaveCount, naCount, sunday, holiday, dayList };
    });

    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement('div');
        blank.className = 'big-cal-day smc-empty';
        grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const key = `${year}-${mm}-${dd}`;
        const info = lookup[key];

        const cell = document.createElement('div');
        cell.className = 'big-cal-day';

        const dateNum = document.createElement('div');
        dateNum.className = 'big-cal-date-num';
        dateNum.textContent = d;
        cell.appendChild(dateNum);

        if (!info) {
            // No data
            cell.style.opacity = '0.5';
        } else if (info.sunday) {
            const sunBadge = document.createElement('div');
            sunBadge.className = 'big-badge bb-sunday';
            sunBadge.textContent = 'Sunday';
            cell.appendChild(sunBadge);
        } else if (HOLIDAYS.includes(key) || info.holiday) {
            const holBadge = document.createElement('div');
            holBadge.className = 'big-badge bb-holiday';
            holBadge.textContent = 'Holiday';
            cell.appendChild(holBadge);
        } else {
            // Working day
            cell.classList.add('working-day');
            const badgesDiv = document.createElement('div');
            badgesDiv.className = 'big-cal-badges';

            if (info.presentCount > 0) {
                const b = document.createElement('div');
                b.className = 'big-badge bb-present';
                b.textContent = `${info.presentCount} Present`;
                badgesDiv.appendChild(b);
            }
            if (info.leaveCount > 0) {
                const b = document.createElement('div');
                b.className = 'big-badge bb-leave';
                b.textContent = `${info.leaveCount} Leave`;
                badgesDiv.appendChild(b);
            }
            if (info.naCount > 0) {
                const b = document.createElement('div');
                b.className = 'big-badge bb-na';
                b.textContent = `${info.naCount} N/A`;
                badgesDiv.appendChild(b);
            }
            cell.appendChild(badgesDiv);

            // Add small daily metrics hint
            const detailsDiv = document.createElement('div');
            detailsDiv.style.cssText = 'font-size: 0.65rem; color: var(--text-muted); margin-top: 8px; border-top: 1px solid var(--glass-border); padding-top: 4px; line-height: 1.2; text-align: center;';
            detailsDiv.innerHTML = `<span style="color: #10b981;">● Details Available</span>`;
            cell.appendChild(detailsDiv);

            // Setup click event for the Day Modal
            cell.addEventListener('click', () => openDayModal(key, info, employees));

        }

        grid.appendChild(cell);
    }

    // Navigation Wiring
    const prevBtn = document.getElementById('big-cal-prev');
    const nextBtn = document.getElementById('big-cal-next');
    const newPrev = prevBtn.cloneNode(true);
    const newNext = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);

    newPrev.addEventListener('click', () => {
        let m = month - 1, y = year;
        if (m < 0) { m = 11; y--; }
        const newMonthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
        const selector = document.getElementById('month-selector');
        if ([...selector.options].some(opt => opt.value === newMonthStr)) {
            selector.value = newMonthStr;
            currentMonth = newMonthStr;
            updateDashboardView();
        } else {
            // Just move the calendar if data isn't available
            renderBigCalendar(employees, y, m);
        }
    });
    newNext.addEventListener('click', () => {
        let m = month + 1, y = year;
        if (m > 11) { m = 0; y++; }
        const newMonthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
        const selector = document.getElementById('month-selector');
        if ([...selector.options].some(opt => opt.value === newMonthStr)) {
            selector.value = newMonthStr;
            currentMonth = newMonthStr;
            updateDashboardView();
        } else {
            renderBigCalendar(employees, y, m);
        }
    });
}

function openDayModal(dateKey, info, allEmployees) {
    document.getElementById('day-modal').style.display = 'flex';

    // Format Date for Title
    const ds = new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('modal-day-title').textContent = ds;

    // Set Stats
    const total = info.presentCount + info.leaveCount + info.naCount;
    document.getElementById('modal-day-stats').innerHTML = `
        <div class="m-stat"><div class="m-stat-val">${total}</div><div class="m-stat-label">Total</div></div>
        <div class="m-stat"><div class="m-stat-val" style="color: #10b981;">${info.presentCount}</div><div class="m-stat-label">Present</div></div>
        <div class="m-stat"><div class="m-stat-val" style="color: #ef4444;">${info.leaveCount}</div><div class="m-stat-label">Leave</div></div>
        <div class="m-stat"><div class="m-stat-val" style="color: #f59e0b;">${info.naCount}</div><div class="m-stat-label">N/A</div></div>
    `;

    // Set Employees List
    const listBody = document.getElementById('modal-emp-list');
    listBody.innerHTML = '';

    const sortedDays = info.dayList.sort((a, b) => a.emp['Employee Name'].localeCompare(b.emp['Employee Name']));

    sortedDays.forEach(item => {
        const row = document.createElement('div');
        row.className = 'emp-modal-row';
        const statusRaw = (item.emp[dateKey] || '').toString().toLowerCase();
        const isLeave = statusRaw === 'leave';
        const isNA = statusRaw === 'na' || statusRaw === '--' || statusRaw === '0';
        const isPresent = statusRaw !== '' && !isLeave && !isNA && statusRaw !== 'sunday' && !statusRaw.includes('holiday');

        let badgeSpan = '';
        let detailHtml = '';
        
        const details = item.emp.daily_details ? item.emp.daily_details[dateKey] : null;
        if (isPresent) {
            const d = details || { login: '--:--', logout: '--:--', break: '--:--', total: '--:--' };
            detailHtml = `
                <div class="modal-emp-details" style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">
                    <span>Clock In: ${d.login || '--:--'}</span> &middot; 
                    <span>Clock Out: ${d.logout || '--:--'}</span> &middot; 
                    <span>Break Info: ${d.break || '--:--'}</span> &middot; 
                    <span>Working Hours: ${d.total || '--:--'}</span>
                </div>
            `;
        }

        if (isPresent) badgeSpan = `<span class="big-badge bb-present">${item.emp[dateKey] || 'Present'}</span>`;
        else if (isLeave) badgeSpan = `<span class="big-badge bb-leave">Leave</span>`;
        else if (isNA) badgeSpan = `<span class="big-badge bb-na">N/A</span>`;

        row.innerHTML = `
            <div style="flex: 1;">
                <div class="emp-mr-name">${item.emp['Employee Name']}</div>
                <div class="emp-mr-id">${item.emp['Employee ID']} &middot; ${item.emp['Branch']}</div>
                ${detailHtml}
            </div>
            <div>${badgeSpan}</div>
        `;

        // Click on employee to open day data modal
        row.addEventListener('click', () => {
            const statusRawInner = (item.emp[dateKey] || '').toString().toLowerCase();
            const isLeaveInner = statusRawInner === 'leave';
            const isNAInner = statusRawInner === 'na' || statusRawInner === '--' || statusRawInner === '0';
            const isPresentInner = statusRawInner !== '' && !isLeaveInner && !isNAInner && statusRawInner !== 'sunday' && !statusRawInner.includes('holiday');

            document.getElementById('emp-day-modal').style.display = 'flex';
            document.getElementById('emp-day-name').textContent = item.emp['Employee Name'];
            document.getElementById('emp-day-date').textContent = ds;

            document.getElementById('emp-day-id').textContent = item.emp['Employee ID'];
            document.getElementById('emp-day-dept').textContent = item.emp['Branch'];

            const statusCard = document.getElementById('emp-day-status-card');
            const statusLabel = document.getElementById('emp-day-status-label');
            const statusVal = document.getElementById('emp-day-status-value');
            const rawStatus = item.emp[dateKey] || 'N/A';
            const metricsDiv = document.getElementById('emp-day-metrics');

            if (isPresentInner) {
                statusCard.style.background = 'rgba(16, 185, 129, 0.1)';
                statusCard.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                statusLabel.style.color = '#065f46';
                statusLabel.textContent = 'Working Day';
                statusVal.style.color = '#10b981';
                statusVal.textContent = String(rawStatus).toUpperCase();

                const d = details || { login: '--:--', logout: '--:--', break: '--:--', total: '--:--' };
                metricsDiv.style.display = 'grid';
                document.getElementById('emp-day-login').textContent = d.login || '--:--';
                document.getElementById('emp-day-logout').textContent = d.logout || '--:--';
                document.getElementById('emp-day-break').textContent = d.break || '--:--';
                document.getElementById('emp-day-total').textContent = d.total || '--:--';
            } else {
                metricsDiv.style.display = 'none';
                if (isLeaveInner) {
                    statusCard.style.background = 'rgba(239, 68, 68, 0.1)';
                    statusCard.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                    statusLabel.style.color = '#991b1b';
                    statusLabel.textContent = 'Status';
                    statusVal.style.color = '#ef4444';
                    statusVal.textContent = String(rawStatus).toUpperCase();
                } else if (isNAInner) {
                    statusCard.style.background = 'rgba(245, 158, 11, 0.1)';
                    statusCard.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                    statusLabel.style.color = '#b45309';
                    statusLabel.textContent = 'Status';
                    statusVal.style.color = '#f59e0b';
                    statusVal.textContent = String(rawStatus).toUpperCase();
                }
            }
        });

        listBody.appendChild(row);
    });
}
