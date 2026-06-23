(function () {
  var bottle = document.getElementById('bottle');
  var fillEl = document.getElementById('fill');
  var dot = document.getElementById('dot');
  var timeEl = document.getElementById('time');
  var labelEl = document.getElementById('label');
  var isDragging = false;
  var hasMoved = false;
  var dragStartScreenX = 0;
  var dragStartScreenY = 0;

  function formatTime(seconds) {
    seconds = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function normalizeState(state) {
    var allowed = {
      running: true,
      break: true,
      paused: true,
      'break-paused': true,
      snoozed: true,
      'break-ready': true,
      idle: true,
    };
    return allowed[state] ? state : 'idle';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getProgress(data) {
    var state = normalizeState(data && data.timerState);
    if (state === 'idle') return 0;
    if (state === 'break-ready') return 100;
    if (!data || typeof data.remainingSeconds !== 'number' || typeof data.totalSeconds !== 'number') return 0;
    if (!Number.isFinite(data.remainingSeconds) || !Number.isFinite(data.totalSeconds) || data.totalSeconds <= 0) return 0;
    return clamp((1 - data.remainingSeconds / data.totalSeconds) * 100, 0, 100);
  }

  function setFill(percent) {
    fillEl.style.height = percent.toFixed(1) + '%';
    bottle.style.setProperty('--fill', percent.toFixed(1) + '%');
  }

  function setBottleState(state) {
    state = normalizeState(state);
    bottle.className = 'bottle ' + state;
    dot.className = 'status-dot ' + state;
  }

  function updateFromMain(data) {
    if (!data) return;
    if (typeof data.remainingSeconds === 'number' && Number.isFinite(data.remainingSeconds)) {
      timeEl.textContent = formatTime(data.remainingSeconds);
    }
    if (typeof data.timerState === 'string') {
      var state = normalizeState(data.timerState);
      setBottleState(state);
      var labels = {
        running: '工作中',
        break: '休息中',
        paused: '已暂停',
        'break-paused': '休息暂停',
        snoozed: '已推迟',
        'break-ready': '等待休息',
        idle: '准备',
      };
      labelEl.textContent = labels[state] || '准备';
    }
    setFill(getProgress(data));
  }

  window.electronAPI.onFloatingUpdate(updateFromMain);

  bottle.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved = false;
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    window.electronAPI.floatingStartDrag(e.screenX, e.screenY);
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    if (Math.abs(e.screenX - dragStartScreenX) > 3 || Math.abs(e.screenY - dragStartScreenY) > 3) {
      hasMoved = true;
      window.electronAPI.floatingDragMove(e.screenX, e.screenY);
    }
  });

  document.addEventListener('mouseup', function () {
    isDragging = false;
  });

  bottle.addEventListener('click', function () {
    if (hasMoved) return;
    window.electronAPI.floatingRestore();
  });

  bottle.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    window.electronAPI.floatingShowMenu();
  });

  window.electronAPI.floatingReady();
})();
