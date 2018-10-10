(function(exports) {
  "use strict";
  let { gnf, update, map } = icky;
  const qs = (selector, el) =>
    el ? el.querySelector(selector) : document.querySelector(selector);

  const on = (...args) => {
    const callback = args.pop();
    args.forEach(topic =>
      PubSub.subscribe(topic, (msg, payload) => {
        callback(msg, payload);
      })
    );
  };

  const toggleAll = qs("input.toggle-all");

  const KEY = {
    ENTER: 13,
    ESCAPE: 27
  };
  const TOPIC = {
    ITEMS_LOADED: "todos/itemsLoaded",
    ITEM_CHANGED: "todos/itemChanged",
    ITEM_STATUS_CHANGED: "todos/itemStatusChanged",
    ITEM_REMOVED: "todos/itemRemoved",
    ITEM_ADDED: "todos/itemAdded",
    VISIBILITY_CHANGED: "todos/visibilityChanged",
    BULK_STATUS_CHANGE: "todos/bulkStatusChange"
  };
  const VISIBILITY = {
    ALL: "All",
    ACTIVE: "Active",
    COMPLETED: "Completed"
  };

  // ------------------------------------------------------------------------
  // Model
  // ------------------------------------------------------------------------
  function Model(name = "todos") {
    const visible = item => {
      switch (visibility) {
        case VISIBILITY.ALL:
          return true;
        case VISIBILITY.COMPLETED:
          return item.done;
        case VISIBILITY.ACTIVE:
          return !item.done;
      }
    };
    let { todos, visibility } = JSON.parse(localStorage.getItem(name)) || {
      todos: [],
      visibility: VISIBILITY.ALL
    };
    setTimeout(() => PubSub.publish(TOPIC.ITEMS_LOADED), 1);

    const save = () => {
      localStorage.setItem(name, JSON.stringify({ todos, visibility }));
    };

    return {
      toggle: todo => {
        if (todo.constructor == Array) {
          todo.map(item => (item.done = !item.done));
          save();
          PubSub.publish(TOPIC.BULK_STATUS_CHANGE, todo);
        } else {
          const old = { ...todo };
          todo.done = !todo.done;
          save();
          PubSub.publish(TOPIC.ITEM_STATUS_CHANGED, { o: old, n: todo });
        }
      },
      setText: (todo, text) => {
        const old = { ...todo };
        todo.text = text;
        save();
        PubSub.publish(TOPIC.ITEM_CHANGED, { o: old, n: todo });
      },
      add: todo => {
        let result = todos.push(todo);
        save();
        PubSub.publish(TOPIC.ITEM_ADDED, result);
      },
      remove: todo => {
        todos.splice(todos.indexOf(todo), 1);
        save();
        PubSub.publish(TOPIC.ITEM_REMOVED, todo);
      },
      visibility: v => {
        if (v) {
          visibility = v;
          save();
          PubSub.publish(TOPIC.VISIBILITY_CHANGED);
        } else {
          return visibility;
        }
      },
      visible: () => todos.filter(visible),
      remaining: () => todos.filter(item => !item.done),
      completed: () => todos.filter(item => item.done),
      all: () => [...todos]
    };
  }

  let model = null;

  // ------------------------------------------------------------------------
  // TEMPLATES
  // ------------------------------------------------------------------------

  // Todo List
  const tTodoList = () => {
    // todo list can potentially create a lot of DOM elements
    // each with many event handlers.
    let namer = gnf("tTodoList");
    return map(model.visible(), item => tTodoItem(namer, item));
  };
  on(
    TOPIC.ITEMS_LOADED,
    TOPIC.BULK_STATUS_CHANGE,
    TOPIC.ITEM_STATUS_CHANGED,
    TOPIC.ITEM_REMOVED,
    TOPIC.ITEM_ADDED,
    TOPIC.VISIBILITY_CHANGED,
    () => update("ul.todo-list", tTodoList)
  );

  // Todo Item
  function tTodoItem(nf, todo) {
    let label, input, listItem;
    let isCanceled = false;
    const doneOnEnter = nf(input => {
      if (event.keyCode == KEY.ENTER) input.blur();
    });
    const cancelOnEsc = nf(input => {
      if (event.keyCode == KEY.ESCAPE) {
        isCanceled = true;
        input.blur();
      }
    });
    const maybeSave = nf(input => {
      listItem.classList.remove("editing");
      if (isCanceled) return;
      var value = input.value.trim();
      if (value.length) {
        model.setText(todo, value);
        label.innerText = value;
      } else {
        model.remove(todo);
      }
    });
    const edit = nf(pLabel => {
      label = pLabel;
      listItem = label.parentElement.parentElement;
      listItem.classList.add("editing");
      input = qs("input.edit", listItem);
      input.focus();
    });

    return `
    <li class="${todo.done ? "completed" : ""}">
      <div class="view">
        <input class="toggle" type="checkbox" ${todo.done ? "checked" : ""} 
               onchange="${nf(() => model.toggle(todo))}()" />

        <label ondblclick="${edit}(this)">${todo.text}</label>

        <button class="destroy"
                onclick="${nf(() => model.remove(todo))}()"></button>
      </div>
      <input class="edit"
             onblur="${maybeSave}(this)"
             onkeypress="${doneOnEnter}(this)" 
             onkeyup="${cancelOnEsc}(this)"
             value="${todo.text}"/>
    </li>`;
  }

  // Items remaining
  const tItemsLeft = () => `${model.remaining().length} Items Left`;
  on(
    TOPIC.ITEMS_LOADED,
    TOPIC.BULK_STATUS_CHANGE,
    TOPIC.ITEM_STATUS_CHANGED,
    TOPIC.ITEM_REMOVED,
    TOPIC.ITEM_ADDED,
    () => update(".todo-count", tItemsLeft)
  );

  const tClearCompleted = () => {
    var completed = model.completed();
    if (completed.length > 0) {
      let onClick = gnf(() => {
        completed.forEach(model.remove);
      });
      return `
      <button class="clear-completed" 
              onclick="${onClick}()">Clear completed</a>`;
    } else {
      return ``;
    }
  };
  on(
    TOPIC.ITEMS_LOADED,
    TOPIC.BULK_STATUS_CHANGE,
    TOPIC.ITEM_STATUS_CHANGED,
    TOPIC.ITEM_REMOVED,
    () => update("#clearCompleted", tClearCompleted)
  );

  // Filter links
  const tFilterList = () => `
    ${tFilterItem("#/", VISIBILITY.ALL)}
    ${tFilterItem("#/active", VISIBILITY.ACTIVE)}
    ${tFilterItem("#/completed", VISIBILITY.COMPLETED)}
  `;
  // Filter link
  const tFilterItem = (href, type) => `
  <li>
    <a href="${href}" 
       class="${model.visibility() == type ? "selected" : ""}" 
       onclick="${onVisibilityChange}('${type}')">${type}</a>
  </li>`;

  on(TOPIC.ITEMS_LOADED, TOPIC.VISIBILITY_CHANGED, () => {
    update("ul.filters", tFilterList);
  });

  // ------------------------------------------------------------------------
  // Initialise App
  // ------------------------------------------------------------------------

  model = new Model();
  const onVisibilityChange = gnf(model.visibility);
  // Handle new ToDo addition
  qs("input.new-todo").onchange = function() {
    let text = this.value;
    if (text.trim().length == 0) {
      return;
    }
    model.add({ text: text, done: false });
    this.value = "";
  };

  toggleAll.onchange = function() {
    if (this.checked) {
      model.toggle(model.remaining());
    } else {
      model.toggle(model.completed());
    }
  };
  on(
    TOPIC.ITEMS_LOADED,
    TOPIC.ITEM_STATUS_CHANGED,
    TOPIC.ITEM_REMOVED,
    TOPIC.ITEM_ADDED,
    () => {
      toggleAll.checked =
        model.all().length > 0 && model.remaining().length == 0;
    }
  );

  const routes = {
    active: () => model.visibility("Active"),
    completed: () => model.visibility("Completed")
  };
  let param = location.hash.split("/")[1];
  let action = routes[param];
  if (action) {
    action();
  }
})(window);
