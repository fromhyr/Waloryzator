const inflationData = JSON.parse(JSON.stringify(data));

// --- Month names ---
const MONTH_HEADERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

const MONTHS_LOCATIVE = [
  'styczniu', 'lutym', 'marcu', 'kwietniu', 'maju', 'czerwcu',
  'lipcu', 'sierpniu', 'wrześniu', 'październiku', 'listopadzie', 'grudniu',
];

const MONTHS_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

const MONTHS_NOMINATIVE = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

// --- Number formatting ---
function formatPLN(value) {
  var parts = Math.abs(value).toFixed(2).split('.');
  var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (value < 0 ? '-' : '') + intPart + ',' + parts[1] + ' zł';
}

function formatIndex(value) {
  return value.toFixed(1).replace('.', ',');
}

function formatPercent(value) {
  var s = value.toFixed(1).replace('.', ',');
  if (s === '0,0') s = '0';
  return s + '%';
}

function formatMultiplier(change) {
  var tenths = Math.round(change * 10);
  var s = (tenths / 1000).toFixed(4).replace(/0+$/, '');
  if (s.endsWith('.')) s += '0';
  return s.replace('.', ',');
}

// --- Inflation table (existing) ---
function getCellType(year, monthIndex) {
  var now = new Date();
  var currentYear = now.getFullYear();
  var currentMonth = now.getMonth();

  if (year < currentYear) return 'data';
  if (year > currentYear) return 'future';

  if (monthIndex <= currentMonth) {
    var yearData = inflationData[year];
    if (yearData && yearData[monthIndex] !== undefined) return 'data';
    return 'missing';
  }
  return 'future';
}

function startEdit(cell, year, monthIndex) {
  if (cell.querySelector('input')) return;

  var type = getCellType(year, monthIndex);
  if (type === 'future') return;

  var currentValue = inflationData[year] && inflationData[year][monthIndex];
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-input';
  input.value = currentValue !== undefined ? currentValue : '';

  cell.textContent = '';
  cell.appendChild(input);
  input.focus();
  input.select();

  function commit() {
    var raw = input.value.trim().replace(',', '.');

    if (raw === '') {
      if (inflationData[year]) {
        inflationData[year][monthIndex] = undefined;
      }
      renderCell(cell, year, monthIndex);
      return;
    }

    var num = parseFloat(raw);
    if (isNaN(num)) {
      renderCell(cell, year, monthIndex);
      return;
    }

    var rounded = Math.round(num * 10) / 10;

    if (!inflationData[year]) inflationData[year] = [];
    while (inflationData[year].length <= monthIndex) {
      inflationData[year].push(undefined);
    }
    inflationData[year][monthIndex] = rounded;

    renderCell(cell, year, monthIndex);
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      input.removeEventListener('blur', commit);
      renderCell(cell, year, monthIndex);
    }
  });
}

function renderCell(cell, year, monthIndex) {
  var type = getCellType(year, monthIndex);
  var value = inflationData[year] && inflationData[year][monthIndex];

  cell.className = 'cell cell-' + type;
  cell.textContent = value !== undefined ? value.toFixed(1).replace('.', ',') : '';
  cell.dataset.year = year;
  cell.dataset.month = monthIndex;
}

function renderTable() {
  var table = document.getElementById('inflation-table');
  table.innerHTML = '';

  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var thYear = document.createElement('th');
  thYear.textContent = 'Rok';
  headerRow.appendChild(thYear);
  MONTH_HEADERS.forEach(function (name) {
    var th = document.createElement('th');
    th.textContent = name;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  var years = Object.keys(inflationData).map(Number).sort(function (a, b) { return b - a; });

  years.forEach(function (year) {
    var row = document.createElement('tr');
    var tdYear = document.createElement('td');
    tdYear.className = 'cell-year';
    tdYear.textContent = year;
    row.appendChild(tdYear);

    for (var m = 0; m < 12; m++) {
      var td = document.createElement('td');
      renderCell(td, year, m);
      (function (td, year, m) {
        td.addEventListener('click', function () {
          startEdit(td, year, m);
        });
      })(td, year, m);
      row.appendChild(td);
    }

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
}

// --- Form: populate selects ---
function populateSelects() {
  var years = Object.keys(inflationData).map(Number).sort(function (a, b) { return b - a; });
  var fromYear = document.getElementById('from-year');
  var toYear = document.getElementById('to-year');
  var fromMonth = document.getElementById('from-month');
  var toMonth = document.getElementById('to-month');

  years.forEach(function (y) {
    var opt1 = document.createElement('option');
    opt1.value = y;
    opt1.textContent = y;
    fromYear.appendChild(opt1);

    var opt2 = document.createElement('option');
    opt2.value = y;
    opt2.textContent = y;
    toYear.appendChild(opt2);
  });

  for (var m = 0; m < 12; m++) {
    var label = MONTHS_NOMINATIVE[m];
    var opt1 = document.createElement('option');
    opt1.value = m;
    opt1.textContent = label;
    fromMonth.appendChild(opt1);

    var opt2 = document.createElement('option');
    opt2.value = m;
    opt2.textContent = label;
    toMonth.appendChild(opt2);
  }

  // Set default end date to last available data point
  var lastYear = years[0]; // years sorted desc, first = newest
  var lastMonthIndex = inflationData[lastYear].length - 1;
  toYear.value = lastYear;
  toMonth.value = lastMonthIndex;
}

// --- Validation & generation ---
function getInflationValue(year, monthIndex) {
  var yearData = inflationData[year];
  if (!yearData) return undefined;
  return yearData[monthIndex];
}

function showError(msg) {
  document.getElementById('error').textContent = msg;
}

function clearError() {
  document.getElementById('error').textContent = '';
}

function validate(amount, fromYear, fromMonth, toYear, toMonth) {
  if (isNaN(amount) || amount <= 0) {
    return 'Podaj poprawną kwotę początkową.';
  }

  var minYear = Math.min.apply(null, Object.keys(inflationData).map(Number));

  if (fromYear < minYear || (fromYear === minYear && fromMonth < 0)) {
    return 'Data początkowa nie może być wcześniejsza niż styczeń ' + minYear + '.';
  }

  var now = new Date();
  var curYear = now.getFullYear();
  var curMonth = now.getMonth();

  if (toYear > curYear || (toYear === curYear && toMonth > curMonth)) {
    return 'Data końcowa nie może być późniejsza niż bieżący miesiąc.';
  }

  if (toYear < fromYear || (toYear === fromYear && toMonth <= fromMonth)) {
    return 'Data końcowa musi być późniejsza niż data początkowa.';
  }

  // Check data completeness — we need indices from fromMonth+1 to toMonth
  var y = fromYear;
  var m = fromMonth + 1;
  if (m > 11) { m = 0; y++; }

  while (y < toYear || (y === toYear && m <= toMonth)) {
    var val = getInflationValue(y, m);
    if (val === undefined) {
      var monthLabel = MONTH_HEADERS[m];
      return 'Brak danych dla ' + MONTHS_GENITIVE[m] + ' ' + y + '. Uzupełnij dane w tabeli poniżej.';
    }
    m++;
    if (m > 11) { m = 0; y++; }
  }

  return null;
}

function monthLocativePrefix(monthIndex) {
  return monthIndex === 8 ? 'we' : 'w';
}

function generate() {
  clearError();
  document.getElementById('result').innerHTML = '';
  document.getElementById('result-container').classList.remove('visible');

  var truncate = document.getElementById('truncate').checked;
  var round2 = truncate
    ? function (v) { return Math.floor(v * 100) / 100; }
    : function (v) { return Math.round(v * 100) / 100; };

  var amountRaw = document.getElementById('amount').value.trim().replace(',', '.').replace(/\s/g, '');
  var amount = parseFloat(amountRaw);
  var fromYear = parseInt(document.getElementById('from-year').value);
  var fromMonth = parseInt(document.getElementById('from-month').value);
  var toYear = parseInt(document.getElementById('to-year').value);
  var toMonth = parseInt(document.getElementById('to-month').value);

  var err = validate(amount, fromYear, fromMonth, toYear, toMonth);
  if (err) {
    showError(err);
    return;
  }

  var html = '';
  var currentAmount = amount;
  var y = fromYear;
  var m = fromMonth + 1;
  if (m > 11) { m = 0; y++; }

  var prevY = fromYear;
  var prevM = fromMonth;

  while (y < toYear || (y === toYear && m <= toMonth)) {
    var index = getInflationValue(y, m);
    var change = Math.round(Math.abs(index - 100) * 10) / 10;
    var prefix = monthLocativePrefix(m);
    var prevPrefix = monthLocativePrefix(prevM);

    var desc = '&#10148; wskaźnik cen towarów i usług konsumpcyjnych <b>' + prefix + ' ' + MONTHS_LOCATIVE[m] + ' ' + y + ' r.</b> w stosunku <b>do ' + MONTHS_GENITIVE[prevM] + ' ' + prevY + ' r.</b> wyniósł ' + formatIndex(index);

    html += '<div class="entry">';

    if (index > 100) {
      var changeAmount = round2(currentAmount * change / 100);
      var newAmount = Math.round((currentAmount + changeAmount) * 100) / 100;

      html += desc + ' <b>(wzrost cen o ' + formatPercent(change) + ')</b>';
      html += '<div class="calc">';
      html += formatPLN(currentAmount) + ' x ' + formatMultiplier(change) + ' = ' + formatPLN(changeAmount);
      html += '<br>' + formatPLN(currentAmount) + ' + ' + formatPLN(changeAmount) + ' = ' + formatPLN(newAmount);
      html += '</div>';

      currentAmount = newAmount;
    } else if (index < 100) {
      var changeAmount = round2(currentAmount * change / 100);
      var newAmount = Math.round((currentAmount - changeAmount) * 100) / 100;

      html += desc + ' <b>(obniżenie cen o ' + formatPercent(change) + ')</b>';
      html += '<div class="calc">';
      html += formatPLN(currentAmount) + ' x ' + formatMultiplier(change) + ' = ' + formatPLN(changeAmount);
      html += '<br>' + formatPLN(currentAmount) + ' - ' + formatPLN(changeAmount) + ' = ' + formatPLN(newAmount);
      html += '</div>';

      currentAmount = newAmount;
    } else {
      html += desc + ' <b>(wartość cen pozostała na tym samym poziomie)</b>';
    }

    html += '</div>';

    prevY = y;
    prevM = m;
    m++;
    if (m > 11) { m = 0; y++; }
  }

  document.getElementById('result').innerHTML = html;
  document.getElementById('result-container').classList.add('visible');
}

// --- Init ---
populateSelects();
renderTable();

document.getElementById('generate-btn').addEventListener('click', generate);

document.getElementById('copy-btn').addEventListener('click', function () {
  var result = document.getElementById('result');
  var selection = window.getSelection();
  var range = document.createRange();
  range.selectNodeContents(result);
  selection.removeAllRanges();
  selection.addRange(range);

  navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([result.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([result.innerText], { type: 'text/plain' }),
    })
  ]).then(function () {
    var btn = document.getElementById('copy-btn');
    btn.textContent = 'Skopiowano!';
    setTimeout(function () { btn.textContent = 'Kopiuj do schowka'; }, 2000);
  });

  selection.removeAllRanges();
});
