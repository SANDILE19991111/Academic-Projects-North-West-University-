// =============================================
// CLINICCARE — FRONTEND APP.JS
// All API calls go to http://localhost:3000/api
// =============================================

const API = 'http://localhost:3000/api';
let currentRole = 'Admin';

// ======= INIT =======
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('en-ZA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  // Check if already logged in
  const token = localStorage.getItem('clinic_token');
  if (!token) {
    document.getElementById('login-modal').classList.remove('hidden');
    document.getElementById('login-modal').style.display = 'flex';
  } else {
    initApp();
  }

  // Nav click handlers
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      navigateTo(section);
    });
  });
});

function initApp() {
  loadDashboard();
}

// ======= AUTH =======
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const role = document.getElementById('login-role').value;

  if (!username || !password) {
    showToast('Please enter username and password', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('clinic_token', data.token);
      localStorage.setItem('clinic_role', role);
      currentRole = role;
      document.getElementById('login-modal').style.display = 'none';
      document.querySelector('.user-name').textContent = username;
      document.querySelector('.user-role').textContent = role;
      document.querySelector('.user-avatar').textContent = username[0].toUpperCase();
      showToast(`Welcome back, ${username}!`, 'success');
      initApp();
    } else {
      showToast(data.message || 'Login failed', 'error');
    }
  } catch {
    // Demo mode — bypass auth when backend offline
    localStorage.setItem('clinic_token', 'demo-token');
    localStorage.setItem('clinic_role', role);
    currentRole = role;
    document.getElementById('login-modal').style.display = 'none';
    showToast('Logged in (demo mode)', 'success');
    initApp();
  }
}

function logout() {
  localStorage.removeItem('clinic_token');
  location.reload();
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('clinic_token')}`
  };
}

// ======= NAVIGATION =======
function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById(`section-${section}`);
  if (el) el.classList.add('active');

  const nav = document.querySelector(`[data-section="${section}"]`);
  if (nav) nav.classList.add('active');

  document.getElementById('page-title').textContent =
    section.charAt(0).toUpperCase() + section.slice(1);

  // Load section data
  switch (section) {
    case 'dashboard': loadDashboard(); break;
    case 'patients': loadPatients(); break;
    case 'appointments': loadAppointments(); break;
    case 'doctors': loadDoctors(); break;
    case 'records': loadRecords(); break;
    case 'pharmacy': loadInventory(); break;
    case 'billing': loadBilling(); break;
    case 'waitlist': loadWaitlist(); break;
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ======= DASHBOARD =======
async function loadDashboard() {
  try {
    const [pRes, aRes, bRes, wRes] = await Promise.all([
      fetch(`${API}/patients`, { headers: getHeaders() }),
      fetch(`${API}/appointments?date=${todayStr()}`, { headers: getHeaders() }),
      fetch(`${API}/billing`, { headers: getHeaders() }),
      fetch(`${API}/waitlist`, { headers: getHeaders() })
    ]);

    if (pRes.ok) {
      const p = await pRes.json();
      document.getElementById('stat-patients').textContent = p.length || 0;
    }

    if (aRes.ok) {
      const a = await aRes.json();
      document.getElementById('stat-appointments').textContent = a.length || 0;
      renderTodayAppointments(a);
    }

    if (bRes.ok) {
      const b = await bRes.json();
      const rev = b.filter(i => i.payment_status === 'Paid')
        .reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);
      document.getElementById('stat-revenue').textContent = `R ${rev.toFixed(2)}`;
    }

    if (wRes.ok) {
      const w = await wRes.json();
      const waiting = w.filter(i => i.status === 'Waiting').length;
      document.getElementById('stat-waitlist').textContent = waiting;
      document.getElementById('notif-count').textContent = waiting;
    }

    loadInventoryAlerts();
  } catch {
    loadDemoDashboard();
  }
}

function loadDemoDashboard() {
  document.getElementById('stat-patients').textContent = '5';
  document.getElementById('stat-appointments').textContent = '3';
  document.getElementById('stat-revenue').textContent = 'R 1,870.50';
  document.getElementById('stat-waitlist').textContent = '2';
  document.getElementById('notif-count').textContent = '2';

  document.getElementById('today-appointments').innerHTML = `
    <div class="list-item"><span>Alice Smith → Dr. Mokoena</span><span class="badge-status badge-scheduled">Scheduled</span></div>
    <div class="list-item"><span>Bob Johnson → Dr. Mokoena</span><span class="badge-status badge-completed">Completed</span></div>
    <div class="list-item"><span>Clara Ngwenya → Dr. Mokoena</span><span class="badge-status badge-scheduled">Scheduled</span></div>
  `;

  document.getElementById('inventory-alerts').innerHTML = `
    <div class="list-item"><span>Item #4 — Out of Stock</span><span class="badge-status badge-out">Out of Stock</span></div>
    <div class="list-item"><span>Item #2 — PharmaLink</span><span class="badge-status badge-low">Reorder Needed</span></div>
  `;
}

function renderTodayAppointments(list) {
  const el = document.getElementById('today-appointments');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>No appointments today</p></div>`;
    return;
  }
  el.innerHTML = list.slice(0, 8).map(a => `
    <div class="list-item">
      <span>Patient #${a.patient_id} → Doctor #${a.doctor_id}</span>
      <span class="badge-status badge-${(a.status || '').toLowerCase()}">${a.status}</span>
    </div>
  `).join('');
}

async function loadInventoryAlerts() {
  try {
    const res = await fetch(`${API}/inventory/alerts`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      const el = document.getElementById('inventory-alerts');
      if (!data.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>All stock levels OK</p></div>`;
        return;
      }
      el.innerHTML = data.map(i => `
        <div class="list-item">
          <span>${i.name} (${i.stock_quant} left)</span>
          <span class="badge-status badge-${i.stock_quant === 0 ? 'out' : 'low'}">${i.stock_quant === 0 ? 'Out of Stock' : 'Low Stock'}</span>
        </div>
      `).join('');
    }
  } catch {}
}

// ======= PATIENTS =======
let allPatients = [];

async function loadPatients() {
  try {
    const res = await fetch(`${API}/patients`, { headers: getHeaders() });
    if (res.ok) {
      allPatients = await res.json();
    } else {
      allPatients = getDemoPatients();
    }
  } catch {
    allPatients = getDemoPatients();
  }
  renderPatients(allPatients);
}

function getDemoPatients() {
  return [
    { patient_id: 1, first_name: 'Alice', surname: 'Smith', dateofbirth: '1990-05-20', cell_no: '0712345678', email: 'alice@example.com' },
    { patient_id: 2, first_name: 'Bob', surname: 'Johnson', dateofbirth: '1985-11-10', cell_no: '0723456789', email: 'bob@example.com' },
    { patient_id: 3, first_name: 'Clara', surname: 'Ngwenya', dateofbirth: '1992-08-14', cell_no: '0734567890', email: 'clara@example.com' },
    { patient_id: 4, first_name: 'Daniel', surname: 'Mokoena', dateofbirth: '1979-01-05', cell_no: '0745678901', email: 'daniel@example.com' },
    { patient_id: 5, first_name: 'Evelyn', surname: 'Khumalo', dateofbirth: '2000-12-25', cell_no: '0756789012', email: 'evelyn@example.com' },
  ];
}

function renderPatients(list) {
  const tbody = document.getElementById('patients-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👤</div><p>No patients found</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.patient_id}</td>
      <td>${p.first_name} ${p.surname}</td>
      <td>${formatDate(p.dateofbirth)}</td>
      <td>${p.cell_no}</td>
      <td>${p.email || '—'}</td>
      <td>
        <button class="btn-sm btn-view" onclick="viewPatient(${p.patient_id})">View</button>
        <button class="btn-sm btn-delete" onclick="deletePatient(${p.patient_id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function searchPatients() {
  const q = document.getElementById('patient-search').value.toLowerCase();
  const filtered = allPatients.filter(p =>
    `${p.first_name} ${p.surname} ${p.patient_id} ${p.email}`.toLowerCase().includes(q)
  );
  renderPatients(filtered);
}

async function addPatient() {
  const body = {
    first_name: document.getElementById('p-fname').value.trim(),
    surname: document.getElementById('p-lname').value.trim(),
    dateofbirth: document.getElementById('p-dob').value,
    cell_no: document.getElementById('p-cell').value.trim(),
    email: document.getElementById('p-email').value.trim(),
    medical_history: document.getElementById('p-history').value.trim(),
    allergies: document.getElementById('p-allergies').value.trim(),
    insurance_info: document.getElementById('p-insurance').value.trim(),
    notification: document.getElementById('p-notif').value === 'true'
  };

  if (!body.first_name || !body.surname || !body.dateofbirth || !body.cell_no) {
    showToast('Please fill in all required fields', 'error'); return;
  }

  try {
    const res = await fetch(`${API}/patients`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Patient registered successfully', 'success');
      closeModal('modal-add-patient');
      loadPatients();
    } else {
      showToast(data.message || 'Error registering patient', 'error');
    }
  } catch {
    showToast('Patient added (demo mode)', 'success');
    closeModal('modal-add-patient');
    allPatients.unshift({ ...body, patient_id: Date.now() });
    renderPatients(allPatients);
  }
}

async function deletePatient(id) {
  if (!confirm('Delete this patient and all their records?')) return;
  try {
    const res = await fetch(`${API}/patients/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (res.ok) {
      showToast('Patient deleted', 'success');
      loadPatients();
    }
  } catch {
    allPatients = allPatients.filter(p => p.patient_id !== id);
    renderPatients(allPatients);
    showToast('Patient removed (demo)', 'success');
  }
}

async function viewPatient(id) {
  const p = allPatients.find(x => x.patient_id == id);
  if (!p) return;
  document.getElementById('patient-detail-content').innerHTML = `
    <div class="detail-grid">
      <div><div class="detail-label">Patient ID</div><div class="detail-value">${p.patient_id}</div></div>
      <div><div class="detail-label">Full Name</div><div class="detail-value">${p.first_name} ${p.surname}</div></div>
      <div><div class="detail-label">Date of Birth</div><div class="detail-value">${formatDate(p.dateofbirth)}</div></div>
      <div><div class="detail-label">Cell Number</div><div class="detail-value">${p.cell_no}</div></div>
      <div><div class="detail-label">Email</div><div class="detail-value">${p.email || '—'}</div></div>
      <div><div class="detail-label">Insurance</div><div class="detail-value">${p.insurance_info || '—'}</div></div>
      <div><div class="detail-label">Allergies</div><div class="detail-value">${p.allergies || 'None'}</div></div>
      <div><div class="detail-label">Notifications</div><div class="detail-value">${p.notification ? '✅ Enabled' : '❌ Disabled'}</div></div>
    </div>
    <div style="margin-top:16px"><div class="detail-label">Medical History</div><div class="detail-value">${p.medical_history || 'None recorded'}</div></div>
  `;
  openModal('modal-view-patient');
}

// ======= APPOINTMENTS =======
async function loadAppointments() {
  const status = document.getElementById('appt-filter-status').value;
  const date = document.getElementById('appt-filter-date').value;
  let url = `${API}/appointments?`;
  if (status) url += `status=${status}&`;
  if (date) url += `date=${date}`;

  try {
    const res = await fetch(url, { headers: getHeaders() });
    const data = res.ok ? await res.json() : getDemoAppointments();
    renderAppointments(data);
  } catch {
    renderAppointments(getDemoAppointments());
  }
}

function getDemoAppointments() {
  return [
    { appointment_id: 1, patient_id: 1, doctor_id: 201, datetime: '2025-05-15T10:00', status: 'Completed', consultation_notes: 'Routine checkup' },
    { appointment_id: 2, patient_id: 2, doctor_id: 201, datetime: '2025-05-15T11:00', status: 'Scheduled', consultation_notes: 'BP review' },
    { appointment_id: 3, patient_id: 3, doctor_id: 201, datetime: '2025-05-16T09:30', status: 'Scheduled', consultation_notes: 'Asthma follow-up' },
  ];
}

function renderAppointments(list) {
  const tbody = document.getElementById('appointments-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📅</div><p>No appointments found</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(a => `
    <tr>
      <td>${a.appointment_id}</td>
      <td>Patient #${a.patient_id}</td>
      <td>Dr. #${a.doctor_id}</td>
      <td>${formatDateTime(a.datetime)}</td>
      <td><span class="badge-status badge-${(a.status||'').toLowerCase().replace(' ','-')}">${a.status}</span></td>
      <td>
        <button class="btn-sm btn-view" onclick="alert('${(a.consultation_notes||'No notes').replace(/'/g,'`')}')">Notes</button>
        <button class="btn-sm btn-delete" onclick="deleteAppointment(${a.appointment_id})">Cancel</button>
      </td>
    </tr>
  `).join('');
}

async function addAppointment() {
  const body = {
    patient_id: parseInt(document.getElementById('a-patientid').value),
    doctor_id: parseInt(document.getElementById('a-doctorid').value),
    datetime: document.getElementById('a-datetime').value,
    consultation_notes: document.getElementById('a-notes').value.trim(),
    status: document.getElementById('a-status').value
  };

  if (!body.patient_id || !body.doctor_id || !body.datetime) {
    showToast('Please fill in all required fields', 'error'); return;
  }

  try {
    const res = await fetch(`${API}/appointments`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Appointment booked!', 'success');
      closeModal('modal-add-appointment');
      loadAppointments();
    } else {
      showToast(data.message || 'Error booking appointment', 'error');
    }
  } catch {
    showToast('Appointment booked (demo mode)', 'success');
    closeModal('modal-add-appointment');
  }
}

async function deleteAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    await fetch(`${API}/appointments/${id}`, { method: 'DELETE', headers: getHeaders() });
    showToast('Appointment cancelled', 'success');
    loadAppointments();
  } catch {
    showToast('Cancelled (demo)', 'success');
  }
}

// ======= DOCTORS =======
async function loadDoctors() {
  try {
    const res = await fetch(`${API}/doctors`, { headers: getHeaders() });
    const data = res.ok ? await res.json() : getDemoDoctors();
    renderDoctors(data);
  } catch {
    renderDoctors(getDemoDoctors());
  }
}

function getDemoDoctors() {
  return [
    { doctor_id: 201, staff_id: 101, specialization: 'General Practitioner', license_number: 'GP001', phone: '0781234567', email: 'dr.mokoena@clinic.com', schedule: 'Mon-Fri 9am-5pm' }
  ];
}

function renderDoctors(list) {
  const tbody = document.getElementById('doctors-tbody');
  tbody.innerHTML = list.map(d => `
    <tr>
      <td>${d.doctor_id}</td>
      <td>Dr. #${d.staff_id}</td>
      <td>${d.specialization}</td>
      <td>${d.phone || '—'}</td>
      <td>${d.schedule || '—'}</td>
      <td>
        <button class="btn-sm btn-delete" onclick="deleteDoctor(${d.doctor_id})">Remove</button>
      </td>
    </tr>
  `).join('');
}

async function addDoctor() {
  const body = {
    phone: document.getElementById('d-phone').value.trim(),
    email: document.getElementById('d-email').value.trim(),
    specialization: document.getElementById('d-spec').value.trim(),
    license_number: document.getElementById('d-license').value.trim(),
    schedule: document.getElementById('d-schedule').value.trim()
  };

  if (!body.phone || !body.email || !body.specialization || !body.license_number) {
    showToast('Please fill in all required fields', 'error'); return;
  }

  try {
    const res = await fetch(`${API}/doctors`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('Doctor added!', 'success');
      closeModal('modal-add-doctor');
      loadDoctors();
    } else {
      const d = await res.json();
      showToast(d.message || 'Error', 'error');
    }
  } catch {
    showToast('Doctor added (demo mode)', 'success');
    closeModal('modal-add-doctor');
  }
}

async function deleteDoctor(id) {
  if (!confirm('Remove this doctor?')) return;
  try {
    await fetch(`${API}/doctors/${id}`, { method: 'DELETE', headers: getHeaders() });
    showToast('Doctor removed', 'success');
    loadDoctors();
  } catch {
    showToast('Removed (demo)', 'success');
  }
}

// ======= MEDICAL RECORDS =======
async function loadRecords() {
  const pid = document.getElementById('record-patient-id').value.trim();
  let url = `${API}/records${pid ? `?patient_id=${pid}` : ''}`;

  try {
    const res = await fetch(url, { headers: getHeaders() });
    const data = res.ok ? await res.json() : getDemoRecords();
    renderRecords(data);
  } catch {
    renderRecords(getDemoRecords());
  }
}

function getDemoRecords() {
  return [
    { record_id: 1, patient_id: 1, doctor_id: 201, diagnosis: 'Healthy', treatment_plan: 'Continue monitoring', time_stamp: '2025-05-15T10:45' },
    { record_id: 2, patient_id: 2, doctor_id: 201, diagnosis: 'Hypertension', treatment_plan: 'Prescribe beta-blockers', time_stamp: '2025-05-15T11:45' },
  ];
}

function renderRecords(list) {
  const tbody = document.getElementById('records-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No records found</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr>
      <td>${r.record_id}</td>
      <td>Patient #${r.patient_id}</td>
      <td>Dr. #${r.doctor_id}</td>
      <td>${r.diagnosis || '—'}</td>
      <td>${r.treatment_plan ? r.treatment_plan.substring(0, 40) + '...' : '—'}</td>
      <td>${formatDateTime(r.time_stamp)}</td>
      <td>
        <button class="btn-sm btn-view" onclick="alert('Treatment: ${(r.treatment_plan||'').replace(/'/g,'`')}')">View</button>
      </td>
    </tr>
  `).join('');
}

async function addRecord() {
  const body = {
    patient_id: parseInt(document.getElementById('r-patientid').value),
    doctor_id: parseInt(document.getElementById('r-doctorid').value),
    diagnosis: document.getElementById('r-diagnosis').value.trim(),
    treatment_plan: document.getElementById('r-treatment').value.trim(),
    lab_results: document.getElementById('r-lab').value.trim(),
    consultation_notes: document.getElementById('r-notes').value.trim()
  };

  if (!body.patient_id || !body.doctor_id || !body.diagnosis) {
    showToast('Fill in required fields', 'error'); return;
  }

  try {
    const res = await fetch(`${API}/records`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('Record saved!', 'success');
      closeModal('modal-add-record');
      loadRecords();
    }
  } catch {
    showToast('Record saved (demo mode)', 'success');
    closeModal('modal-add-record');
  }
}

// ======= INVENTORY =======
async function loadInventory() {
  try {
    const res = await fetch(`${API}/inventory`, { headers: getHeaders() });
    const data = res.ok ? await res.json() : getDemoInventory();
    renderInventory(data);
  } catch {
    renderInventory(getDemoInventory());
  }
}

function getDemoInventory() {
  return [
    { item_id: 1, name: 'Paracetamol', stock_quant: 100, reorder_level: 20, expiry_date: '2026-12-31' },
    { item_id: 2, name: 'Amoxicillin', stock_quant: 50, reorder_level: 10, expiry_date: '2025-10-01' },
    { item_id: 3, name: 'Ibuprofen', stock_quant: 200, reorder_level: 30, expiry_date: '2026-01-15' },
    { item_id: 4, name: 'Bandages', stock_quant: 0, reorder_level: 25, expiry_date: '2025-09-01' },
    { item_id: 5, name: 'Salbutamol Inhaler', stock_quant: 75, reorder_level: 15, expiry_date: '2026-06-20' },
  ];
}

function renderInventory(list) {
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = list.map(i => {
    let status, cls;
    if (i.stock_quant === 0) { status = 'Out of Stock'; cls = 'out'; }
    else if (i.stock_quant <= i.reorder_level) { status = 'Low Stock'; cls = 'low'; }
    else { status = 'In Stock'; cls = 'ok'; }

    return `
      <tr>
        <td>${i.item_id}</td>
        <td>${i.name}</td>
        <td>${i.stock_quant}</td>
        <td>${i.reorder_level}</td>
        <td>${formatDate(i.expiry_date)}</td>
        <td><span class="badge-status badge-${cls}">${status}</span></td>
        <td>
          <button class="btn-sm btn-edit" onclick="restockItem(${i.item_id})">Restock</button>
          <button class="btn-sm btn-delete" onclick="deleteInventory(${i.item_id})">Remove</button>
        </td>
      </tr>`;
  }).join('');
}

async function addInventory() {
  const body = {
    name: document.getElementById('inv-name').value.trim(),
    stock_quant: parseInt(document.getElementById('inv-stock').value),
    reorder_level: parseInt(document.getElementById('inv-reorder').value),
    unit_price: parseFloat(document.getElementById('inv-price').value) || null,
    expiry_date: document.getElementById('inv-expiry').value,
    supplier_info: document.getElementById('inv-supplier').value.trim()
  };

  if (!body.name || isNaN(body.stock_quant)) {
    showToast('Fill in required fields', 'error'); return;
  }

  try {
    const res = await fetch(`${API}/inventory`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('Item added!', 'success');
      closeModal('modal-add-inventory');
      loadInventory();
    }
  } catch {
    showToast('Item added (demo mode)', 'success');
    closeModal('modal-add-inventory');
  }
}

async function restockItem(id) {
  const qty = prompt('Enter quantity to add:');
  if (!qty || isNaN(qty)) return;
  try {
    await fetch(`${API}/inventory/${id}/restock`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ quantity: parseInt(qty) })
    });
    showToast('Stock updated!', 'success');
    loadInventory();
  } catch {
    showToast('Restocked (demo)', 'success');
  }
}

async function deleteInventory(id) {
  if (!confirm('Remove this item?')) return;
  try {
    await fetch(`${API}/inventory/${id}`, { method: 'DELETE', headers: getHeaders() });
    showToast('Item removed', 'success');
    loadInventory();
  } catch {
    showToast('Removed (demo)', 'success');
  }
}

// ======= BILLING =======
async function loadBilling() {
  try {
    const res = await fetch(`${API}/billing`, { headers: getHeaders() });
    const data = res.ok ? await res.json() : getDemoBilling();
    renderBilling(data);
  } catch {
    renderBilling(getDemoBilling());
  }
}

function getDemoBilling() {
  return [
    { invoice_id: 1, patient_id: 1, total_amount: 750.00, payment_method: 'Credit Card', payment_status: 'Paid', dateofbilling: '2025-05-15' },
    { invoice_id: 2, patient_id: 2, total_amount: 500.00, payment_method: 'Cash', payment_status: 'Unpaid', dateofbilling: '2025-05-15' },
    { invoice_id: 3, patient_id: 3, total_amount: 620.50, payment_method: 'Medical Aid', payment_status: 'Paid', dateofbilling: '2025-05-16' },
    { invoice_id: 4, patient_id: 4, total_amount: 430.00, payment_method: 'Credit Card', payment_status: 'Paid', dateofbilling: '2025-05-16' },
    { invoice_id: 5, patient_id: 5, total_amount: 999.99, payment_method: 'Medical Aid', payment_status: 'Pending', dateofbilling: '2025-05-17' },
  ];
}

function renderBilling(list) {
  const tbody = document.getElementById('billing-tbody');
  tbody.innerHTML = list.map(i => {
    const tax = (parseFloat(i.total_amount || 0) * 0.15).toFixed(2);
    return `
      <tr>
        <td>${i.invoice_id}</td>
        <td>Patient #${i.patient_id}</td>
        <td>R ${parseFloat(i.total_amount).toFixed(2)}</td>
        <td>R ${tax}</td>
        <td>${i.payment_method || '—'}</td>
        <td><span class="badge-status badge-${(i.payment_status||'').toLowerCase().replace(' ','-')}">${i.payment_status}</span></td>
        <td>${formatDate(i.dateofbilling)}</td>
        <td>
          <button class="btn-sm btn-view" onclick="markPaid(${i.invoice_id})">Mark Paid</button>
          <button class="btn-sm btn-delete" onclick="deleteInvoice(${i.invoice_id})">Delete</button>
        </td>
      </tr>`;
  }).join('');
}

async function addInvoice() {
  const body = {
    patient_id: parseInt(document.getElementById('inv2-patientid').value),
    total_amount: parseFloat(document.getElementById('inv2-amount').value),
    payment_method: document.getElementById('inv2-method').value,
    payment_status: document.getElementById('inv2-status').value,
    issued_by: parseInt(document.getElementById('inv2-issuedby').value)
  };

  if (!body.patient_id || isNaN(body.total_amount)) {
    showToast('Fill required fields', 'error'); return;
  }

  try {
    const res = await fetch(`${API}/billing`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('Invoice created!', 'success');
      closeModal('modal-add-invoice');
      loadBilling();
    }
  } catch {
    showToast('Invoice created (demo)', 'success');
    closeModal('modal-add-invoice');
  }
}

async function markPaid(id) {
  try {
    await fetch(`${API}/billing/${id}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ payment_status: 'Paid' })
    });
    showToast('Marked as Paid!', 'success');
    loadBilling();
  } catch {
    showToast('Updated (demo)', 'success');
  }
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  try {
    await fetch(`${API}/billing/${id}`, { method: 'DELETE', headers: getHeaders() });
    showToast('Invoice deleted', 'success');
    loadBilling();
  } catch {
    showToast('Deleted (demo)', 'success');
  }
}

// ======= WAITLIST =======
async function loadWaitlist() {
  try {
    const res = await fetch(`${API}/waitlist`, { headers: getHeaders() });
    const data = res.ok ? await res.json() : getDemoWaitlist();
    renderWaitlist(data);
  } catch {
    renderWaitlist(getDemoWaitlist());
  }
}

function getDemoWaitlist() {
  return [
    { waitlist_id: 1, patient_id: 2, doctor_id: 201, requested_date: '2025-05-18', priority: 5, status: 'Waiting' },
    { waitlist_id: 2, patient_id: 4, doctor_id: 201, requested_date: '2025-05-18', priority: 3, status: 'Waiting' },
    { waitlist_id: 3, patient_id: 5, doctor_id: 201, requested_date: '2025-05-18', priority: 7, status: 'Confirmed' },
  ];
}

function renderWaitlist(list) {
  const tbody = document.getElementById('waitlist-tbody');
  tbody.innerHTML = list.map(w => `
    <tr>
      <td>${w.waitlist_id}</td>
      <td>Patient #${w.patient_id}</td>
      <td>Dr. #${w.doctor_id}</td>
      <td>${formatDate(w.requested_date)}</td>
      <td>${w.priority}/10</td>
      <td><span class="badge-status badge-${(w.status||'').toLowerCase()}">${w.status}</span></td>
      <td>
        <button class="btn-sm btn-view" onclick="confirmWaitlist(${w.waitlist_id})">Confirm</button>
        <button class="btn-sm btn-delete" onclick="removeWaitlist(${w.waitlist_id})">Remove</button>
      </td>
    </tr>
  `).join('');
}

async function addWaitlist() {
  const body = {
    patient_id: parseInt(document.getElementById('w-patientid').value),
    doctor_id: parseInt(document.getElementById('w-doctorid').value),
    requested_date: document.getElementById('w-date').value,
    priority: parseInt(document.getElementById('w-priority').value) || 5
  };

  if (!body.patient_id || !body.doctor_id || !body.requested_date) {
    showToast('Fill required fields', 'error'); return;
  }

  try {
    const res = await fetch(`${API}/waitlist`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    });
    if (res.ok) {
      showToast('Added to waitlist!', 'success');
      closeModal('modal-add-waitlist');
      loadWaitlist();
    }
  } catch {
    showToast('Added to waitlist (demo)', 'success');
    closeModal('modal-add-waitlist');
  }
}

async function confirmWaitlist(id) {
  try {
    await fetch(`${API}/waitlist/${id}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status: 'Confirmed' })
    });
    showToast('Waitlist entry confirmed!', 'success');
    loadWaitlist();
  } catch {
    showToast('Confirmed (demo)', 'success');
  }
}

async function removeWaitlist(id) {
  if (!confirm('Remove from waitlist?')) return;
  try {
    await fetch(`${API}/waitlist/${id}`, { method: 'DELETE', headers: getHeaders() });
    showToast('Removed from waitlist', 'success');
    loadWaitlist();
  } catch {
    showToast('Removed (demo)', 'success');
  }
}

// ======= MODAL HELPERS =======
function openModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.add('hidden');
  el.style.display = 'none';
}

// Close modal on background click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay') && !e.target.id.includes('login')) {
    e.target.classList.add('hidden');
    e.target.style.display = 'none';
  }
});

// ======= TOAST =======
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3200);
}

// ======= UTILITIES =======
function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ======= AUTH TAB SWITCHING =======
function switchAuthTab(tab) {
  document.getElementById('panel-signin').style.display = tab === 'signin' ? 'block' : 'none';
  document.getElementById('panel-signup').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('tab-signin').classList.toggle('active', tab === 'signin');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
}

// ======= SIGN UP =======
async function doSignup() {
  const fname    = document.getElementById('reg-fname').value.trim();
  const lname    = document.getElementById('reg-lname').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const role     = document.getElementById('reg-role').value;
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;

  if (!fname || !lname || !phone || !email || !username || !password) {
    showToast('Please fill in all required fields', 'error'); return;
  }
  if (username.length < 5) {
    showToast('Username must be at least 5 characters', 'error'); return;
  }
  if (password !== confirm) {
    showToast('Passwords do not match', 'error'); return;
  }
  if (password.length < 6) {
    showToast('Password must be at least 6 characters', 'error'); return;
  }

  try {
    const res = await fetch(`${API}/auth/register-staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: fname, surname: lname, phone, email, role, username, password })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('Account created! Please sign in.', 'success');
      document.getElementById('login-username').value = username;
      document.getElementById('login-role').value = role;
      switchAuthTab('signin');
    } else {
      showToast(data.message || 'Registration failed', 'error');
    }
  } catch {
    // Demo mode — no backend needed
    showToast(`Account created for "${username}"! Sign in to continue.`, 'success');
    document.getElementById('login-username').value = username;
    document.getElementById('login-role').value = role;
    switchAuthTab('signin');
  }
}
