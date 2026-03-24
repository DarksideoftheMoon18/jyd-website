
const STORAGE_KEY = 'jobData_v7_6_clean';
const INTAKE_SEED_KEY = 'jyd_intake_seed_v7_6';

const RATE_TABLE = {
  basePrice: {
    minimum_service: 175,
    load_1_8: 245,
    load_1_4: 349,
    load_3_8: 475,
    load_1_2: 575,
    load_3_4: 775,
    full_load: 949
  },
  stairAccess: {
    none: 0,
    one_flight: 35,
    two_flights: 70,
    complex: null
  },
  carryDistance: {
    standard: 0,
    ft_75_100: 25,
    ft_100_150: 50,
    long_custom: null
  },
  heavyHandling: {
    none: 0,
    dense_debris: 75,
    single_extra_heavy: 75,
    multiple_dense_custom: null
  },
  specialtyDisposal: {
    none: 0,
    standard_appliance: 35,
    refrigerant_appliance: 65,
    tv_ewaste_tire_mattress: 50,
    built_in_custom: null
  },
  travelArea: {
    primary: 0,
    extended_metro: 45,
    outside_standard: 95,
    multiple_stops_custom: null
  }
};

const LABELS = {
  jobSize: {
    minimum_service: 'Minimum Service',
    load_1_8: '1/8 Truck Load',
    load_1_4: '1/4 Truck Load',
    load_3_8: '3/8 Truck Load',
    load_1_2: '1/2 Truck Load',
    load_3_4: '3/4 Truck Load',
    full_load: 'Full Truck Load'
  },
  stairAccess: {
    none: 'No Stairs',
    one_flight: '1 Flight',
    two_flights: '2 Flights',
    complex: '3+ Flights / Complex Stair Access'
  },
  carryDistance: {
    standard: 'Standard Access',
    ft_75_100: '75–100 ft',
    ft_100_150: '100–150 ft',
    long_custom: '150+ Ft / Repeated Long Carry'
  },
  heavyHandling: {
    none: 'None',
    dense_debris: 'Dense Debris',
    single_extra_heavy: 'Single Extra-Heavy Item',
    multiple_dense_custom: 'Multiple Dense Items / Heavy Debris Load'
  },
  specialtyDisposal: {
    none: 'None',
    standard_appliance: 'Standard Appliance',
    refrigerant_appliance: 'Refrigerant Appliance',
    tv_ewaste_tire_mattress: 'TV / E-Waste / Tire / Mattress',
    built_in_custom: 'Built-In / Difficult Removal'
  },
  travelArea: {
    primary: 'Primary Service Area',
    extended_metro: 'Extended Metro',
    outside_standard: 'Outside Standard Service Area',
    multiple_stops_custom: 'Multiple Pickup Stops'
  }
};

function uniqueSuffix() {
  return `${Date.now().toString().slice(-6)}${Math.floor(Math.random()*90+10)}`;
}
function makeNumber(prefix) {
  return `JYD-${prefix}-${new Date().getFullYear()}-${uniqueSuffix()}`;
}
function currency(amount) {
  return Number(amount || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
function roundMoney(amount) {
  return Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;
}
function normalizeState(value) {
  return String(value || '').trim().toUpperCase();
}
function isMinnesotaAddress(data) {
  return normalizeState(data.state) === 'MN' || /minnesota/i.test(String(data.state || ''));
}
function getEstimatedSalesTaxRate(data) {
  if (!isMinnesotaAddress(data)) return 0;
  if (data.serviceType !== 'junk_removal') return 0;
  if (!data.jobSize) return 0;
  return 0.06875;
}
function getEstimatedWasteFee(data, subtotal) {
  return 0;
}
function getEstimatedLocalFee(data, subtotal) {
  return 0;
}
function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getPipelineStatusLabel(data, pageKey = '') {
  if (data.finalPaymentCompleted || data.paymentStatus === 'paid_in_full') return 'Paid in Full';
  if (data.jobCompleted) return 'Balance Due';
  if (data.paymentStatus === 'deposit_paid') return 'Deposit Paid';
  if (pageKey === 'confirm' || pageKey === 'payment') return 'Deposit Required';
  if (pageKey === 'windows') return 'Pending Selection';
  if (pageKey === 'quote') return 'Review Quote';
  if (pageKey === 'photos' || pageKey === 'intake' || pageKey === 'pricing') return 'In Progress';
  return titleCase(data.status || 'In Progress');
}
function getTaxLabel(data) {
  const rate = getEstimatedSalesTaxRate(data);
  return rate ? `MN Sales Tax (${(rate * 100).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}%)` : 'Sales Tax';
}
function formatAddress(data) {
  const line1 = [data.address1, data.address2].filter(Boolean).join(', ');
  const line2 = [data.city, data.state, data.zip].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ') || '—';
}
function formatWindow(date, windowName) {
  if (!date && !windowName) return 'Not selected';
  const prettyDate = date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric',weekday:'long'}) : 'Date pending';
  return `${prettyDate} — ${windowName || 'Window pending'}`;
}
function getWindowStartHour(windowLabel) {
  const map = {
    '8:00 AM – 10:00 AM': 8,
    '10:00 AM – 12:00 PM': 10,
    '12:00 PM – 2:00 PM': 12,
    '2:00 PM – 4:00 PM': 14,
    '4:00 PM – 6:00 PM': 16
  };
  return map[windowLabel] ?? 12;
}
function formatDateTime(dateObj) {
  return dateObj.toLocaleString(undefined, {year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function getCancellationDeadline(date, windowLabel) {
  if (!date) return '36 hours before the scheduled pickup window';
  const eventDate = new Date(`${date}T00:00:00`);
  eventDate.setHours(getWindowStartHour(windowLabel), 0, 0, 0);
  const cancelDate = new Date(eventDate.getTime() - 36 * 60 * 60 * 1000);
  return formatDateTime(cancelDate);
}
function defaultJob() {
  const quoteId = makeNumber('Q');
  return {
    appVersion: 'v7',
    createdAt: new Date().toISOString(),
    jobId: quoteId,
    quoteId,
    invoiceId: makeNumber('I'),
    receiptId: makeNumber('R'),
    status: 'new_request',
    paymentStatus: 'unpaid',
    paymentChoice: 'deposit',
    firstName: '',
    lastName: '',
    fullName: '',
    phone: '',
    email: '',
    address1: '',
    address2: '',
    city: '',
    state: 'MN',
    zip: '',
    customerType: 'residential',
    serviceType: 'junk_removal',
    materialType: 'standard_household_junk',
    jobSize: '',
    stairAccess: 'none',
    carryDistance: 'standard',
    heavyHandling: 'none',
    specialtyDisposal: 'none',
    travelArea: 'primary',
    photos: [],
    notes: '',
    preferredDate: '',
    preferredWindow: '',
    manualReviewRequired: false,
    customQuoteTriggerReason: [],
    estimatedSubtotal: 0,
    estimatedSalesTax: 0,
    estimatedWasteFee: 0,
    estimatedLocalFee: 0,
    estimatedTotal: 0,
    approvedSubtotal: 0,
    salesTaxAmount: 0,
    wasteFeeAmount: 0,
    localFeeAmount: 0,
    adjustmentAmount: 0,
    depositAmount: 100,
    amountPaid: 0,
    balanceDue: 0,
    lineItems: [],
    paymentDate: '',
    paymentStatusLabel: 'In Progress',
    jobCompleted: false,
    finalPaymentCompleted: false
  };
}
function loadJob() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.appVersion === 'v7') {
        return calculateJob({ ...defaultJob(), ...parsed });
      }
    }
  } catch (e) {}
  const fresh = calculateJob(defaultJob());
  saveJob(fresh);
  return fresh;
}
function saveJob(data) {
  const hydrated = calculateJob({ ...defaultJob(), ...data });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
  return hydrated;
}
function updateJob(patch) { return saveJob({ ...loadJob(), ...patch }); }
function resetJob() { const fresh = calculateJob(defaultJob()); saveJob(fresh); return fresh; }
function createFreshJob(seed = {}) {
  return calculateJob({ ...defaultJob(), ...seed });
}
function saveFreshJob(seed = {}) {
  const fresh = createFreshJob(seed);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}
function saveIntakeSeed(seed = {}) {
  sessionStorage.setItem(INTAKE_SEED_KEY, JSON.stringify(seed));
}
function loadIntakeSeed() {
  try {
    const raw = sessionStorage.getItem(INTAKE_SEED_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(INTAKE_SEED_KEY);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    sessionStorage.removeItem(INTAKE_SEED_KEY);
    return null;
  }
}
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function setHTML(id, value) { const el = document.getElementById(id); if (el) el.innerHTML = value; }
function fillField(id, value) { const el = document.getElementById(id); if (!el) return; if (el.type === 'checkbox') el.checked = !!value; else el.value = value ?? ''; }
function next(page) { window.location.href = page; }
function rowValue(label, amount, manual = false) { return { label, amount, manual }; }
function calculateJob(data) {
  const lineItems = [];
  const customReasons = [];
  const baseKey = data.jobSize;
  if (baseKey && RATE_TABLE.basePrice[baseKey] != null) {
    lineItems.push(rowValue('Priced by Volume', RATE_TABLE.basePrice[baseKey]));
  } else {
    lineItems.push(rowValue('Priced by Volume', 0));
  }
  const categories = [
    ['stairAccess', 'Stair Access'],
    ['carryDistance', 'Carry Distance'],
    ['heavyHandling', 'Heavy Items'],
    ['specialtyDisposal', 'Specialty Disposal'],
    ['travelArea', 'Travel Area']
  ];
  for (const [key, label] of categories) {
    const val = data[key];
    const price = RATE_TABLE[key][val];
    if (price === null) {
      lineItems.push(rowValue(label, 'Custom Quote Required', true));
      customReasons.push(label);
    } else {
      lineItems.push(rowValue(label, price || 0));
    }
  }

  const subtotal = lineItems.reduce((sum, item) => sum + (item.manual ? 0 : Number(item.amount || 0)), 0);
  let manualReviewRequired = customReasons.length > 0;

  if (['construction_demolition_debris', 'dense_debris', 'mixed_unknown_debris'].includes(data.materialType)) {
    manualReviewRequired = true;
    if (!customReasons.includes('Material Type')) customReasons.push('Material Type');
  }
  if (data.customerType !== 'residential') {
    manualReviewRequired = true;
    if (!customReasons.includes('Customer type / tax review')) customReasons.push('Customer type / tax review');
  }

  let estimatedSalesTax = roundMoney(subtotal * getEstimatedSalesTaxRate(data));
  let estimatedWasteFee = roundMoney(getEstimatedWasteFee(data, subtotal));
  let estimatedLocalFee = roundMoney(getEstimatedLocalFee(data, subtotal));

  const estimatedTotal = manualReviewRequired ? null : roundMoney(subtotal + estimatedSalesTax + estimatedWasteFee + estimatedLocalFee);
  const depositAmount = estimatedTotal != null ? Math.min(100, estimatedTotal) : 100;
  const amountPaid = Number(data.amountPaid || 0);
  const approvedSubtotal = subtotal;
  const approvedTotal = estimatedTotal != null ? estimatedTotal : 0;
  const balanceDue = Math.max(0, approvedTotal - amountPaid);

  return {
    ...data,
    fullName: [data.firstName, data.lastName].filter(Boolean).join(' ').trim(),
    lineItems,
    customQuoteTriggerReason: customReasons,
    manualReviewRequired,
    estimatedSubtotal: subtotal,
    approvedSubtotal,
    estimatedSalesTax,
    estimatedWasteFee,
    estimatedLocalFee,
    salesTaxAmount: estimatedSalesTax,
    wasteFeeAmount: estimatedWasteFee,
    localFeeAmount: estimatedLocalFee,
    estimatedTotal,
    approvedTotal,
    depositAmount,
    balanceDue
  };
}
function estimatePreviewText(data) {
  if (data.manualReviewRequired) return 'Manual Review Required';
  if (data.estimatedTotal != null) return currency(data.estimatedTotal);
  return currency(0);
}
function photoSummary(data) {
  const names = Array.isArray(data.photos) ? data.photos : [];
  if (!names.length) return 'No photos uploaded';
  return `${names.length} file(s) uploaded: ${names.join(', ')}`;
}
function renderQuotePhotoPreview(targetId, data = loadJob()) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const photos = Array.isArray(data.photos) ? data.photos : [];
  if (!photos.length) {
    target.innerHTML = '<p class="page-intro" style="margin:0;">No photos uploaded</p>';
    return;
  }
  const shown = photos.slice(0, 4);
  const cards = shown.map(name => `<div class="quote-photo-thumb" title="${name}">${name}</div>`).join('');
  const more = photos.length > 4 ? `<p class="page-intro" style="margin:8px 0 0;">+${photos.length - 4} more photos</p>` : '';
  target.innerHTML = `<div class="quote-photo-grid">${cards}</div>${more}`;
}
function renderGlobalSummary(pageKey = '') {
  const data = loadJob();
  setText('globalJobId', data.jobId || '—');
  setText('globalAddress', formatAddress(data));
  setText('globalWindow', formatWindow(data.preferredDate, data.preferredWindow));
  setText('globalStatus', getPipelineStatusLabel(data, pageKey));
}
function renderEstimateSummary(targetId, data = loadJob()) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const rows = data.lineItems.map(item => `<tr><td>${item.label}</td><td>${item.manual ? '<span class="manual-review">Custom Quote Required</span>' : currency(item.amount)}</td></tr>`).join('');
  const footer = `
    <tr><td>Sales Tax (estimated)</td><td>${currency(data.estimatedSalesTax)}</td></tr>
    <tr><td>Local Tax (estimated)</td><td>${currency(data.estimatedLocalFee)}</td></tr>
    <tr><td>Disposal Fee (estimated)</td><td>${currency(data.estimatedWasteFee)}</td></tr>
    <tr class="total-row"><td><strong>Estimated Total</strong></td><td><strong>${data.manualReviewRequired ? '<span class="manual-review">Manual Review Required</span>' : currency(data.estimatedTotal)}</strong></td></tr>
  `;
  target.innerHTML = `<table class="summary-table">${rows}${footer}</table>`;
}
function hydrateIntake() {
  const seed = loadIntakeSeed();
  const data = saveFreshJob(seed || {});
  ['firstName','lastName','phone','email','address1','address2','city','state','zip','notes','customerType','serviceType','materialType','jobSize','stairAccess','carryDistance','heavyHandling','specialtyDisposal','travelArea'].forEach(id => fillField(id, data[id]));
  setText('jobId', data.jobId);
  setText('estimatePreview', estimatePreviewText(data));
  renderEstimateSummary('estimateSummaryBox', data);
  renderGlobalSummary('intake');
}
function captureIntakeForm() {
  return {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    address1: document.getElementById('address1').value.trim(),
    address2: document.getElementById('address2').value.trim(),
    city: document.getElementById('city').value.trim(),
    state: document.getElementById('state').value.trim() || 'MN',
    zip: document.getElementById('zip').value.trim(),
    customerType: document.getElementById('customerType').value,
    serviceType: document.getElementById('serviceType').value,
    materialType: document.getElementById('materialType').value,
    jobSize: document.getElementById('jobSize').value,
    stairAccess: document.getElementById('stairAccess').value,
    carryDistance: document.getElementById('carryDistance').value,
    heavyHandling: document.getElementById('heavyHandling').value,
    specialtyDisposal: document.getElementById('specialtyDisposal').value,
    travelArea: document.getElementById('travelArea').value,
    notes: document.getElementById('notes').value.trim(),
    status: 'review_in_progress'
  };
}
function previewIntakeEstimate() {
  const data = saveJob({ ...loadJob(), ...captureIntakeForm() });
  setText('estimatePreview', estimatePreviewText(data));
  renderEstimateSummary('estimateSummaryBox', data);
  renderGlobalSummary('intake');
}
function saveIntakeAndContinue() { saveJob({ ...loadJob(), ...captureIntakeForm() }); next('photos.html'); }

function hydratePricing() {
  const data = loadJob();
  fillField('pricingJobSize', data.jobSize);
  fillField('pricingStairAccess', data.stairAccess);
  fillField('pricingCarryDistance', data.carryDistance);
  fillField('pricingHeavyHandling', data.heavyHandling);
  fillField('pricingSpecialtyDisposal', data.specialtyDisposal);
  fillField('pricingTravelArea', data.travelArea);
  previewPricingCalculator();
  renderGlobalSummary('pricing');
}
function previewPricingCalculator() {
  const data = saveJob({
    ...loadJob(),
    jobSize: document.getElementById('pricingJobSize').value,
    stairAccess: document.getElementById('pricingStairAccess').value,
    carryDistance: document.getElementById('pricingCarryDistance').value,
    heavyHandling: document.getElementById('pricingHeavyHandling').value,
    specialtyDisposal: document.getElementById('pricingSpecialtyDisposal').value,
    travelArea: document.getElementById('pricingTravelArea').value
  });
  renderEstimateSummary('pricingEstimateSummary', data);
  const reasonEl = document.getElementById('pricingManualReview');
  if (reasonEl) {
    reasonEl.innerHTML = '';
  }
}
function usePricingAndContinue() {
  const seeded = {
    jobSize: document.getElementById('pricingJobSize').value,
    stairAccess: document.getElementById('pricingStairAccess').value,
    carryDistance: document.getElementById('pricingCarryDistance').value,
    heavyHandling: document.getElementById('pricingHeavyHandling').value,
    specialtyDisposal: document.getElementById('pricingSpecialtyDisposal').value,
    travelArea: document.getElementById('pricingTravelArea').value
  };
  saveIntakeSeed(seeded);
  next('intake.html');
}

function bindPhotoInput() {
  const input = document.getElementById('photoUpload');
  if (!input || input.dataset.bound === 'true') return;
  input.dataset.bound = 'true';
  input.addEventListener('change', () => {
    const selected = Array.from(input.files || []).map(file => file.name);
    if (!selected.length) return;
    const current = loadJob().photos || [];
    const combined = [...current];
    selected.forEach(name => { if (combined.length < 8) combined.push(name); });
    const updated = updateJob({ photos: combined.slice(0, 8) });
    renderPhotoList(updated.photos || []);
    setText('photoStatus', updated.photos.length ? `${updated.photos.length} file(s) uploaded` : 'No files selected');
    setText('photoCounter', `${updated.photos.length} / 8 uploaded`);
    input.value = '';
  }, { passive: true });
}
function renderPhotoList(photos) {
  const list = document.getElementById('photoList');
  if (!list) return;
  if (!photos.length) {
    list.innerHTML = '<li class="upload-empty">No files selected</li>';
    return;
  }
  list.innerHTML = photos.map((name, index) => `<li><span class="upload-file-name">${name}</span><span class="upload-delete" role="button" tabindex="0" aria-label="Remove ${name}" onclick="removePhoto(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();removePhoto(${index});}">×</span></li>`).join('');
}
function removePhoto(index) {
  const data = loadJob();
  const target = (data.photos || [])[index];
  if (!target) return;
  if (!window.confirm(`Delete ${target}?`)) return;
  updateJob({ photos: (data.photos || []).filter((_, i) => i !== index) });
  hydratePhotos();
}
function hydratePhotos() {
  const data = loadJob();
  setText('jobId', data.jobId);
  setText('photoStatus', data.photos.length ? `${data.photos.length} file(s) uploaded` : 'No photos uploaded');
  setText('photoCounter', `${data.photos.length} / 8 uploaded`);
  renderPhotoList(data.photos || []);
  bindPhotoInput();
  renderGlobalSummary('photos');
}
function savePhotosAndContinue() { updateJob({ status: 'review_in_progress' }); next('quote.html'); }

function getQuoteWindowLabel(data) {
  if (!data.preferredDate && !data.preferredWindow) return 'Not selected';
  return formatWindow(data.preferredDate, data.preferredWindow).replace(/ yet/g, '').replace('yet', '');
}

function hydrateQuote() {
  const data = loadJob();
  const quoteWindowLabel = getQuoteWindowLabel(data);
  setText('quoteNumber', String(data.quoteId || '—').replace(/^#/, ''));
  setText('quoteDate', new Date(data.createdAt).toLocaleDateString(undefined, {year:'numeric',month:'long',day:'numeric'}));
  setText('quoteWindow', quoteWindowLabel);
  setText('quoteWindowTop', quoteWindowLabel);
  setText('quoteCustomer', data.fullName || '—');
  setText('quoteContact', [data.phone, data.email].filter(Boolean).join(' • ') || '—');
  setText('quoteAddress', formatAddress(data));
  setText('quotePhotos', photoSummary(data).replace(/ yet/g, '').replace('yet', ''));
  renderEstimateSummary('quoteEstimateSummary', data);
  renderQuotePhotoPreview('quotePhotoPreview', data);
  renderGlobalSummary('quote');
  setText('globalWindow', quoteWindowLabel);
}
function continueToWindowRequest() { updateJob({ status: 'quote_reviewed' }); next('windows.html'); }

function hydrateWindows() {
  const data = loadJob();
  fillField('preferredDate', data.preferredDate);
  fillField('preferredWindow', data.preferredWindow);
  setText('windowJobId', data.jobId);
  setText('windowPreview', formatWindow(data.preferredDate, data.preferredWindow));
  renderGlobalSummary('windows');
}
function saveWindowAndContinue() {
  const preferredDate = document.getElementById('preferredDate').value;
  const preferredWindow = document.getElementById('preferredWindow').value;
  if (!preferredDate || !preferredWindow) {
    alert('Please select a service date and time window before continuing.');
    return;
  }
  updateJob({
    preferredDate,
    preferredWindow,
    status: 'window_requested'
  });
  next('confirm.html');
}


function renderConfirmPricing(targetId, data = loadJob()) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const rows = data.lineItems.map(item => `<tr><td>${item.label}</td><td>${item.manual ? '<span class="manual-review">Custom Quote Required</span>' : currency(item.amount)}</td></tr>`).join('');
  target.innerHTML = `<table class="summary-table">${rows}
    <tr><td>Sales Tax (estimated)</td><td>${currency(data.estimatedSalesTax)}</td></tr>
    <tr><td>Local Tax (estimated)</td><td>${currency(data.estimatedLocalFee)}</td></tr>
    <tr><td>Disposal Fee (estimated)</td><td>${currency(data.estimatedWasteFee)}</td></tr>
    <tr class="total-row"><td><strong>Estimated Total</strong></td><td><strong>${data.manualReviewRequired ? '<span class="manual-review">Manual Review Required</span>' : currency(data.estimatedTotal)}</strong></td></tr>
  </table>`;
}
function hydrateConfirm() {
  const data = loadJob();
  setText('confirmJobId', data.jobId || '—');
  setText('confirmAddress', formatAddress(data));
  setText('confirmAddressSide', formatAddress(data));
  setText('confirmWindow', formatWindow(data.preferredDate, data.preferredWindow));
  setText('confirmWindowSide', formatWindow(data.preferredDate, data.preferredWindow));
  setText('confirmEstimate', estimatePreviewText(data));
  setText('confirmContact', [data.fullName, data.phone, data.email].filter(Boolean).join(' • ') || '—');
  setText('confirmDepositAmount', currency(data.depositAmount || 100));
  renderConfirmPricing('confirmPricingSummary', data);
  renderGlobalSummary('confirm');
}
function continueToPayment() {
  const data = loadJob();
  if (!data.preferredDate || !data.preferredWindow) {
    alert('Please select a service date and time window before continuing.');
    next('windows.html');
    return;
  }
  updateJob({ status: 'deposit_required' });
  next('payment.html');
}

function hydratePayment() {
  const data = loadJob();
  if (!data.preferredDate || !data.preferredWindow) {
    alert('Service Window must be selected before payment.');
    next('windows.html');
    return;
  }
  setText('paymentQuoteId', data.quoteId || '—');
  setText('paymentWindow', formatWindow(data.preferredDate, data.preferredWindow));
  setText('paymentAddress', formatAddress(data));
  setText('paymentDepositAmountTop', currency(data.depositAmount || 100));
  setText('paymentDepositAmountCard', currency(data.depositAmount || 100));
  setText('paymentRemainingEstimate', data.manualReviewRequired ? 'Manual review required' : currency(Math.max(0, (data.estimatedTotal || 0) - (data.depositAmount || 100))));
  renderGlobalSummary('payment');
}
function choosePayment(type) {
  const termsAccepted = document.getElementById('termsAccepted');
  if (termsAccepted && !termsAccepted.checked) { alert('Please accept the quote terms before continuing.'); return; }
  const data = loadJob();
  const paymentAmount = type === 'full' && !data.manualReviewRequired ? (data.estimatedTotal || 0) : 100;
  const paymentStatus = type === 'full' ? 'paid_in_full' : 'deposit_paid';
  const paymentLabel = type === 'full' ? 'Paid in Full' : 'Deposit Paid';
  saveJob({
    ...data,
    paymentChoice: type,
    amountPaid: paymentAmount,
    paymentStatus,
    paymentStatusLabel: paymentLabel,
    paymentDate: new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),
    status: type === 'full' ? 'paid_in_full' : 'deposit_paid'
  });
  next(type === 'full' ? 'receipt.html' : 'completion.html');
}

function renderInvoiceLineItems(targetId) {
  const data = loadJob();
  const body = document.getElementById(targetId);
  if (!body) return;
  body.innerHTML = data.lineItems.map(item => `<tr><td>${item.label}</td><td>${item.manual ? 'Manual Review Required' : '1'}</td><td>${item.manual ? '—' : currency(item.amount)}</td><td class="right">${item.manual ? 'Manual Review Required' : currency(item.amount)}</td></tr>`).join('');
  if (!data.lineItems.length) body.innerHTML = '<tr><td colspan="4">Pricing will appear after the quote details are selected.</td></tr>';
}
function hydrateInvoice() {
  const data = loadJob();
  const invoiceStatus = data.finalPaymentCompleted || data.paymentStatus === 'paid_in_full' ? 'Paid in Full' : 'Balance Due';
  setText('invoiceNumber', data.invoiceId || '—');
  setText('invoiceDate', new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}));
  setText('serviceDate', data.preferredDate ? new Date(`${data.preferredDate}T12:00:00`).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}) : 'To be confirmed');
  setText('dueDate', invoiceStatus === 'Paid in Full' ? 'Paid' : 'Due after completion');
  setText('paymentStatusBadge', invoiceStatus);
  setText('totalDueTop', data.manualReviewRequired ? 'Manual Review Required' : currency(data.balanceDue));
  setText('billToName', data.fullName || '—');
  setText('billToAddress', formatAddress(data));
  setText('billToPhone', data.phone || '—');
  setText('billToEmail', data.email || '—');
  setText('quoteId', data.quoteId || '—');
  setText('serviceAddress', formatAddress(data));
  setText('confirmedWindow', formatWindow(data.preferredDate, data.preferredWindow));
  setText('serviceType', titleCase(data.serviceType));
  renderInvoiceLineItems('invoiceLineItems');
  setText('taxLineLabel', getTaxLabel(data));
  setText('subtotalAmount', currency(data.approvedSubtotal));
  setText('salesTaxAmount', currency(data.salesTaxAmount));
  setText('wasteFeeAmount', currency(data.wasteFeeAmount));
  setText('localTaxAmount', currency(data.localFeeAmount));
  setText('depositAmount', `-${currency(data.amountPaid)}`);
  setText('adjustmentAmount', currency(data.adjustmentAmount || 0));
  setText('grandTotalAmount', data.manualReviewRequired ? 'Manual Review Required' : currency(data.approvedTotal));
  setText('balanceDueAmount', data.manualReviewRequired ? 'Manual Review Required' : currency(data.balanceDue));
  setText('invoiceNote', 'Final pricing reflects the completed job and any approved adjustments. If needed, final payment can be completed securely by phone or invoice link at time of service.');
  setText('invoiceManualReview', data.manualReviewRequired ? `Manual review reasons: ${data.customQuoteTriggerReason.join(', ')}` : 'Quote assumptions matched the submitted information and standard tax logic was applied from the service address.');
  renderGlobalSummary('invoice');
}

function hydrateReceipt() {
  const data = loadJob();
  const statusLabel = data.finalPaymentCompleted || data.paymentStatus === 'paid_in_full' ? 'Paid in Full' : 'Deposit Paid';
  const paymentTypeLabel = statusLabel === 'Paid in Full' ? 'Final Payment' : 'Deposit';
  setText('receiptNumber', data.receiptId || '—');
  setText('receiptDate', data.paymentDate || '—');
  setText('receiptStatus', statusLabel);
  setText('receiptAmountTop', currency(data.amountPaid));
  setText('receiptCustomer', data.fullName || '—');
  setText('receiptAddress', formatAddress(data));
  setText('receiptQuoteId', data.quoteId || '—');
  setText('receiptInvoiceId', data.invoiceId || '—');
  setText('receiptWindow', formatWindow(data.preferredDate, data.preferredWindow));
  setText('receiptServiceType', titleCase(data.serviceType));
  setText('receiptPaymentType', paymentTypeLabel);
  setText('receiptPaymentMethod', 'Secure card payment');
  setText('receiptPaymentDate', data.paymentDate || '—');
  setText('receiptPaymentRef', `LOCAL-${String(data.receiptId || '').slice(-4)}`);
  setText('receiptStatusBody', statusLabel);
  setText('receiptApprovedTotal', data.manualReviewRequired ? 'Manual Review Required' : currency(data.approvedTotal));
  setText('receiptPaymentReceived', currency(data.amountPaid));
  setText('receiptBalanceBottom', data.manualReviewRequired ? 'Manual Review Required' : currency(data.balanceDue));
  setText('receiptMeaning', statusLabel === 'Paid in Full' ? 'Your final payment has been received. Thank you for choosing Junkyard Dawgs.' : 'Your deposit has been received and your requested service window has been reserved.');
  renderGlobalSummary('receipt');
}
function printCurrentDocument() { window.print(); }
function emailCurrentDocument(docType) {
  const data = loadJob();
  const subjectMap = {
    invoice: `Junkyard Dawgs Invoice ${data.invoiceId}`,
    receipt: `Junkyard Dawgs Receipt ${data.receiptId}`,
    quote: `Junkyard Dawgs Quote ${data.quoteId}`
  };
  const bodyMap = {
    invoice: `Invoice #: ${data.invoiceId}\nQuote ID: ${data.quoteId}\nService Address: ${formatAddress(data)}\nService Window: ${formatWindow(data.preferredDate, data.preferredWindow)}\nRemaining Balance: ${data.manualReviewRequired ? 'Manual Review Required' : currency(data.balanceDue)}`,
    receipt: `Receipt #: ${data.receiptId}\nInvoice #: ${data.invoiceId}\nAmount Paid: ${currency(data.amountPaid)}\nRemaining Balance: ${data.manualReviewRequired ? 'Manual Review Required' : currency(data.balanceDue)}`,
    quote: `Quote #: ${data.quoteId}\nEstimated Total: ${estimatePreviewText(data)}\nService Address: ${formatAddress(data)}`
  };
  window.location.href = `mailto:${encodeURIComponent(data.email || '')}?subject=${encodeURIComponent(subjectMap[docType] || 'Junkyard Dawgs Record')}&body=${encodeURIComponent(bodyMap[docType] || '')}`;
}

function markJobCompleted() {
  const data = loadJob();
  saveJob({
    ...data,
    jobCompleted: true,
    status: 'job_completed',
    paymentStatusLabel: data.finalPaymentCompleted || data.paymentStatus === 'paid_in_full' ? 'Paid in Full' : 'Balance Due'
  });
  next('invoice.html');
}
function payRemainingBalance() {
  const data = loadJob();
  const finalAmount = Math.max(0, Number(data.approvedTotal || 0) - Number(data.amountPaid || 0));
  saveJob({
    ...data,
    finalPaymentCompleted: true,
    jobCompleted: true,
    paymentChoice: 'full',
    amountPaid: Number(data.amountPaid || 0) + finalAmount,
    balanceDue: 0,
    paymentStatus: 'paid_in_full',
    paymentStatusLabel: 'Paid in Full',
    paymentDate: new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),
    status: 'paid_in_full'
  });
  next('receipt.html');
}
function hydrateCompletion() {
  const data = loadJob();
  setText('completionJobId', data.jobId || '—');
  setText('completionWindow', formatWindow(data.preferredDate, data.preferredWindow));
  setText('completionWindowTop', formatWindow(data.preferredDate, data.preferredWindow));
  setText('completionAddress', formatAddress(data));
  setText('completionDepositStatus', data.paymentStatus === 'deposit_paid' ? 'Deposit Paid' : getPipelineStatusLabel(data, 'payment'));
  renderGlobalSummary(data.jobCompleted ? 'invoice' : 'completion');
}
