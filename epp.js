
window.onhashchange = ___.hashchange;

var todos = ['Hello', 'World'];

var todo = () => `
<nav>To-Do List</nav>
<div class="main">
  <ol>
    ${___(todos, todo => `
    <li>${todo}</li>
    `)}
  </ol>
</div>
`;

window.onload = () => ___.hashchange('#todo');
