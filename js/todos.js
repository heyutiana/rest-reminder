window.RestReminder.todos = (function () {
  var ns = window.RestReminder;
  var s = ns.state;
  var storage = ns.storage;

  function $ (sel) { return document.querySelector(sel); }

  function ensureTodosArray() {
    if (!Array.isArray(s.todos)) s.todos = [];
    for (var i = 0; i < s.todos.length; i++) normalizeTodo(s.todos[i]);
  }

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function normalizeTodo(todo) {
    if (!todo || typeof todo !== 'object') return;
    if (!todo.id) todo.id = createId();
    if (typeof todo.text !== 'string') todo.text = String(todo.text || '');
    if (!Number.isFinite(todo.focusCycles)) todo.focusCycles = 0;
    if (!Number.isFinite(todo.createdAt)) todo.createdAt = Date.now();
    if (todo.children && !Array.isArray(todo.children)) todo.children = [];
    if (Array.isArray(todo.children)) {
      for (var i = 0; i < todo.children.length; i++) normalizeTodo(todo.children[i]);
      todo.done = todo.children.length > 0 ? todo.children.every(isTodoDone) : !!todo.done;
      if (typeof todo.expanded !== 'boolean') todo.expanded = true;
    } else {
      todo.done = !!todo.done;
    }
  }

  function getChildren(todo) {
    return Array.isArray(todo && todo.children) ? todo.children : [];
  }

  function hasChildren(todo) {
    return getChildren(todo).length > 0;
  }

  function isTodoDone(todo) {
    if (!todo) return false;
    var children = getChildren(todo);
    return children.length > 0 ? children.every(isTodoDone) : !!todo.done;
  }

  function getFocusCycles(todo) {
    if (!todo) return 0;
    var total = Number(todo.focusCycles) || 0;
    var children = getChildren(todo);
    for (var i = 0; i < children.length; i++) total += getFocusCycles(children[i]);
    return total;
  }

  function countExecutableTodos() {
    var total = 0;
    var done = 0;
    forEachExecutable(function (todo) {
      total++;
      if (isTodoDone(todo)) done++;
    });
    return { total: total, done: done };
  }

  function forEachExecutable(callback) {
    ensureTodosArray();
    for (var i = 0; i < s.todos.length; i++) {
      var todo = s.todos[i];
      var children = getChildren(todo);
      if (children.length === 0) {
        callback(todo, null);
      } else {
        for (var j = 0; j < children.length; j++) callback(children[j], todo);
      }
    }
  }

  function findTodo(id) {
    ensureTodosArray();
    for (var i = 0; i < s.todos.length; i++) {
      var todo = s.todos[i];
      if (todo.id === id) return { todo: todo, parent: null, list: s.todos, index: i };
      var children = getChildren(todo);
      for (var j = 0; j < children.length; j++) {
        if (children[j].id === id) return { todo: children[j], parent: todo, list: children, index: j };
      }
    }
    return null;
  }

  function currentTodoIsDoneOrMissing() {
    if (!s.currentTodoId) return false;
    var found = findTodo(s.currentTodoId);
    return !found || isTodoDone(found.todo);
  }

  function updateParentDone(parent) {
    if (parent && hasChildren(parent)) parent.done = parent.children.every(isTodoDone);
  }

  function getTodoPath(found) {
    if (!found) return '';
    return found.parent ? found.parent.text + ' / ' + found.todo.text : found.todo.text;
  }

  function remapTaskFocusPrefix(oldPrefix, newPrefix) {
    if (!s.stats.taskFocus || typeof s.stats.taskFocus !== 'object') return;
    Object.keys(s.stats.taskFocus).forEach(function (key) {
      if (key !== oldPrefix && key.indexOf(oldPrefix + ' / ') !== 0) return;
      var newKey = newPrefix + key.slice(oldPrefix.length);
      s.stats.taskFocus[newKey] = (s.stats.taskFocus[newKey] || 0) + s.stats.taskFocus[key];
      delete s.stats.taskFocus[key];
    });
  }

  function focusTodoInput() {
    var input = $('#todo-input');
    if (!input) return;
    input.disabled = false;
    input.value = '';
    input.focus();
  }

  function showPrompt(label, defaultValue, callback) {
    var existing = $('#todo-prompt-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'todo-prompt-overlay';

    var box = document.createElement('div');
    box.className = 'todo-prompt-box';

    var title = document.createElement('div');
    title.className = 'todo-prompt-title';
    title.textContent = label;

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-prompt-input';
    input.value = defaultValue || '';
    input.maxLength = 80;

    var actions = document.createElement('div');
    actions.className = 'todo-prompt-actions';

    var btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-ghost';
    btnCancel.textContent = '取消';

    var btnOk = document.createElement('button');
    btnOk.className = 'btn btn-primary';
    btnOk.textContent = '确定';

    function done(value) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (callback) callback(value);
    }

    btnCancel.addEventListener('click', function () { done(null); });
    btnOk.addEventListener('click', function () { done(input.value.trim()); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); done(input.value.trim()); }
      if (e.key === 'Escape') { e.preventDefault(); done(null); }
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) done(null);
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);
    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  }

  function showConfirm(label, confirmText, callback) {
    var existing = $('#todo-prompt-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'todo-prompt-overlay';

    var box = document.createElement('div');
    box.className = 'todo-prompt-box';

    var title = document.createElement('div');
    title.className = 'todo-prompt-title';
    title.textContent = label;

    var actions = document.createElement('div');
    actions.className = 'todo-prompt-actions';

    var btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-ghost';
    btnCancel.textContent = '取消';

    var btnOk = document.createElement('button');
    btnOk.className = 'btn btn-danger';
    btnOk.textContent = confirmText || '确定';

    function done(confirmed) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (callback) callback(confirmed);
    }

    btnCancel.addEventListener('click', function () { done(false); });
    btnOk.addEventListener('click', function () { done(true); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) done(false);
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { e.preventDefault(); done(false); document.removeEventListener('keydown', esc); }
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);
    box.appendChild(title);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    btnOk.focus();
  }

  function removePrompt() {
    var existing = $('#todo-prompt-overlay');
    if (existing) existing.remove();
  }

  function editTodoText(id, newText) {
    ns.checkDayReset();
    ensureTodosArray();
    newText = String(newText || '').trim();
    if (!newText) return false;
    var found = findTodo(id);
    if (!found) return false;
    var oldPath = getTodoPath(found);
    var oldText = found.todo.text;
    found.todo.text = newText;
    if (s.currentTodoId === id) {
      // keep current task pointer
    }
    if (hasChildren(found.todo) && oldText !== newText) {
      remapTaskFocusPrefix(oldText, newText);
      storage.saveStats();
    }
    if (s.stats.taskFocus && typeof s.stats.taskFocus === 'object' && s.stats.taskFocus[oldPath]) {
      var newPath = found.parent ? found.parent.text + ' / ' + newText : newText;
      s.stats.taskFocus[newPath] = (s.stats.taskFocus[newPath] || 0) + s.stats.taskFocus[oldPath];
      delete s.stats.taskFocus[oldPath];
      storage.saveStats();
    }
    storage.saveTodos();
    renderTodos();
    updateCurrentTodoDisplay();
    return true;
  }

  function addChildTodo(parentId, text) {
    ns.checkDayReset();
    ensureTodosArray();
    text = String(text || '').trim();
    if (!text) return false;
    var found = findTodo(parentId);
    if (!found) return false;
    if (!Array.isArray(found.todo.children)) {
      found.todo.children = [];
      found.todo.expanded = true;
    }
    found.todo.children.push({
      id: createId(),
      text: text,
      done: false,
      focusCycles: 0,
      createdAt: Date.now(),
    });
    found.todo.done = false;
    found.todo.expanded = true;
    storage.saveTodos();
    renderTodos();
    updateCurrentTodoDisplay();
    return true;
  }

  function addTodo(text) {
    ns.checkDayReset();
    ensureTodosArray();
    text = String(text || '').trim();
    if (!text) return;
    s.todos.push({
      id: createId(),
      text: text,
      done: false,
      focusCycles: 0,
      createdAt: Date.now(),
    });
    storage.saveTodos();
    renderTodos();
    updateCurrentTodoDisplay();
  }

  function addProject(title, tasks) {
    ns.checkDayReset();
    ensureTodosArray();
    title = String(title || '').trim();
    if (!title) return;
    var children = Array.isArray(tasks) ? tasks.map(function (task) {
      return {
        id: createId(),
        text: String((task && task.title) || task || '').trim(),
        done: false,
        focusCycles: 0,
        estimatePomodoros: Number.isFinite(task && task.estimatePomodoros) ? task.estimatePomodoros : 1,
        priority: task && task.priority ? task.priority : 'medium',
        aiGenerated: !!(task && task.aiGenerated),
        createdAt: Date.now(),
      };
    }).filter(function (task) { return task.text; }) : [];
    s.todos.push({
      id: createId(),
      text: title,
      done: children.length === 0 ? false : children.every(isTodoDone),
      focusCycles: 0,
      expanded: true,
      aiGenerated: children.some(function (task) { return task.aiGenerated; }),
      children: children,
      createdAt: Date.now(),
    });
    storage.saveTodos();
    renderTodos();
    updateCurrentTodoDisplay();
  }

  function toggleTodo(id) {
    ensureTodosArray();
    var found = findTodo(id);
    if (!found) return;
    var todo = found.todo;
    if (hasChildren(todo)) {
      var targetDone = !isTodoDone(todo);
      getChildren(todo).forEach(function (child) { child.done = targetDone; });
      todo.done = targetDone;
    } else {
      todo.done = !todo.done;
      updateParentDone(found.parent);
    }
    if (currentTodoIsDoneOrMissing()) {
      s.currentTodoId = null;
    }
    storage.saveTodos();
    renderTodos();
    updateCurrentTodoDisplay();
  }

  function deleteTodo(id) {
    ensureTodosArray();
    var found = findTodo(id);
    if (!found) return;
    if (hasChildren(found.todo)) {
      showConfirm('确定要删除父任务“' + found.todo.text + '”及其 ' + getChildren(found.todo).length + ' 个子任务吗？', '删除', function (confirmed) {
        if (!confirmed) return;
        doDeleteTodo(id);
      });
    } else {
      doDeleteTodo(id);
    }
  }

  function doDeleteTodo(id) {
    ensureTodosArray();
    var found = findTodo(id);
    if (!found) return;
    found.list.splice(found.index, 1);
    updateParentDone(found.parent);
    if (currentTodoIsDoneOrMissing()) s.currentTodoId = null;
    storage.saveTodos();
    renderTodos();
    updateCurrentTodoDisplay();
  }

  function setCurrentTodo(id) {
    ensureTodosArray();
    var found = findTodo(id);
    var todo = found && found.todo;
    if (!todo || isTodoDone(todo) || hasChildren(todo)) return;
    s.currentTodoId = id;
    storage.saveTodos();
    renderTodos();
    updateCurrentTodoDisplay();
  }

  function clearDoneTodos() {
    ensureTodosArray();
    s.todos = s.todos.map(function (todo) {
      if (!hasChildren(todo)) return isTodoDone(todo) ? null : todo;
      todo.children = todo.children.filter(function (child) { return !isTodoDone(child); });
      todo.done = false;
      return todo.children.length === 0 ? null : todo;
    }).filter(Boolean);
    if (currentTodoIsDoneOrMissing()) s.currentTodoId = null;
    storage.saveTodos();
    renderTodos();
    updateCurrentTodoDisplay();
    focusTodoInput();
  }

  function clearAllTodos() {
    showConfirm('确定要清空所有 Todo 吗？', '清空全部', function (confirmed) {
      if (!confirmed) return;
      s.todos = [];
      s.currentTodoId = null;
      storage.saveTodos();
      renderTodos();
      updateCurrentTodoDisplay();
      focusTodoInput();
    });
  }

  function incrementCurrentTodoFocus() {
    if (!s.currentTodoId) return;
    var found = findTodo(s.currentTodoId);
    var todo = found && found.todo;
    if (!todo || isTodoDone(todo) || hasChildren(todo)) return;
    todo.focusCycles++;
    if (!s.stats.taskFocus || typeof s.stats.taskFocus !== 'object') s.stats.taskFocus = {};
    var key = getTodoPath(found);
    s.stats.taskFocus[key] = (s.stats.taskFocus[key] || 0) + 1;
    storage.saveTodos();
    renderTodos();
  }

  function getCurrentTodoText() {
    if (!s.currentTodoId) return null;
    var found = findTodo(s.currentTodoId);
    if (!found || isTodoDone(found.todo)) return null;
    return getTodoPath(found);
  }

  function getTodosForContext() {
    ensureTodosArray();
    return s.todos.map(function (todo) {
      return {
        text: todo.text,
        done: isTodoDone(todo),
        focusCycles: getFocusCycles(todo),
        children: getChildren(todo).map(function (child) {
          return {
            text: child.text,
            done: isTodoDone(child),
            focusCycles: child.focusCycles || 0,
            estimatePomodoros: child.estimatePomodoros || 1,
            priority: child.priority || 'medium',
          };
        }),
      };
    }).slice(0, 30);
  }

  function renderCheckIcon(done) {
    return done ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="2 6 5 9 10 3"/></svg>' : '';
  }

  function renderTodoItem(todo, parent) {
    var done = isTodoDone(todo);
    var children = getChildren(todo);
    var item = document.createElement('div');
    item.className = 'todo-item ' + (parent ? 'todo-child' : 'todo-parent');
    if (children.length === 0 && !parent) item.classList.add('todo-single');
    if (done) item.classList.add('done');
    if (todo.id === s.currentTodoId) item.classList.add('current');

    if (children.length > 0) {
      var expand = document.createElement('button');
      expand.className = 'todo-btn todo-expand';
      expand.title = todo.expanded === false ? '展开' : '折叠';
      expand.textContent = todo.expanded === false ? '▸' : '▾';
      expand.addEventListener('click', function () {
        todo.expanded = todo.expanded === false;
        storage.saveTodos();
        renderTodos();
      });
      item.appendChild(expand);
    } else if (parent) {
      var spacer = document.createElement('span');
      spacer.className = 'todo-child-spacer';
      item.appendChild(spacer);
    }

    var checkbox = document.createElement('button');
    checkbox.className = 'todo-checkbox';
    checkbox.innerHTML = renderCheckIcon(done);
    checkbox.addEventListener('click', function () { toggleTodo(todo.id); });

    var text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    text.title = parent ? parent.text + ' / ' + todo.text : todo.text;

    var cycles = document.createElement('span');
    cycles.className = 'todo-cycles';
    var cycleCount = getFocusCycles(todo);
    if (children.length > 0) {
      var childDone = children.filter(isTodoDone).length;
      cycles.textContent = childDone + '/' + children.length + (cycleCount > 0 ? ' · ' + cycleCount + ' 次' : '');
    } else {
      cycles.textContent = cycleCount > 0 ? cycleCount + ' 次' : '';
      if (cycleCount === 0) cycles.style.display = 'none';
    }

    if (parent && todo.priority && ['high', 'medium', 'low'].includes(todo.priority)) {
      var prio = document.createElement('span');
      prio.className = 'todo-priority ' + todo.priority;
      prio.textContent = { high: '高', medium: '中', low: '低' }[todo.priority];
      item.appendChild(prio);
    }

    var btnCurrent = document.createElement('button');
    btnCurrent.className = 'todo-btn btn-todo-current';
    btnCurrent.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>';
    btnCurrent.title = children.length > 0 ? '请选择子任务开始专注' : '设为当前任务';
    btnCurrent.style.display = (done || todo.id === s.currentTodoId || children.length > 0) ? 'none' : 'flex';
    btnCurrent.addEventListener('click', function () { setCurrentTodo(todo.id); });

    var btnEdit = document.createElement('button');
    btnEdit.className = 'todo-btn btn-todo-edit';
    btnEdit.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 10.5h1.5L10 4l-1.5-1.5L2 9V10.5z"/><path d="M8.5 2.5l1.5 1.5"/></svg>';
    btnEdit.title = '编辑';
    (function (tid) { btnEdit.addEventListener('click', function () {
      var current = findTodo(tid);
      if (!current) return;
      var label = hasChildren(current.todo) ? '修改父任务标题' : '修改任务标题';
      showPrompt(label, current.todo.text, function (val) {
        if (val !== null && val !== '') editTodoText(tid, val);
        removePrompt();
      });
    }); })(todo.id);

    var btnDelete = document.createElement('button');
    btnDelete.className = 'todo-btn btn-todo-delete';
    btnDelete.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>';
    btnDelete.title = '删除';
    btnDelete.addEventListener('click', function () { deleteTodo(todo.id); });

    item.appendChild(checkbox);
    item.appendChild(text);
    item.appendChild(cycles);
    item.appendChild(btnCurrent);
    item.appendChild(btnEdit);
    item.appendChild(btnDelete);
    return item;
  }

  function renderTodos() {
    ensureTodosArray();
    var list = $('#todo-list');
    var counts = countExecutableTodos();
    $('#todo-progress').textContent = counts.done + ' / ' + counts.total;

    if (counts.total === 0) {
      list.innerHTML = '<div class="todo-empty">还没有 Todo，添加一个吧</div>';
      if (ns.stats && ns.stats.renderStatsPage) ns.stats.renderStatsPage();
      return;
    }

    list.innerHTML = '';
    var sorted = s.todos.slice().sort(function (a, b) {
      var aDone = isTodoDone(a);
      var bDone = isTodoDone(b);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.createdAt - b.createdAt;
    });

    for (var i = 0; i < sorted.length; i++) {
      var todo = sorted[i];
      list.appendChild(renderTodoItem(todo, null));
      if (hasChildren(todo) && todo.expanded !== false) {
        var children = todo.children.slice().sort(function (a, b) {
          if (isTodoDone(a) !== isTodoDone(b)) return isTodoDone(a) ? 1 : -1;
          return a.createdAt - b.createdAt;
        });
        for (var j = 0; j < children.length; j++) list.appendChild(renderTodoItem(children[j], todo));
      }
      if (!isTodoDone(todo)) {
        var addRow = document.createElement('div');
        addRow.className = 'todo-item todo-add-child';
        if (!hasChildren(todo)) addRow.classList.add('todo-add-child-flat');
        var addBtn = document.createElement('button');
        addBtn.className = 'btn btn-ghost btn-add-child';
        addBtn.textContent = hasChildren(todo) ? '+ 添加子任务' : '+ 添加子任务';
        (function (tid) { addBtn.addEventListener('click', function () {
          showPrompt('添加子任务', '', function (val) {
            if (val !== null && val !== '') addChildTodo(tid, val);
            removePrompt();
          });
        }); })(todo.id);
        addRow.appendChild(addBtn);
        list.appendChild(addRow);
      }
    }
    if (ns.stats && ns.stats.renderStatsPage) ns.stats.renderStatsPage();
  }

  function updateCurrentTodoDisplay() {
    var nameEl = $('#current-task-name');
    var text = getCurrentTodoText();
    if (text) {
      nameEl.textContent = text;
      nameEl.classList.remove('empty');
    } else {
      nameEl.textContent = '未选择';
      nameEl.classList.add('empty');
    }
  }

  return {
    ensureTodosArray: ensureTodosArray,
    focusTodoInput: focusTodoInput,
    showPrompt: showPrompt,
    showConfirm: showConfirm,
    addTodo: addTodo,
    addProject: addProject,
    editTodoText: editTodoText,
    addChildTodo: addChildTodo,
    toggleTodo: toggleTodo,
    deleteTodo: deleteTodo,
    setCurrentTodo: setCurrentTodo,
    clearDoneTodos: clearDoneTodos,
    clearAllTodos: clearAllTodos,
    incrementCurrentTodoFocus: incrementCurrentTodoFocus,
    getCurrentTodoText: getCurrentTodoText,
    getTodosForContext: getTodosForContext,
    getFocusCycles: getFocusCycles,
    isTodoDone: isTodoDone,
    renderTodos: renderTodos,
    updateCurrentTodoDisplay: updateCurrentTodoDisplay,
  };
})();
